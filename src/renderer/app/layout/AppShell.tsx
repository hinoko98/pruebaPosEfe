import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import Drawer from "@mui/material/Drawer";
import Toolbar from "@mui/material/Toolbar";

import SideMenu, { MenuItem } from "./SideMenu";
import AppHeader from "./AppHeader";

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
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [syncLabel, setSyncLabel] = useState(lastSyncText ?? "Cargando...");

  const refreshSyncStatus = async () => {
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
  };

  useEffect(() => {
    void refreshSyncStatus();
  }, []);

  const drawer = (
    <SideMenu
      menu={menu}
      lastSyncText={syncLabel}
      onSync={() => {
        void refreshSyncStatus();
        onSync?.();
      }}
    />
  );

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <CssBaseline />

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
