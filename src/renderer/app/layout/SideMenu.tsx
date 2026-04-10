import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { alpha } from "@mui/material/styles";

export type MenuItem =
  | {
      type: "item";
      label: string;
      path: string;
      icon?: React.ReactNode;
      disabled?: boolean;
      permissionKey?: string;
    }
  | {
      type: "group";
      label: string;
      icon?: React.ReactNode;
      children: Array<{
        label: string;
        path: string;
        disabled?: boolean;
        permissionKey?: string;
      }>;
    }
  | { type: "divider" };

export default function SideMenu({
  menu,
  lastSyncText: _lastSyncText,
  onSync: _onSync,
}: {
  menu: MenuItem[];
  lastSyncText?: string;
  onSync?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const activePath = location.pathname;

  const isPathActive = (path: string, exact = false) =>
    exact ? activePath === path : activePath === path || activePath.startsWith(path + "/");

  const autoOpenGroups = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const item of menu) {
      if (item.type === "group") {
        map[item.label] = item.children.some((child) => isPathActive(child.path));
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath]);

  const isGroupOpen = (label: string) => openGroups[label] ?? autoOpenGroups[label] ?? false;

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !isGroupOpen(label) }));

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <List sx={{ px: 1 }}>
        {menu.map((item, idx) => {
          if (item.type === "divider") {
            return <Divider key={`divider-${idx}`} sx={{ my: 1 }} />;
          }

          if (item.type === "item") {
            const selected = isPathActive(item.path, true);

            return (
              <ListItemButton
                key={item.path}
                selected={selected}
                disabled={item.disabled}
                onClick={() => navigate(item.path)}
                sx={(theme) => ({
                  borderRadius: 2,
                  mb: 0.5,
                  "&.Mui-selected": {
                    backgroundColor:
                      theme.palette.mode === "dark"
                        ? alpha(theme.palette.primary.main, 0.2)
                        : alpha(theme.palette.primary.main, 0.14),
                    color: theme.palette.text.primary,
                  },
                  "&.Mui-selected:hover": {
                    backgroundColor:
                      theme.palette.mode === "dark"
                        ? alpha(theme.palette.primary.main, 0.24)
                        : alpha(theme.palette.primary.main, 0.18),
                  },
                  "&:hover": {
                    backgroundColor:
                      theme.palette.mode === "dark"
                        ? alpha(theme.palette.common.white, 0.04)
                        : alpha(theme.palette.primary.main, 0.08),
                  },
                })}
              >
                {item.icon ? (
                  <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>{item.icon}</ListItemIcon>
                ) : null}
                <ListItemText primary={item.label} />
              </ListItemButton>
            );
          }

          const open = isGroupOpen(item.label);

          return (
            <Box key={item.label} sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => toggleGroup(item.label)}
                sx={(theme) => ({
                  borderRadius: 2,
                  "&:hover": {
                    backgroundColor:
                      theme.palette.mode === "dark"
                        ? alpha(theme.palette.common.white, 0.04)
                        : alpha(theme.palette.primary.main, 0.08),
                  },
                })}
              >
                {item.icon ? <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon> : null}
                <ListItemText primary={item.label} />
                {open ? <ExpandMoreIcon /> : <ChevronRightIcon />}
              </ListItemButton>

              <Collapse in={open} timeout="auto" unmountOnExit>
                <List disablePadding sx={{ pl: 2 }}>
                  {item.children.map((child) => (
                    <ListItemButton
                      key={child.path}
                      selected={isPathActive(child.path, true)}
                      disabled={child.disabled}
                      onClick={() => navigate(child.path)}
                      sx={(theme) => ({
                        borderRadius: 2,
                        mb: 0.25,
                        "&.Mui-selected": {
                          backgroundColor:
                            theme.palette.mode === "dark"
                              ? alpha(theme.palette.primary.main, 0.2)
                              : alpha(theme.palette.primary.main, 0.14),
                          color: theme.palette.text.primary,
                        },
                        "&.Mui-selected:hover": {
                          backgroundColor:
                            theme.palette.mode === "dark"
                              ? alpha(theme.palette.primary.main, 0.24)
                              : alpha(theme.palette.primary.main, 0.18),
                        },
                        "&:hover": {
                          backgroundColor:
                            theme.palette.mode === "dark"
                              ? alpha(theme.palette.common.white, 0.04)
                              : alpha(theme.palette.primary.main, 0.08),
                        },
                      })}
                    >
                      <ListItemIcon sx={{ minWidth: 40, color: "inherit" }}>
                        <ChevronRightIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={child.label} />
                    </ListItemButton>
                  ))}
                </List>
              </Collapse>
            </Box>
          );
        })}
      </List>

      <Box sx={{ mt: "auto" }} />
    </Box>
  );
}
