import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import Login from "@/pages/Login";
import Layout from "@/pages/Layout";
import Dashboard from "@/pages/Dashboard";
import ItemsPage from "@/pages/ItemsPage";
import StockEntry from "@/pages/StockEntry";
import IssuePage from "@/pages/IssuePage";
import CurrentStock from "@/pages/CurrentStock";
import MonthlyUtil from "@/pages/MonthlyUtil";
import IndentNextYear from "@/pages/IndentNextYear";
import SupplyOrder from "@/pages/SupplyOrder";
import ShortExpiry from "@/pages/ShortExpiry";
import LowStock from "@/pages/LowStock";
import NilStock from "@/pages/NilStock";

function Protected() {
  const { user, checking } = useAuth();
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="App">
        <Toaster richColors position="top-right" />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Protected />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/items/:department" element={<ItemsPage />} />
                <Route path="/stock-entry" element={<StockEntry />} />
                <Route path="/issue" element={<IssuePage />} />
                <Route path="/current-stock" element={<CurrentStock />} />
                <Route path="/monthly-utilisation" element={<MonthlyUtil />} />
                <Route path="/indent-next-year" element={<IndentNextYear />} />
                <Route path="/supply-order" element={<SupplyOrder />} />
                <Route path="/short-expiry" element={<ShortExpiry />} />
                <Route path="/low-stock" element={<LowStock />} />
                <Route path="/nil-stock" element={<NilStock />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </div>
    </AuthProvider>
  );
}
