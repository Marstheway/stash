// Pure history policy for the shared lightbox, kept separate from context.tsx
// so it can be tested without React or the app aliases.

export type LightboxHideReasonName = "dismiss" | "navigate";

export interface ILightboxHideContext {
  reason: LightboxHideReasonName;
  // Entry opts out of history.back() on every close reason.
  discardOnClose: boolean;
  // The current history entry still carries this lightbox's marker.
  isCurrentMarker: boolean;
}

export type LightboxHideAction = "back" | "clear-and-close";

// Clearing is a no-op when the marker is not on the current entry, so
// "clear-and-close" is also the direct-close path.
export function resolveLightboxHideAction(
  context: ILightboxHideContext
): LightboxHideAction {
  if (context.discardOnClose) return "clear-and-close";
  if (context.reason === "navigate") return "clear-and-close";
  return context.isCurrentMarker ? "back" : "clear-and-close";
}
