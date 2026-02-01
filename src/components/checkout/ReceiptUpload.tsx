import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "../../lib/AuthContext";
import type { Id } from "../../../convex/_generated/dataModel";

interface ReceiptUploadProps {
  ledgerItemIds: Id<"ledgerItems">[];
  totalAmount: number;
  paymentMethod: "zelle" | "cash";
  fullAmount: number;
  depositAmount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ReceiptUpload({
  ledgerItemIds,
  totalAmount,
  paymentMethod,
  fullAmount,
  depositAmount,
  onSuccess,
  onCancel,
}: ReceiptUploadProps) {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [transactionRef, setTransactionRef] = useState("");
  const [amount, setAmount] = useState(totalAmount.toString());
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const submitReceipt = useMutation(api.receipts.submitReceipt);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (selectedFile.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => setPreview(reader.result as string);
        reader.readAsDataURL(selectedFile);
      } else {
        setPreview(null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !token) return;

    setError("");
    setIsUploading(true);

    try {
      const uploadUrl = await generateUploadUrl({ token });

      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file");
      }

      const { storageId } = await response.json();

      await submitReceipt({
        token,
        storageId,
        amount: parseFloat(amount),
        paymentMethod: "zelle", // Both options use Zelle for the payment
        transactionRef: transactionRef || undefined,
        ledgerItemIds,
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit receipt");
    } finally {
      setIsUploading(false);
    }
  };

  const isCashOption = paymentMethod === "cash";
  const remainingBalance = fullAmount - depositAmount;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Upload Zelle Receipt
        </h2>

        {/* Payment Summary */}
        <div className={`rounded-lg p-4 mb-6 ${
          isCashOption ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"
        }`}>
          <div className="flex items-center mb-3">
            <span className="text-2xl mr-3">{isCashOption ? "💵" : "💸"}</span>
            <h3 className={`font-semibold ${isCashOption ? "text-amber-800" : "text-green-800"}`}>
              {isCashOption ? "Deposit Payment (Cash Option)" : "Full Payment (Zelle Option)"}
            </h3>
          </div>

          <div className={`text-3xl font-bold mb-2 ${isCashOption ? "text-amber-700" : "text-green-700"}`}>
            ${totalAmount.toFixed(2)}
          </div>

          <p className={`text-sm ${isCashOption ? "text-amber-600" : "text-green-600"}`}>
            {isCashOption
              ? `This is your deposit. You'll pay the remaining $${remainingBalance.toFixed(2)} in cash before camp.`
              : "This is your full balance. No additional payment needed."
            }
          </p>
        </div>

        {/* Zelle Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-blue-800 flex items-center">
            <span className="mr-2">📱</span>
            Send Zelle Payment To:
          </h3>
          <div className="mt-3 bg-white rounded-lg p-3 border border-blue-200">
            <div className="text-lg font-mono font-semibold text-blue-900">
              payments@berryfuncamp.com
            </div>
          </div>
          <p className="text-blue-600 text-sm mt-3">
            After sending the payment, take a screenshot of the confirmation and upload it below.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zelle Confirmation Screenshot *
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              required
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-berry-500 transition-colors"
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Receipt preview"
                  className="max-h-48 mx-auto rounded"
                />
              ) : file ? (
                <div className="text-gray-600">
                  <span className="text-4xl">📄</span>
                  <p className="mt-2">{file.name}</p>
                </div>
              ) : (
                <div className="text-gray-500">
                  <span className="text-4xl">📎</span>
                  <p className="mt-2">Click to upload screenshot</p>
                  <p className="text-sm">PNG, JPG, or PDF</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount Sent *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Expected: ${totalAmount.toFixed(2)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zelle Confirmation Number
              </label>
              <input
                type="text"
                value={transactionRef}
                onChange={e => setTransactionRef(e.target.value)}
                placeholder="e.g., 123456789"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
              />
            </div>
          </div>

          {isCashOption && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
              <p className="font-medium text-gray-700 mb-2">What happens next?</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>We'll verify your deposit within 1-2 business days</li>
                <li>Your spots will be confirmed once verified</li>
                <li>Pay remaining ${remainingBalance.toFixed(2)} in cash before camp starts</li>
              </ol>
            </div>
          )}

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isUploading}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!file || isUploading}
              className="bg-berry-600 hover:bg-berry-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {isUploading ? "Submitting..." : "Submit Receipt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
