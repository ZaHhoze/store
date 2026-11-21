import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import createOrderHandler from '../api/paypal/create-order.js'
import captureOrderHandler from '../api/paypal/capture-order.js'
import stripeCheckoutHandler from '../api/stripe/create-checkout-session.js'
import stripeVerifyHandler from '../api/stripe/verify-session.js'
import checkoutStatusHandler from '../api/paypal/status.js'
import { getOrderItems, getOrderShippingCents } from '../lib/order.js'
import { calculateTaxCents } from '../lib/tax.js'
import { products } from '../src/products.js'

const originalFetch = globalThis.fetch
const originalEnv = { ...process.env }
const orderItems = [{ id: 'zahouse-black-textured-high-top', size: '8', quantity: 1 }]
const sunglassesKitItems = [{ id: 'sunglasses-kit-48-piece-24-styles', quantity: 1 }]
const shippingAddress = {
  name: 'ZaHouse Test Buyer',
  addressLine1: '123 Main Street',
  addressLine2: '',
  city: 'Orlando',
  state: 'FL',
  postalCode: '32810',
}

test('shoe checkout requires an available size and prices each size as a separate variant', () => {
  const shoe = products.find((product) => product.id === 'zahouse-black-textured-high-top')
  const validItems = getOrderItems([{ id: shoe.id, size: '15', quantity: 1 }])

  assert.deepEqual(shoe.sizes, ['8', '9', '10', '11', '12', '13', '14', '15'])
  assert.equal(validItems[0].name, `${shoe.name} - Size 15`)
  assert.equal(validItems[0].sku, `${shoe.id}-size-15`)
  assert.equal(getOrderItems([{ id: shoe.id, size: '7', quantity: 1 }]), null)
  assert.equal(getOrderItems([{ id: shoe.id, quantity: 1 }]), null)
  assert.equal(getOrderItems([{ id: shoe.id, size: '8', quantity: 1 }, { id: shoe.id, size: '8', quantity: 1 }]), null)
})

test('ZaHouse black leather high-top is priced at $450', () => {
  const shoe = products.find((product) => product.id === 'zahouse-black-textured-high-top')
  const orderItem = getOrderItems([{ id: shoe.id, size: '8', quantity: 1 }])[0]

  assert.equal(shoe.priceInCents, 45000)
  assert.equal(orderItem.unit_amount.value, '450.00')
})

test('Vintage Wood Collection Model 5 sunglasses include the supplied details and cost $750', () => {
  const frames = products.find((product) => product.id === 'vwc-18kt-gold-white-buffalo-square')
  const orderItem = getOrderItems([{ id: frames.id, quantity: 1 }])[0]

  assert.equal(frames.priceInCents, 75000)
  assert.equal(orderItem.sku, frames.id)
  assert.equal(orderItem.unit_amount.value, '750.00')
  assert.match(frames.details.join(' '), /60-17-141mm/)
  assert.match(frames.details.join(' '), /double anti-reflective coating/)
  assert.equal(frames.gallery.length, 2)
})

