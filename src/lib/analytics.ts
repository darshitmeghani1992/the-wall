/**
 * Private-beta analytics kill switch.
 *
 * The Enhanced Beta authorization explicitly holds ALL optional third-party
 * analytics until the Founder approves a privacy review and independent QA.
 * A bundled public analytics key, including an accidentally inherited EAS
 * environment value, must not enable collection or instantiate an SDK.
 *
 * This no-op boundary preserves existing callers without transmitting or
 * persisting user identifiers/events. Re-enabling requires a separately reviewed
 * implementation and release gate, not a runtime flag or merely adding a key.
 */

type Props = Record<string, string | number | boolean | null>;

/** Intentionally inert until privacy approval and an independently tested release. */
export function track(_event: string, _properties?: Props): void {
  // Optional analytics OFF for Enhanced Beta.
}

/** Never identify users with a third party while the privacy gate is held. */
export function identify(_distinctId: string, _properties?: Props): void {
  // Optional analytics OFF for Enhanced Beta.
}
