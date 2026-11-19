import { getStripeConfig, stripeRequest } from '../../lib/stripe.js'
import { sendJson } from '../../lib/paypal.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return sendJson(res, 405, { error: 'Method not allowed.' })
  }

  const sessionId = req.query?.session_id
    || new URL(req.url, 'http://localhost').searchParams.get('session_id')
  if (typeof sessionId !== 'string' || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return sendJson(res, 400, { error: 'A valid Stripe Checkout session ID is required.' })
  }

  try {
    const session = await stripeRequest(getStripeConfig(), `/checkout/sessions/${encodeURIComponent(sessionId)}`)
    if (
      session?.metadata?.store !== 'zahouse'
      || session.mode !== 'payment'
      || session.currency !== 'usd'
      || session.payment_status !== 'paid'
      || !Number.isInteger(session.amount_total)
      || session.amount_total < 1
      || !/^\d+$/.test(session.metadata?.total_cents || '')
      || session.amount_total !== Number(session.metadata.total_cents)
    ) {
      return sendJson(res, 409, { error: 'Stripe has not confirmed a completed payment for this session.' })
    }

    return sendJson(res, 200, {
      status: 'paid',
      sessionId: session.id,
      amountCents: session.amount_total,
    })
  } catch (error) {
    if (error.status) return sendJson(res, error.status, { error: error.message })
    console.error('Stripe Checkout session verification failed.')
    return sendJson(res, 502, { error: 'Unable to verify the Stripe payment. Please try again.' })
  }
}
