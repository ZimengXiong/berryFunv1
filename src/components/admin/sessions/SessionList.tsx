import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Link } from "react-router-dom";
import { CapacityIndicator } from "../../sessions/CapacityIndicator";

export function SessionList() {
  const sessions = useQuery(api.sessions.listSessions, { activeOnly: false });

  if (!sessions) {
    return <div className="animate-pulse bg-white rounded-xl shadow-md p-6 h-48"></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900">All Sessions</h2>
        <Link
          to="/admin/sessions/new"
          className="bg-berry-600 hover:bg-berry-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Create Session
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map(session => (
          <div key={session.id} className="bg-white rounded-xl shadow-md p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-gray-900">{session.name}</h3>
                <p className="text-sm text-gray-500">
                  {new Date(session.startDate).toLocaleDateString()} -{" "}
                  {new Date(session.endDate).toLocaleDateString()}
                </p>
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  session.isActive
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {session.isActive ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="mb-4">
              <CapacityIndicator
                capacity={session.capacity}
                enrolled={session.enrolledCount}
              />
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-berry-600">${session.basePrice}</span>
              <Link
                to={`/admin/sessions/${session.id}`}
                className="text-berry-600 hover:text-berry-700 font-medium"
              >
                Edit →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {sessions.length === 0 && (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <span className="text-6xl">📅</span>
          <h3 className="text-xl font-semibold text-gray-900 mt-4">No Sessions Yet</h3>
          <p className="text-gray-600 mt-2">Create your first camp session to get started.</p>
        </div>
      )}
    </div>
  );
}
