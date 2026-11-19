import { US_FLAT_SHIPPING_CENTS, normalizeShippingAddress } from '../../lib/checkout.js'
import { getProductVariantBySku } from '../../lib/order.js'
import {
  getPayPalAccessToken,
  getPayPalConfig,
  getRequestBody,
  methodNotAllowed,
  payPalRequest,
  sendJson,
} from '../../lib/paypal.js'
import { FLAT_TAX_RATE_BPS } from '../../lib/tax.js'

const formatAmount = (cents) => (cents / 100).toFixed(2)
const parseAmount = (amount) => {
  const [whole, fraction] = amount.split('.')
  return Number(whole) * 100 + Number(fraction)
}

function getVerifiedTotal(order) {
  const purchaseUnits = order?.purchase_units
  if (!Array.isArray(purchaseUnits) || purchaseUnits.length !== 1) return null

  const unit = purchaseUnits[0]
  if (unit.amount?.currency_code !== 'USD' || !Array.isArray(unit.items) || unit.items.length === 0) return null

  let totalCents = 0
  const seen = new Set()
  for (const item of unit.items) {
    const variant = getProductVariantBySku(item.sku)
    const product = variant?.product
    const quantity = Number(item.quantity)

    if (
      !product
      || !product.availableForSale
      || seen.has(item.sku)
      || item.name !== variant.name
      || !Number.isInteger(quantity)
      || quantity < 1
      || quantity > 99
      || item.unit_amount?.currency_code !== 'USD'
      || item.unit_amount.value !== formatAmount(product.priceInCents)
    ) return null

    seen.add(item.sku)
    totalCents += product.priceInCents * quantity
  }

  const breakdown = unit.amount.breakdown
  const taxValue = breakdown?.tax_total?.value
  if (
    breakdown?.item_total?.currency_code !== 'USD'
    || breakdown.item_total.value !== formatAmount(totalCents)
    || breakdown.shipping?.currency_code !== 'USD'
    || breakdown.shipping.value !== formatAmount(US_FLAT_SHIPPING_CENTS)
    || breakdown.tax_total?.currency_code !== 'USD'
    || typeof taxValue !== 'string'
    || !/^\d+\.\d{2}$/.test(taxValue)
    || parseAmount(taxValue) !== Math.round((totalCents * FLAT_TAX_RATE_BPS) / 10000)
    || unit.amount.value !== formatAmount(totalCents + US_FLAT_SHIPPING_CENTS + parseAmount(taxValue))
  ) return null

  const shipping = unit.shipping
  const shippingCountry = shipping?.address?.country_code
  if (shippingCountry !== 'US') return null

  const shippingAddress = normalizeShippingAddress({
    name: shipping.name?.full_name,
    addressLine1: shipping.address?.address_line_1,
    addressLine2: shipping.address?.address_line_2 || '',
    city: shipping.address?.admin_area_2,
    state: shipping.address?.admin_area_1,
    postalCode: shipping.address?.postal_code,
  })
  if (!shippingAddress) return null

  return {
    totalCents: totalCents + US_FLAT_SHIPPING_CENTS + parseAmount(taxValue),
    taxCents: parseAmount(taxValue),
    purchaseUnit: unit,
    shippingCountry,
    shippingAddress,
  }
}

function getCompletedCapture(order) {
  const captures = order?.purchase_units?.[0]?.payments?.captures || []
  return captures.find((capture) => capture.status === 'COMPLETED')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)

  const orderID = getRequestBody(req)?.orderID
  if (typeof orderID !== 'string' || !/^[A-Z0-9]{8,40}$/.test(orderID)) {
    return sendJson(res, 400, { error: 'Provide a valid PayPal order ID.' })
  }

  try {
    const config = getPayPalConfig()
    const token = await getPayPalAccessToken(config)
    const order = await payPalRequest(config, token, `/v2/checkout/orders/${encodeURIComponent(orderID)}`)
    if (order?.purchase_units?.[0]?.shipping?.address?.country_code !== 'US') {
      return sendJson(res, 409, { error: 'Shipping is currently available to U.S. addresses only.' })
    }

    const verified = getVerifiedTotal(order)

    if (!verified) {
      return sendJson(res, 409, { error: 'The PayPal order does not match the current product catalog, shipping, tax, or address.' })
    }

    const existingCapture = getCompletedCapture(order)

    if (order.status === 'COMPLETED' && existingCapture) {
      const capturedAmount = existingCapture.amount
      if (
        typeof existingCapture.id !== 'string'
        || capturedAmount?.currency_code !== 'USD'
        || typeof capturedAmount.value !== 'string'
        || !/^\d+\.\d{2}$/.test(capturedAmount.value)
        || capturedAmount.value !== formatAmount(verified.totalCents)
      ) {
        return sendJson(res, 502, { error: 'PayPal returned an invalid capture response.' })
      }

      return sendJson(res, 200, {
        orderID,
        captureID: existingCapture.id,
        status: 'COMPLETED',
        amount: capturedAmount.value,
        currency: capturedAmount.currency_code,
      })
    }

    if (order.status !== 'APPROVED') {
      return sendJson(res, 409, { error: 'This PayPal order has not been approved for payment.' })
    }

    const captureOrder = await payPalRequest(config, token, `/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`, {
      method: 'POST',
      headers: { 'PayPal-Request-Id': `${orderID}-capture` },
      body: '{}',
    })
    const capture = getCompletedCapture(captureOrder)
    const capturedAmount = capture?.amount

    if (
      captureOrder?.status !== 'COMPLETED'
      || typeof capture?.id !== 'string'
      || capturedAmount?.currency_code !== 'USD'
      || capturedAmount.value !== formatAmount(verified.totalCents)
    ) {
      return sendJson(res, 502, { error: 'PayPal did not confirm the payment. Please contact support before retrying.' })
    }

    return sendJson(res, 200, {
      orderID,
      captureID: capture.id,
      status: 'COMPLETED',
      amount: formatAmount(verified.totalCents),
      currency: 'USD',
    })
  } catch (error) {
    if (error.status) return sendJson(res, error.status, { error: error.message })
    console.error('PayPal order capture failed.')
    return sendJson(res, 502, { error: 'Unable to confirm this PayPal payment. Please contact support.' })
  }
}
