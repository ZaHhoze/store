import { getItemTotalCents } from './order.js'

export const FLAT_TAX_RATE_BPS = 600

export function calculateTaxCents(items) {
  return Math.round((getItemTotalCents(items) * FLAT_TAX_RATE_BPS) / 10000)
}
