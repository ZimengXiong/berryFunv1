import { SessionGrid } from "../components/sessions/SessionGrid";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { FloatingActionButton } from "../components/layout/FloatingActionButton";

export function Sessions() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Camp Sessions</h1>
            <p className="text-gray-600 mt-2">
              Browse our available sessions and add them to your cart.
            </p>
          </div>
          <SessionGrid />
        </div>
      </main>
      <Footer />
      <FloatingActionButton />
    </div>
  );
}
