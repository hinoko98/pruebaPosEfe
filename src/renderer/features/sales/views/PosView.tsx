/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useState } from "react";

import InvoicePanel from "@/features/sales/components/InvoicePanel";
import PaymentDialog, { type PaymentDialogSubmit } from "@/features/sales/components/PaymentDialog";
import ProductPricingDialog from "@/features/sales/components/ProductPricingDialog";
import ProductShelf from "@/features/sales/components/ProductShelf";
import SaleReceiptDialog, { type ReceiptPrintTemplate } from "@/features/sales/components/SaleReceiptDialog";
import SalesTabs from "@/features/sales/components/SalesTabs";
import SearchBar from "@/features/sales/components/SearchBar";
import HelpHint from "@/components/ui/HelpHint";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { hasPermission } from "@/features/auth/permissions";
import { APP_PERMISSION_KEYS } from "@/features/user/app-permissions";
import { alpha, useTheme } from "@mui/material/styles";

import type { CartItem, Payment, PaymentMethod, Product } from "../types";
import { resolveProductPricingQuote } from "../../../../shared/productPricing";

export type SaleTab = {
  id: string;
  label: string;
  cart: CartItem[];
  payments: Payment[];
  customer: string;
};

function newTab(number: number): SaleTab {
  return {
    id: crypto.randomUUID(),
    label: `Venta ${number}`,
    cart: [],
    payments: [{ method: "CASH", amount: 0 }],
    customer: "Consumidor final",
  };
}

export const fmt = (value: number) => "$" + Math.round(value).toLocaleString("es-CO");

const normalizeSearchValue = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function MenuToggleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function InvoiceCollapsedRail({
  onOpen,
  itemCount,
  isDark,
  colors,
}: {
  onOpen: () => void;
  itemCount: number;
  isDark: boolean;
  colors: {
    surface: string;
    border: string;
    muted: string;
    pillBg: string;
    pillText: string;
  };
}) {
  return (
    <aside
      style={{
        width: 58,
        minWidth: 58,
        flexShrink: 0,
        background: colors.surface,
        borderLeft: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "12px 10px",
      }}
    >
      <button
        onClick={onOpen}
        title="Mostrar factura"
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          background: colors.surface,
          color: colors.muted,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <MenuToggleIcon />
      </button>

      <div
        style={{
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: colors.muted,
          textTransform: "uppercase",
        }}
      >
        Factura
      </div>

      <div
        style={{
          minWidth: 30,
          minHeight: 30,
          borderRadius: 999,
          background: itemCount > 0 ? colors.pillBg : isDark ? alpha("#ffffff", 0.06) : "#f1f5f9",
          color: itemCount > 0 ? colors.pillText : colors.muted,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 800,
          padding: "0 8px",
        }}
      >
        {itemCount}
      </div>
    </aside>
  );
}

