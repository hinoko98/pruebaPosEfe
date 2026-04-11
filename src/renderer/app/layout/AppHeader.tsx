import { useEffect, useMemo, useState } from "react";

import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
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
  const [notifications, setNotifications] = useState<
    Array<{ id: string; title: string; detail: string; count: number; path: string; actionLabel: string; readKey: string }>
  >([]);
  const [notificationsAnchor, setNotificationsAnchor] = useState<null | HTMLElement>(null);
  const [readNotificationKeys, setReadNotificationKeys] = useState<string[]>([]);

  const displayUserName = useMemo(() => {
    const rawName = (user?.name ?? user?.username ?? "").trim();
    if (!rawName) return "Usuario";
    return rawName.split(/\s+/)[0] || rawName;
  }, [user?.name, user?.username]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadReadNotifications = async () => {
      if (!user) return;
      const response = await window.api.getReadNotifications();
      if (!mounted || !response.success) return;
      setReadNotificationKeys(response.readKeys);
    };

    void loadReadNotifications();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    const loadNotifications = async () => {
      try {
        const [productsResponse, correspondentResponse, accountingResponse] = await Promise.all([
          window.api.listProductsAdmin(),
          window.api.getCorrespondentDashboard(),
          window.api.getAccountingSummary(),
        ]);

        if (!mounted) return;

        const threshold = 5;
        const products = productsResponse.success ? productsResponse.products : [];
        const outOfStockProducts = products.filter((product) => product.isActive && product.stock <= 0);
        const lowStockProducts = products
          .filter((product) => product.isActive && product.stock > 0 && product.stock <= threshold)
          .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, "es"))
          .slice(0, 4);
        const pendingClosures = correspondentResponse.success ? correspondentResponse.totals.pendingClosureCount : 0;
        const pendingCredits = accountingResponse.success ? accountingResponse.summary.pendingCreditsCount : 0;

        const nextNotifications = [
          outOfStockProducts.length > 0
            ? {
                id: "out-of-stock",
                title: "Productos agotados",
                detail: `${outOfStockProducts.length} producto(s) sin existencias.`,
                count: outOfStockProducts.length,
                path: `${basePath}/products`,
                actionLabel: "Ir a productos",
              }
            : null,
          ...lowStockProducts.map((product) => ({
            id: `low-stock-${product.id}`,
            title: "Stock bajo",
            detail: `${product.name} con ${product.stock} unidad(es) disponibles.`,
            count: 1,
            path: `${basePath}/products`,
            actionLabel: "Revisar producto",
          })),
          ...(correspondentResponse.success
            ? correspondentResponse.perPlatform
                .filter((platform) => platform.pendingClosureCount > 0)
                .map((platform) => ({
                  id: `correspondent-pending-${platform.platformId}`,
                  title: "Corresponsal pendiente",
                  detail: `${platform.platform}: ${platform.pendingClosureCount} movimiento(s) pendiente(s) de cuadre.`,
                  count: platform.pendingClosureCount,
                  path: `${basePath}/correspondent/closures`,
                  actionLabel: "Ir a cuadre",
                }))
            : pendingClosures > 0
              ? [
                  {
                    id: "correspondent-pending",
                    title: "Corresponsal pendiente",
                    detail: `${pendingClosures} movimiento(s) pendiente(s) de cuadre.`,
                    count: pendingClosures,
                    path: `${basePath}/correspondent/closures`,
                    actionLabel: "Ir a cuadre",
                  },
                ]
              : []),
          pendingCredits > 0
            ? {
                id: "pending-credits",
                title: "Cartera pendiente",
                detail: `${pendingCredits} cuenta(s) por cobrar requieren seguimiento.`,
                count: pendingCredits,
                path: `${basePath}/accounting`,
                actionLabel: "Ir a contabilidad",
              }
            : null,
        ]
          .filter(
            (
              entry
            ): entry is { id: string; title: string; detail: string; count: number; path: string; actionLabel: string } =>
              entry !== null
          )
          .map((entry) => ({
            ...entry,
            readKey: `${entry.id}:${entry.count}:${entry.detail}`,
          }));

        setNotifications(nextNotifications);
        setReadNotificationKeys((current) => current.filter((key) => nextNotifications.some((item) => item.readKey === key)));
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
    () =>
      notifications
        .filter((notification) => !readNotificationKeys.includes(notification.readKey))
        .reduce((sum, notification) => sum + notification.count, 0),
    [notifications, readNotificationKeys]
  );

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !readNotificationKeys.includes(notification.readKey)),
    [notifications, readNotificationKeys]
  );

  const displayedNotifications = unreadNotifications.length > 0 ? unreadNotifications : notifications;

  const handleNotificationClick = async (notification: (typeof notifications)[number]) => {
    setReadNotificationKeys((current) =>
      current.includes(notification.readKey) ? current : [...current, notification.readKey]
    );
    void window.api.markNotificationsRead([notification.readKey]);
    setNotificationsAnchor(null);
    navigate(notification.path);
  };

  const handleMarkAllAsRead = async () => {
    const nextReadKeys = notifications.map((notification) => notification.readKey);
    setReadNotificationKeys(nextReadKeys);
    void window.api.markNotificationsRead(nextReadKeys);
  };

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
                name: displayUserName,
                role: user.role,
                permissions: user.permissions,
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
        <Box px={2} py={1.5} display="flex" justifyContent="space-between" alignItems="center" gap={2}>
          <Box>
            <Typography variant="subtitle2" fontWeight={800}>
              Notificaciones
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {displayedNotifications.length > 0
                ? `${displayedNotifications.length} alerta(s) para revisar`
                : "No hay alertas pendientes"}
            </Typography>
          </Box>
          {unreadNotifications.length > 0 ? (
            <Button size="small" onClick={handleMarkAllAsRead}>
              Marcar leidas
            </Button>
          ) : null}
        </Box>
        <Divider />
        {displayedNotifications.length === 0 ? (
          <MenuItem disabled>
            <ListItemText primary="Sin novedades" secondary="No hay alertas pendientes por ahora." />
          </MenuItem>
        ) : (
          displayedNotifications.map((notification) => (
            <MenuItem
              key={notification.readKey}
              onClick={() => handleNotificationClick(notification)}
              sx={{ py: 1.25, alignItems: "flex-start" }}
            >
              <ListItemText
                primary={notification.title}
                secondary={`${notification.detail} • ${notification.actionLabel}`}
              />
            </MenuItem>
          ))
        )}
      </Menu>
    </AppBar>
  );
}
