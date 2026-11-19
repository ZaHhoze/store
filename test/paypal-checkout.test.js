import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import createOrderHandler from '../api/paypal/create-order.js'
import captureOrderHandler from '../api/paypal/capture-order.js'
import quoteOrderHandler from '../api/paypal/quote-order.js'
import stripeCheckoutHandler from '../api/stripe/create-checkout-session.js'
import stripeVerifyHandler from '../api/stripe/verify-session.js'
import checkoutStatusHandler from '../api/paypal/status.js'
import { normalizeShippingAddress } from '../lib/checkout.js'
import { getOrderItems } from '../lib/order.js'
import { createTaxQuoteToken } from '../lib/taxjar.js'
import { products } from '../src/products.js'

const originalFetch = globalThis.fetch
const originalEnv = { ...process.env }
const orderItems = [{ id: 'zahouse-black-textured-high-top', quantity: 1 }]
const shippingAddress = {
  name: 'ZaHouse Test Buyer',
  addressLine1: '123 Main Street',
  addressLine2: '',
  city: 'Orlando',
  state: 'FL',
  postalCode: '32810',
}

function taxQuoteToken(taxCents = 1352, address = shippingAddress) {
  return createTaxQuoteToken({
    items: getOrderItems(orderItems),
    address: normalizeShippingAddress(address),
    taxCents,
    secret: 'sandbox-client-secret',
  })
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function invoke(handler, body, request = {}) {
  const res = {
    statusCode: 200,
    headers: {},
    status(code) {
      this.statusCode = code
      return this
    },
    setHeader(name, value) {
      this.headers[name] = value
      return this
    },
    send(value) {
      this.body = value
      return this
    },
  }

  return Promise.resolve(handler({ method: request.method || 'POST', body, ...request }, res)).then(() => ({
    ...res,
    json: res.body,
  }))
}

function approvedOrder(countryCode = 'US', shippingAmount = '20.00') {
  const shoe = products.find((product) => product.id === 'zahouse-black-textured-high-top')
  return {
    id: 'TESTORDER1234',
    status: 'APPROVED',
    purchase_units: [{
      amount: {
        currency_code: 'USD',
        value: '283.52',
        breakdown: {
          item_total: { currency_code: 'USD', value: '250.00' },
          shipping: { currency_code: 'USD', value: shippingAmount },
          tax_total: { currency_code: 'USD', value: '13.52' },
        },
      },
      items: [{
        name: shoe.name,
        sku: shoe.id,
        quantity: '1',
        unit_amount: { currency_code: 'USD', value: '250.00' },
      }],
      shipping: {
        name: { full_name: shippingAddress.name },
        address: {
          address_line_1: shippingAddress.addressLine1,
          admin_area_2: shippingAddress.city,
          admin_area_1: shippingAddress.state,
          postal_code: shippingAddress.postalCode,
          country_code: countryCode,
        },
      },
    }],
  }
}

beforeEach(() => {
  process.env.PAYPAL_CHECKOUT_ENABLED = 'true'
  process.env.PAYPAL_CLIENT_ID = 'sandbox-client-id'
  process.env.PAYPAL_CLIENT_SECRET = 'sandbox-client-secret'
  process.env.PAYPAL_ENVIRONMENT = 'sandbox'
  process.env.VERCEL_ENV = 'preview'
  process.env.stripe_test = 'sk_test_checkout'
  process.env.VERCEL_URL = 'store-preview.example'
  process.env.TAXJAR_API_KEY = 'sandbox-taxjar-key'
  process.env.TAXJAR_ENVIRONMENT = 'sandbox'
})

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key]
  }
  Object.assign(process.env, originalEnv)
})

test('TaxJar quote calculates tax and signs the address-specific total', async () => {
  let taxRequest
  globalThis.fetch = async (url, options) => {
    taxRequest = { url: String(url), options }
    return response({ tax: { amount_to_collect: 13.52 } })
  }

  const result = await invoke(quoteOrderHandler, {
    items: orderItems,
    address: shippingAddress,
  })

  assert.equal(result.statusCode, 200)
  assert.equal(result.json.taxCents, 1352)
  assert.equal(result.json.shippingCents, 2000)
  assert.equal(result.json.totalCents, 28352)
  assert.equal(typeof result.json.taxQuoteToken, 'string')
  assert.equal(taxRequest.url, 'https://api.sandbox.taxjar.com/v2/taxes')
  const payload = JSON.parse(taxRequest.options.body)
  assert.equal(payload.to_state, 'FL')
  assert.equal(payload.to_zip, '32810')
  assert.equal(payload.amount, 250)
  assert.equal(payload.shipping, 20)
})

