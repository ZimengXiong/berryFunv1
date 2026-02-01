import { Link } from "react-router-dom";
import { useLedger } from "../../lib/hooks/useLedger";
import { useAuth } from "../../lib/AuthContext";

export function FloatingActionButton() {
  const { isAuthenticated } = useAuth();
  const { draftCount } = useLedger();

  if (!isAuthenticated || draftCount === 0) {
    return null;
  }

  return (
    <Link
      to="/checkout"
      className="fixed bottom-6 right-6 bg-berry-600 hover:bg-berry-700 text-white rounded-full shadow-lg transition-all duration-200 hover:scale-105 z-50 flex items-center space-x-2 px-6 py-4"
    >
      <span className="text-lg">🛒</span>
      <span className="font-semibold">Checkout</span>
      <span className="bg-white text-berry-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
        {draftCount}
      </span>
    </Link>
  );
}
