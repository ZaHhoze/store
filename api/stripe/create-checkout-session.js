import { normalizeShippingAddress } from '../../lib/checkout.js'
import { getItemTotalCents, getOrderItems, getOrderShippingCents } from '../../lib/order.js'
import {
  getCheckoutQuoteSecret,
  getStripeConfig,
  getStripeSiteUrl,
  stripeRequest,
} from '../../lib/stripe.js'
import {
  getRequestBody,
  methodNotAllowed,
  sendJson,
} from '../../lib/paypal.js'
import { verifyTaxQuoteToken } from '../../lib/tax.js'

function addLineItem(params, index, item) {
  params.set(`line_items[${index}][price_data][currency]`, 'usd')
  params.set(`line_items[${index}][price_data][product_data][name]`, item.name)
  params.set(`line_items[${index}][price_data][product_data][metadata][sku]`, item.sku)
  params.set(`line_items[${index}][price_data][unit_amount]`, String(Math.round(Number(item.unit_amount.value) * 100)))
  params.set(`line_items[${index}][quantity]`, item.quantity)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)

  try {
    const body = getRequestBody(req)
    const items = getOrderItems(body?.items)
    const address = normalizeShippingAddress(body?.address)
    if (!items || !address) {
      return sendJson(res, 400, { error: 'Provide valid products and a complete U.S. shipping address.' })
    }

    const taxCents = verifyTaxQuoteToken(body?.taxQuoteToken, {
      items,
      address,
      secret: getCheckoutQuoteSecret(),
    })
    if (taxCents === null) {
      return sendJson(res, 409, { error: 'The tax quote expired or no longer matches the order. Recalculate tax and try again.' })
    }

    const config = getStripeConfig()
    const itemTotalCents = getItemTotalCents(items)
    const shippingCents = getOrderShippingCents(items)
    const totalCents = itemTotalCents + shippingCents + taxCents
    const params = new URLSearchParams()
    params.set('mode', 'payment')
    params.set('customer_creation', 'always')
    params.set('success_url', `${getStripeSiteUrl()}/?stripe_session_id={CHECKOUT_SESSION_ID}`)
    params.set('cancel_url', `${getStripeSiteUrl()}/?stripe_checkout=cancelled`)
    params.set('metadata[store]', 'zahouse')
    params.set('metadata[tax_cents]', String(taxCents))
    params.set('metadata[total_cents]', String(totalCents))
    params.set('payment_intent_data[shipping][name]', address.name)
    params.set('payment_intent_data[shipping][address][line1]', address.addressLine1)
    if (address.addressLine2) {
      params.set('payment_intent_data[shipping][address][line2]', address.addressLine2)
    }
    params.set('payment_intent_data[shipping][address][city]', address.city)
    params.set('payment_intent_data[shipping][address][state]', address.state)
    params.set('payment_intent_data[shipping][address][postal_code]', address.postalCode)
    params.set('payment_intent_data[shipping][address][country]', 'US')

    items.forEach((item, index) => addLineItem(params, index, item))
    const taxIndex = items.length
    if (taxCents > 0) {
      addLineItem(params, taxIndex, {
        name: 'Sales tax (6%)',
        sku: 'tax',
        quantity: '1',
        unit_amount: { value: (taxCents / 100).toFixed(2) },
      })
    }

    if (shippingCents > 0) {
      params.set('shipping_options[0][shipping_rate_data][type]', 'fixed_amount')
      params.set('shipping_options[0][shipping_rate_data][display_name]', 'U.S. shipping')
      params.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(shippingCents))
      params.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'usd')
    }

    const session = await stripeRequest(config, '/checkout/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    })

    if (typeof session?.id !== 'string' || typeof session?.url !== 'string') {
      console.error('Stripe Checkout response did not include a session ID and URL.')
      return sendJson(res, 502, { error: 'Stripe returned an invalid checkout response.' })
    }

    return sendJson(res, 200, {
      sessionId: session.id,
      url: session.url,
      totalCents,
    })
  } catch (error) {
    if (error.status) return sendJson(res, error.status, { error: error.message })
    console.error('Stripe Checkout session creation failed.')
    return sendJson(res, 502, { error: 'Unable to start card checkout. Please try again.' })
  }
}
