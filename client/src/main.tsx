import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { App } from "./App";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { DisplayPage } from "./pages/DisplayPage";
import { AdminPage } from "./pages/AdminPage";
import { LoginPage } from "./pages/LoginPage";
import "./index.css";

/**
 * Route tree. Guards read `useAuth().isAuthenticated` which is reactive — when
 * login/logout flips the flag, every guard re-evaluates immediately and the
 * user lands on the right page without a manual refresh.
 */
function AppRoutes() {
  const { isAuthenticated } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<App />}>
        <Route index element={<Navigate to="/display" replace />} />
        <Route path="display" element={<DisplayPage />} />
        <Route
          path="login"
          element={
            isAuthenticated ? <Navigate to="/admin" replace /> : <LoginPage />
          }
        />
        <Route
          path="admin"
          element={
            isAuthenticated ? <AdminPage /> : <Navigate to="/login" replace />
          }
        />
        <Route path="*" element={<Navigate to="/display" replace />} />
      </Route>
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
