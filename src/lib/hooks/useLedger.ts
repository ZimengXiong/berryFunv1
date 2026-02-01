import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "../AuthContext";
import type { Id } from "../../../convex/_generated/dataModel";

export function useLedger() {
  const { token } = useAuth();

  const ledgerItems = useQuery(
    api.ledgerItems.getLedgerItems,
    token ? { token } : "skip"
  );

  const balance = useQuery(
    api.deltaEngine.calculateBalance,
    token ? { token } : "skip"
  );

  const draftCount = useQuery(
    api.ledgerItems.getDraftCount,
    token ? { token } : "skip"
  );

  const addToLedgerMutation = useMutation(api.ledgerItems.addToLedger);
  const removeFromLedgerMutation = useMutation(api.ledgerItems.removeFromLedger);

  const addToLedger = async (sessionId: Id<"sessions">, childId?: Id<"children">) => {
    if (!token) throw new Error("Not authenticated");
    return addToLedgerMutation({ token, sessionId, childId });
  };

  const removeFromLedger = async (itemId: Id<"ledgerItems">) => {
    if (!token) throw new Error("Not authenticated");
    return removeFromLedgerMutation({ token, itemId });
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
  const { token } = useAuth();

  return useQuery(
    api.deltaEngine.getDiscountPreview,
    token ? { token, additionalWeeks } : "skip"
  );
}
