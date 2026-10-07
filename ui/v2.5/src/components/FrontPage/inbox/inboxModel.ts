// Pure inbox helpers: filter-name resolution, mixing, range transitions,
// lightbox ownership and Gallery layout. No runtime imports.

export const INBOX_FILTER_NAME = "inbox";
export const INBOX_PAGE_SIZE = 24;

// Gallery layout constants.
export const INBOX_PHOTO_MARGIN = 3;
export const INBOX_COLUMN_MIN_WIDTH = 280;
export const INBOX_NARROW_WIDTH = 576;

export interface IInboxDimensions {
  width: number;
  height: number;
}

// Positive fallbacks so Gallery never divides by a missing or zero size.
export const INBOX_SCENE_DEFAULT_DIMENSIONS: IInboxDimensions = {
  width: 1280,
  height: 720,
};
export const INBOX_IMAGE_DEFAULT_DIMENSIONS: IInboxDimensions = {
  width: 1280,
  height: 720,
};

export interface IInboxIdentifiable {
  id: string;
}

export interface IInboxSavedFilter {
  id: string;
  name: string;
  mode: string;
}

export type InboxFilterStatus = "ok" | "missing" | "ambiguous";

export interface IInboxFilterResolution {
  status: InboxFilterStatus;
  // Matching filter when status is "ok".
  filter?: IInboxSavedFilter;
  // Matching names in stored form, used to describe ambiguity.
  matches: string[];
}

export function normalizeInboxName(name: string): string {
  return name.trim().toLowerCase();
}

export function resolveInboxSavedFilter(
  filters: readonly IInboxSavedFilter[],
  mode: string
): IInboxFilterResolution {
  const matches = filters.filter(
    (f) => f.mode === mode && normalizeInboxName(f.name) === INBOX_FILTER_NAME
  );

  if (matches.length === 0) {
    return { status: "missing", matches: [] };
  }
  if (matches.length > 1) {
    return { status: "ambiguous", matches: matches.map((f) => f.name) };
  }
  return { status: "ok", filter: matches[0], matches: [matches[0].name] };
}

export type InboxItemKind = "scene" | "image";

export interface IInboxMixedScene<S> {
  kind: "scene";
  item: S;
}

export interface IInboxMixedImage<I> {
  kind: "image";
  item: I;
}

export type IInboxMixedItem<S, I> = IInboxMixedScene<S> | IInboxMixedImage<I>;

// Alternates Scene then Image, keeping each category's order; the remainder of
// the other category is appended once one is exhausted.
export function interleaveInbox<
  S extends IInboxIdentifiable,
  I extends IInboxIdentifiable
>(scenes: readonly S[], images: readonly I[]): IInboxMixedItem<S, I>[] {
  const mixed: IInboxMixedItem<S, I>[] = [];
  const length = Math.max(scenes.length, images.length);

  for (let i = 0; i < length; i += 1) {
    const scene = scenes[i];
    if (scene) mixed.push({ kind: "scene", item: scene });
    const image = images[i];
    if (image) mixed.push({ kind: "image", item: image });
  }

  return mixed;
}

export function dedupeInbox<T extends IInboxIdentifiable>(
  items: readonly T[]
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }

  return result;
}

export interface IInboxRange<T> {
  // Identity of the filter/refresh the range belongs to.
  key: string;
  items: T[];
  count: number;
}

// Range transition for one category: a key change clears the range, no update
// keeps it recoverable after a failed page, an update replaces it deduped.
export function applyInboxRange<T extends IInboxIdentifiable>(
  current: IInboxRange<T>,
  key: string,
  update: { items: readonly T[]; count: number } | undefined
): IInboxRange<T> {
  if (key !== current.key) {
    return { key, items: [], count: 0 };
  }
  if (!update) {
    return current;
  }
  return { key, items: dedupeInbox(update.items), count: update.count };
}

export function resolveInboxRandomSeed(
  sort: string | null | undefined,
  savedSeed: number,
  sessionSeed: number
): number {
  if (sort !== "random") return -1;
  return savedSeed === -1 ? sessionSeed : savedSeed;
}

