// Plain-Node tests for historyModel.ts (tsc --module commonjs into a temp dir).
import { strict as assert } from "assert";
import { resolveLightboxHideAction } from "./historyModel";

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

test("default dismiss with the current marker goes back", () => {
  assert.equal(
    resolveLightboxHideAction({
      reason: "dismiss",
      discardOnClose: false,
      isCurrentMarker: true,
    }),
    "back"
  );
});

test("default dismiss without the marker closes directly", () => {
  assert.equal(
    resolveLightboxHideAction({
      reason: "dismiss",
      discardOnClose: false,
      isCurrentMarker: false,
    }),
    "clear-and-close"
  );
});

test("navigate always clears and closes", () => {
  assert.equal(
    resolveLightboxHideAction({
      reason: "navigate",
      discardOnClose: false,
      isCurrentMarker: true,
    }),
    "clear-and-close"
  );
});

test("discard entries never use history.back()", () => {
  ["dismiss", "navigate"].forEach((reason) => {
    [true, false].forEach((isCurrentMarker) => {
      assert.equal(
        resolveLightboxHideAction({
          reason: reason as "dismiss" | "navigate",
          discardOnClose: true,
          isCurrentMarker,
        }),
        "clear-and-close"
      );
    });
  });
});

if (failures > 0) {
  // eslint-disable-next-line no-console
  console.error(`${failures} lightbox history tests failed`);
  process.exit(1);
}
