import { Link } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function Sidebar({ isSidebarOpen, closeSidebar }) {
  const { user } = useAuth(); // Add this to get user
  const isAdmin = user?.user_type === "admin";

  return (
    <div
      className={`fixed top-0 left-0 h-screen w-64 bg-gray-800 text-white flex flex-col p-4 z-50 transition-all duration-300 ease-in-out lg:translate-x-0 ${isSidebarOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"}`}
    >
      <h1 className="text-2xl font-bold mb-6 text-center">{isAdmin ? "Admin Panel" : "User Panel"}</h1>
      <nav className="flex flex-col space-y-2">
        <Link to="/dashboard" onClick={closeSidebar} className="hover:bg-gray-700 p-2 rounded">Dashboard</Link>
        {isAdmin && <Link to="/users" onClick={closeSidebar} className="hover:bg-gray-700 p-2 rounded">Zarządzanie użytkownikami</Link>}
        {isAdmin && <Link to="/add-user" onClick={closeSidebar} className="hover:bg-gray-700 p-2 rounded">Dodaj użytkownika / RFID</Link>}
        {isAdmin && <Link to="/add-user-group" onClick={closeSidebar} className="hover:bg-gray-700 p-2 rounded">Dodaj grupy dostępu</Link>}
        <Link to="/rooms" onClick={closeSidebar} className="hover:bg-gray-700 p-2 rounded">Rezerwacja sal</Link>
        <Link to="/qr-codes" onClick={closeSidebar} className="hover:bg-gray-700 p-2 rounded">Tworzenie QR</Link>
        {isAdmin && <Link to="/logs" onClick={closeSidebar} className="hover:bg-gray-700 p-2 rounded">Logi systemowe</Link>}
        <Link to="/settings" onClick={closeSidebar} className="hover:bg-gray-700 p-2 rounded">Ustawienia</Link>
      </nav>
    </div>
  );
}