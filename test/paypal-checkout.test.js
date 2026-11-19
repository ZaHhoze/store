import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import createOrderHandler from '../api/paypal/create-order.js'
import captureOrderHandler from '../api/paypal/capture-order.js'
import quoteOrderHandler from '../api/paypal/quote-order.js'
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

function invoke(handler, body) {
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

  return handler({ method: 'POST', body }, res).then(() => ({
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
