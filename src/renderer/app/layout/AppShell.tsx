import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";

import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Toolbar from "@mui/material/Toolbar";

import SideMenu, { MenuItem } from "./SideMenu";
import AppHeader from "./AppHeader";
import { hasPermission } from "@/features/auth/permissions";
import { useAuth } from "@/features/auth/hooks/useAuth";

const drawerWidth = 280;

type AppShellProps = {
  title: string;
  basePath: "/admin" | "/app";
  menu: MenuItem[];
  lastSyncText?: string;
  onSync?: () => void;
};

export default function AppShell({
  title,
  basePath,
  menu,
  lastSyncText,
  onSync,
}: AppShellProps) {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [syncLabel, setSyncLabel] = useState(lastSyncText ?? "Cargando...");

  const refreshSyncStatus = useCallback(async () => {
    if (!window.api?.getAppStatus) {
      setSyncLabel(lastSyncText ?? "Sin datos");
      return;
    }

    const response = await window.api.getAppStatus();
    if (!response.success) {
      setSyncLabel(lastSyncText ?? "Sin datos");
      return;
    }

    setSyncLabel(new Date(response.connectedAt).toLocaleString("es-CO"));
  }, [lastSyncText]);

  useEffect(() => {
    void refreshSyncStatus();
  }, [refreshSyncStatus]);

  const visibleMenu = useMemo<MenuItem[]>(
    () =>
      menu
        .map((item) => {
          if (item.type === "item") {
            return hasPermission(user, item.permissionKey) ? item : null;
          }

          if (item.type === "group") {
            const children = item.children.filter((child) => hasPermission(user, child.permissionKey));
            return children.length > 0 ? { ...item, children } : null;
          }

          return item;
        })
        .filter((item): item is MenuItem => item !== null),
    [menu, user]
  );

  const drawer = (
    <SideMenu
      menu={visibleMenu}
      lastSyncText={syncLabel}
      onSync={() => {
        void refreshSyncStatus();
        onSync?.();
      }}
    />
  );

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      {/* HEADER */}
      <AppHeader
        title={title}
        basePath={basePath}
        onToggleDesktopMenu={() => setDrawerOpen((v) => !v)}
      />

      {/* NAV */}
      <Box
        component="nav"
        sx={{
          width: { sm: drawerOpen ? drawerWidth : 0 },
          flexShrink: { sm: 0 },
        }}
      >
        {/* Drawer desktop colapsable */}
        <Drawer
          variant="persistent"
          open={drawerOpen}
          sx={{
            display: { xs: "none", sm: "block" },
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
            },
          }}
        >
          <Toolbar />
          {drawer}
        </Drawer>
      </Box>

      {/* CONTENT */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          overflow: "auto",
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
