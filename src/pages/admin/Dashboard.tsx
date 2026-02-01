import { AdminLayout } from "../../components/admin/AdminLayout";
import { DashboardOverview } from "../../components/admin/DashboardOverview";

export function AdminDashboard() {
  return (
    <AdminLayout title="Dashboard">
      <DashboardOverview />
    </AdminLayout>
  );
}
