/** Stripe Checkout metadata value used to identify OnePage-Flash payments. */
export const ONEPAGE_FLASH_CHECKOUT_APP = "onepage-flash";

/**
 * Return true only for Checkout Sessions owned by OnePage-Flash.
 *
 * New sessions carry an explicit app marker. Sessions created before the
 * marker was introduced remain supported when they contain either of the two
 * legacy publication keys. If another app has its own explicit marker, it
 * always wins over the legacy fallback.
 */
export function isOnePageFlashCheckoutMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return false;

  if (typeof metadata.app === "string" && metadata.app.length > 0) {
    return metadata.app === ONEPAGE_FLASH_CHECKOUT_APP;
  }

  return Boolean(metadata.draftId || metadata.subdomain);
}
