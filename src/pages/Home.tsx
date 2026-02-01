import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-berry-500 to-berry-700 text-white py-20">
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

      {/* Discounts Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Save More with Multiple Weeks
          </h2>
          <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b">
                <span className="font-medium">3 weeks</span>
                <span className="text-green-600 font-bold">$50 off</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="font-medium">5 weeks</span>
                <span className="text-green-600 font-bold">$120 off</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="font-medium">8 weeks</span>
                <span className="text-green-600 font-bold">$240 off</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="font-medium">12 weeks</span>
                <span className="text-green-600 font-bold">$370 off</span>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t text-center text-gray-600">
              <p>Plus additional savings for returning campers and siblings!</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-berry-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Ready to Join the Fun?
          </h2>
          <p className="text-xl text-berry-100 mb-8 max-w-xl mx-auto">
            Spots fill up fast! Register today to secure your child's place at
            Berry Fun Camp.
          </p>
          <Link
            to="/sessions"
            className="inline-block bg-white text-berry-600 hover:bg-berry-50 font-semibold px-8 py-4 rounded-lg transition-colors text-lg"
          >
            Browse Available Sessions
          </Link>
        </div>
      </section>
    </div>
  );
}