// True when the id sequence differs, i.e. membership or ordering changed.
export function inboxIdsChanged(
  previous: readonly string[],
  next: readonly string[]
): boolean {
  if (previous.length !== next.length) return true;
  return previous.some((id, index) => id !== next[index]);
}

export interface IInboxLightboxDelivery {
  // Page of the last batch actually delivered (0 when nothing was delivered).
  deliveredPage: number;
  // Page of the newest issued lightbox request.
  requestPage: number;
  // Page the hook's current query variables target.
  requestedPage: number;
  // True when the result is the same object already delivered.
  sameDataObject: boolean;
  // Ids of the last delivered batch.
  deliveredIds: readonly string[];
  // Ids in the incoming result.
  incomingIds: readonly string[];
}

// Only the newest request is accepted, and a batch whose ids match the last
// delivered one can only be re-delivered for the page it was delivered for.
// This keeps a previous page's data out after a rapid reopen or switch.
export function shouldDeliverInboxLightbox(
  delivery: IInboxLightboxDelivery
): boolean {
  if (delivery.requestedPage !== delivery.requestPage) return false;
  if (
    delivery.sameDataObject &&
    delivery.requestedPage === delivery.deliveredPage
  ) {
    return false;
  }
  if (
    delivery.requestedPage !== delivery.deliveredPage &&
    delivery.deliveredIds.length > 0 &&
    !inboxIdsChanged(delivery.deliveredIds, delivery.incomingIds)
  ) {
    return false;
  }
  return true;
}

// A membership or ordering change under the displayed page means the viewed
// image may have left the Inbox; the lightbox must close.
export function shouldCloseInboxLightboxForChange(
  displayPage: number,
  requestedPage: number,
  displayedIds: readonly string[],
  incomingIds: readonly string[]
): boolean {
  return (
    displayPage === requestedPage &&
    displayedIds.length > 0 &&
    inboxIdsChanged(displayedIds, incomingIds)
  );
}

export function inboxTotalPages(totalCount: number, pageSize: number): number {
  if (totalCount <= 0 || pageSize <= 0) return 0;
  return Math.ceil(totalCount / pageSize);
}

// 1-based page with wraparound at both ends.
export function wrapInboxPage(page: number, totalPages: number): number {
  if (totalPages <= 0) return 1;
  return ((((page - 1) % totalPages) + totalPages) % totalPages) + 1;
}

export function computeInboxLightboxPage(
  globalIndex: number,
  pageSize: number
): { page: number; initialIndex: number } {
  const safeIndex = Math.max(0, globalIndex);
  return {
    page: Math.floor(safeIndex / pageSize) + 1,
    initialIndex: safeIndex % pageSize,
  };
}

// Global offset of a 1-based page, for the shared lightbox footer when page is
// omitted.
export function inboxPageOffset(page: number, pageSize: number): number {
  return Math.max(0, page - 1) * pageSize;
}

export function sliceInboxPage<T>(
  items: readonly T[],
  page: number,
  pageSize: number
): T[] {
  const start = Math.max(0, (page - 1) * pageSize);
  return items.slice(start, start + pageSize);
}

// Column count for the Gallery: two columns on phones, otherwise roughly
// INBOX_COLUMN_MIN_WIDTH wide columns (at least two).
export function inboxColumns(containerWidth: number): number {
  if (containerWidth <= 0) return 1;
  if (containerWidth <= INBOX_NARROW_WIDTH) return 2;
  return Math.max(2, Math.round(containerWidth / INBOX_COLUMN_MIN_WIDTH));
}

// Gallery needs finite positive sizes; anything else uses the fallback.
export function inboxPositiveDimensions(
  width: number | null | undefined,
  height: number | null | undefined,
  fallback: IInboxDimensions
): IInboxDimensions {
  if (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    (width as number) > 0 &&
    (height as number) > 0
  ) {
    return { width: width as number, height: height as number };
  }
  return fallback;
}