export default function PosView() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<
    Array<{ id: string; name: string; document?: string | null; phone?: string | null }>
  >([]);
  const [tabs, setTabs] = useState<SaleTab[]>([newTab(1)]);
  const [activeId, setActiveId] = useState<string>(() => tabs[0].id);
  const [invoiceVisible, setInvoiceVisible] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [pricingDialogProduct, setPricingDialogProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<NonNullable<Awaited<ReturnType<typeof window.api.getSaleDetail>>["sale"]> | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    let mounted = true;

    Promise.all([window.api.listProducts(), window.api.listCustomers()])
      .then(([rows, customersResponse]) => {
        if (!mounted) return;
        setProducts(
          [...rows].sort((a, b) => a.name.localeCompare(b.name, "es"))
        );
        if (customersResponse.success) {
          setCustomers(
            customersResponse.customers
              .filter((customer) => customer.isActive)
              .map((customer) => ({
                id: customer.id,
                name: customer.name,
                document: customer.document,
                phone: customer.phone,
              }))
          );
        }
      })
      .catch(() => {
        if (!mounted) return;
        setFeedback("No se pudieron cargar los productos o clientes desde la base de datos.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const currentPayments = activeTab.payments.length ? activeTab.payments : [{ method: "CASH" as PaymentMethod, amount: 0 }];
  const selectedCustomer =
    customers.find((customer) => customer.name === activeTab.customer) ?? null;
  const cartCount = activeTab.cart.reduce((sum, item) => sum + item.qty, 0);
  const canCreateSales = hasPermission(user, APP_PERMISSION_KEYS.salesCreate);
  const canChangeCustomer = hasPermission(user, APP_PERMISSION_KEYS.salesChangeCustomer);
  const canManagePayments = hasPermission(user, APP_PERMISSION_KEYS.salesManagePayments);
  const canPrintSales = hasPermission(user, APP_PERMISSION_KEYS.salesPrint);
  const canEditSaleItemPrices = hasPermission(user, APP_PERMISSION_KEYS.salesEditItemPrices);
  const canCheckout = canCreateSales && canManagePayments;

  const updateTab = (patch: Partial<SaleTab>) => {
    setTabs((prev) => prev.map((tab) => (tab.id === activeId ? { ...tab, ...patch } : tab)));
  };

  const resolveLinePricing = (
    product: Product,
    qty: number,
    pricingContext: { specialRuleId?: string | null; manualUnitPrice?: number | null }
  ) => {
    return resolveProductPricingQuote({
      fallbackPrice: product.price,
      pricingConfig: product.pricingConfig,
      qty,
      specialRuleId: pricingContext.specialRuleId ?? null,
      manualUnitPrice: pricingContext.manualUnitPrice ?? null,
      canOverrideMinimum: canEditSaleItemPrices,
    });
  };

  const recalculateConfiguredCart = (cart: CartItem[]) => {
    return cart.map((line) => {
      if (!line.pricingEnabled) {
        return line;
      }

      const product = products.find((entry) => entry.id === line.productId);
      if (!product) {
        return line;
      }

      const pricingResult = resolveLinePricing(product, line.qty, {
        specialRuleId: line.specialRuleId,
        manualUnitPrice: line.manualUnitPrice ?? null,
      });
      if (!pricingResult.ok) {
        setFeedback(pricingResult.message);
        return line;
      }

      return {
        ...line,
        name: product.name,
        price: pricingResult.quote.unitPrice,
        specialRuleId: pricingResult.quote.specialRuleId,
        specialRuleLabel: pricingResult.quote.specialRuleLabel,
        pricingSourceLabel: pricingResult.quote.sourceLabel,
        minimumPrice: pricingResult.quote.minimumPrice,
        manualUnitPrice: line.manualUnitPrice ?? null,
      };
    });
  };

  const addTab = () => {
    const nextTab = newTab(tabs.length + 1);
    setTabs((prev) => [...prev, nextTab]);
    setActiveId(nextTab.id);
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) return;

    setTabs((prev) => {
      const next = prev.filter((tab) => tab.id !== id);
      if (activeId === id) {
        setActiveId(next[next.length - 1].id);
      }
      return next;
    });
  };

  const addToCart = (product: Product, qty = 1) => {
    if (product.pricingConfig?.enabled) {
      setPricingDialogProduct(product);
      return;
    }

    const previousCart = activeTab.cart;
    const currentLine = previousCart.find((item) => item.productId === product.id);
    const maxStock = product.stock ?? Number.MAX_SAFE_INTEGER;
    const nextQty = Math.min((currentLine?.qty ?? 0) + qty, maxStock);

    const nextCart = currentLine
      ? previousCart.map((item) =>
          item.productId === product.id ? { ...item, qty: Math.max(1, nextQty) } : item
        )
      : [
          ...previousCart,
          {
            lineId: crypto.randomUUID(),
            productId: product.id,
            name: product.name,
            sku: product.sku,
            price: product.price,
            qty: Math.min(qty, maxStock),
            taxRate: product.taxRate ?? 0,
          },
        ];

    updateTab({ cart: nextCart });
  };

  const addConfiguredProductToCart = (payload: {
    product: Product;
    qty: number;
    specialRuleId?: string | null;
    manualUnitPrice?: number | null;
  }) => {
    const currentLine = activeTab.cart.find(
      (item) =>
        item.productId === payload.product.id &&
        (item.specialRuleId ?? null) === (payload.specialRuleId ?? null) &&
        (item.manualUnitPrice ?? null) === (payload.manualUnitPrice ?? null)
    );
    const mergedQty = (currentLine?.qty ?? 0) + payload.qty;
    const pricingResult = resolveLinePricing(payload.product, mergedQty, {
      specialRuleId: payload.specialRuleId ?? null,
      manualUnitPrice: payload.manualUnitPrice ?? null,
    });

    if (!pricingResult.ok) {
      setFeedback(pricingResult.message);
      return;
    }

    const nextCart = currentLine
      ? activeTab.cart.map((item) =>
          item.lineId === currentLine.lineId
            ? {
                ...item,
                qty: mergedQty,
                price: pricingResult.quote.unitPrice,
                name: payload.product.name,
                specialRuleId: pricingResult.quote.specialRuleId,
                specialRuleLabel: pricingResult.quote.specialRuleLabel,
                pricingSourceLabel: pricingResult.quote.sourceLabel,
                minimumPrice: pricingResult.quote.minimumPrice,
                manualUnitPrice: payload.manualUnitPrice ?? null,
              }
            : item
        )
      : [
          ...activeTab.cart,
          {
            lineId: crypto.randomUUID(),
            productId: payload.product.id,
            name: payload.product.name,
            sku: payload.product.sku,
            price: pricingResult.quote.unitPrice,
            qty: payload.qty,
            taxRate: payload.product.taxRate ?? 0,
            specialRuleId: pricingResult.quote.specialRuleId,
            specialRuleLabel: pricingResult.quote.specialRuleLabel,
            pricingSourceLabel: pricingResult.quote.sourceLabel,
            minimumPrice: pricingResult.quote.minimumPrice,
            pricingEnabled: true,
            manualUnitPrice: payload.manualUnitPrice ?? null,
          },
        ];

    updateTab({ cart: recalculateConfiguredCart(nextCart) });
    setPricingDialogProduct(null);
  };

  const updateQty = (lineId: string, qty: number) => {
    const line = activeTab.cart.find((item) => item.lineId === lineId);
    if (!line) return;

    const product = products.find((item) => item.id === line.productId);
    const maxStock = product?.stock ?? Number.MAX_SAFE_INTEGER;
    const nextQty = Math.max(1, qty || 1);

    if (line.pricingEnabled && product) {
      const pricingResult = resolveLinePricing(product, nextQty, {
        specialRuleId: line.specialRuleId,
        manualUnitPrice: line.manualUnitPrice ?? null,
      });
      if (!pricingResult.ok) {
        setFeedback(pricingResult.message);
        return;
      }

      updateTab({
        cart: activeTab.cart.map((item) =>
          item.lineId === lineId
            ? {
                ...item,
                name: product.name,
                qty: nextQty,
                price: pricingResult.quote.unitPrice,
                specialRuleId: pricingResult.quote.specialRuleId,
                specialRuleLabel: pricingResult.quote.specialRuleLabel,
                pricingSourceLabel: pricingResult.quote.sourceLabel,
                minimumPrice: pricingResult.quote.minimumPrice,
                manualUnitPrice: line.manualUnitPrice ?? null,
              }
            : item
        ),
      });
      return;
    }

    updateTab({
      cart: activeTab.cart.map((item) =>
        item.lineId === lineId
          ? { ...item, qty: Math.min(nextQty, maxStock) }
          : item
      ),
    });
  };

  const removeLine = (lineId: string) => {
    updateTab({ cart: activeTab.cart.filter((item) => item.lineId !== lineId) });
  };

  const handleScan = (barcode: string) => {
    const product = products.find((item) => item.barcode === barcode);
    if (product) {
      addToCart(product);
      setFeedback(null);
    } else {
      setFeedback(`No se encontro un producto con el codigo ${barcode}.`);
    }
  };

  const totals = useMemo(() => {
    const subtotal = activeTab.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const tax = activeTab.cart.reduce(
      (sum, item) => sum + item.price * item.qty * (item.taxRate ?? 0),
      0
    );
    const total = subtotal + tax;

    return {
      subtotal: Math.round(subtotal),
      tax: Math.round(tax),
      total: Math.round(total),
    };
  }, [activeTab.cart]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchQuery);

    if (!normalizedQuery) {
      return products;
    }

    return products.filter((product) => {
      const normalizedName = normalizeSearchValue(product.name);
      const normalizedSku = normalizeSearchValue(product.sku);

      return normalizedName.startsWith(normalizedQuery) || normalizedSku.startsWith(normalizedQuery);
    });
  }, [products, searchQuery]);

  const finalize = async ({ payments: paymentsPlan, registerDebt, dueDate, debtAmount }: PaymentDialogSubmit) => {
    if (activeTab.cart.length === 0) return;
    if (registerDebt && !selectedCustomer) {
      setFeedback("Selecciona un cliente registrado para enviar saldo a cuenta por cobrar.");
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const paymentMethod = paymentsPlan[0]?.method ?? "CASH";
      const amountPaid = paymentsPlan.reduce((sum, payment) => sum + payment.amount, 0);
      const response = await window.api.createSale({
        customer: activeTab.customer || "Consumidor final",
        customerId: selectedCustomer?.id ?? null,
        paymentMethod,
        amountPaid,
        payments: paymentsPlan,
        items: activeTab.cart.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          pricingContext:
            item.pricingEnabled
              ? {
                  specialRuleId: item.specialRuleId ?? null,
                  manualUnitPrice: item.manualUnitPrice ?? null,
                }
              : undefined,
        })),
        clientTotal: totals.total,
        allowDebt: registerDebt,
      });

      if (!response.success) {
        setFeedback(response.message);
        return;
      }

      const detail = await window.api.getSaleDetail(response.saleId);
      if (detail.success && detail.sale) {
        setCompletedSale(detail.sale);
      }

      let accountingMessage = "";
      if (registerDebt && selectedCustomer && debtAmount > 0) {
        const creditResponse = await window.api.createAccountingCredit({
          saleId: response.saleId,
          customerId: selectedCustomer.id,
          total: debtAmount,
          dueDate: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
        });

        if (!creditResponse.success) {
          accountingMessage = " La venta quedo registrada, pero el saldo no pudo enviarse a cartera.";
        } else {
          accountingMessage = ` Saldo enviado a cartera por ${fmt(debtAmount)}.`;
        }
      }

      setPaymentDialogOpen(false);
      setFeedback(
        registerDebt
          ? `Venta ${response.invoiceNumber} registrada por ${fmt(response.total)}.${accountingMessage}`
          : paymentsPlan.length > 1
          ? `Venta ${response.invoiceNumber} registrada por ${fmt(response.total)}. Pago combinado${response.changeAmount > 0 ? `. Vueltas: ${fmt(response.changeAmount)}.` : "."}`
          : paymentMethod === "CASH"
            ? `Venta ${response.invoiceNumber} registrada por ${fmt(response.total)}. Vueltas: ${fmt(response.changeAmount)}.`
            : `Venta ${response.invoiceNumber} registrada por ${fmt(response.total)}.`
      );
      updateTab({
        cart: [],
        payments: [{ method: "CASH", amount: 0 }],
        customer: "Consumidor final",
      });

      const refreshedProducts = await window.api.listProducts();
      setProducts([...refreshedProducts].sort((a, b) => a.name.localeCompare(b.name, "es")));
    } finally {
      setSaving(false);
    }
  };

  const handlePrintCompletedSale = async (template: ReceiptPrintTemplate) => {
    if (!completedSale) return;
    setPrinting(true);
    const response = await window.api.printSaleInvoice({ saleId: completedSale.id, template });
    setPrinting(false);
    if (!response.success) {
      setFeedback(response.message || "No se pudo imprimir la factura.");
      return;
    }
    setFeedback(`Factura ${completedSale.invoiceNumber} enviada a impresion.`);
  };

  const shellColors = useMemo(
    () => ({
      background: theme.palette.background.default,
      surface: theme.palette.background.paper,
      border: theme.palette.divider,
      text: theme.palette.text.primary,
      muted: theme.palette.text.secondary,
      feedbackBg: isDark ? alpha(theme.palette.primary.main, 0.14) : alpha(theme.palette.primary.main, 0.1),
      feedbackBorder: isDark ? alpha(theme.palette.primary.main, 0.24) : alpha(theme.palette.primary.main, 0.2),
      feedbackText: theme.palette.primary.main,
      pillBg: isDark ? alpha(theme.palette.primary.main, 0.18) : alpha(theme.palette.primary.main, 0.12),
      pillText: theme.palette.primary.main,
    }),
    [isDark, theme]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 120px)",
        minHeight: 0,
        background: shellColors.background,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 14px",
          background: shellColors.surface,
          borderBottom: `1px solid ${shellColors.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: 16, color: shellColors.text }}>Facturar</strong>
          <HelpHint title="Busca productos, arma la venta, define cliente y confirma el pago sin salir del flujo principal de caja." />
        </div>
      </div>

      <SalesTabs tabs={tabs} activeId={activeId} onSelect={setActiveId} onAdd={addTab} onClose={closeTab} />

      {feedback ? (
        <div
          style={{
            padding: "10px 14px",
            background: shellColors.feedbackBg,
            color: shellColors.feedbackText,
            borderBottom: `1px solid ${shellColors.feedbackBorder}`,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {feedback}
        </div>
      ) : null}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <SearchBar onScan={handleScan} onSearchChange={setSearchQuery} />

          <ProductShelf products={filteredProducts} onPick={addToCart} searchQuery={searchQuery} />
        </div>

        {invoiceVisible ? (
          <InvoicePanel
            cart={activeTab.cart}
            totals={totals}
            customer={activeTab.customer}
            customers={customers}
            onCustomerChange={(customer) => {
              if (!canChangeCustomer) return;
              updateTab({
                customer,
              });
            }}
            onCheckout={() => {
              if (activeTab.cart.length === 0 || !canCheckout) return;
              setPaymentDialogOpen(true);
            }}
            onCancel={() => {
              setPaymentDialogOpen(false);
              updateTab({
                cart: [],
                payments: [{ method: "CASH", amount: 0 }],
                customer: "Consumidor final",
              });
            }}
            onHide={() => setInvoiceVisible(false)}
            onQty={updateQty}
            onRemove={removeLine}
            saving={saving}
            canChangeCustomer={canChangeCustomer}
            canCheckout={canCheckout}
          />
        ) : (
          <InvoiceCollapsedRail
            onOpen={() => setInvoiceVisible(true)}
            itemCount={cartCount}
            isDark={isDark}
            colors={{
              surface: shellColors.surface,
              border: shellColors.border,
              muted: shellColors.muted,
              pillBg: shellColors.pillBg,
              pillText: shellColors.pillText,
            }}
          />
        )}
      </div>

      <PaymentDialog
        open={paymentDialogOpen}
        total={totals.total}
        saving={saving}
        initialPayments={currentPayments}
        customerName={selectedCustomer?.name ?? activeTab.customer}
        canRegisterDebt={Boolean(selectedCustomer)}
        onClose={() => setPaymentDialogOpen(false)}
        onConfirm={(payload) => finalize(payload)}
      />

      <ProductPricingDialog
        open={Boolean(pricingDialogProduct)}
        product={pricingDialogProduct}
        canEditManualPrice={canEditSaleItemPrices}
        onClose={() => setPricingDialogProduct(null)}
        onConfirm={(payload) => {
          if (!pricingDialogProduct) return;
          addConfiguredProductToCart({
            product: pricingDialogProduct,
            ...payload,
          });
        }}
      />

      <SaleReceiptDialog
        open={Boolean(completedSale)}
        sale={completedSale}
        onClose={() => setCompletedSale(null)}
        onPrint={(template) => void handlePrintCompletedSale(template)}
        printing={printing}
        canPrint={canPrintSales}
      />
    </div>
  );
}
