import { Link } from "react-router-dom";

export default function Sidebar() {
  return (
    <div className="w-64 h-screen bg-gray-800 text-white fixed top-0 left-0 flex flex-col p-4">
      <h1 className="text-2xl font-bold mb-6 text-center">Admin Panel</h1>
      <nav className="flex flex-col space-y-2">
        <Link to="/" className="hover:bg-gray-700 p-2 rounded">Dashboard</Link>
        <Link to="/users" className="hover:bg-gray-700 p-2 rounded">Zarządzanie użytkownikami</Link>
        <Link to="/add-user" className="hover:bg-gray-700 p-2 rounded">Dodaj użytkownika / RFID</Link>
        <Link to="/rooms" className="hover:bg-gray-700 p-2 rounded">Rezerwacja sal</Link>
        <Link to="/qr-codes" className="hover:bg-gray-700 p-2 rounded">Tworzenie QR</Link>
        <Link to="/logs" className="hover:bg-gray-700 p-2 rounded">Logi systemowe</Link>
        <Link to="/settings" className="hover:bg-gray-700 p-2 rounded">Ustawienia</Link>
      </nav>
    </div>
  );
}