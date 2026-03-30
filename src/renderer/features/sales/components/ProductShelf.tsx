import type { Product } from "../types";
import { fmt } from "../views/PosView";

export default function ProductShelf({
  products,
  onPick,
}: {
  products: Product[];
  onPick: (product: Product) => void;
}) {
  return (
    <div
      style={{
        background: "white",
        borderBottom: "1px solid #e2e8f0",
        padding: "12px 14px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
        gap: 12,
        flex: 1,
        minHeight: 0,
        alignContent: "start",
        overflowY: "auto",
      }}
    >
      {products.map((product) => (
        <button
          key={product.id}
          onClick={() => onPick(product)}
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            background: "#ffffff",
            padding: "12px",
            textAlign: "left",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontFamily: "inherit",
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.borderColor = "#38bdf8";
            event.currentTarget.style.background = "#f0f9ff";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.borderColor = "#e2e8f0";
            event.currentTarget.style.background = "#ffffff";
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{product.name}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
              {product.category || "General"}
              {product.subcategory ? ` / ${product.subcategory}` : ""}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0284c7" }}>{fmt(product.price)}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Stock: {product.stock ?? 0}</div>
            </div>
            <div
              style={{
                minWidth: 62,
                height: 30,
                borderRadius: 999,
                background: "#0ea5e9",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Agregar
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
