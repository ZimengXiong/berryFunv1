import { Link } from "react-router-dom";

export function PaymentConfirmation() {
  return (
    <div className="bg-white rounded-xl shadow-md p-8 text-center max-w-lg mx-auto">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Receipt Submitted!</h2>
      <p className="text-gray-600 mb-6">
        Your payment receipt has been submitted successfully. Our team will verify your
        payment within 1-2 business days.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
        <h3 className="font-medium text-blue-800 mb-2">What happens next?</h3>
        <ol className="text-blue-700 text-sm space-y-2 list-decimal list-inside">
          <li>Our team reviews your payment receipt</li>
          <li>Once verified, your enrollments are confirmed</li>
          <li>You'll see the status update in your ledger</li>
          <li>You're all set for camp!</li>
        </ol>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          to="/my-ledger"
          className="bg-berry-600 hover:bg-berry-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
        >
          View My Ledger
        </Link>
        <Link
          to="/sessions"
          className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-3 rounded-lg transition-colors"
        >
          Browse More Sessions
        </Link>
      </div>
    </div>
  );
}
