import { Routes, Route, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import Home from "./pages/Home";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Dashboard from "./pages/citizen/Dashboard";
import SubmitComplaint from "./pages/citizen/SubmitComplaint";
import MyComplaints from "./pages/citizen/MyComplaints";
import MapView from "./pages/citizen/MapView";
import OfficerDashboard from "./pages/officer/OfficerDashboard";
import WorkerDashboard from "./pages/worker/WorkerDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ProtectedRoute from "./navigation/ProtectedRoute";
import DashboardLayout from "./layout/DashboardLayout";

function RootRedirect() {
  const auth = useSelector((s: any) => s.auth);
  const loggedIn = auth?.isAuthenticated || auth?.isLoggedIn || false;
  const role = auth?.user?.role || "citizen";

  if (!loggedIn) return <Navigate to="/login" replace />;
  if (role === "officer") return <Navigate to="/officer-dashboard" replace />;
  if (role === "worker")  return <Navigate to="/worker-dashboard" replace />;
  if (role === "admin")   return <Navigate to="/admin-dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function AppRoutes() {
  return (
    <Routes>

      {/* ── PUBLIC ─────────────────────────────────────────────────── */}
      <Route path="/"         element={<Home />} />
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* ── CITIZEN — wrapped in DashboardLayout ───────────────────── */}
      <Route
        element={
          <ProtectedRoute allowedRoles={["citizen"]}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard"        element={<Dashboard />} />
        <Route path="/submit-complaint" element={<SubmitComplaint />} />
        <Route path="/my-complaints"    element={<MyComplaints />} />
        <Route path="/map"              element={<MapView />} />
      </Route>

      {/* ── OFFICER ────────────────────────────────────────────────── */}
      <Route
        path="/officer-dashboard"
        element={
          <ProtectedRoute allowedRoles={["officer"]}>
            <OfficerDashboard />
          </ProtectedRoute>
        }
      />

      {/* ── WORKER ─────────────────────────────────────────────────── */}
      <Route
        path="/worker-dashboard"
        element={
          <ProtectedRoute allowedRoles={["worker"]}>
            <WorkerDashboard />
          </ProtectedRoute>
        }
      />

      {/* ── ADMIN ──────────────────────────────────────────────────── */}
      <Route
        path="/admin-dashboard"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* ── CATCH-ALL ──────────────────────────────────────────────── */}
      <Route path="*" element={<RootRedirect />} />

    </Routes>
  );
}