import type { SaleTab } from "../views/PosView";
import { alpha, useTheme } from "@mui/material/styles";

const PosIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const XIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export default function SalesTabs({
  tabs,
  activeId,
  onSelect,
  onAdd,
  onClose,
}: {
  tabs: SaleTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onClose: (id: string) => void;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
        padding: "0 12px",
        gap: 4,
        height: 40,
        flexShrink: 0,
        overflowX: "auto",
      }}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <div
            key={tab.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 10px 0 10px",
              height: 32,
              borderRadius: "8px 8px 0 0",
              background: active ? (isDark ? alpha(theme.palette.primary.main, 0.14) : alpha(theme.palette.primary.main, 0.08)) : "transparent",
              border: active ? `1.5px solid ${alpha(theme.palette.primary.main, isDark ? 0.4 : 0.25)}` : "1.5px solid transparent",
              borderBottom: active ? `1.5px solid ${theme.palette.background.paper}` : "1.5px solid transparent",
              cursor: "pointer",
              color: active ? theme.palette.primary.main : theme.palette.text.secondary,
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              transition: "all 0.12s",
              flexShrink: 0,
              userSelect: "none",
            }}
            onClick={() => onSelect(tab.id)}
          >
            <PosIcon />
            <span>{tab.label}</span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  border: "none",
                  background: "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "inherit",
                  padding: 0,
                  opacity: 0.6,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDark ? alpha(theme.palette.error.main, 0.2) : alpha(theme.palette.error.main, 0.14);
                  e.currentTarget.style.color = theme.palette.error.main;
                  e.currentTarget.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "inherit";
                  e.currentTarget.style.opacity = "0.6";
                }}
              >
                <XIcon />
              </button>
            )}
          </div>
        );
      })}

      {/* Botón nueva venta */}
      <button
        onClick={onAdd}
        title="Nueva venta"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          border: `1.5px dashed ${alpha(theme.palette.text.primary, 0.2)}`,
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: theme.palette.text.secondary,
          transition: "all 0.12s",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = theme.palette.primary.main;
          e.currentTarget.style.color = theme.palette.primary.main;
          e.currentTarget.style.background = isDark ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.primary.main, 0.08);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = alpha(theme.palette.text.primary, 0.2);
          e.currentTarget.style.color = theme.palette.text.secondary;
          e.currentTarget.style.background = "transparent";
        }}
      >
        <PlusIcon />
      </button>
    </div>
  );
}
