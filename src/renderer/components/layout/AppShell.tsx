import { ReactNode, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";

import { useAuth } from "@/composables/useAuth";

import SideMenu, { allegraLikeMenu } from "@/components/layoutMenu/SideMenu";
import UserMenu, { defaultUserMenuItems } from "@/components/layout/UserMenu";

export type NavItem = {
  label: string;
  path: string;
  icon?: ReactNode;
  disabled?: boolean;
};

const drawerWidth = 280;

export default function AppShell({
  title,
  basePath,
  navItems,
}: {
  title: string;
  basePath: string; // "/admin" o "/app"
  navItems: NavItem[];
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const selectedPath = useMemo(() => {
    // selecciona por prefijo para que /admin/products también marque "Productos"
    const found = navItems.find((i) => location.pathname.startsWith(i.path));
    return found?.path ?? "";
  }, [location.pathname, navItems]);

  const handleDrawerToggle = () => setMobileOpen((v) => !v);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const drawer = (
    <SideMenu
      title="POS"
      menu={allegraLikeMenu}
      onLogout={handleLogout}
      lastSyncText="06/02/2026 6:33 pm"
      onSync={() => console.log("sync")}
    />
  );

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />

      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: "none" } }}
            aria-label="open drawer"
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" noWrap component="div">
            {title}
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          <Button color="inherit" onClick={() => navigate(basePath)}>
            Inicio
          </Button>
        </Toolbar>
      </AppBar>

      {/* Drawer móvil */}
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>

        {/* Drawer desktop */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", sm: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Contenido */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar /> {/* empuja contenido debajo del AppBar */}
        <Outlet />
      </Box>
    </Box>
  );
}
