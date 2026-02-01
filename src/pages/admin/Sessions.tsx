import { useParams } from "react-router-dom";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { SessionList } from "../../components/admin/sessions/SessionList";
import { SessionForm } from "../../components/admin/sessions/SessionForm";
import type { Id } from "../../../convex/_generated/dataModel";

export function AdminSessions() {
  const { sessionId } = useParams<{ sessionId: string }>();

  if (sessionId === "new") {
    return (
      <AdminLayout title="Create Session">
        <SessionForm />
      </AdminLayout>
    );
  }

  if (sessionId) {
    return (
      <AdminLayout title="Edit Session">
        <SessionForm sessionId={sessionId as Id<"sessions">} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Sessions">
      <SessionList />
    </AdminLayout>
  );
}
