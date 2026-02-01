import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { SessionCard } from "./SessionCard";

export function SessionGrid() {
  const sessions = useQuery(api.sessions.listSessions, { activeOnly: true });

  if (sessions === undefined) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="bg-white rounded-xl shadow-md overflow-hidden animate-pulse">
            <div className="h-48 bg-gray-200"></div>
            <div className="p-5">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-16">
        <span className="text-6xl">📅</span>
        <h3 className="text-xl font-semibold text-gray-900 mt-4">No Sessions Available</h3>
        <p className="text-gray-600 mt-2">Check back soon for upcoming camp sessions!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sessions.map(session => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  );
}
