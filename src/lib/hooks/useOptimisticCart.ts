import { useState, useCallback } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { useLedger } from "./useLedger";

interface OptimisticItem {
  sessionId: Id<"sessions">;
  childId?: Id<"children">;
  status: "adding" | "removing";
}

export function useOptimisticCart() {
  const { addToLedger, removeFromLedger, items, draftCount } = useLedger();
  const [optimisticItems, setOptimisticItems] = useState<OptimisticItem[]>([]);

  const addSession = useCallback(async (sessionId: Id<"sessions">, childId?: Id<"children">) => {
    // Add optimistic item
    setOptimisticItems(prev => [...prev, { sessionId, childId, status: "adding" }]);

    try {
      await addToLedger(sessionId, childId);
    } finally {
      // Remove optimistic item
      setOptimisticItems(prev =>
        prev.filter(item => !(item.sessionId === sessionId && item.childId === childId))
      );
    }
  }, [addToLedger]);

  const removeItem = useCallback(async (itemId: Id<"ledgerItems">) => {
    try {
      await removeFromLedger(itemId);
    } catch (error) {
      console.error("Failed to remove item:", error);
      throw error;
    }
  }, [removeFromLedger]);

  // Check if a session is being added
  const isAdding = useCallback((sessionId: Id<"sessions">, childId?: Id<"children">) => {
    return optimisticItems.some(
      item => item.sessionId === sessionId && item.childId === childId && item.status === "adding"
    );
  }, [optimisticItems]);

  // Check if a session is already in cart (including optimistic)
  const isInCart = useCallback((sessionId: Id<"sessions">, childId?: Id<"children">) => {
    const inItems = items.some(
      item =>
        item.session?.id === sessionId &&
        item.child?.id === childId &&
        item.status === "draft"
    );
    return inItems || isAdding(sessionId, childId);
  }, [items, isAdding]);

  return {
    addSession,
    removeItem,
    isAdding,
    isInCart,
    draftCount: draftCount + optimisticItems.filter(i => i.status === "adding").length,
  };
}
