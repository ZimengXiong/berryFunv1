import { AdminLayout } from "../../components/admin/AdminLayout";
import { OrderList } from "../../components/admin/orders/OrderList";

export function AdminOrders() {
  return (
    <AdminLayout title="Verified Orders">
      <OrderList />
    </AdminLayout>
  );
}
