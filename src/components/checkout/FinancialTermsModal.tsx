interface FinancialTermsModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  depositAmount: number;
}

export function FinancialTermsModal({
  isOpen,
  onAccept,
  onDecline,
  depositAmount,
}: FinancialTermsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Financial Terms & Conditions
          </h2>

          <div className="prose prose-sm max-w-none text-gray-600 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Payment Options</h3>
            <p>
              You have two payment options:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Pay Full via Zelle:</strong> Pay the entire balance now via Zelle.
                Your registration will be confirmed once we verify your payment.
              </li>
              <li>
                <strong>Pay Deposit + Cash:</strong> Pay ${depositAmount}/week deposit via Zelle now,
                then pay the remaining balance in cash before camp starts.
              </li>
            </ul>

            <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 my-4">
              <h4 className="text-red-700 font-bold text-lg flex items-center">
                <span className="mr-2">⚠️</span>
                Non-Refundable Deposit
              </h4>
              <p className="text-red-700 mt-2">
                <strong>The ${depositAmount}/week deposit is NON-REFUNDABLE.</strong>
              </p>
              <p className="text-red-600 mt-1">
                This deposit cannot be refunded under any circumstances,
                including cancellation, withdrawal, or dismissal.
              </p>
            </div>

            <h3 className="text-lg font-semibold text-gray-900">Refund Policy</h3>
            <p>
              Excluding the non-refundable deposit:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>30+ days before session:</strong> Full refund (minus deposit)
              </li>
              <li>
                <strong>14-29 days before session:</strong> 50% refund (minus deposit)
              </li>
              <li>
                <strong>Less than 14 days:</strong> No refund
              </li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900">Discounts</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Multi-Week Discount:</strong> Automatically applied when enrolling in 3+ weeks
              </li>
              <li>
                <strong>Returning Camper:</strong> $25 credit per week for returning families
              </li>
              <li>
                <strong>Sibling Discount:</strong> $15 credit per week for siblings
              </li>
              <li>
                <strong>Early Bird:</strong> 5% off for registrations made before the deadline
              </li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900">Payment Verification</h3>
            <p>
              After uploading your Zelle receipt, our team will verify the payment within
              1-2 business days. Your spots are reserved during this verification period.
            </p>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              onClick={onDecline}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              I Do Not Accept
            </button>
            <button
              onClick={onAccept}
              className="px-6 py-3 bg-berry-600 hover:bg-berry-700 text-white rounded-lg transition-colors font-medium"
            >
              I Understand & Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
