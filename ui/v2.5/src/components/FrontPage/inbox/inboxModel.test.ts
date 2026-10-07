// Plain-Node tests for inboxModel.ts. Run with the tsc + node command from the
// implementation contract; no test framework or new dependency is used.
import { strict as assert } from "assert";
import {
  applyInboxRange,
  computeInboxLightboxPage,
  dedupeInbox,
  inboxColumns,
  inboxIdsChanged,
  inboxPageOffset,
  inboxPositiveDimensions,
  inboxTotalPages,
  interleaveInbox,
  normalizeInboxName,
  resolveInboxRandomSeed,
  resolveInboxSavedFilter,
  shouldCloseInboxLightboxForChange,
  shouldDeliverInboxLightbox,
  sliceInboxPage,
  wrapInboxPage,
  IInboxRange,
  IInboxSavedFilter,
} from "./inboxModel";

let failures = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    // eslint-disable-next-line no-console
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    // eslint-disable-next-line no-console
    console.error(`not ok - ${name}`);
    // eslint-disable-next-line no-console
    console.error(error);
  }
}

const filter = (id: string, name: string, mode: string): IInboxSavedFilter => ({
  id,
  name,
  mode,
});

const item = (id: string) => ({ id });

test("normalizeInboxName trims and lowercases", () => {
  assert.equal(normalizeInboxName("  InBox  "), "inbox");
  assert.equal(normalizeInboxName("INBOX"), "inbox");
});

test("resolveInboxSavedFilter reports missing", () => {
  const result = resolveInboxSavedFilter(
    [filter("1", "other", "SCENES")],
    "SCENES"
  );
  assert.equal(result.status, "missing");
  assert.deepEqual(result.matches, []);
  assert.equal(result.filter, undefined);
});

test("resolveInboxSavedFilter matches case-insensitively within the mode", () => {
  const result = resolveInboxSavedFilter(
    [
      filter("1", "inbox", "IMAGES"),
      filter("2", "  INBOX ", "SCENES"),
      filter("3", "not-inbox", "SCENES"),
    ],
    "SCENES"
  );
  assert.equal(result.status, "ok");
  assert.equal(result.filter?.id, "2");
});

test("resolveInboxSavedFilter reports ambiguous names", () => {
  const result = resolveInboxSavedFilter(
    [filter("1", "Inbox", "SCENES"), filter("2", "inbox", "SCENES")],
    "SCENES"
  );
  assert.equal(result.status, "ambiguous");
  assert.deepEqual(result.matches, ["Inbox", "inbox"]);
  assert.equal(result.filter, undefined);
});

test("interleaveInbox alternates scene first", () => {
  const mixed = interleaveInbox(
    [item("s1"), item("s2")],
    [item("i1"), item("i2")]
  );
  assert.deepEqual(
    mixed.map((m) => `${m.kind}:${m.item.id}`),
    ["scene:s1", "image:i1", "scene:s2", "image:i2"]
  );
});

test("interleaveInbox appends the other category once one is exhausted", () => {
  assert.deepEqual(
    interleaveInbox([item("s1")], [item("i1"), item("i2")]).map(
      (m) => `${m.kind}:${m.item.id}`
    ),
    ["scene:s1", "image:i1", "image:i2"]
  );
  assert.deepEqual(
    interleaveInbox([item("s1"), item("s2")], [item("i1")]).map(
      (m) => `${m.kind}:${m.item.id}`
    ),
    ["scene:s1", "image:i1", "scene:s2"]
  );
  assert.deepEqual(interleaveInbox([], []), []);
});

test("dedupeInbox keeps the first occurrence", () => {
  assert.deepEqual(
    dedupeInbox([item("a"), item("b"), item("a")]).map((i) => i.id),
    ["a", "b"]
  );
});

