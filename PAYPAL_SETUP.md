# PayPal setup

The storefront uses PayPal's JavaScript SDK for approval and Vercel API routes to create and capture orders. Prices and item names are read from `src/products.js` on the server; the browser never supplies trusted prices.

## Current state

- The provided public client ID is stored in the ignored `.env.local` file for local Vite builds.
- The catalog currently includes eight Vintage Wood Collection eyewear listings at $750 each and one shoe listing at $250. Checkout is gated by `PAYPAL_CHECKOUT_ENABLED` and the server-side PayPal environment variables.
- Product photos are supplied as JPEGs under `public/images/products/`; confirm every listing's details and image match against the wholesale catalog before launch.
- No PayPal secret is stored in this repository. Do not put a secret in a `VITE_` variable or commit it. The server accepts either `PAYPAL_CLIENT_SECRET` or the Vercel secret variable `paypal_key`.

## Configure Vercel

Add these environment variables to the Vercel project. Use the same PayPal app's client ID for both client ID variables, and put the app's secret only in the server variable:

| Variable | Value |
| --- | --- |
| `VITE_PAYPAL_CLIENT_ID` | Public client ID for the browser SDK |
| `PAYPAL_CLIENT_ID` | Same app's client ID for the API |
| `PAYPAL_CLIENT_SECRET` (or `paypal_key`) | PayPal app secret; server-side only |
| `PAYPAL_ENVIRONMENT` | `sandbox` for testing; use `live` only for production |
| `PAYPAL_CHECKOUT_ENABLED` | Keep `false` until sandbox testing and launch requirements are ready |
| `TAXJAR_API_KEY` | TaxJar API key; server-side only |
| `TAXJAR_ENVIRONMENT` | `sandbox` for testing; use `live` for production |

Checkout collects a U.S. shipping address, requests a TaxJar estimate, and adds $20 flat shipping per order. The order API signs the tax quote, then creates the PayPal order with that exact address and amount. Capture verifies the catalog items, shipping, tax, and total before capture. TaxJar treats items without a product tax code as fully taxable; review product taxability and configure the correct nexus locations in the TaxJar account before launch. The integration calculates sales tax but does not register for, remit, or file taxes.

For sandbox testing, set sandbox PayPal and TaxJar secrets in the Preview environment only, set both environment variables to `sandbox`, and set `PAYPAL_CHECKOUT_ENABLED=true` for Preview only. Keep the Production flag `false` until live PayPal and TaxJar credentials, tax nexus, product taxability, fulfillment, and launch policies have all been verified. Do not copy live secrets into Preview.

TaxJar's documented calculation endpoint is [POST /v2/taxes](https://developers.taxjar.com/api/reference/#post-calculate-tax-for-order); use its sandbox endpoint while testing. For local API routes, use `npx vercel dev`; `npm run dev` starts Vite only and does not serve the Vercel API functions.

## Before launch

The order API validates the catalog and confirms PayPal capture server-side, but does not yet persist orders, update inventory, send receipts, or process PayPal webhooks. Add the store's fulfillment, tax, shipping, refund, and order-record workflows before treating this starter as a complete production commerce system.
