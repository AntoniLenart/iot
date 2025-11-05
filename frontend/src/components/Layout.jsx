import { useState } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* SIDEBAR */}
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        closeSidebar={() => setIsSidebarOpen(false)}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col transition-all duration-300 lg:ml-64">
        <Navbar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

        <div className="flex-1 p-4 overflow-auto bg-gray-50">
          <Outlet />
        </div>
      </div>

      {/* Blur background */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 backdrop-blur-md bg-black/40 lg:hidden z-40"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
}
