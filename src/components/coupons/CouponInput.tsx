import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "../../lib/AuthContext";

interface CouponInputProps {
  onApplied?: () => void;
}

export function CouponInput({ onApplied }: CouponInputProps) {
  const { token } = useAuth();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const claimCoupon = useMutation(api.coupons.claimCoupon);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !code.trim()) return;

    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const result = await claimCoupon({ token, code: code.trim() });
      setSuccess(
        `Coupon applied! You saved $${result.discountAmount.toFixed(2)}`
      );
      setCode("");
      onApplied?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply coupon");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4">
      <h3 className="font-medium text-gray-900 mb-3">Have a Coupon?</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg mb-3">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-600 text-sm px-3 py-2 rounded-lg mb-3">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="Enter code"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none uppercase"
        />
        <button
          type="submit"
          disabled={!code.trim() || isLoading}
          className="bg-berry-600 hover:bg-berry-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoading ? "..." : "Apply"}
        </button>
      </form>
    </div>
  );
}
