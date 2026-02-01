import { TIERED_DISCOUNTS } from "../../../convex/constants";

interface DiscountBreakdownProps {
  currentWeeks: number;
}

export function DiscountBreakdown({ currentWeeks }: DiscountBreakdownProps) {
  const discountTiers = Object.entries(TIERED_DISCOUNTS).map(([weeks, discount]) => ({
    weeks: parseInt(weeks),
    discount,
  }));

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Multi-Week Savings</h3>
      <p className="text-gray-600 text-sm mb-4">
        The more weeks you enroll, the more you save! Discounts apply automatically.
      </p>

      <div className="space-y-2">
        {discountTiers.map(({ weeks, discount }) => {
          const isActive = currentWeeks >= weeks;
          const isNext = currentWeeks === weeks - 1;

          return (
            <div
              key={weeks}
              className={`flex justify-between items-center p-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-green-50 border border-green-200"
                  : isNext
                  ? "bg-yellow-50 border border-yellow-200"
                  : "bg-gray-50"
              }`}
            >
              <div className="flex items-center space-x-2">
                {isActive && <span className="text-green-500">✓</span>}
                <span className={isActive ? "font-medium text-green-700" : "text-gray-700"}>
                  {weeks} weeks
                </span>
              </div>
              <span className={isActive ? "font-bold text-green-600" : "font-medium text-gray-600"}>
                ${discount} off
              </span>
            </div>
          );
        })}
      </div>

      {currentWeeks > 0 && currentWeeks < 12 && (
        <div className="mt-4 p-3 bg-berry-50 rounded-lg">
          <p className="text-berry-700 text-sm">
            <strong>Tip:</strong> Add{" "}
            {currentWeeks < 3 ? 3 - currentWeeks : 1} more week
            {currentWeeks < 3 && 3 - currentWeeks > 1 ? "s" : ""} to unlock your next discount!
          </p>
        </div>
      )}
    </div>
  );
}