test('DRONE 5 brown cherry wood sunglasses include Model 5 Color 1 specifications', () => {
  const frames = products.find((product) => product.id === 'vwc-drone-5-brown-wood')

  assert.equal(frames.priceInCents, 75000)
  assert.match(frames.description, /brown cherry wood temples/)
  assert.match(frames.details.join(' '), /Model #5, Color #1/)
  assert.match(frames.details.join(' '), /60-17-141mm/)
  assert.match(frames.details.join(' '), /hard folding case, cleaning cloth, and gift box/)
})

test('DRONE 6 silver and blue wood sunglasses include Model 6 Color 7 specifications', () => {
  const frames = products.find((product) => product.id === 'vwc-drone-6-blue-wood')

  assert.equal(frames.priceInCents, 75000)
  assert.match(frames.details.join(' '), /Frame: Silver with blue genuine wood temples/)
  assert.match(frames.details.join(' '), /55-17-141mm/)
  assert.match(frames.details.join(' '), /Model #6, Color #7/)
  assert.match(frames.details.join(' '), /hard folding case, cleaning cloth, and gift box/)
})

test('VWC Collector blue wood drill-mount sunglasses are listed at $750 with custom lens details', () => {
  const frames = products.find((product) => product.id === 'vwc-collector-24kt-blue-wood')
  const orderItem = getOrderItems([{ id: frames.id, quantity: 1 }])[0]
  const details = frames.details.join(' ')

  assert.equal(frames.priceInCents, 75000)
  assert.equal(orderItem.unit_amount.value, '750.00')
  assert.match(details, /24KT gold-plated hardware/)
  assert.match(details, /61-15-145mm/)
  assert.match(details, /single-vision or progressive prescription/)
})

test('Pinnacle 24KT white buffalo horn sunglasses are listed at $750 with custom lens details', () => {
  const frames = products.find((product) => product.id === 'vwc-pinnacle-24kt-white-buffalo')
  const details = frames.details.join(' ')
  const orderItem = getOrderItems([{ id: frames.id, quantity: 1 }])[0]

  assert.equal(frames.priceInCents, 75000)
  assert.equal(orderItem.unit_amount.value, '750.00')
  assert.match(details, /61-17-138mm/)
  assert.match(details, /double anti-reflective coating/)
  assert.match(details, /No two pairs hit the same/)
})

test('48-piece sunglasses kit is listed at $1', () => {
  const kit = products.find((product) => product.id === 'sunglasses-kit-48-piece-24-styles')
  const orderItem = getOrderItems([{ id: kit.id, quantity: 1 }])[0]

  assert.equal(kit.priceInCents, 100)
  assert.equal(orderItem.unit_amount.value, '1.00')
  assert.match(kit.name, /24 Unique Styles/)
  assert.match(kit.description, /48-piece kit/)
  assert.match(kit.details.join(' '), /retail stores, kiosks, pop-up vendors, and event sellers/)
})

test('48-piece sunglasses kit gets free shipping only when ordered by itself', () => {
  const kitOrder = getOrderItems(sunglassesKitItems)
  const mixedOrder = getOrderItems([...sunglassesKitItems, ...orderItems])

  assert.equal(getOrderShippingCents(kitOrder), 0)
  assert.equal(getOrderShippingCents(mixedOrder), 2000)
})

test('Wali black-and-gold high-tops are priced at $1,000 with U.S. sizes 7 through 17', () => {
  const shoe = products.find((product) => product.id === 'wali-black-gold-python-high-top')
  const variant = getOrderItems([{ id: shoe.id, size: '17', quantity: 1 }])[0]

  assert.deepEqual(shoe.sizes, ['7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17'])
  assert.equal(shoe.priceInCents, 100000)
  assert.equal(variant.name, `${shoe.name} - Size 17`)
  assert.equal(variant.sku, `${shoe.id}-size-17`)
  assert.equal(variant.unit_amount.value, '1000.00')
  assert.equal(getOrderItems([{ id: shoe.id, size: '18', quantity: 1 }]), null)
})

test('Wali white-and-gold Italian suede high-tops are listed at $1,100 with U.S. sizes 7 through 17', () => {
  const shoe = products.find((product) => product.id === 'wali-white-gold-italian-suede-high-top')
  const variant = getOrderItems([{ id: shoe.id, size: '17', quantity: 1 }])[0]

  assert.equal(shoe.priceInCents, 110000)
  assert.equal(variant.name, `${shoe.name} - Size 17`)
  assert.equal(variant.sku, `${shoe.id}-size-17`)
  assert.equal(variant.unit_amount.value, '1100.00')
  assert.equal(getOrderItems([{ id: shoe.id, size: '18', quantity: 1 }]), null)
})

test('Wali red-and-black limited edition offers US 7–13.5 and EU 39–46 for $950', () => {
  const shoe = products.find((product) => product.id === 'wali-red-blaque-limited-edition-high-top')
  const usVariant = getOrderItems([{ id: shoe.id, size: 'US 13.5', quantity: 1 }])[0]
  const euVariant = getOrderItems([{ id: shoe.id, size: 'EU 46', quantity: 1 }])[0]

  assert.equal(shoe.priceInCents, 95000)
  assert.equal(usVariant.unit_amount.value, '950.00')
  assert.equal(usVariant.name, `${shoe.name} - Size US 13.5`)
  assert.equal(euVariant.name, `${shoe.name} - Size EU 46`)
  assert.equal(getOrderItems([{ id: shoe.id, size: 'US 14', quantity: 1 }]), null)
  assert.equal(getOrderItems([{ id: shoe.id, size: 'EU 47', quantity: 1 }]), null)
})

test('leather jacket checkout offers S through XL at $800', () => {
  const jacket = products.find((product) => product.category === 'Clothing')
  const variants = jacket.sizes.map((size) => getOrderItems([{ id: jacket.id, size, quantity: 1 }])[0])

  assert.deepEqual(jacket.sizes, ['S', 'M', 'L', 'XL'])
  assert.equal(jacket.priceInCents, 80000)
  assert.deepEqual(variants.map((item) => item.name), jacket.sizes.map((size) => `${jacket.name} - Size ${size}`))
  assert.equal(getOrderItems([{ id: jacket.id, size: 'XXL', quantity: 1 }]), null)
})

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
        value: '497.00',
        breakdown: {
          item_total: { currency_code: 'USD', value: '450.00' },
          shipping: { currency_code: 'USD', value: shippingAmount },
          tax_total: { currency_code: 'USD', value: '27.00' },
        },
      },
      items: [{
        name: `${shoe.name} - Size 8`,
        sku: `${shoe.id}-size-8`,
        quantity: '1',
        unit_amount: { currency_code: 'USD', value: '450.00' },
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

function approvedSunglassesKitOrder() {
  const order = approvedOrder()
  const kit = products.find((product) => product.id === 'sunglasses-kit-48-piece-24-styles')
  const unit = order.purchase_units[0]
  unit.amount.value = '1.06'
  unit.amount.breakdown.item_total.value = '1.00'
  unit.amount.breakdown.shipping.value = '0.00'
  unit.amount.breakdown.tax_total.value = '0.06'
  unit.items = [{
    name: kit.name,
    sku: kit.id,
    quantity: '1',
    unit_amount: { currency_code: 'USD', value: '1.00' },
  }]
  return order
}

beforeEach(() => {
  process.env.PAYPAL_CHECKOUT_ENABLED = 'true'
  process.env.PAYPAL_CLIENT_ID = 'sandbox-client-id'
  process.env.PAYPAL_CLIENT_SECRET = 'sandbox-client-secret'
  process.env.PAYPAL_ENVIRONMENT = 'sandbox'
  process.env.VERCEL_ENV = 'preview'
  process.env.stripe_test = 'sk_test_checkout'
  process.env.VERCEL_URL = 'store-preview.example'
})

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key]
  }
  Object.assign(process.env, originalEnv)
})

