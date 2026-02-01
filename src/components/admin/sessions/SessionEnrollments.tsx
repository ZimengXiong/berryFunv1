import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "../../../lib/AuthContext";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Link } from "react-router-dom";

interface SessionEnrollmentsProps {
  sessionId: Id<"sessions">;
}

export function SessionEnrollments({ sessionId }: SessionEnrollmentsProps) {
  const { token } = useAuth();
  const data = useQuery(api.sessions.getSessionEnrollments, token ? { token, sessionId } : "skip");

  if (!data) {
    return <div className="animate-pulse bg-white rounded-xl shadow-md p-6 h-48"></div>;
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-yellow-100 text-yellow-800",
      secured: "bg-blue-100 text-blue-800",
      verified: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 bg-gray-50 border-b">
        <h3 className="font-bold text-gray-900">{data.session.name}</h3>
        <p className="text-sm text-gray-500">
          {data.session.enrolledCount} / {data.session.capacity} enrolled
        </p>
      </div>

      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Child</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.enrollments.map(enrollment => (
            <tr key={enrollment.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                {enrollment.user ? (
                  <Link
                    to={`/admin/users/${enrollment.user.id}`}
                    className="text-berry-600 hover:text-berry-700"
                  >
                    <div className="font-medium">
                      {enrollment.user.firstName} {enrollment.user.lastName}
                    </div>
                    <div className="text-sm text-gray-500">{enrollment.user.email}</div>
                  </Link>
                ) : (
                  <span className="text-gray-400">Unknown</span>
                )}
              </td>
              <td className="px-6 py-4">
                {enrollment.child ? (
                  <span>
                    {enrollment.child.firstName} {enrollment.child.lastName}
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="px-6 py-4">{getStatusBadge(enrollment.status)}</td>
              <td className="px-6 py-4 text-right">${enrollment.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.enrollments.length === 0 && (
        <div className="text-center py-12 text-gray-500">No enrollments yet</div>
      )}
    </div>
  );
}
