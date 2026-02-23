import AppShell from "@/app/layout/AppShell";
import { adminMenu } from "@/app/routes/menu";

export default function AdminLayout() {
  return (
    <AppShell    
      title="Panel Admin"
      basePath="/admin"
      menu={adminMenu}
      lastSyncText="06/02/2026 6:33 pm"
      onSync={() => console.log("sync")}
      
    />
  );
}
