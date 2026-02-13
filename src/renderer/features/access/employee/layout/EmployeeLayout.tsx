import AppShell, { NavItem } from "@/components/layout/AppShell";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import HistoryIcon from "@mui/icons-material/History";
import PeopleIcon from "@mui/icons-material/People";

const employeeNav: NavItem[] = [
  { label: "Vender (POS)", path: "/app/pos", icon: <PointOfSaleIcon /> },
  { label: "Historial", path: "/app/history", icon: <HistoryIcon /> },
  { label: "Clientes", path: "/app/customers", icon: <PeopleIcon /> },
];

export default function EmployeeLayout() {
  return <AppShell title="Caja" basePath="/app" navItems={employeeNav} />;
}
