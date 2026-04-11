import type { CSSProperties, ReactNode } from "react";
import type { Theme } from "@mui/material/styles";
import { alpha, useTheme } from "@mui/material/styles";

import type { CartItem } from "../types";
import { fmt } from "../views/PosView";

const MenuIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

const SparkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
  </svg>
);

const EmptyBagIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8h12l-1 10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z" />
    <path d="M9 8a3 3 0 1 1 6 0" />
    <path d="M10 12v.01" />
    <path d="M14 12v.01" />
  </svg>
);

const RemoveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M5 12h14" />
  </svg>
);

const AddIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const UserPlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
    <circle cx="9.5" cy="7" r="3.5" />
    <path d="M19 8v6M16 11h6" />
  </svg>
);

export default function InvoicePanel({
  cart,
  totals,
  customer,
  customers,
  onCustomerChange,
  onCheckout,
  onCancel,
  onHide,
  onQty,
  onRemove,
  saving,
  canChangeCustomer = true,
  canCheckout = true,
}: {
  cart: CartItem[];
  totals: { subtotal: number; tax: number; total: number };
  customer: string;
  customers: Array<{ id: string; name: string; document?: string | null; phone?: string | null }>;
  onCustomerChange: (value: string) => void;
  onCheckout: () => void;
  onCancel: () => void;
  onHide: () => void;
  onQty: (lineId: string, qty: number) => void;
  onRemove: (lineId: string) => void;
  saving?: boolean;
  canChangeCustomer?: boolean;
  canCheckout?: boolean;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isEmpty = cart.length === 0;
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const inputStyle = getFieldStyle(theme);
  const colors = {
    surface: theme.palette.background.paper,
    panel: isDark ? alpha(theme.palette.common.white, 0.03) : "#fbfdff",
    panelSoft: isDark ? alpha(theme.palette.common.white, 0.02) : "#f8fbfe",
    border: theme.palette.divider,
    text: theme.palette.text.primary,
    muted: theme.palette.text.secondary,
    primary: theme.palette.primary.main,
    primarySoft: isDark ? alpha(theme.palette.primary.main, 0.16) : alpha(theme.palette.primary.main, 0.08),
    primarySoftStrong: isDark ? alpha(theme.palette.primary.main, 0.2) : "#edf7ff",
    danger: theme.palette.error.main,
  };

  return (
    <aside
      style={{
        width: 398,
        minWidth: 398,
        flexShrink: 0,
        background: colors.surface,
        borderLeft: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div
        style={{
          padding: "14px 14px 10px",
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 15, color: colors.text, fontWeight: 800 }}>Factura de venta</h2>
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              background: colors.primarySoftStrong,
              color: colors.primary,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SparkIcon />
          </span>
        </div>

        <button
          onClick={onHide}
          title="Ocultar factura"
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.muted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <MenuIcon />
        </button>
      </div>

      <div
        style={{
          padding: "12px 14px 10px",
          borderBottom: `1px solid ${colors.border}`,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FieldShell label="Lista de precio">
            <select style={inputStyle} defaultValue="General">
              <option value="General">General</option>
            </select>
          </FieldShell>

          <FieldShell label="Numeracion">
            <select style={inputStyle} defaultValue="Principal">
              <option value="Principal">Principal</option>
            </select>
          </FieldShell>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
          <FieldShell label="Cliente">
            <select
              value={customer || "Consumidor final"}
              onChange={(event) => onCustomerChange(event.target.value)}
              style={inputStyle}
              disabled={!canChangeCustomer}
            >
              <option value="Consumidor final">Consumidor final</option>
              {customers.map((entry) => (
                <option key={entry.id} value={entry.name}>
                  {entry.name}
                  {entry.document ? ` (${entry.document})` : ""}
                </option>
              ))}
            </select>
          </FieldShell>

          <button
            onClick={() => onCustomerChange("Consumidor final")}
            title="Usar consumidor final"
            disabled={!canChangeCustomer}
            style={{
              width: 42,
              height: 36,
              borderRadius: 12,
              border: "none",
              background: colors.primarySoft,
              color: colors.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: canChangeCustomer ? "pointer" : "not-allowed",
              opacity: canChangeCustomer ? 1 : 0.6,
            }}
          >
            <UserPlusIcon />
          </button>
        </div>

      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          background: colors.panel,
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isEmpty ? "28px 18px" : "14px 14px 18px",
          }}
        >
          {isEmpty ? (
            <div
              style={{
                height: "100%",
                borderRadius: 18,
                background: isDark
                  ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.02)} 0%, ${alpha(theme.palette.common.white, 0.01)} 100%)`
                  : `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${colors.panel} 100%)`,
                border: `1px solid ${colors.border}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                color: colors.muted,
                gap: 12,
                padding: "28px",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: colors.muted,
                }}
              >
                <EmptyBagIcon />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>
                Aqui veras los productos que elijas
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                Agrega articulos desde la busqueda o la lista para construir la venta.
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {cart.map((item) => (
                <div
                  key={item.lineId}
                  style={{
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 16,
                    padding: "12px 12px 10px",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: colors.text }}>{item.name}</div>
                      {item.sku ? (
                        <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                          SKU: {item.sku}
                        </div>
                      ) : null}
                      <div style={{ fontSize: 11, color: colors.muted, marginTop: 3 }}>
                        {fmt(item.price)} c/u
                      </div>
                      {item.sheetTypeName || item.specialRuleLabel || item.pricingSourceLabel ? (
                        <div style={{ fontSize: 11, color: colors.muted, marginTop: 3 }}>
                          {[item.sheetTypeName, item.specialRuleLabel, item.pricingSourceLabel].filter(Boolean).join(" | ")}
                        </div>
                      ) : null}
                    </div>

                    <button
                      onClick={() => onRemove(item.lineId)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: colors.danger,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: "inherit",
                        padding: 0,
                      }}
                    >
                      Quitar
                    </button>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        height: 34,
                        borderRadius: 999,
                        border: `1px solid ${colors.border}`,
                        display: "inline-flex",
                        alignItems: "center",
                        overflow: "hidden",
                        background: colors.surface,
                      }}
                    >
                      <QtyAction onClick={() => onQty(item.lineId, item.qty - 1)}>
                        <RemoveIcon />
                      </QtyAction>
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(event) => onQty(item.lineId, Number(event.target.value))}
                        style={{
                          width: 42,
                          border: "none",
                          outline: "none",
                          textAlign: "center",
                          fontSize: 13,
                          fontWeight: 700,
                          color: colors.text,
                          fontFamily: "inherit",
                        }}
                      />
                      <QtyAction onClick={() => onQty(item.lineId, item.qty + 1)}>
                        <AddIcon />
                      </QtyAction>
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 800, color: colors.primary }}>
                      {fmt(item.price * item.qty)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            borderTop: `1px solid ${colors.border}`,
            background: colors.surface,
            padding: "12px 14px 10px",
            display: "grid",
            gap: 10,
          }}
        >
          <div
            style={{
              borderRadius: 16,
              background: colors.panelSoft,
              border: `1px solid ${colors.border}`,
              padding: "12px",
              display: "grid",
              gap: 7,
            }}
          >
            <TotalRow label="Subtotal" value={fmt(totals.subtotal)} />
            <TotalRow label="IVA" value={fmt(totals.tax)} />
            <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 7 }}>
              <TotalRow label="Total" value={fmt(totals.total)} strong />
            </div>
          </div>

          <button
            onClick={onCheckout}
            disabled={isEmpty || saving || !canCheckout}
            style={{
              width: "100%",
              height: 42,
              borderRadius: 12,
              border: "none",
              background: isEmpty || saving || !canCheckout ? (isDark ? alpha(theme.palette.common.white, 0.14) : "#d7dee7") : colors.primary,
              color: isEmpty || saving || !canCheckout ? theme.palette.text.secondary : theme.palette.primary.contrastText,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 14px",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 800,
              cursor: isEmpty || saving || !canCheckout ? "not-allowed" : "pointer",
            }}
          >
            <span>{saving ? "Guardando..." : canCheckout ? "Vender" : "Sin permiso para vender"}</span>
            <span>{fmt(totals.total)}</span>
          </button>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              color: colors.muted,
              fontSize: 12,
            }}
          >
            <span>{cartCount} Productos</span>
            <button
              onClick={onCancel}
              style={{
                border: "none",
                background: "transparent",
                color: colors.primary,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                padding: 0,
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function FieldShell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, color: theme.palette.text.primary, fontWeight: 700 }}>{label}</span>
      {children}
    </label>
  );
}

function QtyAction({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  const theme = useTheme();
  return (
    <button
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        border: "none",
        background: "transparent",
        color: theme.palette.text.secondary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function TotalRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  const theme = useTheme();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 12, color: strong ? theme.palette.text.primary : theme.palette.text.secondary, fontWeight: strong ? 800 : 600 }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: theme.palette.text.primary, fontWeight: strong ? 800 : 700 }}>{value}</span>
    </div>
  );
}

const getFieldStyle = (theme: Theme): CSSProperties => ({
  width: "100%",
  height: 36,
  borderRadius: 12,
  border: `1px solid ${theme.palette.divider}`,
  background: theme.palette.background.paper,
  padding: "0 12px",
  outline: "none",
  fontFamily: "inherit",
  fontSize: 13,
  color: theme.palette.text.primary,
  boxSizing: "border-box",
});
