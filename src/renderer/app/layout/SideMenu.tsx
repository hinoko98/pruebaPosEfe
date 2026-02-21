import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";

import HomeIcon from "@mui/icons-material/Home";
import DescriptionIcon from "@mui/icons-material/Description";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import SettingsIcon from "@mui/icons-material/Settings";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LogoutIcon from "@mui/icons-material/Logout";
import SyncIcon from "@mui/icons-material/Sync";

export type MenuItem =
  | {
      type: "item";
      label: string;
      path: string;
      icon?: React.ReactNode;
      disabled?: boolean;
    }
  | {
      type: "group";
      label: string;
      icon?: React.ReactNode;
      children: Array<{
        label: string;
        path: string;
        disabled?: boolean;
      }>;
    }
  | { type: "divider" };

export default function SideMenu({
  title = "POS",
  menu,
  onLogout,
  lastSyncText,
  onSync,
}: {
  title?: string;
  menu: MenuItem[];
  onLogout: () => void;
  lastSyncText?: string;
  onSync?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const activePath = location.pathname;

  const isPathActive = (path: string) =>
    activePath === path || activePath.startsWith(path + "/");

  const autoOpenGroups = useMemo(() => {
    // abre un grupo si alguna ruta hija está activa
    const map: Record<string, boolean> = {};
    for (const m of menu) {
      if (m.type === "group") {
        map[m.label] = m.children.some((c) => isPathActive(c.path));
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath]);

  const isGroupOpen = (label: string) =>
    openGroups[label] ?? autoOpenGroups[label] ?? false;

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !isGroupOpen(label) }));

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      
      {/* Menú */}
      <List sx={{ px: 1 }}>
        {menu.map((m, idx) => {
          if (m.type === "divider") {
            return <Divider key={`d-${idx}`} sx={{ my: 1 }} />;
          }

          if (m.type === "item") {
            const selected = isPathActive(m.path);
            return (
              <ListItemButton 
                key={m.path}
                selected={selected}
                disabled={m.disabled}
                onClick={() => navigate(m.path)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                }}
              >
                {m.icon ? <ListItemIcon>{m.icon}</ListItemIcon> : null}
                <ListItemText primary={m.label} />
              </ListItemButton>
            );
          }

          // group
          const open = isGroupOpen(m.label);
          return (
            <Box key={m.label} sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => toggleGroup(m.label)}
                sx={{ borderRadius: 2 }}
              >
                {m.icon ? <ListItemIcon>{m.icon}</ListItemIcon> : null}
                <ListItemText primary={m.label} />
                {open ? <ExpandMoreIcon /> : <ChevronRightIcon />}
              </ListItemButton>

              <Collapse in={open} timeout="auto" unmountOnExit>
                <List disablePadding sx={{ pl: 2 }}>
                  {m.children.map((c) => (
                    <ListItemButton
                      key={c.path}
                      selected={isPathActive(c.path)}
                      disabled={c.disabled}
                      onClick={() => navigate(c.path)}
                      sx={{ borderRadius: 2, mb: 0.25 }}
                    >
                      <ListItemIcon>
                        <ChevronRightIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={c.label} />
                    </ListItemButton>
                  ))}
                </List>
              </Collapse>
            </Box>
          );
        })}
      </List>

      {/* Footer: última sincronización */}
      <Box sx={{ mt: "auto" }}>
        <Divider />
        <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Última sincronización
            </Typography>
            <Typography variant="body2">{lastSyncText ?? "—"}</Typography>
          </Box>

          <IconButton
            onClick={onSync}
            disabled={!onSync}
            aria-label="sincronizar"
            title="Sincronizar"
          >
            <SyncIcon />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}

/** menú estilo POS */
export const allegraLikeMenu: MenuItem[] = [
  { type: "item", label: "Facturar", path: "/app/pos", icon: <HomeIcon /> },
  {
    type: "group",
    label: "Ingresos",
    icon: <AttachMoneyIcon />,
    children: [
      { label: "Historial de ventas", path: "/app/incomes/history" },
      { label: "Pagos", path: "/app/payments" },
    ],
  },

  {
    type: "group",
    label: "Turnos",
    icon: <SwapVertIcon />,
    children: [
      { label: "Historial de turnos", path: "/app/shifts" },
      { label: "Reportes de turnos", path: "/app/cash-count" },
    ],
  },

  {
    type: "item",
    label: "Gestión de efectivo",
    path: "/app/cash",
    icon: <AttachMoneyIcon />,
  },
  {
    type: "item",
    label: "Devoluciones",
    path: "/app/refunds",
    icon: <SwapVertIcon />,
  },
  {
    type: "item",
    label: "Contactos",
    path: "/app/contacts",
    icon: <PeopleAltIcon />,
  },

  {
    type: "group",
    label: "Inventario",
    icon: <Inventory2Icon />,
    children: [
      { label: "Productos", path: "/admin/products" }, // ajusta según rol
      { label: "Movimientos", path: "/app/stock-moves" },
      { label: "Bodegas", path: "/app/warehouses" },
    ],
  },

  {
    type: "item",
    label: "Compras",
    path: "/app/purchases",
    icon: <ShoppingCartIcon />,
  },
  {
    type: "item",
    label: "Configuraciones",
    path: "/app/settings",
    icon: <SettingsIcon />,
  },
];
