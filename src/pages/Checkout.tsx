import { CheckoutFlow } from "../components/checkout/CheckoutFlow";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";

export function Checkout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
            <p className="text-gray-600 mt-2">
              Review your order and complete your registration.
            </p>
          </div>
          <CheckoutFlow />
        </div>
      </main>
      <Footer />
    </div>
  );
}
