import type { Id } from "../../../../convex/_generated/dataModel";

interface OrderDetailProps {
  orderId: Id<"ledgerItems">;
}

export function OrderDetail({ orderId }: OrderDetailProps) {
  // Order detail view - can be expanded as needed
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900">Order Details</h2>
      <p className="text-gray-600 mt-2">Order ID: {orderId}</p>
      {/* Add more details as needed */}
    </div>
  );
}
