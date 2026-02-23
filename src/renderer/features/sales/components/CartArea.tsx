import type { CartItem } from "../types";
import { fmt } from "../views/PosView";

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6M9 6V4h6v2" />
  </svg>
);

const BasketEmptyIcon = () => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 01-8 0" />
  </svg>
);

export default function CartArea({
  items,
  onQty,
  onRemove,
}: {
  items: CartItem[];
  onQty: (lineId: string, qty: number) => void;
  onRemove: (lineId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          color: "#94a3b8",
          padding: "0 24px",
        }}
      >
        <BasketEmptyIcon />
        <p style={{ margin: 0, fontSize: 14, textAlign: "center", lineHeight: 1.7 }}>
          Para crear tu primera factura te invitamos a<br />
          agregar un producto o servicio. 🖊️
        </p>
        <button
          style={{
            padding: "9px 22px",
            borderRadius: 8,
            border: "none",
            background: "#0ea5e9",
            color: "white",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#0284c7")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#0ea5e9")}
        >
          Nuevo producto o servicio
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",    // sin scroll externo
        padding: "10px 14px",
      }}
    >
      {/* Tabla con scroll interno solo si hay muchos items */}
      <div
        style={{
          flex: 1,
          background: "white",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header fijo */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 108px 80px 32px",
            padding: "7px 14px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            flexShrink: 0,
          }}
        >
          {["Producto", "Precio", "Cant.", "Total", ""].map((h, i) => (
            <span
              key={i}
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                textAlign: i >= 1 && i < 4 ? "center" : "left",
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Filas con scroll interno */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {items.map((item, idx) => (
            <div
              key={item.lineId}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 108px 80px 32px",
                padding: "8px 14px",
                alignItems: "center",
                borderBottom: "1px solid #f1f5f9",
                background: idx % 2 === 0 ? "white" : "#fafbfc",
              }}
            >
              {/* Nombre */}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#1e293b",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.name}
              </span>

              {/* Precio */}
              <span style={{ textAlign: "center", fontSize: 12, color: "#64748b" }}>
                {fmt(item.price)}
              </span>

              {/* Cantidad +/- */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    border: "1px solid #e2e8f0",
                    borderRadius: 7,
                    overflow: "hidden",
                    background: "white",
                  }}
                >
                  <button
                    onClick={() => onQty(item.lineId, item.qty - 1)}
                    style={{
                      width: 26,
                      height: 26,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 15,
                      color: "#64748b",
                      fontFamily: "inherit",
                      lineHeight: 1,
                    }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={item.qty}
                    onChange={(e) => onQty(item.lineId, +e.target.value)}
                    style={{
                      width: 30,
                      height: 26,
                      border: "none",
                      textAlign: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#1e293b",
                      outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                  <button
                    onClick={() => onQty(item.lineId, item.qty + 1)}
                    style={{
                      width: 26,
                      height: 26,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 15,
                      color: "#64748b",
                      fontFamily: "inherit",
                      lineHeight: 1,
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Total línea */}
              <span
                style={{
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {fmt(item.price * item.qty)}
              </span>

              {/* Eliminar */}
              <button
                onClick={() => onRemove(item.lineId)}
                style={{
                  width: 26,
                  height: 26,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 5,
                  transition: "all 0.12s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#ef4444";
                  e.currentTarget.style.background = "#fef2f2";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#cbd5e1";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}