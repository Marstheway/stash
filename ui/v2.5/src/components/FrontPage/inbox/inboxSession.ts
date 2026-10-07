// In-memory (not localStorage) home session state: survives the FrontPage
// unmount on a detail visit, resets on reload. No media data is persisted.

export type InboxTab = "all" | "scenes" | "images";

interface IInboxSessionState {
  tab: InboxTab;
  seeds: Record<string, number>;
  pages: Record<string, number>;
}

const session: IInboxSessionState = {
  tab: "all",
  seeds: {},
  pages: {},
};

export function readInboxTab(): InboxTab {
  return session.tab;
}

export function writeInboxTab(tab: InboxTab) {
  session.tab = tab;
}

// Fixed random seed per browse session, keeping page boundaries stable.
export function inboxSeed(key: string): number {
  const existing = session.seeds[key];
  if (existing !== undefined) return existing;

  const seed = Math.floor(Math.random() * 10 ** 8);
  session.seeds[key] = seed;
  return seed;
}

// Loaded range restored after a detail round trip.
export function readInboxPages(key: string): number {
  return session.pages[key] ?? 1;
}

export function writeInboxPages(key: string, pages: number) {
  session.pages[key] = pages;
}
