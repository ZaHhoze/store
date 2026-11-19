function getExpectedStripeMode() {
  return process.env.VERCEL_ENV === 'production' ? 'live' : 'test'
}

function getStripeSecretCandidate() {
  if (process.env.VERCEL_ENV === 'production') {
    return process.env.STRIPE_SECRET_KEY || process.env.stripe_key
  }
  return process.env.STRIPE_TEST_SECRET_KEY
    || process.env.stripe_test
    || process.env.STRIPE_SECRET_KEY
    || process.env.stripe_key
}

export function isStripeConfigured() {
  const secretKey = getStripeSecretCandidate()
  return typeof secretKey === 'string' && secretKey.startsWith(`sk_${getExpectedStripeMode()}_`)
}

export function getStripeConfig() {
  const secretKey = getStripeSecretCandidate()
  const expectedMode = getExpectedStripeMode()
  if (!secretKey || !secretKey.startsWith(`sk_${expectedMode}_`)) {
    const error = new Error(`A Stripe ${expectedMode} secret key is not configured for this deployment.`)
    error.status = 503
    throw error
  }
  return { secretKey }
}

export function getCheckoutQuoteSecret() {
  const secret = process.env.CHECKOUT_QUOTE_SECRET
    || process.env.PAYPAL_CLIENT_SECRET
    || process.env.paypal_key
    || getStripeSecretCandidate()

  if (!secret) {
    const error = new Error('Checkout quote signing is not configured.')
    error.status = 503
    throw error
  }
  return secret
}

export function getStripeSiteUrl() {
  if (process.env.VERCEL_ENV === 'production') {
    return process.env.STORE_FRONTEND_URL || 'https://shop.za.house'
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return process.env.STORE_FRONTEND_URL || 'http://localhost:3000'
}

export async function stripeRequest(config, path, options = {}) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      ...options.headers,
    },
  })

  const responseData = await response.json().catch(() => null)
  if (!response.ok) {
    console.error('Stripe API request failed', {
      status: response.status,
      type: responseData?.error?.type || 'unknown_error',
      code: responseData?.error?.code || 'unknown_error',
    })
    const error = new Error('Stripe could not complete the checkout request.')
    error.status = 502
    throw error
  }
  return responseData
}