test('Stripe Checkout session uses server prices, signed tax, shipping, and provided address', async () => {
  let stripeRequest
  globalThis.fetch = async (url, options) => {
    stripeRequest = { url: String(url), options }
    return response({
      id: 'cs_test_checkout123',
      url: 'https://checkout.stripe.com/c/pay/cs_test_checkout123',
    })
  }

  const result = await invoke(stripeCheckoutHandler, {
    items: orderItems,
    address: shippingAddress,
    taxQuoteToken: taxQuoteToken(),
  })

  assert.equal(result.statusCode, 200)
  assert.equal(result.json.sessionId, 'cs_test_checkout123')
  assert.equal(result.json.totalCents, 28352)
  assert.equal(stripeRequest.url, 'https://api.stripe.com/v1/checkout/sessions')
  assert.equal(stripeRequest.options.headers.Authorization, 'Bearer sk_test_checkout')
  const payload = new URLSearchParams(stripeRequest.options.body)
  assert.equal(payload.get('line_items[0][price_data][unit_amount]'), '25000')
  assert.equal(payload.get('line_items[0][quantity]'), '1')
  assert.equal(payload.get('line_items[1][price_data][product_data][name]'), 'Estimated sales tax')
  assert.equal(payload.get('line_items[1][price_data][unit_amount]'), '1352')
  assert.equal(payload.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), '2000')
  assert.equal(payload.get('payment_intent_data[shipping][address][postal_code]'), '32810')
  assert.equal(payload.get('payment_intent_data[shipping][address][country]'), 'US')
  assert.equal(payload.get('metadata[store]'), 'zahouse')
  assert.equal(payload.get('metadata[total_cents]'), '28352')
  assert.match(payload.get('success_url'), /store-preview\.example\/\?stripe_session_id=/)
})

test('Stripe Checkout rejects an expired or mismatched tax quote without creating a session', async () => {
  let requests = 0
  globalThis.fetch = async () => {
    requests += 1
    return response({})
  }

  const result = await invoke(stripeCheckoutHandler, {
    items: orderItems,
    address: { ...shippingAddress, postalCode: '32811' },
    taxQuoteToken: taxQuoteToken(),
  })

  assert.equal(result.statusCode, 409)
  assert.match(result.json.error, /estimate expired or no longer matches/)
  assert.equal(requests, 0)
})

test('Stripe Checkout requires a test key on Preview deployments', async () => {
  let requests = 0
  process.env.stripe_test = 'sk_live_wrong_environment'
  globalThis.fetch = async () => {
    requests += 1
    return response({})
  }

  const result = await invoke(stripeCheckoutHandler, {
    items: orderItems,
    address: shippingAddress,
    taxQuoteToken: taxQuoteToken(),
  })

  assert.equal(result.statusCode, 503)
  assert.match(result.json.error, /Stripe test secret key/)
  assert.equal(requests, 0)
})

test('checkout status enables Stripe independently from PayPal configuration', async () => {
  process.env.PAYPAL_CHECKOUT_ENABLED = 'false'
  delete process.env.PAYPAL_CLIENT_ID
  delete process.env.PAYPAL_CLIENT_SECRET
  const result = await invoke(checkoutStatusHandler, undefined, { method: 'GET' })

  assert.equal(result.statusCode, 200)
  assert.equal(result.json.checkoutEnabled, false)
  assert.equal(result.json.paypalEnabled, false)
  assert.equal(result.json.stripeEnabled, true)
})

test('checkout status keeps live Stripe disabled until live TaxJar is configured', async () => {
  process.env.VERCEL_ENV = 'production'
  delete process.env.STRIPE_SECRET_KEY
  process.env.stripe_key = 'sk_live_checkout'
  process.env.TAXJAR_ENVIRONMENT = 'sandbox'
  const result = await invoke(checkoutStatusHandler, undefined, { method: 'GET' })

  assert.equal(result.json.stripeEnabled, false)
  process.env.TAXJAR_ENVIRONMENT = 'live'
  const liveResult = await invoke(checkoutStatusHandler, undefined, { method: 'GET' })
  assert.equal(liveResult.json.stripeEnabled, true)
})

test('TaxJar quotes can be signed with Stripe when PayPal is not configured', async () => {
  delete process.env.PAYPAL_CLIENT_SECRET
  delete process.env.paypal_key
  globalThis.fetch = async () => response({ tax: { amount_to_collect: 13.52 } })

  const result = await invoke(quoteOrderHandler, {
    items: orderItems,
    address: shippingAddress,
  })

  assert.equal(result.statusCode, 200)
  assert.equal(typeof result.json.taxQuoteToken, 'string')
  assert.equal(result.json.taxCents, 1352)
})

test('Stripe return verification confirms only a paid ZaHouse session', async () => {
  let requestedUrl
  globalThis.fetch = async (url) => {
    requestedUrl = String(url)
    return response({
      id: 'cs_test_paid123',
      mode: 'payment',
      currency: 'usd',
      payment_status: 'paid',
      amount_total: 28352,
      metadata: { store: 'zahouse', total_cents: '28352' },
    })
  }

  const result = await invoke(stripeVerifyHandler, undefined, {
    method: 'GET',
    url: '/api/stripe/verify-session?session_id=cs_test_paid123',
  })

  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.json, {
    status: 'paid',
    sessionId: 'cs_test_paid123',
    amountCents: 28352,
  })
  assert.equal(requestedUrl, 'https://api.stripe.com/v1/checkout/sessions/cs_test_paid123')
})

