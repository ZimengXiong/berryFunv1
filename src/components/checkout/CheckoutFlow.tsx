import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useLedger } from "../../lib/hooks/useLedger";
import { useAuth } from "../../lib/AuthContext";
import { LedgerItemRow } from "../ledger/LedgerItemRow";
import { BalanceSummary } from "../ledger/BalanceSummary";
import { LiabilityModal } from "./LiabilityModal";
import { FinancialTermsModal } from "./FinancialTermsModal";
import { ReceiptUpload } from "./ReceiptUpload";
import { PaymentConfirmation } from "./PaymentConfirmation";
import { DEPOSIT_PER_WEEK } from "../../../convex/constants";
import type { Id } from "../../../convex/_generated/dataModel";

type Step = "review" | "liability" | "financial" | "method" | "payment" | "confirmation";
type PaymentMethod = "zelle" | "cash" | null;

interface ReservationData {
  reservedItems: Id<"ledgerItems">[];
  depositAmount: number;
  expiresAt: number;
  paymentMethod: "zelle" | "cash";
}

export function CheckoutFlow() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { items, balance, removeFromLedger, isLoading } = useLedger();
  const [step, setStep] = useState<Step>("review");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [isReserving, setIsReserving] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const reserveItems = useMutation(api.ledgerItems.reserveItems);

  const draftItems = items.filter(i => i.status === "draft" && i.type === "enrollment");
  const reservedItems = items.filter(i => i.status === "reserved" && i.type === "enrollment");
  const draftCredits = items.filter(i => i.status === "draft" && i.type === "credit_memo");

  // Items to checkout (either draft or already reserved)
  const checkoutItems = draftItems.length > 0 ? draftItems : reservedItems;
  const weekCount = checkoutItems.length;

  // Calculate amounts
  const depositAmount = weekCount * DEPOSIT_PER_WEEK;
  const fullAmount = balance?.balanceDue ?? 0;

  // Countdown timer for reservation
  useEffect(() => {
    if (!reservation) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, reservation.expiresAt - Date.now());
      setTimeLeft(remaining);

      if (remaining === 0) {
        // Reservation expired, go back to review
        setReservation(null);
        setStep("review");
        setError("Your reservation has expired. Please try again.");
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [reservation]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="bg-white rounded-xl shadow-md p-6 h-64"></div>
      </div>
    );
  }

  if (checkoutItems.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-12 text-center">
        <span className="text-6xl">🛒</span>
        <h2 className="text-xl font-semibold text-gray-900 mt-4">No Items to Checkout</h2>
        <p className="text-gray-600 mt-2">Add some sessions to your cart first.</p>
        <button
          onClick={() => navigate("/sessions")}
          className="mt-6 bg-berry-600 hover:bg-berry-700 text-white px-6 py-3 rounded-lg transition-colors"
        >
          Browse Sessions
        </button>
      </div>
    );
  }

  if (step === "confirmation") {
    return <PaymentConfirmation />;
  }

  const handleSelectPaymentMethod = async (method: "zelle" | "cash") => {
    if (!isAuthenticated) return;

    setPaymentMethod(method);
    setError("");
    setIsReserving(true);

    try {
      const itemIds = checkoutItems.map(i => i.id);
      const result = await reserveItems({
        itemIds,
        paymentMethod: method,
      });

      setReservation(result as ReservationData);
      setStep("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reserve spots");
    } finally {
      setIsReserving(false);
    }
  };

  const allItemIds = [...checkoutItems, ...draftCredits].map(i => i.id);
  const amountDueNow = paymentMethod === "cash" ? depositAmount : fullAmount;

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex justify-between items-center">
          {["Review", "Liability", "Terms", "Method", "Payment"].map((label, i) => {
            const steps: Step[] = ["review", "liability", "financial", "method", "payment"];
            const currentIndex = steps.indexOf(step);
            const isActive = i === currentIndex;
            const isComplete = i < currentIndex;

            return (
              <div
                key={label}
                className={`flex items-center ${i < 4 ? "flex-1" : ""}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm ${
                    isComplete
                      ? "bg-green-500 text-white"
                      : isActive
                      ? "bg-berry-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isComplete ? "✓" : i + 1}
                </div>
                <span
                  className={`ml-2 hidden sm:block text-sm ${
                    isActive ? "font-medium text-gray-900" : "text-gray-500"
                  }`}
                >
                  {label}
                </span>
                {i < 4 && (
                  <div
                    className={`flex-1 h-1 mx-2 sm:mx-4 ${
                      isComplete ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Reservation Timer */}
      {reservation && timeLeft !== null && (
        <div className={`rounded-lg p-4 flex items-center justify-between ${
          timeLeft < 300000 ? "bg-red-50 border border-red-200" : "bg-blue-50 border border-blue-200"
        }`}>
          <div className="flex items-center">
            <span className="text-2xl mr-3">⏱️</span>
            <div>
              <p className={`font-medium ${timeLeft < 300000 ? "text-red-800" : "text-blue-800"}`}>
                Spots Reserved
              </p>
              <p className={`text-sm ${timeLeft < 300000 ? "text-red-600" : "text-blue-600"}`}>
                Complete payment to secure your registration
              </p>
            </div>
          </div>
          <div className={`text-2xl font-mono font-bold ${
            timeLeft < 300000 ? "text-red-600" : "text-blue-600"
          }`}>
            {formatTime(timeLeft)}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {step === "review" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Review Your Order</h2>
              <div className="divide-y">
                {checkoutItems.map(item => (
                  <LedgerItemRow
                    key={item.id}
                    item={item}
                    onRemove={item.status === "draft" ? removeFromLedger : undefined}
                  />
                ))}
                {draftCredits.map(item => (
                  <LedgerItemRow
                    key={item.id}
                    item={item}
                    onRemove={removeFromLedger}
                  />
                ))}
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => navigate("/sessions")}
                  className="text-berry-600 hover:text-berry-700 font-medium"
                >
                  ← Add More Sessions
                </button>
                <button
                  onClick={() => setStep("liability")}
                  className="bg-berry-600 hover:bg-berry-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Continue to Checkout
                </button>
              </div>
            </div>
          </div>

          <div>
            <BalanceSummary balance={balance ?? null} />
          </div>
        </div>
      )}

      {step === "method" && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Select Payment Method</h2>
            <p className="text-gray-600 mb-6">
              Choose how you'd like to pay for {weekCount} week{weekCount > 1 ? "s" : ""} of camp.
            </p>

            <div className="space-y-4">
              {/* Zelle Option */}
              <button
                onClick={() => handleSelectPaymentMethod("zelle")}
                disabled={isReserving}
                className="w-full text-left border-2 border-gray-200 rounded-xl p-6 hover:border-berry-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <span className="text-2xl mr-3">💸</span>
                      Pay Full Amount via Zelle
                    </h3>
                    <p className="text-gray-600 mt-2 ml-9">
                      Pay the full balance now via Zelle for immediate confirmation.
                    </p>
                    <ul className="mt-3 ml-9 text-sm text-gray-500 space-y-1">
                      <li>✓ Fastest confirmation</li>
                      <li>✓ Pay everything at once</li>
                    </ul>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-berry-600">
                      ${fullAmount.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500">due now</div>
                  </div>
                </div>
              </button>

              {/* Cash Option */}
              <button
                onClick={() => handleSelectPaymentMethod("cash")}
                disabled={isReserving}
                className="w-full text-left border-2 border-gray-200 rounded-xl p-6 hover:border-berry-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <span className="text-2xl mr-3">💵</span>
                      Pay Deposit + Cash Later
                    </h3>
                    <p className="text-gray-600 mt-2 ml-9">
                      Pay ${DEPOSIT_PER_WEEK}/week deposit via Zelle now, settle the rest in cash.
                    </p>
                    <ul className="mt-3 ml-9 text-sm text-gray-500 space-y-1">
                      <li>✓ Lower upfront payment</li>
                      <li>✓ Pay remaining balance in cash before camp starts</li>
                    </ul>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-berry-600">
                      ${depositAmount.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500">due now</div>
                    <div className="text-sm text-gray-400 mt-1">
                      +${(fullAmount - depositAmount).toFixed(2)} later
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {isReserving && (
              <div className="mt-4 text-center text-gray-600">
                <span className="animate-pulse">Reserving your spots...</span>
              </div>
            )}

            <div className="mt-6 pt-4 border-t">
              <button
                onClick={() => setStep("financial")}
                className="text-gray-500 hover:text-gray-700"
              >
                ← Back to Terms
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "payment" && (
        <ReceiptUpload
          ledgerItemIds={allItemIds}
          totalAmount={amountDueNow}
          paymentMethod={paymentMethod!}
          fullAmount={fullAmount}
          depositAmount={depositAmount}
          onSuccess={() => setStep("confirmation")}
          onCancel={() => {
            setStep("method");
            setReservation(null);
          }}
        />
      )}

      {/* Modals */}
      <LiabilityModal
        isOpen={step === "liability"}
        onAccept={() => setStep("financial")}
        onDecline={() => setStep("review")}
      />

      <FinancialTermsModal
        isOpen={step === "financial"}
        onAccept={() => setStep("method")}
        onDecline={() => setStep("review")}
        depositAmount={DEPOSIT_PER_WEEK}
      />
    </div>
  );
}
