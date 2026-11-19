# PayPal setup

The storefront offers PayPal and Stripe Checkout. PayPal uses its JavaScript SDK for approval; Stripe redirects customers to Stripe's hosted card checkout. Vercel API routes create both payment sessions from the server-side catalog and signed TaxJar quote. The browser never supplies trusted prices.

## Current state

- The provided public client ID is stored in the ignored `.env.local` file for local Vite builds.
- The catalog currently includes eight Vintage Wood Collection eyewear listings at $750 each and one shoe listing at $250. PayPal is gated by `PAYPAL_CHECKOUT_ENABLED`; Stripe is enabled when the matching test or live secret exists for the deployment. Both payment methods require TaxJar.
- Product photos are supplied as JPEGs under `public/images/products/`; confirm every listing's details and image match against the wholesale catalog before launch.
- No payment secrets are stored in this repository. Do not put a secret in a `VITE_` variable or commit it. PayPal accepts `PAYPAL_CLIENT_SECRET` or `paypal_key`. Stripe accepts `STRIPE_SECRET_KEY` or `stripe_key` in Production, and `STRIPE_TEST_SECRET_KEY` or `stripe_test` in Preview/Development.

## Configure Vercel

Add these environment variables to the Vercel project. Use the same PayPal app's client ID for both client ID variables, and put the app's secret only in the server variable:

| Variable | Value |
| --- | --- |
| `VITE_PAYPAL_CLIENT_ID` | Public client ID for the browser SDK |
| `PAYPAL_CLIENT_ID` | Same app's client ID for the API |
| `PAYPAL_CLIENT_SECRET` (or `paypal_key`) | PayPal app secret; server-side only |
| `PAYPAL_ENVIRONMENT` | `sandbox` for testing; use `live` only for production |
| `PAYPAL_CHECKOUT_ENABLED` | Keep `false` until sandbox testing and launch requirements are ready |
| `STRIPE_SECRET_KEY` (or `stripe_key`) | Stripe live secret key; Production only |
| `STRIPE_TEST_SECRET_KEY` (or `stripe_test`) | Stripe test secret key; Preview/Development only |
| `CHECKOUT_QUOTE_SECRET` | Optional shared high-entropy secret for signing tax quotes |
| `TAXJAR_API_KEY` | TaxJar API key; server-side only |
| `TAXJAR_ENVIRONMENT` | `sandbox` for testing; use `live` for production |

Production checkout requires `TAXJAR_API_KEY` in Vercel's **Production** environment and `TAXJAR_ENVIRONMENT=live`. Preview and Development require a sandbox key and `TAXJAR_ENVIRONMENT=sandbox`. Tax requests have an 8-second timeout; if TaxJar is unavailable, checkout displays an error and lets the customer retry instead of waiting indefinitely.

Checkout collects a U.S. shipping address, requests a TaxJar estimate, and adds $20 flat shipping per order. PayPal receives the server-calculated amount and address. Stripe Checkout receives server-priced catalog lines, the signed TaxJar estimate as a separate checkout line, the shipping charge, and the shipping address attached to its payment. The TaxJar estimate is not Stripe Tax and will need to be reconciled in accounting. Stripe payments are verified against the Checkout Session before the success message is shown. TaxJar treats items without a product tax code as fully taxable; review product taxability and configure the correct nexus locations in the TaxJar account before launch. The integration calculates sales tax but does not register for, remit, or file taxes.

For sandbox testing, set Stripe's `stripe_test` key (or `STRIPE_TEST_SECRET_KEY`) and TaxJar's sandbox key in Preview. Configure PayPal sandbox credentials and set `PAYPAL_CHECKOUT_ENABLED=true` only if testing PayPal too. Production Stripe accepts only a live `sk_live_` key and requires live TaxJar; Preview accepts only a test `sk_test_` key and requires sandbox TaxJar. Do not copy live secrets into Preview or test payments with real customer cards.

TaxJar's documented calculation endpoint is [POST /v2/taxes](https://developers.taxjar.com/api/reference/#post-calculate-tax-for-order); use its sandbox endpoint while testing. For local API routes, use `npx vercel dev`; `npm run dev` starts Vite only and does not serve the Vercel API functions.

## Before launch

The payment APIs validate catalog pricing and confirm payment, but do not yet persist orders, update inventory, send store-managed receipts, process PayPal or Stripe webhooks, or automate fulfillment/refunds. Stripe Checkout may send its own payment receipt according to the Stripe account settings. Add the store's order-record, fulfillment, tax, shipping, and refund workflows before treating this as a complete production commerce system.