test('flat tax is calculated from merchandise only without an address quote', () => {
  assert.equal(calculateTaxCents(getOrderItems(orderItems)), 2700)
  assert.equal(calculateTaxCents(getOrderItems(sunglassesKitItems)), 6)
})

test('Stripe Checkout omits a shipping charge for the sunglasses kit', async () => {
  let stripeRequest
  globalThis.fetch = async (url, options) => {
    stripeRequest = { url: String(url), options }
    return response({
      id: 'cs_test_free_shipping',
      url: 'https://checkout.stripe.com/c/pay/cs_test_free_shipping',
    })
  }

  const result = await invoke(stripeCheckoutHandler, {
    items: sunglassesKitItems,
    address: shippingAddress,
  })

  assert.equal(result.statusCode, 200)
  assert.equal(result.json.totalCents, 106)
  const payload = new URLSearchParams(stripeRequest.options.body)
  assert.equal(payload.has('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), false)
  assert.equal(payload.get('line_items[1][price_data][unit_amount]'), '6')
})

test('Stripe Checkout session uses server prices, server-calculated tax, shipping, and provided address', async () => {
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
  })

  assert.equal(result.statusCode, 200)
  assert.equal(result.json.sessionId, 'cs_test_checkout123')
  assert.equal(result.json.totalCents, 49700)
  assert.equal(stripeRequest.url, 'https://api.stripe.com/v1/checkout/sessions')
  assert.equal(stripeRequest.options.headers.Authorization, 'Bearer sk_test_checkout')
  const payload = new URLSearchParams(stripeRequest.options.body)
  assert.equal(payload.get('line_items[0][price_data][product_data][name]'), 'Textured Black Leather High-Top Sneaker - Size 8')
  assert.equal(payload.get('line_items[0][price_data][product_data][metadata][sku]'), 'zahouse-black-textured-high-top-size-8')
  assert.equal(payload.get('line_items[0][price_data][unit_amount]'), '45000')
  assert.equal(payload.get('line_items[0][quantity]'), '1')
  assert.equal(payload.get('line_items[1][price_data][product_data][name]'), 'Sales tax (6%)')
  assert.equal(payload.get('line_items[1][price_data][unit_amount]'), '2700')
  assert.equal(payload.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), '2000')
  assert.equal(payload.get('payment_intent_data[shipping][address][postal_code]'), '32810')
  assert.equal(payload.get('payment_intent_data[shipping][address][country]'), 'US')
  assert.equal(payload.get('metadata[store]'), 'zahouse')
  assert.equal(payload.get('metadata[total_cents]'), '49700')
  assert.match(payload.get('success_url'), /store-preview\.example\/\?stripe_session_id=/)
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
  })

  assert.equal(result.statusCode, 503)
  assert.match(result.json.error, /Stripe test secret key/)
  assert.equal(requests, 0)
})

