import { UserCircle } from "lucide-react";

export default function Navbar() {
  return (
    <div className="h-16 bg-white shadow flex items-center justify-end px-6">
      <div className="flex items-center space-x-2 text-gray-600 font-medium">
        <UserCircle size={24} />
        <span>Admin</span>
      </div>
    </div>
  );
}