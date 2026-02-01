import { useParams } from "react-router-dom";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { ReceiptQueue } from "../../components/admin/receipts/ReceiptQueue";
import { ReceiptReview } from "../../components/admin/receipts/ReceiptReview";
import type { Id } from "../../../convex/_generated/dataModel";

export function AdminReceipts() {
  const { receiptId } = useParams<{ receiptId: string }>();

  if (receiptId) {
    return (
      <AdminLayout title="Review Receipt">
        <ReceiptReview receiptId={receiptId as Id<"receipts">} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Receipts">
      <ReceiptQueue />
    </AdminLayout>
  );
}
