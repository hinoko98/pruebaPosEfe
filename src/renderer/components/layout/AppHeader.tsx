import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import MenuIcon from "@mui/icons-material/Menu";

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
          <UserMenu
            user={{
              name: user.name ?? user.username,
              role: user.role,
            }}
            items={defaultUserMenuItems(basePath)}
            onLogout={handleLogout}
          />
        ) : null}
      </Toolbar>
    </AppBar>
  );
}
