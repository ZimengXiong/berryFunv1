import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Link } from "react-router-dom";

export function ReceiptQueue() {
  const receipts = useQuery(api.receipts.listPendingReceipts, {});

  if (!receipts) {
    return <div className="animate-pulse bg-white rounded-xl shadow-md p-6 h-48"></div>;
  }

  if (receipts.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-12 text-center">
        <span className="text-6xl">✅</span>
        <h3 className="text-xl font-semibold text-gray-900 mt-4">All Caught Up!</h3>
        <p className="text-gray-600 mt-2">No pending receipts to review.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 bg-orange-50 border-b border-orange-200">
        <h3 className="font-bold text-orange-800">
          {receipts.length} Receipt{receipts.length > 1 ? "s" : ""} Awaiting Review
        </h3>
      </div>

      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {receipts.map(receipt => {
            const isCash = receipt.receiptType === "cash";
            return (
              <tr key={receipt.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  {receipt.user ? (
                    <Link
                      to={`/admin/users/${receipt.user.id}`}
                      className="text-berry-600 hover:text-berry-700"
                    >
                      <div className="font-medium">
                        {receipt.user.firstName} {receipt.user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{receipt.user.email}</div>
                    </Link>
                  ) : (
                    <span className="text-gray-400">Unknown</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {isCash ? (
                    <div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        Cash
                      </span>
                      <div className="text-xs text-gray-400 mt-1">No image</div>
                    </div>
                  ) : (
                    <div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Zelle
                      </span>
                      {receipt.transactionRef && (
                        <div className="text-xs text-gray-400 mt-1">#{receipt.transactionRef}</div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 font-medium">${receipt.amount.toFixed(2)}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {receipt.itemCount} item{receipt.itemCount > 1 ? "s" : ""}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(receipt.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    to={`/admin/receipts/${receipt.id}`}
                    className="bg-berry-600 hover:bg-berry-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    Review
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
