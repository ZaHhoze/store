import { products } from '../src/products.js'
import { US_FLAT_SHIPPING_CENTS } from './checkout.js'

const formatAmount = (cents) => (cents / 100).toFixed(2)

function getProductVariant(product, size) {
  if (product.sizes) {
    if (!product.sizes.includes(String(size))) return null
    return {
      product,
      size: String(size),
      sku: `${product.id}-size-${size}`,
      name: `${product.name} - Size ${size}`,
    }
  }
  if (size !== undefined) return null
  return { product, size: undefined, sku: product.id, name: product.name }
}

export function getProductVariantBySku(sku) {
  for (const product of products) {
    if (product.sizes) {
      const size = product.sizes.find((entry) => `${product.id}-size-${entry}` === sku)
      if (size) return getProductVariant(product, size)
    } else if (product.id === sku) {
      return getProductVariant(product)
    }
  }
  return null
}

export function getOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 30) return null

  const seen = new Set()
  const orderItems = []

  for (const item of items) {
    if (
      !item
      || typeof item.id !== 'string'
      || !Number.isInteger(item.quantity)
      || item.quantity < 1
      || item.quantity > 99
    ) return null

    const product = products.find((entry) => entry.id === item.id)
    if (!product || !product.availableForSale) {
      const error = new Error('One or more items are not available for purchase.')
      error.status = 409
      throw error
    }

    const variant = getProductVariant(product, item.size)
    if (!variant || seen.has(variant.sku)) return null

    seen.add(variant.sku)
    orderItems.push({
      name: variant.name,
      sku: variant.sku,
      quantity: String(item.quantity),
      unit_amount: {
        currency_code: 'USD',
        value: formatAmount(product.priceInCents),
      },
    })
  }

  return orderItems
}

export function getItemTotalCents(items) {
  return items.reduce((total, item) => {
    const variant = getProductVariantBySku(item.sku)
    return total + variant.product.priceInCents * Number(item.quantity)
  }, 0)
}

export function getOrderShippingCents(items) {
  const qualifiesForFreeShipping = items.length > 0
    && items.every((item) => getProductVariantBySku(item.sku)?.product.freeShipping)

  return qualifiesForFreeShipping ? 0 : US_FLAT_SHIPPING_CENTS
}
