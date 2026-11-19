import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { getItemTotalCents } from './order.js'

const TAX_QUOTE_TTL_MS = 30 * 60 * 1000
export const FLAT_TAX_RATE_BPS = 600

function hashValue(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function getQuoteFingerprint(items, address) {
  const normalizedItems = items
    .map((item) => [item.sku, Number(item.quantity)])
    .sort(([left], [right]) => left.localeCompare(right))

  return {
    items: hashValue(normalizedItems),
    address: hashValue(address),
  }
}

export function calculateTaxCents(items) {
  return Math.round((getItemTotalCents(items) * FLAT_TAX_RATE_BPS) / 10000)
}

export function createTaxQuoteToken({ items, address, taxCents, secret }) {
  const payload = {
    ...getQuoteFingerprint(items, address),
    taxRateBps: FLAT_TAX_RATE_BPS,
    taxCents,
    expiresAt: Date.now() + TAX_QUOTE_TTL_MS,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url')
  return `${encodedPayload}.${signature}`
}

export function verifyTaxQuoteToken(token, { items, address, secret }) {
  if (typeof token !== 'string' || token.length > 2048) return null
  const [encodedPayload, encodedSignature, ...extra] = token.split('.')
  if (!encodedPayload || !encodedSignature || extra.length > 0) return null

  const signature = Buffer.from(encodedSignature, 'base64url')
  const expectedSignature = createHmac('sha256', secret).update(encodedPayload).digest()
  if (signature.length !== expectedSignature.length || !timingSafeEqual(signature, expectedSignature)) return null

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
    const fingerprint = getQuoteFingerprint(items, address)
    if (
      payload.items !== fingerprint.items
      || payload.address !== fingerprint.address
      || payload.taxRateBps !== FLAT_TAX_RATE_BPS
      || !Number.isInteger(payload.taxCents)
      || payload.taxCents !== calculateTaxCents(items)
      || !Number.isFinite(payload.expiresAt)
      || payload.expiresAt <= Date.now()
    ) return null

    return payload.taxCents
  } catch {
    return null
  }
}
