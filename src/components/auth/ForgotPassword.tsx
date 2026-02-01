import { useState } from "react";
import { Link } from "react-router-dom";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would trigger a password reset email
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md text-center">
        <span className="text-4xl">📧</span>
        <h1 className="text-2xl font-bold text-gray-900 mt-4">Check Your Email</h1>
        <p className="text-gray-600 mt-4">
          If an account exists for {email}, we've sent password reset instructions.
        </p>
        <Link
          to="/login"
          className="inline-block mt-6 text-berry-600 hover:text-berry-700 font-medium"
        >
          Back to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
      <div className="text-center mb-8">
        <span className="text-4xl">🔐</span>
        <h1 className="text-2xl font-bold text-gray-900 mt-4">Reset Password</h1>
        <p className="text-gray-600 mt-2">Enter your email to receive reset instructions</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none transition-all"
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-berry-600 hover:bg-berry-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          Send Reset Link
        </button>
      </form>

      <p className="text-center text-gray-600 mt-6">
        <Link to="/login" className="text-berry-600 hover:text-berry-700 font-medium">
          Back to Login
        </Link>
      </p>
    </div>
  );
}
