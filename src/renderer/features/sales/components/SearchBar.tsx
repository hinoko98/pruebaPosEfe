import { useMemo, useRef, useState } from "react";

import type { Product } from "../types";
import { fmt } from "../views/PosView";

const SearchIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const BarcodeIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14" />
  </svg>
);

type Mode = "search" | "barcode";

export default function SearchBar({
  products,
  onPick,
  onScan,
}: {
  products: Product[];
  onPick: (p: Product, qty?: number) => void;
  onScan: (barcode: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (mode === "barcode") return [];

    if (!q) {
      return products.slice(0, 12);
    }

    return products
      .filter(
        (product) =>
          product.name.toLowerCase().includes(q) ||
          (product.barcode ?? "").toLowerCase().includes(q) ||
          (product.sku ?? "").toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [mode, products, query]);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setQuery("");
    setShowDrop(nextMode === "search");

    setTimeout(() => {
      if (nextMode === "barcode") {
        scanRef.current?.focus();
      } else {
        searchRef.current?.focus();
      }
    }, 50);
  };

  const handlePick = (product: Product) => {
    onPick(product);
    setQuery("");
    setShowDrop(false);
  };

  return (
    <div
      style={{
        padding: "12px 14px",
        background: "white",
        borderBottom: "1px solid #e2e8f0",
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          border: "1.5px solid #e2e8f0",
          borderRadius: 10,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {(["search", "barcode"] as Mode[]).map((currentMode) => {
          const active = mode === currentMode;
          return (
            <button
              key={currentMode}
              onClick={() => switchMode(currentMode)}
              style={{
                width: 42,
                height: 40,
                border: "none",
                background: active ? "#0ea5e9" : "white",
                color: active ? "white" : "#94a3b8",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title={currentMode === "search" ? "Buscar producto" : "Escanear codigo"}
            >
              {currentMode === "search" ? <SearchIcon /> : <BarcodeIcon />}
            </button>
          );
        })}
      </div>

      <input
        ref={scanRef}
        style={{ position: "absolute", left: -9999, width: 1, height: 1 }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            const barcode = event.currentTarget.value.trim();
            if (barcode) onScan(barcode);
            event.currentTarget.value = "";
          }
        }}
      />

      <div style={{ flex: 1, position: "relative" }}>
        {mode === "barcode" ? (
          <div
            onClick={() => scanRef.current?.focus()}
            style={{
              height: 42,
              borderRadius: 12,
              border: "2px solid #bae6fd",
              background: "#f0f9ff",
              display: "flex",
              alignItems: "center",
              padding: "0 14px",
              gap: 10,
              cursor: "text",
              color: "#0369a1",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <BarcodeIcon />
            Escaner listo para agregar productos por codigo de barras
          </div>
        ) : (
          <>
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
                pointerEvents: "none",
              }}
            >
              <SearchIcon />
            </span>
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShowDrop(true);
              }}
              onFocus={() => setShowDrop(true)}
              onBlur={() => setTimeout(() => setShowDrop(false), 150)}
              placeholder="Buscar por nombre, SKU o codigo..."
              autoFocus
              style={{
                width: "100%",
                height: 42,
                paddingLeft: 40,
                paddingRight: 14,
                borderRadius: 12,
                border: "2px solid #e2e8f0",
                fontSize: 14,
                outline: "none",
                background: "white",
                color: "#1e293b",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />

            {showDrop && suggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  background: "white",
                  borderRadius: 14,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 16px 32px rgba(15, 23, 42, 0.12)",
                  zIndex: 300,
                  overflow: "hidden",
                  maxHeight: 360,
                  overflowY: "auto",
                }}
              >
                {suggestions.map((product) => (
                  <button
                    key={product.id}
                    onMouseDown={() => handlePick(product)}
                    style={{
                      width: "100%",
                      border: "none",
                      background: "transparent",
                      padding: "10px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 14,
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = "#f8fafc";
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{product.name}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                        {product.sku || "Sin SKU"}
                        {product.barcode ? ` • ${product.barcode}` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0284c7" }}>{fmt(product.price)}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>Stock {product.stock ?? 0}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
