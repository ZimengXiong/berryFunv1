import type { ReactNode } from "react";
import { ConvexProvider as ConvexProviderBase, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

interface Props {
  children: ReactNode;
}

export function ConvexProvider({ children }: Props) {
  return (
    <ConvexProviderBase client={convex}>
      {children}
    </ConvexProviderBase>
  );
}
