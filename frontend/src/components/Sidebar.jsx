import { Link } from "react-router-dom";

export default function Sidebar({ isSidebarOpen, closeSidebar }) {
  return (
    <div
      className={`fixed top-0 left-0 h-screen w-64 bg-gray-800 text-white flex flex-col p-4 transform transition-transform duration-300 z-50
      ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
    >
      <h1 className="text-2xl font-bold mb-6 text-center">Admin Panel</h1>
      <nav className="flex flex-col space-y-2">
        <Link to="/dashboard" onClick={closeSidebar} className="hover:bg-gray-700 p-2 rounded">Dashboard</Link>
        <Link to="/users" onClick={closeSidebar} className="hover:bg-gray-700 p-2 rounded">Zarządzanie użytkownikami</Link>
        <Link to="/add-user" onClick={closeSidebar} className="hover:bg-gray-700 p-2 rounded">Dodaj użytkownika / RFID</Link>
        <Link to="/rooms" onClick={closeSidebar} className="hover:bg-gray-700 p-2 rounded">Rezerwacja sal</Link>
        <Link to="/qr-codes" onClick={closeSidebar} className="hover:bg-gray-700 p-2 rounded">Tworzenie QR</Link>
        <Link to="/logs" onClick={closeSidebar} className="hover:bg-gray-700 p-2 rounded">Logi systemowe</Link>
        <Link to="/settings" onClick={closeSidebar} className="hover:bg-gray-700 p-2 rounded">Ustawienia</Link>
      </nav>
    </div>
  );
}