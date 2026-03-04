// ProtectedRoute.js
//
// Provides two guards:
//   • ProtectedRoute  — for any authenticated user
//   • AdminRoute      — for admin users only (redirects to /admin/login)
//
// Usage:
//   <ProtectedRoute path="/feed" element={<Feed />} />
//   <AdminRoute path="/admin/dashboard" element={<AdminDashboard />} />

import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * Requires the user to be authenticated.
 * Redirects to /login if not.
 */
export const ProtectedRoute = ({ children }) => {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? children : <Navigate to="/login" replace />;
};

/**
 * Requires the user to be authenticated AND have admin role.
 * Redirects non-admins to /admin/login.
 * Redirects unauthenticated users to /admin/login too.
 */
export const AdminRoute = ({ children }) => {
    const { isAuthenticated, user } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/admin/login" replace />;
    }

    if (!user?.isAdmin) {
        // Authenticated but not an admin — kick back to admin login
        return <Navigate to="/admin/login" replace />;
    }

    return children;
};

// Default export kept for backwards compatibility
export default ProtectedRoute;