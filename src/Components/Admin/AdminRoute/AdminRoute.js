import { Navigate } from "react-router-dom";
import { useAuth } from "../../../Context/Authorisation/AuthContext";

const AdminRoute = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.isAdmin) return <Navigate to="/unauthorized" replace />;

  return children;


};

export default AdminRoute;
