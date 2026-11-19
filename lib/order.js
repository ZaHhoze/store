import { products } from '../src/products.js'

const formatAmount = (cents) => (cents / 100).toFixed(2)

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
      || seen.has(item.id)
    ) return null

    const product = products.find((entry) => entry.id === item.id)
    if (!product || !product.availableForSale) {
      const error = new Error('One or more items are not available for purchase.')
      error.status = 409
      throw error
    }

    seen.add(item.id)
    orderItems.push({
      name: product.name,
      sku: product.id,
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
    const product = products.find((entry) => entry.id === item.sku)
    return total + product.priceInCents * Number(item.quantity)
  }, 0)
}
