import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "../../../lib/AuthContext";
import { Link } from "react-router-dom";

export function OrderList() {
  const { isAuthenticated } = useAuth();
  const orders = useQuery(api.admin.getVerifiedOrders, isAuthenticated ? {} : "skip");

  if (!orders) {
    return <div className="animate-pulse bg-white rounded-xl shadow-md p-6 h-48"></div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Session/Item</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Child</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Discounts</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Verified</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {orders.map(order => {
            const totalDiscounts =
              (order.snapshotTieredDiscount || 0) +
              (order.snapshotReturningCredit || 0) +
              (order.snapshotSiblingCredit || 0) +
              (order.snapshotEarlyBirdCredit || 0);

            return (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  {order.user ? (
                    <Link
                      to={`/admin/users/${order.user.id}`}
                      className="text-berry-600 hover:text-berry-700"
                    >
                      <div className="font-medium">
                        {order.user.firstName} {order.user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{order.user.email}</div>
                    </Link>
                  ) : (
                    <span className="text-gray-400">Unknown</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <span>{order.type === "enrollment" ? "📅" : "🎟️"}</span>
                    <div>
                      <p className="font-medium text-gray-900">
                        {order.session?.name || order.description || "Credit"}
                      </p>
                      {order.session && (
                        <p className="text-sm text-gray-500">
                          {new Date(order.session.startDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {order.child ? (
                    <span>
                      {order.child.firstName} {order.child.lastName}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right font-medium">
                  ${Math.abs(order.amount).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right">
                  {totalDiscounts > 0 ? (
                    <span className="text-green-600">-${totalDiscounts.toFixed(2)}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right text-sm text-gray-500">
                  {order.verifiedAt
                    ? new Date(order.verifiedAt).toLocaleDateString()
                    : "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {orders.length === 0 && (
        <div className="text-center py-12 text-gray-500">No verified orders yet</div>
      )}
    </div>
  );
}
