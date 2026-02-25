// src/renderer/components/ui/QuantityInput.tsx
// ─── Control de cantidad reutilizable ────────────────────────────────────────
// Uso:
//   <QuantityInput value={item.qty} onChange={(q) => updateQty(item.lineId, q)} />
//   <QuantityInput value={qty} onChange={setQty} min={1} max={999} />

interface QuantityInputProps {
  value:    number;
  onChange: (qty: number) => void;
  min?:     number;
  max?:     number;
}

export default function QuantityInput({
  value,
  onChange,
  min = 1,
  max = 9999,
}: QuantityInputProps) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  const btnStyle = {
    width:      26,
    height:     26,
    border:     "none",
    background: "transparent",
    cursor:     "pointer",
    fontSize:   16,
    color:      "#64748b",
    fontFamily: "inherit",
    lineHeight: 1,
    display:    "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } as const;

  return (
    <div style={{
      display:    "inline-flex",
      alignItems: "center",
      border:     "1px solid #e2e8f0",
      borderRadius: 7,
      overflow:   "hidden",
      background: "white",
    }}>
      {/* Botón decrementar */}
      <button
        onClick={dec}
        disabled={value <= min}
        style={{ ...btnStyle, opacity: value <= min ? 0.4 : 1 }}
      >
        −
      </button>

      {/* Campo numérico */}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        style={{
          width:      34,
          height:     26,
          border:     "none",
          textAlign:  "center",
          fontSize:   12,
          fontWeight: 700,
          color:      "#1e293b",
          outline:    "none",
          fontFamily: "inherit",
          background: "transparent",
          // Ocultar flechas del input number
          MozAppearance: "textfield",
        } as React.CSSProperties}
      />

      {/* Botón incrementar */}
      <button
        onClick={inc}
        disabled={value >= max}
        style={{ ...btnStyle, opacity: value >= max ? 0.4 : 1 }}
      >
        +
      </button>
    </div>
  );
}