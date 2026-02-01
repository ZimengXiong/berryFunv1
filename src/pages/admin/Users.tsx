import { useParams } from "react-router-dom";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { UserList } from "../../components/admin/users/UserList";
import { UserDetail } from "../../components/admin/users/UserDetail";
import type { Id } from "../../../convex/_generated/dataModel";

export function AdminUsers() {
  const { userId } = useParams<{ userId: string }>();

  if (userId) {
    return (
      <AdminLayout title="User Details">
        <UserDetail userId={userId as Id<"users">} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Users">
      <UserList />
    </AdminLayout>
  );
}
