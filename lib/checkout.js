export const US_FLAT_SHIPPING_CENTS = 2000

export const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]

const trimString = (value, maxLength) => (
  typeof value === 'string' && value.trim().length <= maxLength
    ? value.trim()
    : ''
)

export function normalizeShippingAddress(address) {
  if (!address || typeof address !== 'object' || Array.isArray(address)) return null

  if (
    address.addressLine2 !== undefined
    && address.addressLine2 !== null
    && (typeof address.addressLine2 !== 'string' || address.addressLine2.trim().length > 100)
  ) return null

  const normalized = {
    name: trimString(address.name, 120),
    addressLine1: trimString(address.addressLine1, 200),
    addressLine2: trimString(address.addressLine2, 100),
    city: trimString(address.city, 100),
    state: trimString(address.state, 2).toUpperCase(),
    postalCode: trimString(address.postalCode, 10),
  }

  if (
    normalized.name.length < 2
    || normalized.addressLine1.length < 2
    || normalized.city.length < 2
    || !US_STATE_CODES.includes(normalized.state)
    || !/^\d{5}(?:-\d{4})?$/.test(normalized.postalCode)
  ) return null

  return normalized
}
