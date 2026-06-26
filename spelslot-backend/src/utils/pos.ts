import { generateKeyBetween } from 'fractional-indexing'

/** A pos that sorts after `last` (or at the start if null). */
export function posAfter(last: string | null | undefined): string {
  return generateKeyBetween(last ?? null, null)
}

/** A pos that sorts between `before` and `after`. */
export function posBetween(
  before: string | null | undefined,
  after: string | null | undefined,
): string {
  return generateKeyBetween(before ?? null, after ?? null)
}
