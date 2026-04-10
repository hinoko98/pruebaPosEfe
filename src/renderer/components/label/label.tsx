import Box from "@mui/material/Box";

import type { LabelColor, LabelProps } from "./types";

const colorStyles: Record<LabelColor, { bg: string; text: string; border: string }> = {
  default: { bg: "#e5e7eb", text: "#374151", border: "#d1d5db" },
  primary: { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  secondary: { bg: "#f3e8ff", text: "#7e22ce", border: "#d8b4fe" },
  info: { bg: "#dbeafe", text: "#0369a1", border: "#7dd3fc" },
  success: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  warning: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  error: { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
};

export function Label({
  sx,
  endIcon,
  children,
  startIcon,
  className,
  disabled,
  variant = "soft",
  color = "default",
  ...other
}: LabelProps) {
  const palette = colorStyles[color];

  return (
    <Box
      component="span"
      className={className}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        minWidth: 24,
        height: 24,
        px: 1,
        borderRadius: 1,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        opacity: disabled ? 0.48 : 1,
        pointerEvents: disabled ? "none" : undefined,
        ...(variant === "filled" && {
          color: "#fff",
          backgroundColor: palette.text,
        }),
        ...(variant === "outlined" && {
          color: palette.text,
          backgroundColor: "transparent",
          border: `1px solid ${palette.border}`,
        }),
        ...(variant === "soft" && {
          color: palette.text,
          backgroundColor: palette.bg,
        }),
        ...(variant === "inverted" && {
          color: palette.bg,
          backgroundColor: palette.text,
        }),
        ...sx,
      }}
      {...other}
    >
      {startIcon}
      {typeof children === "string"
        ? children.charAt(0).toUpperCase() + children.slice(1)
        : children}
      {endIcon}
    </Box>
  );
}
