import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

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
          <Route path="/users" element={<Users />} />
          <Route path="/add-user" element={<AddUser />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/qr-codes" element={<QRCodes />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/logs" element={<Logs />} />
      </Route>
      </Routes>
    </Router>
  );
}