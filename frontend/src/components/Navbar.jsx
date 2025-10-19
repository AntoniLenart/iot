import { useState, useEffect, useRef } from "react";
import { UserCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const [openMenu, setOpenMenu] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef(null);

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    setOpenMenu(false);
    navigate("/");
  };

  const handleSettings = () => {
    setOpenMenu(false);
    navigate("/settings");
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="h-16 bg-white shadow flex items-center justify-between px-6 relative">
      {/* Left side — logo + name */}
      <div className="flex items-center space-x-3">
        <img
          src="src/assets/logo.svg"
          alt="Logo"
          className="w-12 h-12 p-1 border border-gray-300 rounded-xl shadow-sm hover:scale-110 transition-transform"
        />
        <span className="text-xl font-semibold text-gray-800 tracking-tight">
          Nazwa Aplikacji
        </span>
      </div>

      {/* Right side — profile */}
      <div ref={menuRef} className="relative select-none">
        <div
          onClick={() => setOpenMenu((prev) => !prev)}
          className="flex items-center space-x-2 text-gray-600 font-medium hover:text-gray-800 transition-colors cursor-pointer"
        >
          <UserCircle size={24} />
          <span>Admin</span>
        </div>

        {/* MENU */}
        {openMenu && (
          <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
            <ul className="text-gray-700 text-sm">
              <li
                onClick={handleSettings}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer rounded-t-xl"
              >
                ⚙️ Ustawienia
              </li>
              <li
                onClick={handleLogout}
                className="px-4 py-2 hover:bg-red-100 text-red-600 cursor-pointer rounded-b-xl"
              >
                🚪 Wyloguj
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
