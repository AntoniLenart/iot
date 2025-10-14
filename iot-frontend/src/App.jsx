import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";

// Pages
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import AddUser from "./pages/AddUser";
import Biometrics from "./pages/Biometrics";
import Rooms from "./pages/Rooms";
import QRCodes from "./pages/QRCodes";
import Settings from "./pages/Settings";
import Logs from "./pages/Logs";

export default function App() {
  return (
    <Router>
      <div className="flex">
        <Sidebar />
        <div className="ml-64 flex-1 flex flex-col h-screen">
          <Navbar />
          <div className="flex-1 p-4 overflow-hidden">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/users" element={<Users />} />
              <Route path="/add-user" element={<AddUser />} />
              <Route path="/biometrics" element={<Biometrics />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/qr-codes" element={<QRCodes />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/logs" element={<Logs />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}