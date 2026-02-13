import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AuthUser, Role } from "@/features/auth/types";

type AuthContextType = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;

  // Por ahora mock. Luego lo conectas a IPC/DB sin romper la app.
  login: (payload: { username: string; password?: string }) => Promise<void>;
  logout: () => void;

  // útil para setear usuario desde backend/IPC en el futuro
  setUser: (user: AuthUser | null) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LS_USER_KEY = "authUser"; // guarda el usuario completo (mock). Luego puedes guardar token.

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar sesión al iniciar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_USER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AuthUser;
        setUser(parsed);
      }
    } catch {
      // si el JSON está roto, limpiamos
      localStorage.removeItem(LS_USER_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Login mock (después reemplazas por IPC: window.posAPI.auth.login())
  const login: AuthContextType["login"] = async ({ username }) => {
    // ejemplo: si username contiene "admin" será ADMIN; si no, EMPLOYEE (solo para probar)
    const role: Role = username.toLowerCase().includes("admin") ? "ADMIN" : "EMPLOYEE";

    const fakeUser: AuthUser = {
      id: crypto.randomUUID(),
      username,
      name: username,
      role,
    };

    localStorage.setItem(LS_USER_KEY, JSON.stringify(fakeUser));
    setUser(fakeUser);
  };

  const logout = () => {
    localStorage.removeItem(LS_USER_KEY);
    setUser(null);
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: !!user,
      loading,
      login,
      logout,
      setUser,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
