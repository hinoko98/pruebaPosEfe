// src/renderer/components/ui/Badge.tsx
// ─── Componente Badge reutilizable ───────────────────────────────────────────
// Uso:
//   <Badge variant="success">Cobrada</Badge>
//   <Badge variant="warning">Pendiente</Badge>
//   <Badge variant="info">No electrónica</Badge>

import type { ReactNode } from "react";

export type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

interface BadgeProps {
  variant?:  BadgeVariant;
  children:  ReactNode;
  dot?:      boolean;  // muestra un punto de color antes del texto
}

const variantStyles: Record<BadgeVariant, { bg: string; color: string; dot: string }> = {
  success: { bg: "#dcfce7", color: "#16a34a", dot: "#22c55e" },
  warning: { bg: "#fef9c3", color: "#ca8a04", dot: "#eab308" },
  danger:  { bg: "#fee2e2", color: "#dc2626", dot: "#ef4444" },
  info:    { bg: "#e0f2fe", color: "#0284c7", dot: "#0ea5e9" },
  neutral: { bg: "#f1f5f9", color: "#64748b", dot: "#94a3b8" },
};

export default function Badge({ variant = "neutral", children, dot = false }: BadgeProps) {
  const s = variantStyles[variant];
  return (
    <span style={{
      display:       "inline-flex",
      alignItems:    "center",
      gap:           5,
      padding:       "2px 8px",
      borderRadius:  20,
      fontSize:      11,
      fontWeight:    600,
      background:    s.bg,
      color:         s.color,
      whiteSpace:    "nowrap",
    }}>
      {dot && (
        <span style={{
          width:        6,
          height:       6,
          borderRadius: "50%",
          background:   s.dot,
          flexShrink:   0,
        }} />
      )}
      {children}
    </span>
  );
}