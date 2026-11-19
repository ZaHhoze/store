import { products } from '../../src/products.js'
import { sendJson } from '../../lib/paypal.js'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return sendJson(res, 405, { error: 'Method not allowed.' })
  }

  const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox'
  const taxEnvironment = process.env.TAXJAR_ENVIRONMENT || 'sandbox'
  const configured = Boolean(
    process.env.PAYPAL_CLIENT_ID
    && (process.env.PAYPAL_CLIENT_SECRET || process.env.paypal_key)
    && process.env.PAYPAL_CHECKOUT_ENABLED === 'true'
    && (environment === 'sandbox' || environment === 'live')
    && process.env.TAXJAR_API_KEY
    && (taxEnvironment === 'sandbox' || taxEnvironment === 'live'),
  )

  return sendJson(res, 200, {
    checkoutEnabled: configured && products.some((product) => product.availableForSale),
  })
}
