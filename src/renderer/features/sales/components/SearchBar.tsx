import { useEffect, useRef, useState } from "react";

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
  onScan,
  onSearchChange,
}: {
  onScan: (barcode: string) => void;
  onSearchChange: (query: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [barcodeValue, setBarcodeValue] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode !== "search") {
      onSearchChange("");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onSearchChange(query);
    }, 320);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [mode, onSearchChange, query]);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setQuery("");
    setBarcodeValue("");

    setTimeout(() => {
      if (nextMode === "barcode") {
        scanRef.current?.focus();
      } else {
        searchRef.current?.focus();
      }
    }, 50);
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

      <div style={{ flex: 1, position: "relative" }}>
        {mode === "barcode" ? (
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
              <BarcodeIcon />
            </span>
            <input
              ref={scanRef}
              value={barcodeValue}
              onChange={(event) => setBarcodeValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  const barcode = barcodeValue.trim();
                  if (barcode) {
                    onScan(barcode);
                    setBarcodeValue("");
                  }
                }
              }}
              placeholder="Escanea o escribe el codigo de barras..."
              inputMode="numeric"
              autoFocus
              style={{
                width: "100%",
                height: 42,
                paddingLeft: 40,
                paddingRight: 14,
                borderRadius: 12,
                border: "2px solid #bae6fd",
                fontSize: 14,
                outline: "none",
                background: "#f0f9ff",
                color: "#0f172a",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </>
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
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o SKU..."
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
          </>
        )}
      </div>
    </div>
  );
}
