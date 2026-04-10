import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, alpha, createTheme } from "@mui/material/styles";

export type AppThemeMode = "LIGHT" | "DARK";

type AppThemeContextValue = {
  themeMode: AppThemeMode;
  setThemeMode: (themeMode: AppThemeMode) => void;
};

const STORAGE_KEY = "pos-system-theme-mode";

const AppThemeContext = createContext<AppThemeContextValue | undefined>(undefined);

function readStoredThemeMode(): AppThemeMode {
  if (typeof window === "undefined") return "LIGHT";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "DARK" ? "DARK" : "LIGHT";
}

function buildTheme(themeMode: AppThemeMode) {
  const isDark = themeMode === "DARK";

  return createTheme({
    cssVariables: true,
    shape: {
      borderRadius: 18,
    },
    palette: isDark
      ? {
          mode: "dark",
          primary: {
            main: "#8bd74b",
            light: "#b5f07b",
            dark: "#5e9f2c",
            contrastText: "#11100d",
          },
          secondary: {
            main: "#d8d1c7",
          },
          background: {
            default: "#120f0d",
            paper: "#1b1714",
          },
          text: {
            primary: "#f7f2ea",
            secondary: "#bdb4a8",
          },
          divider: alpha("#f7f2ea", 0.08),
          success: {
            main: "#8bd74b",
          },
        }
      : {
          mode: "light",
          primary: {
            main: "#79bb37",
            light: "#a9dd6d",
            dark: "#4f8120",
            contrastText: "#ffffff",
          },
          secondary: {
            main: "#4c443d",
          },
          background: {
            default: "#f5efe8",
            paper: "#fffdfa",
          },
          text: {
            primary: "#1f1a17",
            secondary: "#6f675f",
          },
          divider: alpha("#1f1a17", 0.08),
          success: {
            main: "#5c9a27",
          },
        },
    typography: {
      fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
      h4: {
        fontWeight: 800,
      },
      h5: {
        fontWeight: 800,
      },
      h6: {
        fontWeight: 700,
      },
      subtitle1: {
        fontWeight: 700,
      },
      subtitle2: {
        fontWeight: 700,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundImage: "none",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: `1px solid ${isDark ? alpha("#f7f2ea", 0.08) : alpha("#1f1a17", 0.08)}`,
            boxShadow: isDark
              ? "0 16px 40px rgba(0,0,0,0.28)"
              : "0 18px 36px rgba(35, 26, 18, 0.08)",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? "#171310" : "#fffdfa",
            borderRight: `1px solid ${isDark ? alpha("#f7f2ea", 0.08) : alpha("#1f1a17", 0.08)}`,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "#171310" : "#fffdfa",
            backgroundImage: "none",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            textTransform: "none",
            fontWeight: 700,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: isDark ? alpha("#f7f2ea", 0.08) : alpha("#1f1a17", 0.08),
          },
          head: {
            fontWeight: 800,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 14,
          },
        },
      },
    },
  });
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<AppThemeMode>(() => readStoredThemeMode());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, themeMode);
  }, [themeMode]);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      themeMode,
      setThemeMode: setThemeModeState,
    }),
    [themeMode]
  );

  const theme = useMemo(() => buildTheme(themeMode), [themeMode]);

  return (
    <AppThemeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppThemeContext.Provider>
  );
}

export function useAppThemeMode() {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error("useAppThemeMode debe usarse dentro de AppThemeProvider");
  }
  return context;
}
