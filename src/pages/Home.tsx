import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-berry-500 to-berry-700 text-white min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold mb-6">
            Welcome to Berry Fun Camp! 🍓
          </h1>
          <p className="text-xl text-berry-100 mb-8 max-w-2xl mx-auto">
            Create unforgettable summer memories with our exciting camp sessions.
            Adventure, learning, and fun await your children!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/sessions"
              className="bg-white text-berry-600 hover:bg-berry-50 font-semibold px-8 py-4 rounded-lg transition-colors text-lg"
            >
              View Sessions
            </Link>
            {!isAuthenticated && (
              <Link
                to="/register"
                className="bg-berry-800 hover:bg-berry-900 text-white font-semibold px-8 py-4 rounded-lg transition-colors text-lg"
              >
                Register Now
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
