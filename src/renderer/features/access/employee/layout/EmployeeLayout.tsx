import AppShell from "@/app/layout/AppShell";
import { employeeMenu } from "@/app/routes/menu";

export default function EmployeeLayout() {
  return (
    <AppShell
      title="Caja"
      basePath="/app"
      menu={employeeMenu}
      onSync={() => console.log("sync")}
    />
  );
}
