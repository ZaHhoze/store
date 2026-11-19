import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { getItemTotalCents } from './order.js'
import { US_FLAT_SHIPPING_CENTS } from './checkout.js'

const TAX_QUOTE_TTL_MS = 30 * 60 * 1000
const TAXJAR_REQUEST_TIMEOUT_MS = 8000
const formatAmount = (cents) => (cents / 100).toFixed(2)

function getTaxJarConfig() {
  const apiKey = process.env.TAXJAR_API_KEY
  const environment = process.env.TAXJAR_ENVIRONMENT || 'sandbox'

  if (!apiKey) {
    const error = new Error('TaxJar server credentials are not configured.')
    error.status = 503
    throw error
  }

  if (environment !== 'sandbox' && environment !== 'live') {
    const error = new Error('TAXJAR_ENVIRONMENT must be "sandbox" or "live".')
    error.status = 500
    throw error
  }

  return {
    apiKey,
    apiBase: environment === 'live'
      ? 'https://api.taxjar.com'
      : 'https://api.sandbox.taxjar.com',
  }
}

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

export async function calculateTaxCents(items, address) {
  const config = getTaxJarConfig()
  const itemTotalCents = getItemTotalCents(items)
  const street = [address.addressLine1, address.addressLine2].filter(Boolean).join(', ')
  let response
  try {
    response = await fetch(`${config.apiBase}/v2/taxes`, {
      method: 'POST',
      headers: {
        Authorization: `Token token="${config.apiKey}"`,
        'Content-Type': 'application/json',
        'x-api-version': '2022-01-24',
      },
      body: JSON.stringify({
        to_country: 'US',
        to_zip: address.postalCode,
        to_state: address.state,
        to_city: address.city,
        to_street: street,
        amount: itemTotalCents / 100,
        shipping: US_FLAT_SHIPPING_CENTS / 100,
        line_items: items.map((item) => ({
          id: item.sku,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_amount.value),
        })),
      }),
      signal: AbortSignal.timeout(TAXJAR_REQUEST_TIMEOUT_MS),
    })
  } catch (cause) {
    const timedOut = cause?.name === 'TimeoutError' || cause?.name === 'AbortError'
    const error = new Error(
      timedOut
        ? 'Tax calculation timed out. Please try again.'
        : 'Tax service could not be reached. Please try again.',
      { cause },
    )
    error.status = timedOut ? 504 : 502
    throw error
  }

  const result = await response.json().catch(() => null)
  if (!response.ok) {
    const taxjarError = typeof result?.error === 'string' ? result.error : 'unknown_error'
    console.error('TaxJar calculation failed', { status: response.status, error: taxjarError })
    const error = new Error(response.status === 401
      ? 'TaxJar rejected the API key. Verify it is valid for the configured TaxJar environment.'
      : 'Tax could not be calculated for this address.')
    error.status = 502
    throw error
  }

  const amountToCollect = result?.tax?.amount_to_collect
  if (typeof amountToCollect !== 'number' || !Number.isFinite(amountToCollect) || amountToCollect < 0) {
    console.error('TaxJar returned an invalid tax calculation.')
    const error = new Error('TaxJar returned an invalid tax calculation.')
    error.status = 502
    throw error
  }

  return Math.round(amountToCollect * 100)
}

export function createTaxQuoteToken({ items, address, taxCents, secret }) {
  const payload = {
    ...getQuoteFingerprint(items, address),
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
      || !Number.isInteger(payload.taxCents)
      || payload.taxCents < 0
      || !Number.isFinite(payload.expiresAt)
      || payload.expiresAt <= Date.now()
    ) return null

    return payload.taxCents
  } catch {
    return null
  }
}
