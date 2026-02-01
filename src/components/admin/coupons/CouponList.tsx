import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "../../../lib/AuthContext";
import { Link } from "react-router-dom";

export function CouponList() {
  const { token } = useAuth();
  const coupons = useQuery(api.coupons.listCoupons, token ? { token } : "skip");

  if (!coupons) {
    return <div className="animate-pulse bg-white rounded-xl shadow-md p-6 h-48"></div>;
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      available: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      consumed: "bg-gray-100 text-gray-800",
      expired: "bg-red-100 text-red-800",
      disabled: "bg-gray-200 text-gray-600",
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900">All Coupons</h2>
        <Link
          to="/admin/coupons/new"
          className="bg-berry-600 hover:bg-berry-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Create Coupon
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uses</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {coupons.map(coupon => (
              <tr key={coupon.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                    {coupon.code}
                  </code>
                  {coupon.description && (
                    <p className="text-xs text-gray-500 mt-1">{coupon.description}</p>
                  )}
                </td>
                <td className="px-6 py-4 font-medium">
                  {coupon.discountType === "fixed"
                    ? `$${coupon.discountValue}`
                    : `${coupon.discountValue}%`}
                </td>
                <td className="px-6 py-4">{getStatusBadge(coupon.status)}</td>
                <td className="px-6 py-4 text-gray-500">
                  {coupon.currentUses}
                  {coupon.maxUses && ` / ${coupon.maxUses}`}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {coupon.expiresAt
                    ? new Date(coupon.expiresAt).toLocaleDateString()
                    : "Never"}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    to={`/admin/coupons/${coupon.id}`}
                    className="text-berry-600 hover:text-berry-700 font-medium"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {coupons.length === 0 && (
          <div className="text-center py-12 text-gray-500">No coupons found</div>
        )}
      </div>
    </div>
  );
}
