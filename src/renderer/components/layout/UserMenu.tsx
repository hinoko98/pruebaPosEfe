import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";

import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import SecurityIcon from "@mui/icons-material/Security";
import PersonIcon from "@mui/icons-material/Person";
import AppsIcon from "@mui/icons-material/Apps";
import MonitorIcon from "@mui/icons-material/Monitor";
import BarChartIcon from "@mui/icons-material/BarChart";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

export type Role = "ADMIN" | "EMPLOYEE";

export type UserMenuItem = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  path?: string; // navegación interna
  external?: boolean; // si abre afuera (en web)
  href?: string; // link externo
  roles?: Role[]; // opcional: restringe por rol
  dividerBefore?: boolean;
};

export default function UserMenu({
  user,
  onLogout,
  items,
}: {
  user: { name: string; email?: string; role: Role };
  onLogout: () => void;
  items: UserMenuItem[];
}) {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const open = Boolean(anchorEl);

  const visibleItems = useMemo(() => {
    return items.filter((i) => {
      if (!i.roles) return true;
      return i.roles.includes(user.role);
    });
  }, [items, user.role]);

  const initials = useMemo(() => {
    const parts = user.name.trim().split(/\s+/);
    const a = parts[0]?.[0] ?? "U";
    const b = parts[1]?.[0] ?? "";
    return (a + b).toUpperCase();
  }, [user.name]);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) =>
    setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleItemClick = (item: UserMenuItem) => {
    handleClose();

    if (item.external && item.href) {
      // En Electron luego podrías abrir con shell.openExternal(...)
      window.open(item.href, "_blank");
      return;
    }

    if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <>
      <IconButton onClick={handleOpen} size="small" aria-label="user menu">
        <Avatar sx={{ width: 34, height: 34 }}>{initials}</Avatar>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        PaperProps={{ sx: { width: 320, borderRadius: 3, overflow: "hidden" } }}
      >
        {/* Header */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography fontWeight={700}>{user.name}</Typography>
          {user.email ? (
            <Typography variant="body2" color="text.secondary">
              {user.email}
            </Typography>
          ) : null}
        </Box>

        <Divider />

        {visibleItems.map((item) => (
          <Box key={item.key}>
            {item.dividerBefore ? <Divider /> : null}

            <MenuItem onClick={() => handleItemClick(item)}>
              {item.icon ? <ListItemIcon>{item.icon}</ListItemIcon> : null}
              <Typography variant="body2" sx={{ flex: 1 }}>
                {item.label}
              </Typography>
              {item.external ? <OpenInNewIcon fontSize="small" /> : null}
            </MenuItem>
          </Box>
        ))}

        <Divider />

        <MenuItem
          onClick={() => {
            handleClose();
            onLogout();
          }}
        >
          <ListItemIcon>
            <LogoutIcon />
          </ListItemIcon>
          Cerrar sesión
        </MenuItem>
      </Menu>
    </>
  );
}

/** Items default recomendados (los “generales” que pediste) */
export function defaultUserMenuItems(
  basePath: "/admin" | "/app",
): UserMenuItem[] {
  return [
    // Generales para TODOS
    {
      key: "profile",
      label: "Mi Perfil",
      icon: <PersonIcon />,
      path: `${basePath}/profile`,
    },
    {
      key: "security",
      label: "Seguridad",
      icon: <SecurityIcon />,
      path: `${basePath}/security`,
    },
    {
      key: "settings",
      label: "Configuraciones",
      icon: <SettingsIcon />,
      path: `${basePath}/settings`,
    },
  ];
}
