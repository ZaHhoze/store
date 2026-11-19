export function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').send(body)
}

export function getRequestBody(req) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req.body
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return null
    }
  }
  return null
}

export function getPayPalConfig() {
  if (process.env.PAYPAL_CHECKOUT_ENABLED !== 'true') {
    const error = new Error('PayPal checkout is not enabled for this store.')
    error.status = 503
    throw error
  }

  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || process.env.paypal_key
  const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox'

  if (!clientId || !clientSecret) {
    const error = new Error('PayPal server credentials are not configured.')
    error.status = 503
    throw error
  }

  if (environment !== 'sandbox' && environment !== 'live') {
    const error = new Error('PAYPAL_ENVIRONMENT must be "sandbox" or "live".')
    error.status = 500
    throw error
  }

  return {
    clientId,
    clientSecret,
    apiBase: environment === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com',
  }
}

export async function getPayPalAccessToken(config) {
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
  const response = await fetch(`${config.apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    console.error('PayPal OAuth request failed', {
      status: response.status,
      debugId: response.headers.get('paypal-debug-id'),
    })
    const error = new Error('PayPal could not authorize this request.')
    error.status = 502
    throw error
  }

  const tokenData = await response.json()
  if (typeof tokenData.access_token !== 'string') {
    console.error('PayPal OAuth response did not include an access token.')
    const error = new Error('PayPal returned an invalid authorization response.')
    error.status = 502
    throw error
  }

  return tokenData.access_token
}

export async function payPalRequest(config, token, path, options = {}) {
  const response = await fetch(`${config.apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const responseData = await response.json().catch(() => null)
  if (!response.ok) {
    console.error('PayPal API request failed', {
      status: response.status,
      debugId: response.headers.get('paypal-debug-id'),
      issue: responseData?.name || 'unknown_error',
    })
    const error = new Error('PayPal could not complete the payment request.')
    error.status = 502
    throw error
  }

  return responseData
}

export function methodNotAllowed(res) {
  res.setHeader('Allow', 'POST')
  sendJson(res, 405, { error: 'Method not allowed.' })
}
