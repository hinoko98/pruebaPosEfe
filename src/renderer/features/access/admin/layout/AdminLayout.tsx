import AppShell from "@/app/layout/AppShell";
import { adminMenu } from "@/app/routes/menu";

export default function AdminLayout() {
  return (
    <AppShell
      title="Panel Admin"
      basePath="/admin"
      menu={adminMenu}
      onSync={() => console.log("sync")}
    />
  );
}
