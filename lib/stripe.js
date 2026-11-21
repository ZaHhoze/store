function getExpectedStripeMode() {
  return process.env.VERCEL_ENV === 'production' ? 'live' : 'test'
}

function getStripeSecretCandidate() {
  const expectedPrefix = `sk_${getExpectedStripeMode()}_`
  const candidates = process.env.VERCEL_ENV === 'production'
    ? [process.env.STRIPE_SECRET_KEY, process.env.stripe_key]
    : [process.env.STRIPE_TEST_SECRET_KEY, process.env.stripe_test]

  return candidates.find((candidate) => (
    typeof candidate === 'string' && candidate.startsWith(expectedPrefix)
  ))
}

export function isStripeConfigured() {
  return Boolean(getStripeSecretCandidate())
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
