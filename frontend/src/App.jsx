import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

// Pages
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import AddUser from "./pages/AddUser";
import Rooms from "./pages/Rooms";
import QRCodes from "./pages/QRCodes";
import Settings from "./pages/Settings";
import Logs from "./pages/Logs";

import Login from "./pages/Login";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route
              path="/users"
              element={
                <AdminRoute>
                  <Users />
                </AdminRoute>
              }
            />
            <Route
              path="/add-user"
              element={
                <AdminRoute>
                  <AddUser />
                </AdminRoute>
              }
            />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/qr-codes" element={<QRCodes />} />
            <Route path="/settings" element={<Settings />} />
            <Route
              path="/logs"
              element={
                <AdminRoute>
                  <Logs />
                </AdminRoute>
              }
            />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}