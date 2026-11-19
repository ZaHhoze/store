import { getRequestBody, methodNotAllowed, sendJson } from '../../lib/paypal.js'
import { US_FLAT_SHIPPING_CENTS, normalizeShippingAddress } from '../../lib/checkout.js'
import { getItemTotalCents, getOrderItems } from '../../lib/order.js'
import { getCheckoutQuoteSecret } from '../../lib/stripe.js'
import { calculateTaxCents, createTaxQuoteToken } from '../../lib/taxjar.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)

  try {
    const body = getRequestBody(req)
    const items = getOrderItems(body?.items)
    const address = normalizeShippingAddress(body?.address)
    if (!items || !address) {
      return sendJson(res, 400, { error: 'Provide valid products and a complete U.S. shipping address.' })
    }

    const quoteSecret = getCheckoutQuoteSecret()
    const taxCents = await calculateTaxCents(items, address)
    const itemTotalCents = getItemTotalCents(items)

    return sendJson(res, 200, {
      taxCents,
      shippingCents: US_FLAT_SHIPPING_CENTS,
      totalCents: itemTotalCents + US_FLAT_SHIPPING_CENTS + taxCents,
      taxQuoteToken: createTaxQuoteToken({
        items,
        address,
        taxCents,
        secret: quoteSecret,
      }),
    })
  } catch (error) {
    if (error.status) return sendJson(res, error.status, { error: error.message })
    console.error('Tax quote creation failed.')
    return sendJson(res, 502, { error: 'Unable to calculate tax. Please check the address and try again.' })
  }
}
