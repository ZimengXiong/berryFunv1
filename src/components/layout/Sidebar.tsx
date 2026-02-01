import { Link, useLocation } from "react-router-dom";

const navItems = [
  { path: "/admin", label: "Dashboard", icon: "📊" },
  { path: "/admin/users", label: "Users", icon: "👥" },
  { path: "/admin/sessions", label: "Sessions", icon: "📅" },
  { path: "/admin/receipts", label: "Receipts", icon: "🧾" },
  { path: "/admin/coupons", label: "Coupons", icon: "🎟️" },
  { path: "/admin/orders", label: "Orders", icon: "📋" },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen">
      <div className="p-4 border-b border-gray-700">
        <Link to="/" className="flex items-center space-x-2">
          <span className="text-2xl">🍓</span>
          <span className="text-lg font-bold">Admin Panel</span>
        </Link>
      </div>

      <nav className="p-4">
        <ul className="space-y-2">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-berry-600 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="absolute bottom-0 w-64 p-4 border-t border-gray-700">
        <Link
          to="/"
          className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <span>←</span>
          <span>Back to Site</span>
        </Link>
      </div>
    </aside>
  );
}
