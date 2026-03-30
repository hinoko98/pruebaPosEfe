import { useEffect, useMemo, useState } from "react";

import InvoicePanel from "@/features/sales/components/InvoicePanel";
import PaymentDialog from "@/features/sales/components/PaymentDialog";
import ProductShelf from "@/features/sales/components/ProductShelf";
import SaleReceiptDialog from "@/features/sales/components/SaleReceiptDialog";
import SalesTabs from "@/features/sales/components/SalesTabs";
import SearchBar from "@/features/sales/components/SearchBar";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { hasPermission } from "@/features/auth/permissions";
import { APP_PERMISSION_KEYS } from "@/features/user/app-permissions";

import type { CartItem, Payment, PaymentMethod, Product } from "../types";

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

function MenuToggleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export default function PosView() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; document?: string | null; phone?: string | null }>>([]);
  const [tabs, setTabs] = useState<SaleTab[]>([newTab(1)]);
  const [activeId, setActiveId] = useState<string>(() => tabs[0].id);
  const [invoiceVisible, setInvoiceVisible] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
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
  const canCreateSales = hasPermission(user, APP_PERMISSION_KEYS.salesCreate);
  const canChangeCustomer = hasPermission(user, APP_PERMISSION_KEYS.salesChangeCustomer);
  const canManagePayments = hasPermission(user, APP_PERMISSION_KEYS.salesManagePayments);
  const canPrintSales = hasPermission(user, APP_PERMISSION_KEYS.salesPrint);
  const canCheckout = canCreateSales && canManagePayments;

  const updateTab = (patch: Partial<SaleTab>) => {
    setTabs((prev) => prev.map((tab) => (tab.id === activeId ? { ...tab, ...patch } : tab)));
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
            price: product.price,
            qty: Math.min(qty, maxStock),
            taxRate: product.taxRate ?? 0,
          },
        ];

    updateTab({ cart: nextCart });
  };

  const updateQty = (lineId: string, qty: number) => {
    const line = activeTab.cart.find((item) => item.lineId === lineId);
    if (!line) return;

    const product = products.find((item) => item.id === line.productId);
    const maxStock = product?.stock ?? Number.MAX_SAFE_INTEGER;

    updateTab({
      cart: activeTab.cart.map((item) =>
        item.lineId === lineId
          ? { ...item, qty: Math.min(Math.max(1, qty || 1), maxStock) }
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

  const finalize = async (paymentsPlan: Payment[]) => {
    if (activeTab.cart.length === 0) return;

    setSaving(true);
    setFeedback(null);

    try {
      const paymentMethod = paymentsPlan[0]?.method ?? "CASH";
      const amountPaid = paymentsPlan.reduce((sum, payment) => sum + payment.amount, 0);
      const response = await window.api.createSale({
        customer: activeTab.customer || "Consumidor final",
        paymentMethod,
        amountPaid,
        payments: paymentsPlan,
        items: activeTab.cart.map((item) => ({
          productId: item.productId,
          qty: item.qty,
        })),
        clientTotal: totals.total,
      });

      if (!response.success) {
        setFeedback(response.message);
        return;
      }

      const detail = await window.api.getSaleDetail(response.saleId);
      if (detail.success && detail.sale) {
        setCompletedSale(detail.sale);
      }

      setPaymentDialogOpen(false);
      setFeedback(
        paymentsPlan.length > 1
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

  const handlePrintCompletedSale = async () => {
    if (!completedSale) return;
    setPrinting(true);
    const response = await window.api.printSaleInvoice(completedSale.id);
    setPrinting(false);
    if (!response.success) {
      setFeedback(response.message || "No se pudo imprimir la factura.");
      return;
    }
    setFeedback(`Factura ${completedSale.invoiceNumber} enviada a impresion.`);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 120px)",
        minHeight: 0,
        background: "#f1f5f9",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <SalesTabs tabs={tabs} activeId={activeId} onSelect={setActiveId} onAdd={addTab} onClose={closeTab} />

      {feedback ? (
        <div
          style={{
            padding: "10px 14px",
            background: "#eff6ff",
            color: "#1d4ed8",
            borderBottom: "1px solid #dbeafe",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {feedback}
        </div>
      ) : null}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <SearchBar products={products} onPick={addToCart} onScan={handleScan} />

          {!invoiceVisible ? (
            <div
              style={{
                padding: "10px 14px 0",
                background: "white",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <button
                onClick={() => setInvoiceVisible(true)}
                style={{
                  height: 36,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: "white",
                  color: "#0f172a",
                  fontFamily: "inherit",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                <MenuToggleIcon />
                Mostrar factura
              </button>
            </div>
          ) : null}

          <ProductShelf products={products} onPick={addToCart} />
        </div>

        {invoiceVisible ? (
          <InvoicePanel
            cart={activeTab.cart}
            totals={totals}
            customer={activeTab.customer}
            customers={customers}
            onCustomerChange={(customer) => {
              if (!canChangeCustomer) return;
              updateTab({ customer });
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
        ) : null}
      </div>

      <PaymentDialog
        open={paymentDialogOpen}
        total={totals.total}
        saving={saving}
        initialPayments={currentPayments}
        onClose={() => setPaymentDialogOpen(false)}
        onConfirm={(payments) => finalize(payments)}
      />

      <SaleReceiptDialog
        open={Boolean(completedSale)}
        sale={completedSale}
        onClose={() => setCompletedSale(null)}
        onPrint={() => void handlePrintCompletedSale()}
        printing={printing}
        canPrint={canPrintSales}
      />
    </div>
  );
}