test('Stripe Checkout accepts a correctly scoped test key when another alias is invalid', async () => {
  let stripeRequest
  process.env.STRIPE_TEST_SECRET_KEY = 'pk_test_not_a_secret_key'
  process.env.stripe_test = 'sk_test_valid_checkout'
  globalThis.fetch = async (url, options) => {
    stripeRequest = { url: String(url), options }
    return response({
      id: 'cs_test_valid123',
      url: 'https://checkout.stripe.com/c/pay/cs_test_valid123',
    })
  }

  const result = await invoke(stripeCheckoutHandler, {
    items: orderItems,
    address: shippingAddress,
  })

  assert.equal(result.statusCode, 200)
  assert.equal(stripeRequest.options.headers.Authorization, 'Bearer sk_test_valid_checkout')
})

test('Preview never falls back to a production Stripe key', async () => {
  delete process.env.stripe_test
  delete process.env.STRIPE_TEST_SECRET_KEY
  process.env.stripe_key = 'sk_live_production_only'
  let requests = 0
  globalThis.fetch = async () => {
    requests += 1
    return response({})
  }

  const result = await invoke(stripeCheckoutHandler, {
    items: orderItems,
    address: shippingAddress,
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

test('checkout status enables live Stripe without a tax-service configuration', async () => {
  process.env.VERCEL_ENV = 'production'
  delete process.env.STRIPE_SECRET_KEY
  process.env.stripe_key = 'sk_live_checkout'
  const result = await invoke(checkoutStatusHandler, undefined, { method: 'GET' })

  assert.equal(result.json.stripeEnabled, true)
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
      amount_total: 49700,
      metadata: { store: 'zahouse', total_cents: '49700' },
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
    amountCents: 49700,
  })
  assert.equal(requestedUrl, 'https://api.stripe.com/v1/checkout/sessions/cs_test_paid123')
})

test('Stripe return verification rejects an unpaid session', async () => {
  globalThis.fetch = async () => response({
    id: 'cs_test_unpaid123',
    mode: 'payment',
    currency: 'usd',
    payment_status: 'unpaid',
    amount_total: 49700,
    metadata: { store: 'zahouse', total_cents: '49700' },
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
    amount_total: 49600,
    metadata: { store: 'zahouse', total_cents: '49700' },
  })

  const result = await invoke(stripeVerifyHandler, undefined, {
    method: 'GET',
    url: '/api/stripe/verify-session?session_id=cs_test_wrongtotal123',
  })

  assert.equal(result.statusCode, 409)
  assert.match(result.json.error, /not confirmed/)
})

test('create order includes server-calculated flat tax and $20 U.S. shipping', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    if (String(url).endsWith('/v1/oauth2/token')) return response({ access_token: 'sandbox-token' })
    return response({ id: 'TESTORDER1234' })
  }

  const result = await invoke(createOrderHandler, {
    items: orderItems,
    address: shippingAddress,
  })

  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.json, { orderID: 'TESTORDER1234' })
  const payload = JSON.parse(calls[1].options.body)
  assert.equal(payload.purchase_units[0].amount.value, '497.00')
  assert.equal(payload.purchase_units[0].amount.breakdown.item_total.value, '450.00')
  assert.equal(payload.purchase_units[0].amount.breakdown.shipping.value, '20.00')
  assert.equal(payload.purchase_units[0].amount.breakdown.tax_total.value, '27.00')
  assert.equal(payload.purchase_units[0].shipping.address.country_code, 'US')
  assert.equal(payload.purchase_units[0].items[0].name, 'Textured Black Leather High-Top Sneaker - Size 8')
  assert.equal(payload.purchase_units[0].items[0].sku, 'zahouse-black-textured-high-top-size-8')
  assert.equal(payload.application_context.shipping_preference, 'SET_PROVIDED_ADDRESS')
})

