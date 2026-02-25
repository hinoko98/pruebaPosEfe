// src/renderer/components/ui/Select.tsx
// ─── Componente Select reutilizable ──────────────────────────────────────────
// Uso:
//   <Select label="Método de pago" value={v} onChange={setV} options={["Efectivo","Tarjeta"]} />
//   <Select value={v} onChange={setV} options={opts} />  ← sin label

import { ChevronDownIcon } from "@/components/icons/Index";

interface SelectProps {
  label?:    string;
  value:     string;
  onChange:  (v: string) => void;
  options:   string[];
  fullWidth?: boolean;
  disabled?:  boolean;
}

export default function Select({
  label,
  value,
  onChange,
  options,
  fullWidth = true,
  disabled  = false,
}: SelectProps) {
  return (
    <div style={{ width: fullWidth ? "100%" : undefined }}>

      {/* Etiqueta opcional */}
      {label && (
        <div style={{
          fontSize:      10,
          fontWeight:    700,
          color:         "#94a3b8",
          marginBottom:  4,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}>
          {label}
        </div>
      )}

      {/* Select con ícono personalizado */}
      <div style={{ position: "relative" }}>
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width:       "100%",
            height:      34,
            padding:     "0 28px 0 9px",
            borderRadius: 8,
            border:      "1.5px solid #e2e8f0",
            fontSize:    12,
            color:       "#1e293b",
            background:  disabled ? "#f8fafc" : "white",
            appearance:  "none",
            cursor:      disabled ? "not-allowed" : "pointer",
            fontFamily:  "inherit",
            fontWeight:  500,
            outline:     "none",
            opacity:     disabled ? 0.6 : 1,
          }}
        >
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>

        {/* Ícono chevron */}
        <span style={{
          position:      "absolute",
          right:         7,
          top:           "50%",
          transform:     "translateY(-50%)",
          pointerEvents: "none",
          color:         "#94a3b8",
          display:       "flex",
          alignItems:    "center",
        }}>
          <ChevronDownIcon />
        </span>
      </div>
    </div>
  );
}