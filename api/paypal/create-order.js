import { randomUUID } from 'node:crypto'
import { normalizeShippingAddress } from '../../lib/checkout.js'
import { getItemTotalCents, getOrderItems, getOrderShippingCents } from '../../lib/order.js'
import {
  getPayPalAccessToken,
  getPayPalConfig,
  getRequestBody,
  methodNotAllowed,
  payPalRequest,
  sendJson,
} from '../../lib/paypal.js'
import { calculateTaxCents } from '../../lib/tax.js'

const formatAmount = (cents) => (cents / 100).toFixed(2)

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)

  try {
    const body = getRequestBody(req)
    const items = getOrderItems(body?.items)
    const address = normalizeShippingAddress(body?.address)
    if (!items || !address) {
      return sendJson(res, 400, { error: 'Provide valid products and a complete U.S. shipping address.' })
    }

    const config = getPayPalConfig()
    const taxCents = calculateTaxCents(items)
    const itemTotalCents = getItemTotalCents(items)
    const shippingCents = getOrderShippingCents(items)
    const totalCents = itemTotalCents + shippingCents + taxCents
    const token = await getPayPalAccessToken(config)
    const order = await payPalRequest(config, token, '/v2/checkout/orders', {
      method: 'POST',
      headers: { 'PayPal-Request-Id': `za-create-${randomUUID()}` },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          description: 'za.house order',
          amount: {
            currency_code: 'USD',
            value: formatAmount(totalCents),
            breakdown: {
              item_total: {
                currency_code: 'USD',
                value: formatAmount(itemTotalCents),
              },
              shipping: {
                currency_code: 'USD',
                value: formatAmount(shippingCents),
              },
              tax_total: {
                currency_code: 'USD',
                value: formatAmount(taxCents),
              },
            },
          },
          items,
          shipping: {
            name: { full_name: address.name },
            address: {
              address_line_1: address.addressLine1,
              ...(address.addressLine2 ? { address_line_2: address.addressLine2 } : {}),
              admin_area_2: address.city,
              admin_area_1: address.state,
              postal_code: address.postalCode,
              country_code: 'US',
            },
          },
        }],
        application_context: {
          brand_name: 'za.house',
          shipping_preference: 'SET_PROVIDED_ADDRESS',
          user_action: 'PAY_NOW',
        },
      }),
    })

    if (typeof order?.id !== 'string') {
      console.error('PayPal create-order response did not include an order ID.')
      return sendJson(res, 502, { error: 'PayPal returned an invalid order response.' })
    }

    return sendJson(res, 200, { orderID: order.id })
  } catch (error) {
    if (error.status) return sendJson(res, error.status, { error: error.message })
    console.error('PayPal order creation failed.')
    return sendJson(res, 502, { error: 'Unable to start PayPal checkout. Please try again.' })
  }
}