test('PayPal order creates a zero shipping charge for the sunglasses kit', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    if (String(url).endsWith('/v1/oauth2/token')) return response({ access_token: 'sandbox-token' })
    return response({ id: 'TESTFREESHIP123' })
  }

  const result = await invoke(createOrderHandler, {
    items: sunglassesKitItems,
    address: shippingAddress,
  })

  assert.equal(result.statusCode, 200)
  const payload = JSON.parse(calls[1].options.body)
  assert.equal(payload.purchase_units[0].amount.value, '1.06')
  assert.equal(payload.purchase_units[0].amount.breakdown.shipping.value, '0.00')
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
              amount: { currency_code: 'USD', value: '497.00' },
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
  assert.equal(result.json.amount, '497.00')
  assert.equal(result.json.captureID, 'TESTCAPTURE123')
  assert.equal(calls.some((url) => url.endsWith('/capture')), true)
})

test('capture accepts free shipping for the sunglasses kit', async () => {
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/v1/oauth2/token')) return response({ access_token: 'sandbox-token' })
    if (String(url).endsWith('/capture')) {
      return response({
        status: 'COMPLETED',
        purchase_units: [{
          payments: {
            captures: [{
              id: 'TESTKITCAPTURE123',
              status: 'COMPLETED',
              amount: { currency_code: 'USD', value: '1.06' },
            }],
          },
        }],
      })
    }
    return response(approvedSunglassesKitOrder())
  }

  const result = await invoke(captureOrderHandler, { orderID: 'TESTORDER1234' })

  assert.equal(result.statusCode, 200)
  assert.equal(result.json.amount, '1.06')
})

test('capture rejects a PayPal order with a non-6% tax amount', async () => {
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/v1/oauth2/token')) return response({ access_token: 'sandbox-token' })
    const order = approvedOrder()
    order.purchase_units[0].amount.value = '284.99'
    order.purchase_units[0].amount.breakdown.tax_total.value = '14.99'
    return response(order)
  }

  const result = await invoke(captureOrderHandler, { orderID: 'TESTORDER1234' })

  assert.equal(result.statusCode, 409)
  assert.match(result.json.error, /tax/)
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
