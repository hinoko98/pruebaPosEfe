import type { SaleTab } from "../views/PosView";

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
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: "white",
        borderBottom: "1px solid #e2e8f0",
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
              background: active ? "#f0f9ff" : "transparent",
              border: active ? "1.5px solid #bae6fd" : "1.5px solid transparent",
              borderBottom: active ? "1.5px solid white" : "1.5px solid transparent",
              cursor: "pointer",
              color: active ? "#0284c7" : "#64748b",
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
                  e.currentTarget.style.background = "#fecdd3";
                  e.currentTarget.style.color = "#dc2626";
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
          border: "1.5px dashed #cbd5e1",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#94a3b8",
          transition: "all 0.12s",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#0ea5e9";
          e.currentTarget.style.color = "#0ea5e9";
          e.currentTarget.style.background = "#f0f9ff";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#cbd5e1";
          e.currentTarget.style.color = "#94a3b8";
          e.currentTarget.style.background = "transparent";
        }}
      >
        <PlusIcon />
      </button>
    </div>
  );
}