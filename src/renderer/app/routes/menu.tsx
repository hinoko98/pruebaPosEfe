import type { MenuItem } from "@/app/layout/SideMenu";
import { APP_PERMISSION_KEYS } from "@/features/user/app-permissions";

import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AssessmentIcon from "@mui/icons-material/Assessment";
import DashboardIcon from "@mui/icons-material/Dashboard";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SettingsIcon from "@mui/icons-material/Settings";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";

export const adminMenu: MenuItem[] = [
  { type: "item", label: "Resumen", path: "/admin", icon: <DashboardIcon /> },
  {
    type: "item",
    label: "Facturar",
    path: "/admin/pos",
    icon: <PointOfSaleIcon />,
    permissionKey: APP_PERMISSION_KEYS.posAccess,
  },
  {
    type: "group",
    label: "Ventas",
    icon: <ReceiptLongIcon />,
    children: [
      { label: "Historial", path: "/admin/sales", permissionKey: APP_PERMISSION_KEYS.salesHistory },
      { label: "Caja", path: "/admin/cash", permissionKey: APP_PERMISSION_KEYS.cashView },
    ],
  },
  {
    type: "group",
    label: "Corresponsal",
    icon: <AccountBalanceIcon />,
    children: [
      { label: "Transacciones", path: "/admin/correspondent", permissionKey: APP_PERMISSION_KEYS.correspondentView },
      { label: "Cuadre", path: "/admin/correspondent/closures" },
      { label: "Configuracion", path: "/admin/correspondent/settings" },
    ],
  },
  {
    type: "group",
    label: "Inventario",
    icon: <Inventory2Icon />,
    children: [
      { label: "Productos", path: "/admin/products", permissionKey: APP_PERMISSION_KEYS.productsView },
      { label: "Movimientos", path: "/admin/stock-moves", permissionKey: APP_PERMISSION_KEYS.stockMovesView },
    ],
  },
  {
    type: "group",
    label: "Compras",
    icon: <ShoppingCartIcon />,
    children: [
      { label: "Compras", path: "/admin/purchases", permissionKey: APP_PERMISSION_KEYS.purchasesView },
      { label: "Proveedores", path: "/admin/suppliers", permissionKey: APP_PERMISSION_KEYS.suppliersView },
    ],
  },
  {
    type: "group",
    label: "Gestion",
    icon: <PeopleAltIcon />,
    children: [
      { label: "Usuarios", path: "/admin/users", permissionKey: APP_PERMISSION_KEYS.usersView },
      { label: "Roles y permisos", path: "/admin/roles", permissionKey: APP_PERMISSION_KEYS.rolesView },
      { label: "Clientes", path: "/admin/customers", permissionKey: APP_PERMISSION_KEYS.customersView },
    ],
  },
  {
    type: "item",
    label: "Reportes",
    path: "/admin/reports",
    icon: <AssessmentIcon />,
    permissionKey: APP_PERMISSION_KEYS.reportsView,
  },
  {
    type: "item",
    label: "Configuracion",
    path: "/admin/settings",
    icon: <SettingsIcon />,
    permissionKey: APP_PERMISSION_KEYS.settingsView,
  },
];

export const employeeMenu: MenuItem[] = [
  { type: "item", label: "Resumen", path: "/app", icon: <DashboardIcon /> },
  {
    type: "item",
    label: "Facturar",
    path: "/app/pos",
    icon: <PointOfSaleIcon />,
    permissionKey: APP_PERMISSION_KEYS.posAccess,
  },
  {
    type: "group",
    label: "Ventas",
    icon: <ReceiptLongIcon />,
    children: [
      { label: "Historial", path: "/app/sales", permissionKey: APP_PERMISSION_KEYS.salesHistory },
      { label: "Caja", path: "/app/cash", permissionKey: APP_PERMISSION_KEYS.cashView },
    ],
  },
  {
    type: "group",
    label: "Corresponsal",
    icon: <AccountBalanceIcon />,
    children: [
      { label: "Transacciones", path: "/app/correspondent", permissionKey: APP_PERMISSION_KEYS.correspondentView },
      { label: "Cuadre", path: "/app/correspondent/closures" },
    ],
  },
  {
    type: "item",
    label: "Clientes",
    path: "/app/customers",
    icon: <PeopleAltIcon />,
    permissionKey: APP_PERMISSION_KEYS.customersView,
  },
  {
    type: "group",
    label: "Inventario",
    icon: <Inventory2Icon />,
    children: [
      { label: "Productos", path: "/app/products", permissionKey: APP_PERMISSION_KEYS.productsView },
      { label: "Movimientos", path: "/app/stock-moves", permissionKey: APP_PERMISSION_KEYS.stockMovesView },
    ],
  },
  {
    type: "item",
    label: "Proveedores",
    path: "/app/suppliers",
    icon: <LocalShippingIcon />,
    permissionKey: APP_PERMISSION_KEYS.suppliersView,
  },
];
