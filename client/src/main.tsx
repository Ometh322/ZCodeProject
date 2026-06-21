import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { App } from "./App";
import { DisplayPage } from "./pages/DisplayPage";
import { AdminPage } from "./pages/AdminPage";
import { LoginPage } from "./pages/LoginPage";
import { api } from "./api";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/display" replace />} />
          <Route path="display" element={<DisplayPage />} />
          <Route
            path="login"
            element={
              api.isLoggedIn() ? <Navigate to="/admin" replace /> : <LoginPage />
            }
          />
          <Route
            path="admin"
            element={
              api.isLoggedIn() ? <AdminPage /> : <Navigate to="/login" replace />
            }
          />
          <Route path="*" element={<Navigate to="/display" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
