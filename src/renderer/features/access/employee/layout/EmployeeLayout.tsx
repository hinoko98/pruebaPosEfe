import AppShell from "@/app/layout/AppShell";
import { employeeMenu } from "@/app/routes/menu";

export default function EmployeeLayout() {
  return (
    <AppShell
      title="Caja"
      basePath="/app"
      menu={employeeMenu}
      lastSyncText="06/02/2026 6:33 pm"
      onSync={() => console.log("sync")}
    />
  );
  }