import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "../AuthContext";
import type { Id } from "../../../convex/_generated/dataModel";

export function useLedger() {
  const { isAuthenticated } = useAuth();

  const ledgerItems = useQuery(
    api.ledgerItems.getLedgerItems,
    isAuthenticated ? {} : "skip"
  );

  const balance = useQuery(
    api.deltaEngine.calculateBalance,
    isAuthenticated ? {} : "skip"
  );

  const draftCount = useQuery(
    api.ledgerItems.getDraftCount,
    isAuthenticated ? {} : "skip"
  );

  const addToLedgerMutation = useMutation(api.ledgerItems.addToLedger);
  const removeFromLedgerMutation = useMutation(api.ledgerItems.removeFromLedger);

  const addToLedger = async (sessionId: Id<"sessions">, childId?: Id<"children">) => {
    if (!isAuthenticated) throw new Error("Not authenticated");
    return addToLedgerMutation({ sessionId, childId });
  };

  const removeFromLedger = async (itemId: Id<"ledgerItems">) => {
    if (!isAuthenticated) throw new Error("Not authenticated");
    return removeFromLedgerMutation({ itemId });
  };

  return {
    items: ledgerItems ?? [],
    balance,
    draftCount: draftCount ?? 0,
    addToLedger,
    removeFromLedger,
    isLoading: ledgerItems === undefined || balance === undefined,
  };
}

export function useDiscountPreview(additionalWeeks: number) {
  const { isAuthenticated } = useAuth();

  return useQuery(
    api.deltaEngine.getDiscountPreview,
    isAuthenticated ? { additionalWeeks } : "skip"
  );
}
