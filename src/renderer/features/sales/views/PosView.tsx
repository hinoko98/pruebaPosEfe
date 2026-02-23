import { useMemo, useState } from "react";
import type { CartItem, Product, Payment, PaymentMethod } from "../types";
import SalesTabs from "@/features/sales/components/SalesTabs";
import SearchBar from "@/features/sales/components/SearchBar";
import CartArea from "@/features/sales/components/CartArea";
import InvoicePanel from "@/features/sales/components/InvoicePanel";

// ─── Mock temporal (luego viene de IPC/DB) ────────────────────────────────────
export const mockProducts: Product[] = [
  { id: "p1", barcode: "7701234567890", name: "Galletas",       price: 2500, taxRate: 0.19 },
  { id: "p2", barcode: "7700000000001", name: "Coca-Cola 400ml",price: 3500, taxRate: 0.19 },
  { id: "p3", barcode: "7700000000002", name: "Arroz 1kg",      price: 5200, taxRate: 0    },
  { id: "p4", barcode: "7700000000003", name: "Leche Entera 1L",price: 4100, taxRate: 0    },
  { id: "p5", barcode: "7700000000004", name: "Pan Tajado",     price: 3800, taxRate: 0    },
];

// ─── Tipos internos ───────────────────────────────────────────────────────────
export type SaleTab = {
  id: string;
  label: string;
  cart: CartItem[];
  payments: Payment[];
  customer: string;
  priceList: string;
  numeration: string;
};

function newTab(n: number): SaleTab {
  return {
    id: crypto.randomUUID(),
    label: `Venta ${n}`,
    cart: [],
    payments: [{ method: "CASH", amount: 0 }],
    customer: "Consumidor final",
    priceList: "General",
    numeration: "Principal",
  };
}

export const fmt = (n: number) =>
  "$" + Math.round(n).toLocaleString("es-CO");

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PosView() {
  const [tabs, setTabs] = useState<SaleTab[]>([newTab(1)]);
  const [activeId, setActiveId] = useState<string>(tabs[0].id);

  // Tab activa
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  // Actualiza un campo de la tab activa
  const updateTab = (patch: Partial<SaleTab>) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === activeId ? { ...t, ...patch } : t))
    );
  };

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const addTab = () => {
    const t = newTab(tabs.length + 1);
    setTabs((prev) => [...prev, t]);
    setActiveId(t.id);
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) return; // al menos una
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (id === activeId) setActiveId(next[next.length - 1].id);
      return next;
    });
  };

  // ── Carrito ──────────────────
  const addToCart = (p: Product, qty = 1) => {
    const prev = activeTab.cart;
    const idx = prev.findIndex((i) => i.productId === p.id);
    let next: CartItem[];
    if (idx >= 0) {
      next = prev.map((i, j) =>
        j === idx ? { ...i, qty: i.qty + qty } : i
      );
    } else {
      next = [
        ...prev,
        {
          lineId: crypto.randomUUID(),
          productId: p.id,
          name: p.name,
          price: p.price,
          qty,
          taxRate: p.taxRate ?? 0,
        },
      ];
    }
    updateTab({ cart: next });
  };

  const updateQty = (lineId: string, qty: number) => {
    updateTab({
      cart: activeTab.cart.map((i) =>
        i.lineId === lineId ? { ...i, qty: Math.max(1, qty) } : i
      ),
    });
  };

  const removeLine = (lineId: string) => {
    updateTab({ cart: activeTab.cart.filter((i) => i.lineId !== lineId) });
  };

  const handleScan = (barcode: string) => {
    const p = mockProducts.find((x) => x.barcode === barcode);
    if (p) addToCart(p);
  };

  // ── Totales ───────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const cart = activeTab.cart;
    const subtotal = cart.reduce((a, i) => a + i.price * i.qty, 0);
    const tax = cart.reduce((a, i) => a + i.price * i.qty * (i.taxRate ?? 0), 0);
    const total = subtotal + tax;
    return {
      subtotal: Math.round(subtotal),
      tax: Math.round(tax),
      total: Math.round(total),
    };
  }, [activeTab.cart]);

  // ── Finalizar venta ───────────────────────────────────────────────────────
  const finalize = () => {
    console.log("VENTA", { cart: activeTab.cart, payments: activeTab.payments, totals });
    updateTab({
      cart: [],
      payments: [{ method: "CASH", amount: 0 }],
    });
  };

  const p0 = activeTab.payments[0] ?? { method: "CASH" as PaymentMethod, amount: 0 };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#f1f5f9",
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        overflow: "hidden",
      }}
    >
      {/* ── Tabs de ventas múltiples ── */}
      <SalesTabs
        tabs={tabs}
        activeId={activeId}
        onSelect={setActiveId}
        onAdd={addTab}
        onClose={closeTab}
      />

      {/* ── Contenido principal (izquierda + derecha) ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Columna izquierda */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <SearchBar
            products={mockProducts}
            onPick={addToCart}
            onScan={handleScan}
          />
          <CartArea
            items={activeTab.cart}
            onQty={updateQty}
            onRemove={removeLine}
          />
        </div>

        {/* Panel derecho */}
        <InvoicePanel
          cart={activeTab.cart}
          totals={totals}
          paymentMethod={p0.method}
          onPaymentMethodChange={(m) =>
            updateTab({ payments: [{ ...p0, method: m }] })
          }
          customer={activeTab.customer}
          onCustomerChange={(c) => updateTab({ customer: c })}
          priceList={activeTab.priceList}
          onPriceListChange={(v) => updateTab({ priceList: v })}
          numeration={activeTab.numeration}
          onNumerationChange={(v) => updateTab({ numeration: v })}
          onFinalize={finalize}
          onCancel={() =>
            updateTab({ cart: [], payments: [{ method: "CASH", amount: 0 }] })
          }
        />
      </div>
    </div>
  );
}