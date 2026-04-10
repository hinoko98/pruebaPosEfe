import type { MenuItem } from "@/app/layout/SideMenu";
import { APP_PERMISSION_KEYS } from "@/features/user/app-permissions";

import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import DashboardIcon from "@mui/icons-material/Dashboard";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import SettingsIcon from "@mui/icons-material/Settings";

export const adminMenu: MenuItem[] = [
  { type: "item", label: "Resumen", path: "/admin", icon: <DashboardIcon /> },
  {
    type: "group",
    label: "Operacion comercial",
    icon: <PointOfSaleIcon />,
    children: [
      { label: "Facturar", path: "/admin/pos", permissionKey: APP_PERMISSION_KEYS.posAccess },
      { label: "Ventas", path: "/admin/sales", permissionKey: APP_PERMISSION_KEYS.salesHistory },
      { label: "Clientes", path: "/admin/customers", permissionKey: APP_PERMISSION_KEYS.customersView },
    ],
  },
  {
    type: "group",
    label: "Tesoreria",
    icon: <AccountBalanceIcon />,
    children: [
      { label: "Caja general", path: "/admin/cash", permissionKey: APP_PERMISSION_KEYS.cashView },
      { label: "Transacciones", path: "/admin/correspondent", permissionKey: APP_PERMISSION_KEYS.correspondentView },
      { label: "Historial", path: "/admin/correspondent/history", permissionKey: APP_PERMISSION_KEYS.correspondentView },
      { label: "Resumen diario", path: "/admin/correspondent/closures" },
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
    label: "Control financiero",
    icon: <AccountBalanceWalletIcon />,
    children: [
      { label: "Centro contable", path: "/admin/accounting", permissionKey: APP_PERMISSION_KEYS.reportsView },
      { label: "Reportes", path: "/admin/reports", permissionKey: APP_PERMISSION_KEYS.reportsView },
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
    ],
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
    type: "group",
    label: "Operacion comercial",
    icon: <PointOfSaleIcon />,
    children: [
      { label: "Facturar", path: "/app/pos", permissionKey: APP_PERMISSION_KEYS.posAccess },
      { label: "Ventas", path: "/app/sales", permissionKey: APP_PERMISSION_KEYS.salesHistory },
      { label: "Clientes", path: "/app/customers", permissionKey: APP_PERMISSION_KEYS.customersView },
    ],
  },
  {
    type: "group",
    label: "Tesoreria",
    icon: <AccountBalanceIcon />,
    children: [
      { label: "Caja general", path: "/app/cash", permissionKey: APP_PERMISSION_KEYS.cashView },
      { label: "Transacciones", path: "/app/correspondent", permissionKey: APP_PERMISSION_KEYS.correspondentView },
      { label: "Historial", path: "/app/correspondent/history", permissionKey: APP_PERMISSION_KEYS.correspondentView },
      { label: "Resumen diario", path: "/app/correspondent/closures" },
    ],
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
    type: "group",
    label: "Control financiero",
    icon: <AccountBalanceWalletIcon />,
    children: [
      { label: "Centro contable", path: "/app/accounting", permissionKey: APP_PERMISSION_KEYS.reportsView },
      { label: "Compras", path: "/app/purchases", permissionKey: APP_PERMISSION_KEYS.purchasesView },
      { label: "Proveedores", path: "/app/suppliers", permissionKey: APP_PERMISSION_KEYS.suppliersView },
    ],
  },
];