test('Stripe return verification rejects an unpaid session', async () => {
  globalThis.fetch = async () => response({
    id: 'cs_test_unpaid123',
    mode: 'payment',
    currency: 'usd',
    payment_status: 'unpaid',
    amount_total: 28352,
    metadata: { store: 'zahouse', total_cents: '28352' },
  })

  const result = await invoke(stripeVerifyHandler, undefined, {
    method: 'GET',
    url: '/api/stripe/verify-session?session_id=cs_test_unpaid123',
  })

  assert.equal(result.statusCode, 409)
  assert.match(result.json.error, /not confirmed/)
})

test('Stripe return verification rejects a paid session with a mismatched total', async () => {
  globalThis.fetch = async () => response({
    id: 'cs_test_wrongtotal123',
    mode: 'payment',
    currency: 'usd',
    payment_status: 'paid',
    amount_total: 28000,
    metadata: { store: 'zahouse', total_cents: '28352' },
  })

  const result = await invoke(stripeVerifyHandler, undefined, {
    method: 'GET',
    url: '/api/stripe/verify-session?session_id=cs_test_wrongtotal123',
  })

  assert.equal(result.statusCode, 409)
  assert.match(result.json.error, /not confirmed/)
})

test('create order includes the signed TaxJar estimate and $20 U.S. shipping', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    if (String(url).endsWith('/v1/oauth2/token')) return response({ access_token: 'sandbox-token' })
    return response({ id: 'TESTORDER1234' })
  }

  const result = await invoke(createOrderHandler, {
    items: orderItems,
    address: shippingAddress,
    taxQuoteToken: taxQuoteToken(),
  })

  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.json, { orderID: 'TESTORDER1234' })
  const payload = JSON.parse(calls[1].options.body)
  assert.equal(payload.purchase_units[0].amount.value, '283.52')
  assert.equal(payload.purchase_units[0].amount.breakdown.item_total.value, '250.00')
  assert.equal(payload.purchase_units[0].amount.breakdown.shipping.value, '20.00')
  assert.equal(payload.purchase_units[0].amount.breakdown.tax_total.value, '13.52')
  assert.equal(payload.purchase_units[0].shipping.address.country_code, 'US')
  assert.equal(payload.application_context.shipping_preference, 'SET_PROVIDED_ADDRESS')
})

test('create order rejects a tax quote that does not match the shipping address', async () => {
  let requests = 0
  globalThis.fetch = async () => {
    requests += 1
    return response({ access_token: 'sandbox-token' })
  }

  const result = await invoke(createOrderHandler, {
    items: orderItems,
    address: { ...shippingAddress, postalCode: '32811' },
    taxQuoteToken: taxQuoteToken(),
  })

  assert.equal(result.statusCode, 409)
  assert.match(result.json.error, /estimate expired or no longer matches/)
  assert.equal(requests, 0)
})

test('capture rejects non-U.S. shipping addresses without sending a capture request', async () => {
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    if (String(url).endsWith('/v1/oauth2/token')) return response({ access_token: 'sandbox-token' })
    return response(approvedOrder('CA'))
  }

  const result = await invoke(captureOrderHandler, { orderID: 'TESTORDER1234' })

  assert.equal(result.statusCode, 409)
  assert.match(result.json.error, /U\.S\. addresses only/)
  assert.equal(calls.some((url) => url.endsWith('/capture')), false)
})

test('capture confirms the complete catalog and shipping amount', async () => {
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    if (String(url).endsWith('/v1/oauth2/token')) return response({ access_token: 'sandbox-token' })
    if (String(url).endsWith('/capture')) {
      return response({
        status: 'COMPLETED',
        purchase_units: [{
          payments: {
            captures: [{
              id: 'TESTCAPTURE123',
              status: 'COMPLETED',
              amount: { currency_code: 'USD', value: '283.52' },
            }],
          },
        }],
      })
    }
    return response(approvedOrder())
  }

  const result = await invoke(captureOrderHandler, { orderID: 'TESTORDER1234' })

  assert.equal(result.statusCode, 200)
  assert.equal(result.json.status, 'COMPLETED')
  assert.equal(result.json.amount, '283.52')
  assert.equal(result.json.captureID, 'TESTCAPTURE123')
  assert.equal(calls.some((url) => url.endsWith('/capture')), true)
})

test('capture rejects a PayPal order with a modified shipping fee', async () => {
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/v1/oauth2/token')) return response({ access_token: 'sandbox-token' })
    return response(approvedOrder('US', '1.00'))
  }

  const result = await invoke(captureOrderHandler, { orderID: 'TESTORDER1234' })

  assert.equal(result.statusCode, 409)
  assert.match(result.json.error, /does not match/)
})
