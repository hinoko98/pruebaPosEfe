import type { Product } from "../types";
import { fmt } from "../views/PosView";
import { alpha, useTheme } from "@mui/material/styles";

export default function ProductShelf({
  products,
  onPick,
  searchQuery,
}: {
  products: Product[];
  onPick: (product: Product) => void;
  searchQuery?: string;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  if (products.length === 0) {
    return (
      <div
        style={{
          background: theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
          padding: "24px 14px",
          flex: 1,
          minHeight: 0,
        }}
      >
        <div
          style={{
            borderRadius: 16,
            padding: "28px 18px",
            textAlign: "center",
            color: theme.palette.text.secondary,
            background: isDark ? alpha(theme.palette.common.white, 0.02) : alpha(theme.palette.primary.main, 0.03),
            border: `1px dashed ${alpha(theme.palette.text.primary, 0.18)}`,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: theme.palette.text.primary, marginBottom: 6 }}>
            No hay articulos para mostrar
          </div>
          <div style={{ fontSize: 13 }}>
            {searchQuery?.trim()
              ? `No encontramos coincidencias para "${searchQuery.trim()}".`
              : "No hay productos disponibles en este momento."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
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
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 14,
            background: theme.palette.background.paper,
            padding: "12px",
            textAlign: "left",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontFamily: "inherit",
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.borderColor = theme.palette.primary.main;
            event.currentTarget.style.background = isDark
              ? alpha(theme.palette.primary.main, 0.1)
              : alpha(theme.palette.primary.main, 0.06);
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.borderColor = theme.palette.divider;
            event.currentTarget.style.background = theme.palette.background.paper;
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: theme.palette.text.primary }}>{product.name}</div>
            {product.sku ? (
              <div style={{ fontSize: 11, color: theme.palette.text.secondary, marginTop: 3 }}>SKU: {product.sku}</div>
            ) : null}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: theme.palette.primary.main }}>{fmt(product.price)}</div>
              <div style={{ fontSize: 11, color: theme.palette.text.secondary }}>Stock: {product.stock ?? 0}</div>
            </div>
            <div
              style={{
                minWidth: 62,
                height: 30,
                borderRadius: 999,
                background: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
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
