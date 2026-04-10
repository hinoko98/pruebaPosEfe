import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { HashRouter } from "react-router-dom"; 
import { AuthProvider } from "@/features/auth/hooks/useAuth.tsx";
import { AppThemeProvider } from "@/theme/AppThemeProvider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <AppThemeProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </AppThemeProvider>
    </AuthProvider>
  </React.StrictMode>,
);

