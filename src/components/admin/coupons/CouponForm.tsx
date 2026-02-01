import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "../../../lib/AuthContext";
import { useNavigate } from "react-router-dom";
import type { Id } from "../../../../convex/_generated/dataModel";

interface CouponFormProps {
  couponId?: Id<"coupons">;
}

export function CouponForm({ couponId }: CouponFormProps) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const existingCoupon = useQuery(
    api.coupons.getCoupon,
    couponId && isAuthenticated ? { couponId } : "skip"
  );

  const createCoupon = useMutation(api.coupons.createCoupon);
  const updateCoupon = useMutation(api.coupons.updateCoupon);
  const disableCoupon = useMutation(api.coupons.disableCoupon);

  const [formData, setFormData] = useState({
    code: "",
    discountValue: "",
    discountType: "fixed" as "fixed" | "percentage",
    maxUses: "",
    expiresAt: "",
    description: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (existingCoupon) {
      setFormData({
        code: existingCoupon.code,
        discountValue: existingCoupon.discountValue.toString(),
        discountType: existingCoupon.discountType,
        maxUses: existingCoupon.maxUses?.toString() || "",
        expiresAt: existingCoupon.expiresAt
          ? new Date(existingCoupon.expiresAt).toISOString().split("T")[0]
          : "",
        description: existingCoupon.description || "",
      });
    }
  }, [existingCoupon]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) return;

    setError("");
    setIsLoading(true);

    try {
      if (couponId) {
        await updateCoupon({
          couponId,
          discountValue: parseFloat(formData.discountValue),
          maxUses: formData.maxUses ? parseInt(formData.maxUses) : undefined,
          expiresAt: formData.expiresAt
            ? new Date(formData.expiresAt).getTime()
            : undefined,
          description: formData.description || undefined,
        });
      } else {
        await createCoupon({
          code: formData.code.toUpperCase(),
          discountValue: parseFloat(formData.discountValue),
          discountType: formData.discountType,
          maxUses: formData.maxUses ? parseInt(formData.maxUses) : undefined,
          expiresAt: formData.expiresAt
            ? new Date(formData.expiresAt).getTime()
            : undefined,
          description: formData.description || undefined,
        });
      }

      navigate("/admin/coupons");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save coupon");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!isAuthenticated || !couponId) return;
    if (!confirm("Are you sure you want to disable this coupon?")) return;

    try {
      await disableCoupon({ couponId });
      navigate("/admin/coupons");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable coupon");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        {couponId ? "Edit Coupon" : "Create New Coupon"}
      </h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Coupon Code *
            </label>
            <input
              name="code"
              type="text"
              value={formData.code}
              onChange={handleChange}
              required
              disabled={!!couponId}
              placeholder="e.g., SUMMER2024"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none uppercase disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Discount Type *
            </label>
            <select
              name="discountType"
              value={formData.discountType}
              onChange={handleChange}
              disabled={!!couponId}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none disabled:bg-gray-100"
            >
              <option value="fixed">Fixed Amount ($)</option>
              <option value="percentage">Percentage (%)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Discount Value *
            </label>
            <input
              name="discountValue"
              type="number"
              step="0.01"
              value={formData.discountValue}
              onChange={handleChange}
              required
              placeholder={formData.discountType === "fixed" ? "50" : "10"}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Uses (optional)
            </label>
            <input
              name="maxUses"
              type="number"
              value={formData.maxUses}
              onChange={handleChange}
              placeholder="Unlimited if empty"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expiration Date (optional)
            </label>
            <input
              name="expiresAt"
              type="date"
              value={formData.expiresAt}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              placeholder="Internal notes about this coupon..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
            />
          </div>
        </div>

        <div className="flex justify-between pt-4">
          {couponId && existingCoupon?.status !== "disabled" && (
            <button
              type="button"
              onClick={handleDisable}
              className="text-red-600 hover:text-red-700"
            >
              Disable Coupon
            </button>
          )}
          <div className="flex space-x-4 ml-auto">
            <button
              type="button"
              onClick={() => navigate("/admin/coupons")}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-berry-600 hover:bg-berry-700 text-white px-6 py-2 rounded-lg disabled:opacity-50"
            >
              {isLoading ? "Saving..." : couponId ? "Save Changes" : "Create Coupon"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
