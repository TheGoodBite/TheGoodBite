"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_GROCERY_DRAFT, readGroceryDraft, writeGroceryDraft, type GroceryDraft } from "@/lib/groceryDraft";

export function useGroceryDraft({ ownerId, authReady, draft, onRestore }: {
  ownerId: string | null;
  authReady: boolean;
  draft: GroceryDraft;
  onRestore: (draft: GroceryDraft) => void;
}) {
  const [restoredOwner, setRestoredOwner] = useState<string | null | undefined>(undefined);
  const restore = useRef(onRestore);
  restore.current = onRestore;
  const adoptedGuest = useRef(false);
  const serialized = JSON.stringify(draft);

  useEffect(() => {
    if (!authReady) return;
    try {
      const saved = readGroceryDraft(window.localStorage, ownerId);
      adoptedGuest.current = saved.adoptedGuest;
      restore.current(saved.draft ?? EMPTY_GROCERY_DRAFT);
    } catch {
      restore.current(EMPTY_GROCERY_DRAFT);
    }
    setRestoredOwner(ownerId);
  }, [authReady, ownerId]);

  const persist = useCallback(() => {
    // Avoid overwriting a stored draft with the empty initial render, or with
    // another account's state while an auth transition is still restoring it.
    if (!authReady || restoredOwner !== ownerId) return;
    try {
      if (writeGroceryDraft(window.localStorage, ownerId, JSON.parse(serialized), adoptedGuest.current))
        adoptedGuest.current = false;
    } catch { /* Blocked storage must not prevent list editing or sign-in. */ }
  }, [authReady, restoredOwner, ownerId, serialized]);

  useEffect(persist, [persist]);

  return persist;
}