test("applyInboxRange drops the range when the filter identity changes", () => {
  const previous: IInboxRange<{ id: string }> = {
    key: "SCENES|1",
    items: [item("a"), item("b")],
    count: 2,
  };
  // A stale response arriving after the filter changed must not replace it.
  const next = applyInboxRange(previous, "IMAGES|2", {
    items: [item("x")],
    count: 1,
  });
  assert.deepEqual(next, { key: "IMAGES|2", items: [], count: 0 });
});

test("applyInboxRange keeps the range while a page fetch fails", () => {
  const previous: IInboxRange<{ id: string }> = {
    key: "IMAGES|1",
    items: [item("a"), item("b")],
    count: 5,
  };
  const failed = applyInboxRange(previous, "IMAGES|1", undefined);
  assert.equal(failed, previous);
  assert.deepEqual(
    failed.items.map((i) => i.id),
    ["a", "b"]
  );
});

test("applyInboxRange replaces and dedupes a successful page", () => {
  const previous: IInboxRange<{ id: string }> = {
    key: "IMAGES|1",
    items: [item("a")],
    count: 1,
  };
  const next = applyInboxRange(previous, "IMAGES|1", {
    items: [item("a"), item("a"), item("b")],
    count: 3,
  });
  assert.deepEqual(
    next.items.map((i) => i.id),
    ["a", "b"]
  );
  assert.equal(next.count, 3);
});

test("resolveInboxRandomSeed keeps a fixed seed for the session", () => {
  assert.equal(resolveInboxRandomSeed("date", -1, 42), -1);
  assert.equal(resolveInboxRandomSeed("random", -1, 42), 42);
  assert.equal(resolveInboxRandomSeed("random", 7, 42), 7);
});

test("inboxIdsChanged detects membership and ordering changes", () => {
  assert.equal(inboxIdsChanged(["a", "b"], ["a", "b"]), false);
  assert.equal(inboxIdsChanged(["a", "b"], ["b", "a"]), true);
  assert.equal(inboxIdsChanged(["a", "b"], ["a"]), true);
  assert.equal(inboxIdsChanged(["a"], ["a", "b"]), true);
});

test("shouldDeliverInboxLightbox rejects a result for a superseded request", () => {
  // Request 3 is the newest; the hook still holds request 2's variables.
  assert.equal(
    shouldDeliverInboxLightbox({
      deliveredPage: 2,
      requestPage: 3,
      requestedPage: 2,
      sameDataObject: false,
      deliveredIds: ["a"],
      incomingIds: ["b"],
    }),
    false
  );
});

test("shouldDeliverInboxLightbox ignores a repeated identical page result", () => {
  assert.equal(
    shouldDeliverInboxLightbox({
      deliveredPage: 1,
      requestPage: 1,
      requestedPage: 1,
      sameDataObject: true,
      deliveredIds: ["a", "b"],
      incomingIds: ["a", "b"],
    }),
    false
  );
});

test("shouldDeliverInboxLightbox drops an outgoing page replayed after a switch", () => {
  // Rapid reopen/switch: page 2 requested, but page 1's batch is still held.
  assert.equal(
    shouldDeliverInboxLightbox({
      deliveredPage: 1,
      requestPage: 2,
      requestedPage: 2,
      sameDataObject: true,
      deliveredIds: ["a", "b"],
      incomingIds: ["a", "b"],
    }),
    false
  );
});

test("shouldDeliverInboxLightbox accepts the first delivery of a new session", () => {
  assert.equal(
    shouldDeliverInboxLightbox({
      deliveredPage: 0,
      requestPage: 2,
      requestedPage: 2,
      sameDataObject: false,
      deliveredIds: [],
      incomingIds: ["c", "d"],
    }),
    true
  );
});

test("shouldDeliverInboxLightbox accepts a genuine page switch", () => {
  assert.equal(
    shouldDeliverInboxLightbox({
      deliveredPage: 1,
      requestPage: 2,
      requestedPage: 2,
      sameDataObject: false,
      deliveredIds: ["a", "b"],
      incomingIds: ["c", "d"],
    }),
    true
  );
});

