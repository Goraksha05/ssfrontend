import AdminLayout from "./Components/Admin/AdminLayout";
import AdminUserReport from "./Components/Admin/UserReport";
import AdminRoute from "./Components/Admin/AdminRoute/AdminRoute";

<Route path="/admin" element={<AdminLayout />}>
  <Route path="users-report" element={
    <AdminRoute>
      <AdminUserReport />
    </AdminRoute>
  } />
</Route>

