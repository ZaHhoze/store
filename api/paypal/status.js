import { products } from '../../src/products.js'
import { sendJson } from '../../lib/paypal.js'
import { isStripeConfigured } from '../../lib/stripe.js'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return sendJson(res, 405, { error: 'Method not allowed.' })
  }

  const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox'
  const paypalConfigured = Boolean(
    process.env.PAYPAL_CLIENT_ID
    && (process.env.PAYPAL_CLIENT_SECRET || process.env.paypal_key)
    && process.env.PAYPAL_CHECKOUT_ENABLED === 'true'
    && (environment === 'sandbox' || environment === 'live')
  )
  const availableProducts = products.some((product) => product.availableForSale)

  return sendJson(res, 200, {
    checkoutEnabled: paypalConfigured && availableProducts,
    paypalEnabled: paypalConfigured && availableProducts,
    stripeEnabled: isStripeConfigured()
      && availableProducts,
  })
}
