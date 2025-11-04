import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const isLoggedIn = !!localStorage.getItem("user"); // Check for 'user'

  return isLoggedIn ? children : <Navigate to="/" />;
}