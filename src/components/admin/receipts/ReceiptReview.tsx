import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "../../../lib/AuthContext";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useNavigate, Link } from "react-router-dom";

interface ReceiptReviewProps {
  receiptId: Id<"receipts">;
}

export function ReceiptReview({ receiptId }: ReceiptReviewProps) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const receipt = useQuery(api.receipts.getReceipt, token ? { token, receiptId } : "skip");
  const fileUrl = useQuery(
    api.files.getFileUrl,
    receipt?.storageId ? { storageId: receipt.storageId } : "skip"
  );

  const verifyReceipt = useMutation(api.admin.verifyReceipt);
  const denyReceipt = useMutation(api.admin.denyReceipt);

  const [adminNotes, setAdminNotes] = useState("");
  const [denialReason, setDenialReason] = useState("");
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!receipt) {
    return <div className="animate-pulse bg-white rounded-xl shadow-md p-6 h-96"></div>;
  }

  const handleVerify = async () => {
    if (!token) return;
    setIsProcessing(true);

    try {
      await verifyReceipt({
        token,
        receiptId,
        adminNotes: adminNotes || undefined,
      });
      navigate("/admin/receipts");
    } catch (error) {
      console.error("Failed to verify:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeny = async () => {
    if (!token || !denialReason.trim()) return;
    setIsProcessing(true);

    try {
      await denyReceipt({
        token,
        receiptId,
        denialReason,
        adminNotes: adminNotes || undefined,
      });
      navigate("/admin/receipts");
    } catch (error) {
      console.error("Failed to deny:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const isPending = receipt.status === "pending";

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link to="/admin/receipts" className="text-gray-500 hover:text-gray-700">
          ← Back to Receipts
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receipt Image */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="font-bold text-gray-900 mb-4">Receipt Image</h3>
          {fileUrl ? (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={fileUrl}
                alt="Payment receipt"
                className="w-full rounded-lg shadow-sm hover:shadow-md transition-shadow"
              />
            </a>
          ) : (
            <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-gray-400">Loading image...</span>
            </div>
          )}
        </div>

        {/* Receipt Details */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="font-bold text-gray-900 mb-4">Receipt Details</h3>

            <div className="space-y-4">
              {receipt.user && (
                <div>
                  <label className="text-sm font-medium text-gray-500">User</label>
                  <Link
                    to={`/admin/users/${receipt.user.id}`}
                    className="block text-berry-600 hover:text-berry-700 font-medium"
                  >
                    {receipt.user.firstName} {receipt.user.lastName}
                  </Link>
                  <p className="text-sm text-gray-500">{receipt.user.email}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Amount</label>
                  <p className="text-2xl font-bold text-gray-900">${receipt.amount.toFixed(2)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <p>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        receipt.status === "pending"
                          ? "bg-orange-100 text-orange-800"
                          : receipt.status === "verified"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {receipt.status}
                    </span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Payment Method</label>
                  <p className="text-gray-900">{receipt.paymentMethod || "-"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Reference</label>
                  <p className="text-gray-900">{receipt.transactionRef || "-"}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Submitted</label>
                <p className="text-gray-900">
                  {new Date(receipt.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Linked Items */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="font-bold text-gray-900 mb-4">
              Linked Items ({receipt.linkedItems?.length || 0})
            </h3>
            <div className="space-y-2">
              {receipt.linkedItems?.filter(item => item !== null).map(item => (
                <div
                  key={item!.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {item!.session?.name || "Credit"}
                    </p>
                    <p className="text-sm text-gray-500">{item!.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${Math.abs(item!.amount).toFixed(2)}</p>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        item!.status === "secured"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {item!.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Admin Actions */}
          {isPending && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="font-bold text-gray-900 mb-4">Admin Actions</h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Notes (optional)
                </label>
                <textarea
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
                  placeholder="Internal notes..."
                />
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={handleVerify}
                  disabled={isProcessing}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isProcessing ? "Processing..." : "✓ Verify Payment"}
                </button>
                <button
                  onClick={() => setShowDenyModal(true)}
                  disabled={isProcessing}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  ✗ Deny
                </button>
              </div>
            </div>
          )}

          {/* Show denial reason if denied */}
          {receipt.status === "denied" && receipt.denialReason && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h4 className="font-medium text-red-800">Denial Reason</h4>
              <p className="text-red-700 mt-1">{receipt.denialReason}</p>
            </div>
          )}
        </div>
      </div>

      {/* Deny Modal */}
      {showDenyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Deny Receipt</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for denying this receipt. The user will be notified.
            </p>
            <textarea
              value={denialReason}
              onChange={e => setDenialReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none mb-4"
              placeholder="Reason for denial..."
            />
            <div className="flex space-x-4">
              <button
                onClick={() => setShowDenyModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeny}
                disabled={!denialReason.trim() || isProcessing}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "Deny Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
