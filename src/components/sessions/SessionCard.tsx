import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuth } from "../../lib/AuthContext";
import { useOptimisticCart } from "../../lib/hooks/useOptimisticCart";

interface Session {
  id: Id<"sessions">;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  basePrice: number;
  capacity: number;
  enrolledCount: number;
  spotsRemaining: number;
  ageMin?: number;
  ageMax?: number;
  location?: string;
  imageStorageId?: Id<"_storage">;
  earlyBirdDeadline?: number;
}

interface SessionCardProps {
  session: Session;
}

export function SessionCard({ session }: SessionCardProps) {
  const { isAuthenticated } = useAuth();
  const { addSession, isInCart, isAdding } = useOptimisticCart();

  const imageUrl = useQuery(
    api.files.getFileUrl,
    session.imageStorageId ? { storageId: session.imageStorageId } : "skip"
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const isEarlyBird = session.earlyBirdDeadline && Date.now() < session.earlyBirdDeadline;
  const isFull = session.spotsRemaining <= 0;
  const isLowAvailability = session.spotsRemaining > 0 && session.spotsRemaining <= 5;
  const inCart = isInCart(session.id);
  const adding = isAdding(session.id);

  const handleAddToCart = async () => {
    if (!isAuthenticated || inCart || adding || isFull) return;
    try {
      await addSession(session.id);
    } catch (error) {
      console.error("Failed to add to cart:", error);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="h-48 bg-gradient-to-br from-berry-400 to-berry-600 relative">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={session.name}
            className="w-full h-full object-cover"
          />
        )}
        {isEarlyBird && (
          <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">
            Early Bird 5% Off
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold text-gray-900">{session.name}</h3>
          <span className="text-lg font-bold text-berry-600">
            ${session.basePrice}
          </span>
        </div>

        <p className="text-sm text-gray-600 mb-3">
          {formatDate(session.startDate)} - {formatDate(session.endDate)}
        </p>

        {session.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {session.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {session.ageMin !== undefined && session.ageMax !== undefined && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
              Ages {session.ageMin}-{session.ageMax}
            </span>
          )}
          {session.location && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
              {session.location}
            </span>
          )}
        </div>

        <div className="flex justify-between items-center">
          <div>
            {isFull ? (
              <span className="text-red-600 font-medium">Full</span>
            ) : isLowAvailability ? (
              <span className="text-orange-600 font-medium">
                Only {session.spotsRemaining} spots left!
              </span>
            ) : (
              <span className="text-gray-500 text-sm">
                {session.spotsRemaining} spots available
              </span>
            )}
          </div>

          {isAuthenticated ? (
            inCart ? (
              <span className="text-green-600 font-medium">In Cart</span>
            ) : (
              <button
                onClick={handleAddToCart}
                disabled={isFull || adding}
                className="bg-berry-600 hover:bg-berry-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? "Adding..." : isFull ? "Full" : "Add to Cart"}
              </button>
            )
          ) : (
            <a
              href="/login"
              className="text-berry-600 hover:text-berry-700 font-medium"
            >
              Login to Enroll
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
