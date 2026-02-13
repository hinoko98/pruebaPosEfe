import AppShell, { NavItem } from "@/components/layout/AppShell";
import DashboardIcon from "@mui/icons-material/Dashboard";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PeopleIcon from "@mui/icons-material/People";
import SettingsIcon from "@mui/icons-material/Settings";

const adminNav: NavItem[] = [
  { label: "Dashboard", path: "/admin", icon: <DashboardIcon /> },
  { label: "Productos", path: "/admin/products", icon: <Inventory2Icon /> },
  { label: "Clientes", path: "/admin/customers", icon: <PeopleIcon /> },
  { label: "Configuración", path: "/admin/settings", icon: <SettingsIcon /> },
];

export default function AdminLayout() {
  return <AppShell title="Panel Admin" basePath="/admin" navItems={adminNav} />;
}
