import type { Id } from "../../../convex/_generated/dataModel";

interface LedgerItem {
  id: Id<"ledgerItems">;
  type: "enrollment" | "credit_memo";
  status: "draft" | "reserved" | "secured" | "verified" | "cancelled";
  amount: number;
  description?: string;
  createdAt: number;
  verifiedAt?: number;
  session?: {
    id: Id<"sessions">;
    name: string;
    startDate: string;
    endDate: string;
    basePrice: number;
  } | null;
  child?: {
    id: Id<"children">;
    firstName: string;
    lastName: string;
  } | null;
  coupon?: {
    id: Id<"coupons">;
    code: string;
    discountValue: number;
    discountType: "fixed" | "percentage";
  } | null;
}

interface LedgerItemRowProps {
  item: LedgerItem;
  onRemove?: (id: Id<"ledgerItems">) => void;
  showActions?: boolean;
}

export function LedgerItemRow({ item, onRemove, showActions = true }: LedgerItemRowProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-yellow-100 text-yellow-800",
      reserved: "bg-orange-100 text-orange-800",
      secured: "bg-blue-100 text-blue-800",
      verified: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-800"}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const isCredit = item.type === "credit_memo" || item.amount < 0;

  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
      <div className="flex-1">
        <div className="flex items-center space-x-3">
          <span className="text-xl">
            {item.type === "enrollment" ? "📅" : "🎟️"}
          </span>
          <div>
            <div className="font-medium text-gray-900">
              {item.session?.name || item.description || "Credit Memo"}
            </div>
            {item.session && (
              <div className="text-sm text-gray-500">
                {new Date(item.session.startDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                -{" "}
                {new Date(item.session.endDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            )}
            {item.child && (
              <div className="text-sm text-gray-500">
                For: {item.child.firstName} {item.child.lastName}
              </div>
            )}
            {item.coupon && (
              <div className="text-sm text-berry-600">
                Coupon: {item.coupon.code}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="text-right">
          <div className={`font-semibold ${isCredit ? "text-green-600" : "text-gray-900"}`}>
            {isCredit ? "-" : ""}${Math.abs(item.amount).toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">
            {formatDate(item.createdAt)}
          </div>
        </div>

        {getStatusBadge(item.status)}

        {showActions && item.status === "draft" && onRemove && (
          <button
            onClick={() => onRemove(item.id)}
            className="text-gray-400 hover:text-red-600 transition-colors p-1"
            title="Remove"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
