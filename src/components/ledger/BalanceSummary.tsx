interface BalanceBreakdown {
  grossTuition: number;
  totalDiscounts: number;
  totalCredits: number;
  totalPaid: number;
  pendingPayments: number;
  balanceDue: number;
  tieredDiscount: number;
  returningCredit: number;
  siblingCredit: number;
  earlyBirdCredit: number;
  couponCredits: number;
  weekCount: number;
  draftWeekCount: number;
  reservedWeekCount: number;
  securedWeekCount: number;
  verifiedWeekCount: number;
  hasEarlyBirdEligible: boolean;
  isReturning: boolean;
  hasSiblings: boolean;
}

interface BalanceSummaryProps {
  balance: BalanceBreakdown | null;
}

export function BalanceSummary({ balance }: BalanceSummaryProps) {
  if (!balance) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const hasAnyDiscounts =
    balance.tieredDiscount > 0 ||
    balance.returningCredit > 0 ||
    balance.siblingCredit > 0 ||
    balance.earlyBirdCredit > 0 ||
    balance.couponCredits > 0;

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Balance Summary</h3>

      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Gross Tuition ({balance.weekCount} weeks)</span>
          <span className="font-medium">{formatCurrency(balance.grossTuition)}</span>
        </div>

        {hasAnyDiscounts && (
          <>
            <div className="border-t pt-3">
              <div className="text-sm font-medium text-gray-500 mb-2">Discounts & Credits</div>

              {balance.tieredDiscount > 0 && (
                <div className="flex justify-between text-green-600 text-sm">
                  <span>Multi-Week Discount</span>
                  <span>-{formatCurrency(balance.tieredDiscount)}</span>
                </div>
              )}

              {balance.returningCredit > 0 && (
                <div className="flex justify-between text-green-600 text-sm">
                  <span>Returning Camper Credit</span>
                  <span>-{formatCurrency(balance.returningCredit)}</span>
                </div>
              )}

              {balance.siblingCredit > 0 && (
                <div className="flex justify-between text-green-600 text-sm">
                  <span>Sibling Discount</span>
                  <span>-{formatCurrency(balance.siblingCredit)}</span>
                </div>
              )}

              {balance.earlyBirdCredit > 0 && (
                <div className="flex justify-between text-green-600 text-sm">
                  <span>Early Bird Discount (5%)</span>
                  <span>-{formatCurrency(balance.earlyBirdCredit)}</span>
                </div>
              )}

              {balance.couponCredits > 0 && (
                <div className="flex justify-between text-green-600 text-sm">
                  <span>Coupon Credits</span>
                  <span>-{formatCurrency(balance.couponCredits)}</span>
                </div>
              )}
            </div>
          </>
        )}

        {(balance.totalPaid > 0 || balance.pendingPayments > 0) && (
          <div className="border-t pt-3 space-y-1">
            {balance.totalPaid > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Verified Payments</span>
                <span>-{formatCurrency(balance.totalPaid)}</span>
              </div>
            )}
            {balance.pendingPayments > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>Pending Verification</span>
                <span>-{formatCurrency(balance.pendingPayments)}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between text-xl font-bold border-t pt-3">
          <span>Balance Due</span>
          <span className={balance.balanceDue > 0 ? "text-berry-600" : "text-green-600"}>
            {formatCurrency(balance.balanceDue)}
          </span>
        </div>

      </div>

      {/* Status breakdown */}
      <div className="mt-6 pt-4 border-t">
        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          <div>
            <div className="font-medium text-gray-600">{balance.draftWeekCount}</div>
            <div className="text-gray-500 text-xs">Cart</div>
          </div>
          <div>
            <div className="font-medium text-orange-600">{balance.reservedWeekCount}</div>
            <div className="text-gray-500 text-xs">Reserved</div>
          </div>
          <div>
            <div className="font-medium text-blue-600">{balance.securedWeekCount}</div>
            <div className="text-gray-500 text-xs">Paid</div>
          </div>
          <div>
            <div className="font-medium text-green-600">{balance.verifiedWeekCount}</div>
            <div className="text-gray-500 text-xs">Confirmed</div>
          </div>
        </div>
      </div>

      {/* Active discounts info */}
      {(balance.isReturning || balance.hasSiblings || balance.hasEarlyBirdEligible) && (
        <div className="mt-4 pt-4 border-t">
          <div className="text-sm text-gray-500">Active discounts:</div>
          <div className="flex flex-wrap gap-2 mt-2">
            {balance.isReturning && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                Returning Camper ($25/week)
              </span>
            )}
            {balance.hasSiblings && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                Sibling Discount ($15/week)
              </span>
            )}
            {balance.hasEarlyBirdEligible && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                Early Bird (5% off)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
