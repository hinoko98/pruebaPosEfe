import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import CssBaseline from '@mui/material/CssBaseline'
import { HashRouter } from "react-router-dom"; 
import { AuthProvider } from "@/composables/useAuth.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <HashRouter>
        <CssBaseline />
        <App />
      </HashRouter>
    </AuthProvider>
  </React.StrictMode>,
);

