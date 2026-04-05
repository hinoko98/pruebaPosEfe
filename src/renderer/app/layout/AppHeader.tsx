import { useEffect, useMemo, useState } from "react";

import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Badge from "@mui/material/Badge";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";

import UserMenu, { defaultUserMenuItems } from "./UserMenu";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useNavigate } from "react-router-dom";

type AppHeaderProps = {
  title?: string;
  basePath: "/admin" | "/app";
  onToggleDesktopMenu?: () => void; // colapsa/expande drawer en desktop
};

export default function AppHeader({
  title = "POS",
  basePath,
  onToggleDesktopMenu,
}: AppHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; detail: string; count: number }>>([]);
  const [notificationsAnchor, setNotificationsAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadNotifications = async () => {
      try {
        const [products, correspondentResponse] = await Promise.all([
          window.api.listProducts(),
          window.api.getCorrespondentDashboard(),
        ]);

        if (!mounted) return;

        const threshold = 5;
        const outOfStockCount = products.filter((product) => product.stock <= 0).length;
        const lowStockCount = products.filter((product) => product.stock > 0 && product.stock <= threshold).length;
        const pendingClosures = correspondentResponse.success ? correspondentResponse.totals.pendingClosureCount : 0;

        const nextNotifications = [
          outOfStockCount > 0
            ? {
                id: "out-of-stock",
                title: "Productos agotados",
                detail: `${outOfStockCount} producto(s) sin existencias.`,
                count: outOfStockCount,
              }
            : null,
          lowStockCount > 0
            ? {
                id: "low-stock",
                title: "Stock bajo",
                detail: `${lowStockCount} producto(s) con stock reducido.`,
                count: lowStockCount,
              }
            : null,
          pendingClosures > 0
            ? {
                id: "correspondent-pending",
                title: "Corresponsal pendiente",
                detail: `${pendingClosures} movimiento(s) pendiente(s) de cuadre.`,
                count: pendingClosures,
              }
            : null,
        ].filter((entry): entry is { id: string; title: string; detail: string; count: number } => entry !== null);

        setNotifications(nextNotifications);
      } catch {
        if (!mounted) return;
        setNotifications([]);
      }
    };

    void loadNotifications();
    const timer = window.setInterval(() => void loadNotifications(), 60000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const notificationsCount = useMemo(
    () => notifications.reduce((sum, notification) => sum + notification.count, 0),
    [notifications]
  );

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: (t) => t.zIndex.drawer + 1,
        bgcolor: "background.paper",
        color: "text.primary",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        {/* Botón menú en desktop */}
        <IconButton
          onClick={onToggleDesktopMenu}
          sx={{ display: { xs: "none", sm: "inline-flex" } }}
          edge="start"
          aria-label="toggle drawer desktop"
        >
          <MenuIcon />
        </IconButton>

        <Typography fontWeight={700} noWrap>
          {title}
        </Typography>

        <Box sx={{ flexGrow: 1 }} />
        {user ? (
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", md: "block" } }}>
              {currentTime.toLocaleTimeString("es-CO")}
            </Typography>

            <IconButton
              aria-label="notificaciones"
              onClick={(event) => setNotificationsAnchor(event.currentTarget)}
            >
              <Badge color="error" badgeContent={notificationsCount} max={99}>
                <NotificationsOutlinedIcon />
              </Badge>
            </IconButton>

            <UserMenu
              user={{
                name: user.name ?? user.username,
                role: user.role,
              }}
              items={defaultUserMenuItems(basePath)}
              onLogout={handleLogout}
            />
          </Box>
        ) : null}
      </Toolbar>

      <Menu
        anchorEl={notificationsAnchor}
        open={Boolean(notificationsAnchor)}
        onClose={() => setNotificationsAnchor(null)}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        PaperProps={{ sx: { width: 320, borderRadius: 3 } }}
      >
        {notifications.length === 0 ? (
          <MenuItem disabled>
            <ListItemText primary="Sin novedades" secondary="No hay alertas pendientes por ahora." />
          </MenuItem>
        ) : (
          notifications.map((notification) => (
            <MenuItem key={notification.id} onClick={() => setNotificationsAnchor(null)}>
              <ListItemText primary={notification.title} secondary={notification.detail} />
            </MenuItem>
          ))
        )}
      </Menu>
    </AppBar>
  );
}
