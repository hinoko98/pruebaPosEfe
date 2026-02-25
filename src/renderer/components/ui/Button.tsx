// src/renderer/components/ui/Button.tsx
// ─── Componente Button reutilizable ──────────────────────────────────────────
// Uso:
//   <Button variant="primary" size="lg" fullWidth>Vender</Button>
//   <Button variant="ghost" size="sm">Cancelar</Button>
//   <Button variant="icon" leftIcon={<PlusIcon />}>Nuevo</Button>
//   <Button variant="danger"><TrashIcon /></Button>

import type { CSSProperties, ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "ghost" | "icon" | "danger" | "outline";
export type ButtonSize    = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  fullWidth?: boolean;
  leftIcon?:  ReactNode;
  children?:  ReactNode;
}

// ─── Estilos base por variante ────────────────────────────────────────────────
const variantBase: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "#0ea5e9",
    color: "white",
    border: "none",
    fontWeight: 700,
    boxShadow: "0 2px 8px rgba(14,165,233,0.25)",
  },
  ghost: {
    background: "transparent",
    color: "#0ea5e9",
    border: "none",
    fontWeight: 600,
  },
  icon: {
    background: "transparent",
    color: "#94a3b8",
    border: "1.5px solid #e2e8f0",
    fontWeight: 500,
  },
  danger: {
    background: "transparent",
    color: "#cbd5e1",
    border: "none",
    fontWeight: 500,
  },
  outline: {
    background: "white",
    color: "#475569",
    border: "1.5px solid #e2e8f0",
    fontWeight: 500,
  },
};

// ─── Tamaños ──────────────────────────────────────────────────────────────────
const sizeStyles: Record<ButtonSize, CSSProperties> = {
  xs: { height: 26, padding: "0 8px",  fontSize: 11, borderRadius: 6  },
  sm: { height: 32, padding: "0 12px", fontSize: 12, borderRadius: 8  },
  md: { height: 38, padding: "0 16px", fontSize: 13, borderRadius: 9  },
  lg: { height: 46, padding: "0 20px", fontSize: 14, borderRadius: 11 },
};

// ─── Hover por variante ───────────────────────────────────────────────────────
const hoverIn: Record<ButtonVariant, Partial<CSSProperties>> = {
  primary: { background: "#0284c7" },
  ghost:   { background: "#f0f9ff" },
  icon:    { background: "#f0f9ff", borderColor: "#0ea5e9", color: "#0ea5e9" },
  danger:  { background: "#fef2f2", color: "#ef4444" },
  outline: { background: "#f8fafc", borderColor: "#94a3b8" },
};

const hoverOut: Record<ButtonVariant, Partial<CSSProperties>> = {
  primary: { background: "#0ea5e9" },
  ghost:   { background: "transparent" },
  icon:    { background: "transparent", borderColor: "#e2e8f0", color: "#94a3b8" },
  danger:  { background: "transparent", color: "#cbd5e1" },
  outline: { background: "white", borderColor: "#e2e8f0" },
};

// ─── Componente ───────────────────────────────────────────────────────────────
export default function Button({
  variant   = "primary",
  size      = "md",
  fullWidth = false,
  leftIcon,
  children,
  disabled,
  style,
  onMouseEnter,
  onMouseLeave,
  ...props
}: ButtonProps) {

  const base: CSSProperties = {
    display:        "inline-flex",
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
    cursor:         disabled ? "not-allowed" : "pointer",
    fontFamily:     "inherit",
    opacity:        disabled ? 0.5 : 1,
    transition:     "all 0.15s",
    whiteSpace:     "nowrap",
    boxSizing:      "border-box",
    width:          fullWidth ? "100%" : undefined,
    ...variantBase[variant],
    ...sizeStyles[size],
    ...style,
  };

  const applyStyle = (el: HTMLButtonElement, styles: Partial<CSSProperties>) => {
    Object.assign(el.style, styles);
  };

  return (
    <button
      disabled={disabled}
      style={base}
      onMouseEnter={(e) => {
        if (!disabled) applyStyle(e.currentTarget, hoverIn[variant]);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (!disabled) applyStyle(e.currentTarget, hoverOut[variant]);
        onMouseLeave?.(e);
      }}
      {...props}
    >
      {leftIcon && (
        <span style={{ display: "flex", alignItems: "center" }}>
          {leftIcon}
        </span>
      )}
      {children}
    </button>
  );
}