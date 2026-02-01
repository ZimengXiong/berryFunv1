import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "../../../lib/AuthContext";
import type { Id } from "../../../../convex/_generated/dataModel";

interface UserLedgerViewProps {
  userId: Id<"users">;
}

export function UserLedgerView({ userId }: UserLedgerViewProps) {
  const { token } = useAuth();
  const ledgerData = useQuery(api.ledgerItems.getUserLedger, token ? { token, userId } : "skip");

  if (!ledgerData) {
    return <div className="animate-pulse bg-white rounded-xl shadow-md p-6 h-48"></div>;
  }

  const { user, items } = ledgerData;

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
        <h3 className="font-bold text-gray-900">
          Ledger for {user.firstName} {user.lastName}
        </h3>
        <p className="text-sm text-gray-500">{user.email}</p>
      </div>

      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map(item => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <span className="text-lg mr-2">
                  {item.type === "enrollment" ? "📅" : "🎟️"}
                </span>
                {item.type}
              </td>
              <td className="px-6 py-4">
                <div>
                  <p className="font-medium text-gray-900">
                    {item.session?.name || item.description || "Credit"}
                  </p>
                  {item.child && (
                    <p className="text-sm text-gray-500">
                      For: {item.child.firstName} {item.child.lastName}
                    </p>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
              <td className="px-6 py-4 text-right">
                <span className={item.amount < 0 ? "text-green-600" : ""}>
                  ${Math.abs(item.amount).toFixed(2)}
                </span>
              </td>
              <td className="px-6 py-4 text-right text-sm text-gray-500">
                {new Date(item.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <div className="text-center py-12 text-gray-500">No ledger items</div>
      )}
    </div>
  );
}