test("shouldDeliverInboxLightbox accepts fresh data for the delivered page", () => {
  assert.equal(
    shouldDeliverInboxLightbox({
      deliveredPage: 1,
      requestPage: 1,
      requestedPage: 1,
      sameDataObject: false,
      deliveredIds: ["a"],
      incomingIds: ["a"],
    }),
    true
  );
});

test("shouldCloseInboxLightboxForChange closes on membership and order changes", () => {
  assert.equal(
    shouldCloseInboxLightboxForChange(1, 1, ["a", "b"], ["a"]),
    true
  );
  assert.equal(
    shouldCloseInboxLightboxForChange(1, 1, ["a", "b"], ["b", "a"]),
    true
  );
  assert.equal(
    shouldCloseInboxLightboxForChange(1, 1, ["a", "b"], ["a", "b"]),
    false
  );
  // A page switch legitimately changes the batch; it must not close.
  assert.equal(
    shouldCloseInboxLightboxForChange(1, 2, ["a", "b"], ["c", "d"]),
    false
  );
});

test("lightbox page maths wrap and slice", () => {
  assert.equal(inboxTotalPages(47, 24), 2);
  assert.equal(inboxTotalPages(0, 24), 0);
  assert.equal(wrapInboxPage(3, 2), 1);
  assert.equal(wrapInboxPage(0, 2), 2);
  assert.equal(wrapInboxPage(-1, 2), 1);
  assert.deepEqual(computeInboxLightboxPage(25, 24), {
    page: 2,
    initialIndex: 1,
  });
  assert.deepEqual(computeInboxLightboxPage(0, 24), {
    page: 1,
    initialIndex: 0,
  });
  const items = Array.from({ length: 30 }, (_, i) => i);
  assert.deepEqual(sliceInboxPage(items, 2, 24), [24, 25, 26, 27, 28, 29]);
});

test("lightbox page offset yields the clicked global position", () => {
  assert.equal(inboxPageOffset(1, 24), 0);
  assert.equal(inboxPageOffset(2, 24), 24);
  assert.equal(inboxPageOffset(0, 24), 0);
  // Opening at global index 25 -> page 2, batch index 1, position 26.
  const { page, initialIndex } = computeInboxLightboxPage(25, 24);
  assert.equal(inboxPageOffset(page, 24) + initialIndex + 1, 26);
});

test("inboxColumns keeps two columns on phones and scales on desktop", () => {
  assert.equal(inboxColumns(0), 1);
  assert.equal(inboxColumns(390), 2);
  assert.equal(inboxColumns(576), 2);
  assert.equal(inboxColumns(1200), 4);
  assert.ok(inboxColumns(900) >= 2);
});

test("inboxPositiveDimensions falls back on non-finite or non-positive sizes", () => {
  const fallback = { width: 1280, height: 720 };
  assert.deepEqual(inboxPositiveDimensions(640, 480, fallback), {
    width: 640,
    height: 480,
  });
  assert.deepEqual(inboxPositiveDimensions(0, 480, fallback), fallback);
  assert.deepEqual(inboxPositiveDimensions(640, 0, fallback), fallback);
  assert.deepEqual(inboxPositiveDimensions(undefined, undefined, fallback), {
    width: 1280,
    height: 720,
  });
  assert.deepEqual(inboxPositiveDimensions(null, 480, fallback), fallback);
  assert.deepEqual(inboxPositiveDimensions(NaN, 480, fallback), fallback);
  assert.deepEqual(inboxPositiveDimensions(640, NaN, fallback), fallback);
  assert.deepEqual(inboxPositiveDimensions(Infinity, 480, fallback), fallback);
  assert.deepEqual(inboxPositiveDimensions(640, -Infinity, fallback), fallback);
  assert.deepEqual(inboxPositiveDimensions(-640, 480, fallback), fallback);
});

if (failures > 0) {
  // eslint-disable-next-line no-console
  console.error(`${failures} inbox tests failed`);
  process.exit(1);
}
