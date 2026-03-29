import type { MenuItem } from "@/app/layout/SideMenu";

import AssessmentIcon from "@mui/icons-material/Assessment";
import DashboardIcon from "@mui/icons-material/Dashboard";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SettingsIcon from "@mui/icons-material/Settings";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";

export const adminMenu: MenuItem[] = [
  { type: "item", label: "Resumen", path: "/admin", icon: <DashboardIcon /> },
  { type: "item", label: "Facturar", path: "/admin/pos", icon: <PointOfSaleIcon /> },
  {
    type: "group",
    label: "Ventas",
    icon: <ReceiptLongIcon />,
    children: [
      { label: "Historial", path: "/admin/sales" },
      { label: "Caja", path: "/admin/cash" },
    ],
  },
  {
    type: "group",
    label: "Corresponsal",
    icon: <AccountBalanceIcon />,
    children: [
      { label: "Transacciones", path: "/admin/correspondent" },
      { label: "Cuadre", path: "/admin/correspondent/closures" },
      { label: "Configuración", path: "/admin/correspondent/settings" },
    ],
  },
  {
    type: "group",
    label: "Inventario",
    icon: <Inventory2Icon />,
    children: [
      { label: "Productos", path: "/admin/products" },
      { label: "Movimientos", path: "/admin/stock-moves" },
    ],
  },
  {
    type: "group",
    label: "Compras",
    icon: <ShoppingCartIcon />,
    children: [
      { label: "Compras", path: "/admin/purchases" },
      { label: "Proveedores", path: "/admin/suppliers" },
    ],
  },
  {
    type: "group",
    label: "Gestión",
    icon: <PeopleAltIcon />,
    children: [
      { label: "Usuarios", path: "/admin/users" },
      { label: "Clientes", path: "/admin/customers" },
    ],
  },
  { type: "item", label: "Reportes", path: "/admin/reports", icon: <AssessmentIcon /> },
  { type: "item", label: "Configuración", path: "/admin/settings", icon: <SettingsIcon /> },
];

export const employeeMenu: MenuItem[] = [
  { type: "item", label: "Resumen", path: "/app", icon: <DashboardIcon /> },
  { type: "item", label: "Facturar", path: "/app/pos", icon: <PointOfSaleIcon /> },
  {
    type: "group",
    label: "Ventas",
    icon: <ReceiptLongIcon />,
    children: [
      { label: "Historial", path: "/app/sales" },
      { label: "Caja", path: "/app/cash" },
    ],
  },
  {
    type: "group",
    label: "Corresponsal",
    icon: <AccountBalanceIcon />,
    children: [
      { label: "Transacciones", path: "/app/correspondent" },
      { label: "Cuadre", path: "/app/correspondent/closures" },
    ],
  },
  { type: "item", label: "Clientes", path: "/app/customers", icon: <PeopleAltIcon /> },
  {
    type: "group",
    label: "Inventario",
    icon: <Inventory2Icon />,
    children: [
      { label: "Productos", path: "/app/products" },
      { label: "Movimientos", path: "/app/stock-moves" },
    ],
  },
  { type: "item", label: "Proveedores", path: "/app/suppliers", icon: <LocalShippingIcon /> },
];
