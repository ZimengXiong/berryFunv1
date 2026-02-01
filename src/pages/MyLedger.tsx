import { LedgerView } from "../components/ledger/LedgerView";
import { CouponInput } from "../components/coupons/CouponInput";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { FloatingActionButton } from "../components/layout/FloatingActionButton";

export function MyLedger() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">My Ledger</h1>
            <p className="text-gray-600 mt-2">
              View your enrollments, balance, and payment history.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <LedgerView />
            </div>
            <div className="space-y-6">
              <CouponInput />
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <FloatingActionButton />
    </div>
  );
}
