import { useParams } from "react-router-dom";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { CouponList } from "../../components/admin/coupons/CouponList";
import { CouponForm } from "../../components/admin/coupons/CouponForm";
import type { Id } from "../../../convex/_generated/dataModel";

export function AdminCoupons() {
  const { couponId } = useParams<{ couponId: string }>();

  if (couponId === "new") {
    return (
      <AdminLayout title="Create Coupon">
        <CouponForm />
      </AdminLayout>
    );
  }

  if (couponId) {
    return (
      <AdminLayout title="Edit Coupon">
        <CouponForm couponId={couponId as Id<"coupons">} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Coupons">
      <CouponList />
    </AdminLayout>
  );
}
