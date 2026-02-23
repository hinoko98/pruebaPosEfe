import { useMemo, useRef, useState } from "react";
import type { Product } from "../types";
import { fmt } from "../views/PosView";

const SearchIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
);
const BarcodeIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14" />
  </svg>
);
const PlusSmIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
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
  const [mode, setMode] = useState<Mode>("barcode");
  const [query, setQuery] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || mode === "barcode") return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode ?? "").includes(q)
      )
      .slice(0, 8);
  }, [query, mode, products]);

  const handlePick = (p: Product) => {
    onPick(p);
    setQuery("");
    setShowDrop(false);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setQuery("");
    setShowDrop(false);
    setTimeout(() => {
      if (m === "barcode") scanRef.current?.focus();
      else searchRef.current?.focus();
    }, 50);
  };

  return (
    <div
      style={{
        padding: "10px 14px",
        background: "white",
        borderBottom: "1px solid #e2e8f0",
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      {/* Toggle barcode / búsqueda */}
      <div
        style={{
          display: "flex",
          border: "1.5px solid #e2e8f0",
          borderRadius: 10,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {(["barcode", "search"] as Mode[]).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              onClick={() => switchMode(m)}
              title={m === "barcode" ? "Modo código de barras" : "Buscar por nombre"}
              style={{
                width: 38,
                height: 38,
                border: "none",
                background: active ? "#0ea5e9" : "white",
                color: active ? "white" : "#94a3b8",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              {m === "barcode" ? <BarcodeIcon /> : <SearchIcon />}
            </button>
          );
        })}
      </div>

      {/* Input barcode (oculto, captura del lector) */}
      <input
        ref={scanRef}
        style={{ position: "absolute", left: -9999, width: 1, height: 1 }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const bc = e.currentTarget.value.trim();
            if (bc) onScan(bc);
            e.currentTarget.value = "";
          }
        }}
      />

      {/* Campo visible */}
      <div style={{ flex: 1, position: "relative" }}>
        {mode === "barcode" ? (
          // Modo barcode: campo decorativo que muestra estado
          <div
            onClick={() => scanRef.current?.focus()}
            style={{
              height: 40,
              borderRadius: 10,
              border: "2px solid #bae6fd",
              background: "#f0f9ff",
              display: "flex",
              alignItems: "center",
              padding: "0 14px",
              gap: 10,
              cursor: "text",
            }}
          >
            <span style={{ color: "#0284c7" }}><BarcodeIcon /></span>
            <span style={{ fontSize: 13, color: "#0284c7", fontWeight: 500 }}>
              Código de barras — listo para escanear
            </span>
            <span
              style={{
                marginLeft: "auto",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 0 3px rgba(34,197,94,0.25)",
                animation: "pulse 2s infinite",
              }}
            />
          </div>
        ) : (
          // Modo búsqueda: autocomplete normal
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
              onChange={(e) => {
                setQuery(e.target.value);
                setShowDrop(true);
              }}
              onFocus={() => setShowDrop(true)}
              onBlur={() => setTimeout(() => setShowDrop(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions[0]) handlePick(suggestions[0]);
              }}
              placeholder="Buscar por nombre o código..."
              autoFocus
              style={{
                width: "100%",
                height: 40,
                paddingLeft: 40,
                paddingRight: 14,
                borderRadius: 10,
                border: "2px solid #e2e8f0",
                fontSize: 14,
                outline: "none",
                background: "white",
                color: "#1e293b",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
            {/* Dropdown */}
            {showDrop && suggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  background: "white",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                  zIndex: 300,
                  overflow: "hidden",
                }}
              >
                {suggestions.map((p) => (
                  <button
                    key={p.id}
                    onMouseDown={() => handlePick(p)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      width: "100%",
                      padding: "9px 14px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                      borderBottom: "1px solid #f8fafc",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f9ff")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14, color: "#1e293b" }}>
                        {p.name}
                      </div>
                      {p.barcode && (
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                          {p.barcode}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>
                        {fmt(p.price)}
                      </span>
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          background: "#0ea5e9",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <PlusSmIcon />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Botón nuevo producto */}
      <button
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: 40,
          padding: "0 14px",
          borderRadius: 10,
          border: "none",
          background: "#0ea5e9",
          color: "white",
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
          whiteSpace: "nowrap",
          fontFamily: "inherit",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#0284c7")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#0ea5e9")}
      >
        <PlusSmIcon /> Nuevo producto
      </button>

      {/* CSS animación pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(34,197,94,0.25); }
          50% { box-shadow: 0 0 0 6px rgba(34,197,94,0.1); }
        }
      `}</style>
    </div>
  );
}