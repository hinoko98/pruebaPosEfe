import type { MenuItem } from "@/app/layout/SideMenu";

import DashboardIcon from "@mui/icons-material/Dashboard";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import SettingsIcon from "@mui/icons-material/Settings";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";

export const adminMenu: MenuItem[] = [
  { type: "item", label: "Dashboard", path: "/admin", icon: <DashboardIcon /> },
  { type: "item", label: "Facturar", path: "/admin/pos", icon: <PointOfSaleIcon /> },  
  {
    type: "group",
    label: "Inventario",
    icon: <Inventory2Icon />,
    children: [
      { label: "Productos", path: "/admin/products" },
      { label: "Movimientos", path: "/admin/stock-moves" },
    ],
  },
  { type: "item", label: "Clientes", path: "/admin/customers", icon: <PeopleAltIcon /> },
  { type: "item", label: "Configuración", path: "/admin/settings", icon: <SettingsIcon /> },
];

export const employeeMenu: MenuItem[] = [
  { type: "item", label: "Facturar", path: "/app/pos", icon: <PointOfSaleIcon /> },
  {
    type: "group",
    label: "Turnos",
    icon: <SwapVertIcon />,
    children: [
      { label: "Apertura/Cierre", path: "/app/shifts" },
      { label: "Arqueo", path: "/app/cash-count" },
    ],
  },
  { type: "item", label: "Gestión de efectivo", path: "/app/cash", icon: <AttachMoneyIcon /> },
  { type: "item", label: "Clientes", path: "/app/customers", icon: <PeopleAltIcon /> },
  { type: "item", label: "Configuración", path: "/app/settings", icon: <SettingsIcon /> },
];
