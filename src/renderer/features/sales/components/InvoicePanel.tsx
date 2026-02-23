// src/renderer/features/sales/components/InvoicePanel.tsx
import type { CartItem, PaymentMethod } from "../types";
import { fmt } from "../views/PosView";

const BoltIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);
const ChevronDown = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const UserPlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);
const BasketIcon = () => (
  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 01-8 0" />
  </svg>
);

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "#94a3b8",
        marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.06em"
      }}>
        {label}
      </div>
      <div style={{ position: "relative" }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%", height: 34, padding: "0 28px 0 9px",
            borderRadius: 8, border: "1.5px solid #e2e8f0",
            fontSize: 12, color: "#1e293b", background: "white",
            appearance: "none" as const, cursor: "pointer",
            fontFamily: "inherit", fontWeight: 500, outline: "none",
          }}
        >
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
        <span style={{
          position: "absolute", right: 7, top: "50%",
          transform: "translateY(-50%)", pointerEvents: "none" as const, color: "#94a3b8"
        }}>
          <ChevronDown />
        </span>
      </div>
    </div>
  );
}

export default function InvoicePanel({
  cart, totals, paymentMethod, onPaymentMethodChange,
  customer, onCustomerChange, priceList, onPriceListChange,
  numeration, onNumerationChange, onFinalize, onCancel,
}: {
  cart: CartItem[];
  totals: { subtotal: number; tax: number; total: number };
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (m: PaymentMethod) => void;
  customer: string;
  onCustomerChange: (v: string) => void;
  priceList: string;
  onPriceListChange: (v: string) => void;
  numeration: string;
  onNumerationChange: (v: string) => void;
  onFinalize: () => void;
  onCancel: () => void;
}) {
  const isEmpty = cart.length === 0;

  return (
    <div style={{
      width: 340,
      flexShrink: 0,
      background: "white",
      borderLeft: "1px solid #e2e8f0",
      display: "flex",
      flexDirection: "column",
      height: "100%",        // ← ocupa exactamente el alto disponible
      overflow: "hidden",    // ← nada se derrama
    }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        padding: "11px 16px 10px",
        borderBottom: "1px solid #f1f5f9",
        display: "flex", alignItems: "center", gap: 7,
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Factura de venta</span>
        <span style={{
          width: 20, height: 20, borderRadius: 5,
          background: "#fef3c7",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <BoltIcon />
        </span>
      </div>

      {/* ── Campos fijos (nunca se mueven) ──────────────────── */}
      {/* Estos 4 campos SIEMPRE están arriba, sin scroll      */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid #f1f5f9",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        flexShrink: 0,        // ← NUNCA se comprime
      }}>

        {/* Lista precio + Numeración en fila */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <SelectField
              label="Lista de precio"
              value={priceList}
              onChange={onPriceListChange}
              options={["General", "Mayorista"]}
            />
          </div>
          <div style={{ flex: 1 }}>
            <SelectField
              label="Numeración"
              value={numeration}
              onChange={onNumerationChange}
              options={["Principal", "Secundaria"]}
            />
          </div>
        </div>

        {/* Método de pago */}
        <SelectField
          label="Método de pago"
          value={
            paymentMethod === "CASH" ? "Efectivo"
            : paymentMethod === "CARD" ? "Tarjeta"
            : "Transferencia"
          }
          onChange={(v) => {
            const map: Record<string, PaymentMethod> = {
              Efectivo: "CASH", Tarjeta: "CARD", Transferencia: "TRANSFER",
            };
            onPaymentMethodChange(map[v] ?? "CASH");
          }}
          options={["Efectivo", "Tarjeta", "Transferencia"]}
        />

        {/* Cliente */}
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "#94a3b8",
            marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em"
          }}>
            Cliente
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <select
                value={customer}
                onChange={(e) => onCustomerChange(e.target.value)}
                style={{
                  width: "100%", height: 34, padding: "0 28px 0 9px",
                  borderRadius: 8, border: "1.5px solid #e2e8f0",
                  fontSize: 12, color: "#1e293b", background: "white",
                  appearance: "none", cursor: "pointer",
                  fontFamily: "inherit", fontWeight: 500, outline: "none",
                }}
              >
                <option>Consumidor final (222222222222)</option>
                <option>Consumidor final</option>
              </select>
              <span style={{
                position: "absolute", right: 7, top: "50%",
                transform: "translateY(-50%)", pointerEvents: "none", color: "#94a3b8"
              }}>
                <ChevronDown />
              </span>
            </div>
            <button
              title="Nuevo contacto"
              style={{
                width: 34, height: 34, borderRadius: 8,
                border: "1.5px solid #e2e8f0",
                background: "#f0fdfa", color: "#0d9488",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#ccfbf1";
                e.currentTarget.style.borderColor = "#0d9488";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#f0fdfa";
                e.currentTarget.style.borderColor = "#e2e8f0";
              }}
            >
              <UserPlusIcon />
            </button>
          </div>
        </div>
      </div>

      {/* ── Zona central (items + estado vacío) ─────────────── */}
      {/* Esta sección ocupa el espacio sobrante y tiene scroll */}
      {/* interno solo si hay muchos productos                  */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}>
        {isEmpty ? (
          /* Estado vacío centrado */
          <div style={{
            flex: 1,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 8, color: "#94a3b8", padding: "20px 16px",
          }}>
            <BasketIcon />
            <p style={{ margin: 0, fontSize: 12, textAlign: "center", lineHeight: 1.7 }}>
              Aquí verás los productos que elijas<br />en tu próxima venta
            </p>
          </div>
        ) : (
          /* Lista de productos del panel */
          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 5 }}>
            {cart.map((i) => (
              <div key={i.lineId} style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "baseline", fontSize: 13,
              }}>
                <span style={{ color: "#475569" }}>
                  {i.name}
                  <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: 4 }}>×{i.qty}</span>
                </span>
                <span style={{ fontWeight: 600, color: "#0f172a", flexShrink: 0, marginLeft: 8 }}>
                  {fmt(i.price * i.qty)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Totales + Footer (siempre al fondo) ─────────────── */}
      <div style={{
        flexShrink: 0,
        borderTop: "1px solid #f1f5f9",
        padding: "10px 16px 14px",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {/* Totales solo cuando hay items */}
        {!isEmpty && (
          <div style={{
            background: "#f8fafc", borderRadius: 10,
            padding: "9px 12px",
            display: "flex", flexDirection: "column", gap: 5,
            marginBottom: 2,
          }}>
            <TotalRow label="Subtotal" value={fmt(totals.subtotal)} />
            <TotalRow label="IVA (19.00%)" value={fmt(totals.tax)} />
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 5 }}>
              <TotalRow label="Total" value={fmt(totals.total)} bold />
            </div>
          </div>
        )}

        {/* Botón Vender */}
        <button
          onClick={onFinalize}
          disabled={isEmpty}
          style={{
            width: "100%", height: 44, borderRadius: 10, border: "none",
            background: isEmpty ? "#e2e8f0" : "#0ea5e9",
            color: isEmpty ? "#94a3b8" : "white",
            fontSize: 14, fontWeight: 700,
            cursor: isEmpty ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            display: "flex", alignItems: "center",
            justifyContent: "space-between", padding: "0 16px",
            boxShadow: isEmpty ? "none" : "0 3px 10px rgba(14,165,233,0.3)",
          }}
          onMouseEnter={(e) => { if (!isEmpty) e.currentTarget.style.background = "#0284c7"; }}
          onMouseLeave={(e) => { if (!isEmpty) e.currentTarget.style.background = "#0ea5e9"; }}
        >
          <span>Vender</span>
          <span>{fmt(totals.total)}</span>
        </button>

        {/* Contador + Cancelar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {cart.length} {cart.length === 1 ? "Producto" : "Productos"}
          </span>
          <button
            onClick={onCancel}
            style={{
              border: "none", background: "transparent",
              color: "#0ea5e9", fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", padding: 0,
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontSize: 12, color: bold ? "#0f172a" : "#64748b", fontWeight: bold ? 700 : 400 }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: "#0f172a", fontWeight: bold ? 700 : 500 }}>
        {value}
      </span>
    </div>
  );
}