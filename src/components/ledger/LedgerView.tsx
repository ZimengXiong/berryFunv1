import { useLedger } from "../../lib/hooks/useLedger";
import { LedgerItemRow } from "./LedgerItemRow";
import { BalanceSummary } from "./BalanceSummary";
import { DiscountBreakdown } from "./DiscountBreakdown";
import { Link } from "react-router-dom";

export function LedgerView() {
  const { items, balance, removeFromLedger, isLoading } = useLedger();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="bg-white rounded-xl shadow-md p-6 h-64"></div>
        <div className="bg-white rounded-xl shadow-md p-6 h-48"></div>
      </div>
    );
  }

  const draftItems = items.filter(i => i.status === "draft");
  const securedItems = items.filter(i => i.status === "secured");
  const verifiedItems = items.filter(i => i.status === "verified");

  const hasItems = items.length > 0;
  const hasDraftItems = draftItems.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Draft Items */}
          {hasDraftItems && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Draft ({draftItems.length})
                </h3>
                <Link
                  to="/checkout"
                  className="bg-berry-600 hover:bg-berry-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                >
                  Proceed to Checkout
                </Link>
              </div>
              <div className="divide-y">
                {draftItems.map(item => (
                  <LedgerItemRow
                    key={item.id}
                    item={item}
                    onRemove={removeFromLedger}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Secured Items */}
          {securedItems.length > 0 && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Pending Verification ({securedItems.length})
              </h3>
              <p className="text-sm text-blue-600 mb-4">
                These items are secured and awaiting admin verification of your payment.
              </p>
              <div className="divide-y">
                {securedItems.map(item => (
                  <LedgerItemRow key={item.id} item={item} showActions={false} />
                ))}
              </div>
            </div>
          )}

          {/* Verified Items */}
          {verifiedItems.length > 0 && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Confirmed Enrollments ({verifiedItems.length})
              </h3>
              <div className="divide-y">
                {verifiedItems.map(item => (
                  <LedgerItemRow key={item.id} item={item} showActions={false} />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!hasItems && (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <span className="text-6xl">📋</span>
              <h3 className="text-xl font-semibold text-gray-900 mt-4">
                Your Ledger is Empty
              </h3>
              <p className="text-gray-600 mt-2">
                Browse our camp sessions and add them to your ledger to get started.
              </p>
              <Link
                to="/sessions"
                className="inline-block mt-6 bg-berry-600 hover:bg-berry-700 text-white px-6 py-3 rounded-lg transition-colors"
              >
                Browse Sessions
              </Link>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <BalanceSummary balance={balance ?? null} />
          {balance && balance.weekCount > 0 && (
            <DiscountBreakdown currentWeeks={balance.weekCount} />
          )}
        </div>
      </div>
    </div>
  );
}
