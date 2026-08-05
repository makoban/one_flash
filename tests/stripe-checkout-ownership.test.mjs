import test from "node:test";
import assert from "node:assert/strict";

import {
  ONEPAGE_FLASH_CHECKOUT_APP,
  isOnePageFlashCheckoutMetadata,
} from "../src/lib/stripe-checkout-ownership.mjs";

test("ignores metadata-free Payment Link sessions", () => {
  assert.equal(isOnePageFlashCheckoutMetadata(undefined), false);
  assert.equal(isOnePageFlashCheckoutMetadata(null), false);
  assert.equal(isOnePageFlashCheckoutMetadata({}), false);
});

test("ignores sessions explicitly owned by another service", () => {
  assert.equal(isOnePageFlashCheckoutMetadata({ app: "yuukichiya" }), false);
  assert.equal(
    isOnePageFlashCheckoutMetadata({ app: "yuukichiya", draftId: "shared-name" }),
    false
  );
});

test("accepts sessions carrying the OnePage-Flash ownership marker", () => {
  assert.equal(
    isOnePageFlashCheckoutMetadata({ app: ONEPAGE_FLASH_CHECKOUT_APP }),
    true
  );
});

test("keeps legacy OnePage-Flash sessions backward compatible", () => {
  assert.equal(isOnePageFlashCheckoutMetadata({ draftId: "draft-old" }), true);
  assert.equal(isOnePageFlashCheckoutMetadata({ subdomain: "site-old" }), true);
  assert.equal(
    isOnePageFlashCheckoutMetadata({ draftId: "draft-old", subdomain: "site-old" }),
    true
  );
});
