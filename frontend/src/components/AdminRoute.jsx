import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function AdminRoute({ children }) {
  const { user } = useAuth();
  const isAdmin = user?.user_type === "admin";

  return isAdmin ? children : <Navigate to="/dashboard" />;
}
