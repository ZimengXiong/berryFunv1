import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";

export function Header() {
  const { user, isAuthenticated, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl">🍓</span>
            <span className="text-xl font-bold text-berry-600">Berry Fun Camp</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-6">
            <Link
              to="/sessions"
              className="text-gray-600 hover:text-berry-600 transition-colors"
            >
              Sessions
            </Link>
            {isAuthenticated && (
              <>
                <Link
                  to="/my-ledger"
                  className="text-gray-600 hover:text-berry-600 transition-colors"
                >
                  My Ledger
                </Link>
                <Link
                  to="/profile"
                  className="text-gray-600 hover:text-berry-600 transition-colors"
                >
                  Profile
                </Link>
              </>
            )}
            {isAdmin && (
              <Link
                to="/admin"
                className="text-gray-600 hover:text-berry-600 transition-colors font-medium"
              >
                Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <span className="hidden sm:inline text-sm text-gray-600">
                  Hi, {user?.firstName}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-gray-600 hover:text-berry-600 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="bg-berry-600 hover:bg-berry-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
