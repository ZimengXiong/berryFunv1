import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "../../lib/AuthContext";
import { Link } from "react-router-dom";

export function DashboardOverview() {
  const { isAuthenticated } = useAuth();
  const stats = useQuery(api.admin.getDashboardStats, isAuthenticated ? {} : "skip");

  if (!stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl shadow-md p-6 h-24"></div>
          ))}
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const statCards = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      subValue: `${stats.activeUsers} active`,
      icon: "👥",
      color: "bg-blue-500",
    },
    {
      label: "Active Sessions",
      value: stats.activeSessions,
      subValue: `${stats.totalEnrollments} enrolled`,
      icon: "📅",
      color: "bg-green-500",
    },
    {
      label: "Pending Receipts",
      value: stats.pendingReceipts,
      subValue: "awaiting review",
      icon: "🧾",
      color: stats.pendingReceipts > 0 ? "bg-orange-500" : "bg-gray-400",
      link: "/admin/receipts",
    },
    {
      label: "Total Revenue",
      value: formatCurrency(stats.totalRevenue),
      subValue: "verified payments",
      icon: "💰",
      color: "bg-berry-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(stat => {
          const content = (
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <p className="text-gray-400 text-xs mt-1">{stat.subValue}</p>
                </div>
                <div
                  className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center text-2xl`}
                >
                  {stat.icon}
                </div>
              </div>
            </div>
          );

          return stat.link ? (
            <Link key={stat.label} to={stat.link}>
              {content}
            </Link>
          ) : (
            <div key={stat.label}>{content}</div>
          );
        })}
      </div>

      {/* Quick Actions */}
      {stats.pendingReceipts > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-medium text-orange-800">
                  {stats.pendingReceipts} receipt{stats.pendingReceipts > 1 ? "s" : ""} pending
                  review
                </p>
                <p className="text-orange-600 text-sm">
                  These require your attention to verify payments
                </p>
              </div>
            </div>
            <Link
              to="/admin/receipts"
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Review Now
            </Link>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h2>
        {stats.recentActivity.length > 0 ? (
          <div className="space-y-3">
            {stats.recentActivity.map(activity => (
              <div
                key={activity.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">
                    {activity.action === "registered"
                      ? "👋"
                      : activity.action === "verified"
                      ? "✅"
                      : activity.action === "denied"
                      ? "❌"
                      : activity.action === "created"
                      ? "➕"
                      : "📝"}
                  </span>
                  <div>
                    <p className="text-gray-900">
                      <span className="font-medium">{activity.userName}</span>{" "}
                      {activity.action} a {activity.targetType}
                    </p>
                  </div>
                </div>
                <span className="text-gray-400 text-sm">
                  {new Date(activity.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No recent activity</p>
        )}
      </div>
    </div>
  );
}
