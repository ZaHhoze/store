import './style.css'
import { products } from './products.js'
import { US_FLAT_SHIPPING_CENTS, US_STATE_CODES } from '../lib/checkout.js'

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})
const hasPreviewProducts = products.some((product) => !product.availableForSale)
const categories = ['All products', ...new Set(products.filter((product) => product.category !== 'Shoes').map((product) => product.category))]
const collections = [
  { id: 'vintage-wood', name: 'Vintage Wood', label: 'The signature eyewear edit', image: '/images/products/drone-6-blue-wood-side.jpg', imageAlt: 'Silver rimless sunglasses with blue wood temples' },
  { id: 'zaza', name: 'Zaza', label: 'A little more attitude', mark: 'Z.' },
  { id: 'clothing', name: 'Clothing', label: 'Pieces with a point of view', image: '/images/poai-leather-jacket.jpeg', imageAlt: 'Black POAI leather jacket' },
  { id: 'shoes', name: 'Shoes', label: 'A considered step', image: '/images/wali/black-gold-python-side.jpg', imageAlt: 'Wali black python-print high-top sneaker with gold laces and gold sole' },
  { id: 'venues', name: 'Venues', label: 'Spaces made for gathering', image: '/images/dining-room.jpeg', imageAlt: 'An elegant dining room set for gathering' },
  { id: 'consultation', name: 'Consultation', label: 'A more personal experience', mark: 'Z/H' },
]
const editorialPages = [
  {
    id: 'zaza',
    eyebrow: 'Zaza brand showcase',
    title: 'Meet the<br /><em>Zaza line.</em>',
    description: 'A visual introduction to the Zaza brand.',
    note: 'Brand image only. This page does not offer products for sale, ordering, or delivery.',
    image: '/images/zaza/preroll-display.png',
    imageAlt: 'Zaza-branded pre-roll tubes shown together in a clear display jar',
    imageClass: 'editorial-page__image--zaza',
    action: 'Return to the house',
    subject: 'ZaHouse',
  },
  {
    id: 'clothing',
    eyebrow: 'The clothing edit',
    title: 'Wear your<br /><em>point of view.</em>',
    description: 'Personal style starts with pieces that feel unmistakably yours. Explore a considered mix of independent labels and statement essentials.',
    note: 'Our clothing collection is still being curated. Contact the house for current availability.',
    image: '/images/poai-leather-jacket.jpeg',
    imageAlt: 'Black POAI leather jacket',
    imageClass: '',
    action: 'Ask about clothing',
    subject: 'Clothing collection inquiry',
  },
  {
    id: 'shoes',
    eyebrow: 'The shoe room',
    title: 'Find your<br /><em>next step.</em>',
    description: 'Step into distinctive style with considered leather high-tops and Italian-crafted Wali™ sneakers.',
    note: 'Explore the current selection of signature high-tops.',
    image: '',
    imageAlt: '',
    imageClass: 'editorial-page__image--shoes',
    action: 'Ask about shoes',
    subject: 'Shoes collection inquiry',
  },
  {
    id: 'venues',
    eyebrow: 'Gather at the house',
    title: 'Make room for<br /><em>good company.</em>',
    description: 'Some of life’s best moments happen around a table. Discover the spaces and details that make a gathering feel special.',
    note: 'For venue information and availability, tell us a little about the occasion you have in mind.',
    image: '/images/dining-room.jpeg',
    imageAlt: 'An elegant dining room set for gathering',
    imageClass: '',
    action: 'Ask about venues',
    subject: 'Venue inquiry',
  },
  {
    id: 'consultation',
    eyebrow: 'A personal experience',
    title: 'Let’s find what<br /><em>feels like you.</em>',
    description: 'Looking for a thoughtful gift, a signature piece, or a fresh perspective? Start a conversation with the house.',
    note: 'Share what you are looking for and we will be in touch to discuss the next step.',
    image: '/images/products/drone-5-brown-wood-angle.jpg',
    imageAlt: 'Gold sunglasses with brown wood temples',
    imageClass: '',
    action: 'Start a conversation',
    subject: 'ZaHouse consultation request',
  },
]
const cart = new Map()
const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID
let activeCategory = 'All products'
let activeRoute = 'home'
let searchQuery = ''
let sortOrder = 'featured'
let paypalSdkPromise
let checkoutAvailabilityPromise
let paypalButtonsPromise
let paypalButtonsRendered = false
let paypalEnabled = false
let stripeEnabled = false
let currentTaxCents = null
let currentTaxQuoteKey = ''
let currentTaxQuoteToken = ''
let taxQuoteInFlightKey = ''
let taxQuoteVersion = 0
let taxQuoteTimer
let taxQuoteCanRetry = false

document.querySelector('#app').innerHTML = `
  <div class="announcement">
    <span>Independent finds, thoughtfully chosen</span>
    <span class="announcement__divider" aria-hidden="true"></span>
    <span>Find a piece with a point of view</span>
  </div>

  <header class="site-header">
    <a class="wordmark" href="#home" aria-label="ZaHouse home"><img src="/images/zahouse-logo.jpg" alt="ZaHouse" /></a>
    <label class="search-box" for="product-search">
      <span class="search-box__icon" aria-hidden="true">&#9906;</span>
      <input id="product-search" type="search" placeholder="Search products and brands" autocomplete="off" />
      <span class="search-box__shortcut" aria-hidden="true">/</span>
    </label>
    <div class="header-actions">
      <a class="header-link" href="#vintage-wood">Shop</a>
      <button class="cart-trigger" id="open-cart" type="button" aria-haspopup="dialog" aria-controls="cart-panel">
        Bag <span class="cart-trigger__count" id="cart-count" aria-live="polite">0</span>
      </button>
    </div>
  </header>
  <nav class="site-nav" aria-label="Explore ZaHouse">
    ${collections.map((collection) => `<a href="#${collection.id}" data-nav-route="${collection.id}">${collection.name}</a>`).join('')}
  </nav>

  <main>
    <div class="route-page" data-route-page="home">
      <section class="hero" id="home" aria-labelledby="hero-title">
      <div class="hero__copy">
        <p class="eyebrow"><span class="eyebrow__line"></span> Come experience the house</p>
        <h1 id="hero-title">Live with feeling.<br /><em>Wear your story.</em></h1>
        <p class="hero__intro">A world of independent style, memorable spaces, and personal discoveries—curated for the way you want to live.</p>
        <a class="text-link" href="#vintage-wood">Explore the house <span aria-hidden="true">&#8594;</span></a>
        <p class="hero__location">Discover something that feels like you <span>·</span> za.house</p>
      </div>
      <a class="hero__feature hero__feature--wali" href="#shoes" aria-label="Shop Wali Blaque and Gold Python Print Luxury High Tops with gold soles and laces, $1,000">
        <span class="hero__feature-kicker">NEW / WALI™ IN FOCUS</span>
        <img class="hero__feature-image" src="/images/wali/black-gold-python-side.jpg" alt="Black python-print Wali high-top sneaker with gold laces and gold sole" />
        <div class="hero__feature-caption">
          <div><span>BLACK &amp; GOLD PYTHON PRINT</span><strong>Luxury High Tops</strong></div>
          <span class="hero__feature-price">$1,000</span>
          <span class="hero__feature-arrow" aria-hidden="true">&#8599;</span>
        </div>
      </a>
      <div class="hero__caption"><span>Style. Space. A little more you.</span><span>Welcome to za.house</span></div>
      </section>

      <section class="collection-index" aria-labelledby="collection-index-title">
        <div class="section-heading">
          <div>
            <p class="eyebrow eyebrow--dark"><span class="eyebrow__line"></span> Find your way around</p>
            <h2 id="collection-index-title">Explore the <em>house.</em></h2>
          </div>
          <p class="section-heading__copy">From a signature pair to a place to gather, discover the different sides of the ZaHouse experience.</p>
        </div>
        <div class="collection-grid">
          ${collections.map((collection) => `
            <a class="collection-tile" href="#${collection.id}">
              <span class="collection-tile__image${collection.image ? '' : ' collection-tile__image--mark'}${collection.id === 'shoes' ? ' collection-tile__image--shoe' : ''}">
                ${collection.image
    ? `<img src="${collection.image}" alt="${collection.imageAlt}" loading="lazy" />`
    : `<span aria-hidden="true">${collection.mark}</span>`}
              </span>
              <span class="collection-tile__copy"><strong>${collection.name}</strong><span>${collection.label}</span></span>
              <span class="collection-tile__arrow" aria-hidden="true">&#8599;</span>
            </a>
          `).join('')}
        </div>
      </section>

      <section class="house-note" aria-labelledby="house-note-title">
        <div class="house-note__copy">
          <p class="eyebrow"><span class="eyebrow__line"></span> A note from the house</p>
          <h2 id="house-note-title">Not just a store.<br /><em>A way to feel.</em></h2>
        </div>
        <p class="house-note__description">ZaHouse brings together the things we wear, the places we gather, and the details that make a life feel personal. Come for a find; stay for the feeling.</p>
        <a class="house-note__link" href="#consultation">Experience ZaHouse <span aria-hidden="true">&#8594;</span></a>
      </section>
      <section class="preview-strip" aria-label="The ZaHouse experience">
        <div><span class="preview-strip__index">01</span><span>Independent style</span></div>
        <div><span class="preview-strip__index">02</span><span>Spaces to remember</span></div>
        <div><span class="preview-strip__index">03</span><span>Personal discoveries</span></div>
      </section>
    </div>

    <div class="route-page" data-route-page="vintage-wood" hidden>
      <section class="collection-page-heading">
        <p class="eyebrow"><span class="eyebrow__line"></span> The signature eyewear edit</p>
        <h1>Vintage Wood<br /><em>Collection.</em></h1>
        <p>Distinctive eyewear, sculptural details, and thoughtful craftsmanship. Explore the collection curated by ZaHouse.</p>
      </section>
      <section class="shop-section" id="shop" aria-labelledby="shop-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow eyebrow--dark"><span class="eyebrow__line"></span> Vintage Wood Collection</p>
          <h2 id="shop-title">The eyewear <em>edit.</em></h2>
        </div>
        <p class="section-heading__copy">Explore the silhouettes, materials, and distinctive finishes that make each pair its own.</p>
      </div>

      <div class="shop-toolbar">
        <div class="category-links" id="category-filters" aria-label="Filter by category">
          ${categories.map((category, index) => `
            <button type="button" class="category-chip${index === 0 ? ' is-active' : ''}" data-category="${category}">
              ${category}<span>${category === 'All products' ? products.length : products.filter((product) => product.category === category).length}</span>
            </button>
          `).join('')}
        </div>
        <label class="sort-control" for="sort-products">
          <span>Sort by</span>
          <select id="sort-products">
            <option value="featured">Featured</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      <div class="results-bar">
        <p id="results-count" aria-live="polite">${products.length} thoughtfully chosen find</p>
        <span>${products.length} curated eyewear finds</span>
      </div>
      <div class="product-grid" id="product-grid"></div>
      <div class="empty-results" id="empty-results" hidden>
        <p>No pieces found this time.</p>
        <span>Try another search or browse the full collection.</span>
        <button type="button" id="clear-filters">Clear filters</button>
      </div>
      ${hasPreviewProducts ? '<p class="sample-note">Sample catalog for preview only. Product names, descriptions, images, and prices are not final.</p>' : ''}
      </section>
      <section class="collection-return"><a class="text-link" href="#home">Back to the ZaHouse experience <span aria-hidden="true">&#8592;</span></a></section>
    </div>

    ${editorialPages.map((page) => page.id === 'shoes' || page.id === 'clothing' ? `
      <div class="route-page" data-route-page="${page.id}" hidden>
        <section class="collection-page-heading">
          <p class="eyebrow"><span class="eyebrow__line"></span>${page.eyebrow}</p>
          <h1>${page.title}</h1>
          <p>${page.description}</p>
        </section>
        <section class="shop-section shoes-section" aria-labelledby="${page.id}-title">
          <div class="section-heading">
            <div>
              <p class="eyebrow eyebrow--dark"><span class="eyebrow__line"></span>${page.id === 'shoes' ? 'The shoe room' : 'The clothing edit'}</p>
              <h2 id="${page.id}-title">${page.id === 'shoes' ? 'Selected <em>footwear.</em>' : 'Selected <em>outerwear.</em>'}</h2>
            </div>
            <p class="section-heading__copy">${page.id === 'shoes' ? 'Explore signature high-tops in distinctive materials, colors, and sizes.' : 'Distinctive pieces, thoughtfully chosen for the way you live.'}</p>
          </div>
          <div class="product-grid product-grid--shoes" id="${page.id}-product-grid"></div>
        </section>
        <section class="collection-return"><a class="text-link" href="#home">Back to the ZaHouse experience <span aria-hidden="true">&#8592;</span></a></section>
      </div>
    ` : `
      <div class="route-page" data-route-page="${page.id}" hidden>
        <section class="editorial-page">
          <div class="editorial-page__copy">
            <p class="eyebrow"><span class="eyebrow__line"></span>${page.eyebrow}</p>
            <h1>${page.title}</h1>
            <p class="editorial-page__description">${page.description}</p>
            <p class="editorial-page__note">${page.note}</p>
            <a class="text-link" href="${page.id === 'zaza' ? '#home' : `mailto:info@za.house?subject=${encodeURIComponent(page.subject)}`}">${page.action} <span aria-hidden="true">${page.id === 'zaza' ? '&#8592;' : '&#8594;'}</span></a>
          </div>
          <div class="editorial-page__visual ${page.imageClass}">
            ${page.image ? `<img src="${page.image}" alt="${page.imageAlt}" />` : '<span aria-hidden="true">STEP<br />INTO<br />YOUR<br />STYLE.</span>'}
          </div>
        </section>
        <section class="collection-return"><a class="text-link" href="#home">Back to the ZaHouse experience <span aria-hidden="true">&#8592;</span></a></section>
      </div>
    `).join('')}
  </main>

  <footer class="site-footer">
    <div class="footer__brand"><a class="wordmark wordmark--footer" href="#home" aria-label="ZaHouse home"><img src="/images/zahouse-logo-transparent.png" alt="ZaHouse" /></a><p>Live beautifully.<br />Wear your point of view.</p></div>
    <div class="footer__contact"><span class="footer__label">Visit the house</span><a href="https://maps.google.com/?q=5205+Edgewater+Dr,+Orlando,+FL+32810" target="_blank" rel="noreferrer">5205 Edgewater Dr<br />Orlando, FL 32810 <span aria-hidden="true">&#8599;</span></a></div>
    <div class="footer__contact"><span class="footer__label">Get in touch</span><a href="mailto:info@za.house">info@za.house</a><a href="tel:+16197966346">619.796.6346</a></div>
    <nav class="footer__contact footer__social" aria-label="Follow za.house">
      <span class="footer__label">Follow the house</span>
      <a href="https://www.instagram.com/zahouse_farms/" target="_blank" rel="noopener noreferrer">Instagram @zahouse_farms <span aria-hidden="true">&#8599;</span></a>
      <a href="https://www.facebook.com/share/1cXsmfDGq4/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer">Facebook @zahouse <span aria-hidden="true">&#8599;</span></a>
      <a href="https://x.com/zahouse1" target="_blank" rel="noopener noreferrer">X @zahouse1 <span aria-hidden="true">&#8599;</span></a>
      <a href="https://www.youtube.com/@zahousefilms" target="_blank" rel="noopener noreferrer">YouTube @zahousefilms <span aria-hidden="true">&#8599;</span></a>
    </nav>
    <div class="footer__bottom"><span>&copy; 2026 za.house. All rights reserved.</span><a href="#home">Back to the experience &#8593;</a><span>Made for the way you live.</span></div>
  </footer>

  <div class="cart-overlay" id="cart-overlay" hidden>
    <button class="cart-overlay__scrim" type="button" data-close-cart aria-label="Close shopping bag"></button>
    <aside class="cart-panel" id="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">
      <div class="cart-panel__header">
        <div><p class="eyebrow eyebrow--dark">Your selection</p><h2 id="cart-title">Shopping bag <span id="cart-title-count">(0)</span></h2></div>
        <button class="cart-panel__close" type="button" data-close-cart aria-label="Close shopping bag">&times;</button>
      </div>
      <div class="cart-panel__items" id="cart-items"></div>
      <div class="cart-panel__footer">
        <div class="cart-subtotal"><span>Subtotal</span><strong id="cart-subtotal">${currency.format(0)}</strong></div>
        <div class="cart-subtotal"><span>U.S. shipping</span><strong id="cart-shipping">${currency.format(0)}</strong></div>
        <div class="cart-subtotal"><span>Sales tax (6%)</span><strong id="cart-tax">Address required</strong></div>
        <div class="cart-total"><span>Estimated total</span><strong id="cart-total">${currency.format(0)}</strong></div>
        <p class="cart-panel__notice">U.S. shipping is $20 per order, with free shipping when the 48-piece sunglasses kit is ordered by itself. Sales tax is a flat 6% of merchandise subtotal and does not include shipping. Choose PayPal or secure card checkout.</p>
        <form class="shipping-address-form" id="shipping-address-form" hidden>
          <p>U.S. shipping address</p>
          <label>Full name<input name="name" autocomplete="name" required minlength="2" maxlength="120" /></label>
          <label>Street address<input name="addressLine1" autocomplete="address-line1" required minlength="2" maxlength="200" /></label>
          <label>Apartment, suite, etc. <span>(optional)</span><input name="addressLine2" autocomplete="address-line2" maxlength="100" /></label>
          <div class="shipping-address-form__row">
            <label>City<input name="city" autocomplete="address-level2" required minlength="2" maxlength="100" /></label>
            <label>State
              <select name="state" autocomplete="address-level1" required>
                <option value="">Select</option>
                ${US_STATE_CODES.map((state) => `<option value="${state}">${state}</option>`).join('')}
              </select>
            </label>
          </div>
          <label>ZIP code<input name="postalCode" autocomplete="postal-code" inputmode="numeric" pattern="\\d{5}(-\\d{4})?" required /></label>
          <span class="shipping-address-form__country">Shipping to the United States only</span>
        </form>
        <div id="paypal-button-container" class="paypal-button-container" hidden></div>
        <button class="stripe-checkout-button" id="stripe-checkout-button" type="button" hidden>Pay securely by card</button>
        <button class="checkout-button" id="checkout-unavailable" type="button" disabled>Checkout unavailable</button>
        <p class="cart-panel__secure" id="checkout-status" role="status" aria-live="polite">Sample products cannot be purchased.</p>
      </div>
    </aside>
  </div>

  <div class="product-overlay" id="product-overlay" hidden>
    <button class="product-overlay__scrim" type="button" data-close-product aria-label="Close product details"></button>
    <section class="product-detail" id="product-detail" role="dialog" aria-modal="true" aria-labelledby="product-detail-title">
      <button class="product-detail__close" type="button" data-close-product aria-label="Close product details">&times;</button>
      <div class="product-detail__content" id="product-detail-content"></div>
    </section>
  </div>
`

const cartOverlay = document.querySelector('#cart-overlay')
const cartItems = document.querySelector('#cart-items')
const cartCount = document.querySelector('#cart-count')
const cartTitleCount = document.querySelector('#cart-title-count')
const cartSubtotal = document.querySelector('#cart-subtotal')
const cartShipping = document.querySelector('#cart-shipping')
const cartTax = document.querySelector('#cart-tax')
const cartTotal = document.querySelector('#cart-total')
const shippingAddressForm = document.querySelector('#shipping-address-form')
const openCartButton = document.querySelector('#open-cart')
const closeCartButton = document.querySelector('#cart-panel .cart-panel__close')
const productGrid = document.querySelector('#product-grid')
const productSearch = document.querySelector('#product-search')
const sortProducts = document.querySelector('#sort-products')
const resultsCount = document.querySelector('#results-count')
const emptyResults = document.querySelector('#empty-results')
const shoesProductGrid = document.querySelector('#shoes-product-grid')
const clothingProductGrid = document.querySelector('#clothing-product-grid')
const paypalButtonContainer = document.querySelector('#paypal-button-container')
const stripeCheckoutButton = document.querySelector('#stripe-checkout-button')
const checkoutUnavailable = document.querySelector('#checkout-unavailable')
const checkoutStatus = document.querySelector('#checkout-status')
const productOverlay = document.querySelector('#product-overlay')
const productDetailContent = document.querySelector('#product-detail-content')
const productDetailClose = document.querySelector('.product-detail__close')
const routePages = [...document.querySelectorAll('[data-route-page]')]
let lastProductTrigger

function renderRoute() {
  const requestedRoute = window.location.hash.slice(1).split('/')[0] || 'home'
  const route = requestedRoute === 'shop' ? 'vintage-wood' : requestedRoute
  const activePage = routePages.find((page) => page.dataset.routePage === route) || routePages[0]
  activeRoute = activePage.dataset.routePage

  routePages.forEach((page) => {
    page.hidden = page !== activePage
  })

  document.querySelectorAll('[data-nav-route]').forEach((link) => {
    if (link.dataset.navRoute === activePage.dataset.routePage) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })

  const title = activePage.dataset.routePage === 'home'
    ? 'ZaHouse | Live with feeling. Wear your story.'
    : `${collections.find((collection) => collection.id === activePage.dataset.routePage)?.name
      || editorialPages.find((page) => page.id === activePage.dataset.routePage)?.eyebrow} | ZaHouse`
  document.title = title
  if (activeRoute === 'vintage-wood' || activeRoute === 'shoes' || activeRoute === 'clothing') renderProducts()
}

function productMedia(product, className = '') {
  const brandMark = product.brand.split(/\s+/).map((word) => word[0]).join('').slice(0, 3)

  if (product.image) {
    return `<div class="product-card__visual ${className}"><img src="${product.image}" alt="${product.alt}" loading="lazy" /></div>`
  }

  return `
    <div class="product-card__visual product-card__visual--placeholder ${className}">
      <span class="product-placeholder__brand">${product.brand}</span>
      <span class="product-placeholder__monogram" aria-hidden="true">${brandMark}<span>.</span></span>
      <span class="product-placeholder__caption">Photo coming soon</span>
    </div>
  `
}

function renderProducts() {
  const query = searchQuery.trim().toLocaleLowerCase()
  const isShoesPage = activeRoute === 'shoes'
  const isClothingPage = activeRoute === 'clothing'
  const isCategoryPage = isShoesPage || isClothingPage
  const visibleProducts = products
    .filter((product) => isShoesPage
      ? product.category === 'Shoes'
      : isClothingPage
        ? product.category === 'Clothing'
        : product.category !== 'Shoes')
    .filter((product) => isCategoryPage || activeCategory === 'All products' || product.category === activeCategory)
    .filter((product) => !query || [product.name, product.brand, product.category, product.description]
      .some((value) => value.toLocaleLowerCase().includes(query)))

  if (sortOrder === 'price-low') visibleProducts.sort((a, b) => a.priceInCents - b.priceInCents)
  if (sortOrder === 'price-high') visibleProducts.sort((a, b) => b.priceInCents - a.priceInCents)
  if (sortOrder === 'name') visibleProducts.sort((a, b) => a.name.localeCompare(b.name))

  const productCards = visibleProducts.map((product) => `
    <article class="product-card">
      <div class="product-card__media-wrap">
        <button class="product-card__image-link" type="button" data-product="${product.id}" aria-label="View ${product.name} details">
          ${productMedia(product, product.imageClass)}
        </button>
        <span class="product-card__badge">${product.availableForSale ? 'New find' : 'Coming soon'}</span>
      </div>
      <div class="product-card__details">
        <p class="product-card__brand">${product.brand}</p>
        <div class="product-card__title-row">
          <h3><button class="product-card__title-link" type="button" data-product="${product.id}">${product.name}</button></h3>
          <span class="product-card__price">${currency.format(product.priceInCents / 100)}</span>
        </div>
        <p class="product-card__description">${product.description}</p>
        <button class="add-button" type="button" data-add="${product.id}" ${product.availableForSale ? '' : 'disabled'}>
          ${product.availableForSale ? (product.sizes ? 'Choose size' : 'Add to bag') : 'Coming soon'} <span aria-hidden="true">${product.availableForSale ? (product.sizes ? '&#8594;' : '+') : '·'}</span>
        </button>
      </div>
    </article>
  `).join('')

  if (isShoesPage) {
    shoesProductGrid.innerHTML = productCards
    return
  }
  if (isClothingPage) {
    clothingProductGrid.innerHTML = productCards
    return
  }

  productGrid.innerHTML = productCards

  resultsCount.textContent = `${visibleProducts.length} ${visibleProducts.length === 1 ? 'thoughtfully chosen find' : 'thoughtfully chosen finds'}`
  productGrid.hidden = visibleProducts.length === 0
  emptyResults.hidden = visibleProducts.length > 0

  document.querySelectorAll('[data-category]').forEach((button) => {
    const selected = button.dataset.category === activeCategory
    button.classList.toggle('is-active', selected)
    button.setAttribute('aria-pressed', String(selected))
  })
}

function renderCart() {
  const entries = [...cart.entries()]
  const itemCount = entries.reduce((total, [, quantity]) => total + quantity, 0)
  taxQuoteVersion += 1
  currentTaxCents = null
  currentTaxQuoteKey = ''
  currentTaxQuoteToken = ''
  taxQuoteInFlightKey = ''

  cartCount.textContent = itemCount
  cartTitleCount.textContent = `(${itemCount})`
  shippingAddressForm.hidden = entries.length === 0
  updateCartTotals(entries)

  if (entries.length === 0) {
    cartItems.innerHTML = '<div class="cart-empty"><span aria-hidden="true">✳</span><p>Your bag is taking shape.</p><span>Add a pair to get started.</span></div>'
  } else {
    cartItems.innerHTML = entries.map(([key, quantity]) => {
      const { product, size } = getCartVariant(key)
      const itemName = `${product.name}${size ? ` · Size ${size}` : ''}`

      return `
        <article class="cart-item">
          ${productMedia(product, 'cart-item__media')}
          <div class="cart-item__details">
            <div class="cart-item__heading"><div><p>${product.category}</p><h3>${itemName}</h3></div><strong>${currency.format(product.priceInCents * quantity / 100)}</strong></div>
            <div class="cart-item__actions">
              <div class="quantity-control" aria-label="Quantity for ${itemName}">
                <button type="button" data-quantity="${key}" data-delta="-1" aria-label="Remove one ${itemName}">−</button>
                <span>${quantity}</span>
                <button type="button" data-quantity="${key}" data-delta="1" aria-label="Add one ${itemName}">+</button>
              </div>
              <button class="cart-item__remove" type="button" data-remove="${key}">Remove</button>
            </div>
          </div>
        </article>
      `
    }).join('')
  }

  updateCheckoutAvailability(entries)
}

function updateCartTotals(entries = [...cart.entries()]) {
  const subtotal = entries.reduce((total, [key, quantity]) => {
    const { product } = getCartVariant(key)
    return total + product.priceInCents * quantity
  }, 0)
  const freeShippingOnly = entries.length > 0
    && entries.every(([key]) => getCartVariant(key).product.freeShipping)
  const shipping = entries.length === 0 || freeShippingOnly ? 0 : US_FLAT_SHIPPING_CENTS
  const tax = currentTaxCents ?? 0

  cartSubtotal.textContent = currency.format(subtotal / 100)
  cartShipping.textContent = freeShippingOnly ? 'Free' : currency.format(shipping / 100)
  cartTax.textContent = currentTaxCents === null ? 'Address required' : currency.format(tax / 100)
  cartTotal.textContent = currency.format((subtotal + shipping + tax) / 100)
}

function getCartKey(id, size) {
  return size ? `${id}::${size}` : id
}

function getCartVariant(key) {
  const separator = key.lastIndexOf('::')
  const id = separator < 0 ? key : key.slice(0, separator)
  const size = separator < 0 ? undefined : key.slice(separator + 2)
  const product = products.find((item) => item.id === id)

  if (!product || (product.sizes
    ? !product.sizes.includes(size)
    : size !== undefined)) {
    throw new Error('The shopping bag contains an invalid product variant.')
  }
  return { product, size }
}

function getOrderItemsFromCart(entries) {
  return entries.map(([key, quantity]) => {
    const { product, size } = getCartVariant(key)
    return { id: product.id, ...(size ? { size } : {}), quantity }
  })
}

function showProductDetails(product, trigger) {
  lastProductTrigger = trigger
  const gallery = [{ image: product.image, alt: product.alt }, ...(product.gallery ?? [])]
  const descriptions = (product.details ?? [product.description])
    .map((paragraph) => `<p class="product-detail__description">${paragraph}</p>`)
    .join('')
  const features = product.features ? `
    <div class="product-detail__features">
      <h3>Features and Specifications</h3>
      <ul>${product.features.map((feature) => `<li>${feature}</li>`).join('')}</ul>
    </div>
  ` : ''
  const weight = product.weight ? `
    <div class="product-detail__features">
      <h3>Dimensions and weight</h3>
      <p>Weight: ${product.weight}</p>
    </div>
  ` : ''
  productDetailContent.innerHTML = `
    <div class="product-detail__image">
      ${productMedia(product, product.imageClass)}
      ${gallery.length > 1 ? `
        <div class="product-detail__thumbnails" role="group" aria-label="Product photos">
          ${gallery.map((image, index) => `
            <button
              class="product-detail__thumbnail${index === 0 ? ' is-active' : ''}"
              type="button"
              data-gallery-image="${image.image}"
              data-gallery-alt="${image.alt}"
              aria-label="View product photo ${index + 1}"
              aria-pressed="${index === 0}"
            >
              <img src="${image.image}" alt="" />
            </button>
          `).join('')}
        </div>
      ` : ''}
    </div>
    <div class="product-detail__copy">
      <p class="product-card__brand">${product.brand}</p>
      <h2 id="product-detail-title">${product.name}</h2>
      <p class="product-detail__price">${currency.format(product.priceInCents / 100)} <span>USD</span></p>
      ${descriptions}
      ${features}
      ${weight}
      ${product.sizes ? `
        <label class="product-detail__size-field" for="product-size">
          <span>${product.sizeLabel ?? (product.category === 'Shoes' ? 'Size (US)' : 'Size')}</span>
          <select id="product-size" data-size-select required>
            <option value="">Choose a size</option>
            ${product.sizes.map((size) => `<option value="${size}">${size}</option>`).join('')}
          </select>
        </label>
      ` : ''}
      <p class="product-detail__note">${product.shippingNote ?? 'U.S. shipping is $20 per order. Tax is calculated from your shipping address.'}</p>
      <button class="add-button" type="button" data-add="${product.id}" ${product.availableForSale && !product.sizes ? '' : 'disabled'}>
        ${product.availableForSale ? 'Add to bag' : 'Coming soon'} <span aria-hidden="true">${product.availableForSale ? '+' : '·'}</span>
      </button>
    </div>
  `
  productOverlay.hidden = false
  document.body.classList.add('product-open')
  productDetailClose.focus()
}

function hideProductDetails() {
  productOverlay.hidden = true
  document.body.classList.remove('product-open')
  lastProductTrigger?.focus()
}

function isPurchasableCart(entries) {
  return entries.length > 0 && entries.every(([key]) => {
    const { product } = getCartVariant(key)
    return product.availableForSale
  })
}

function getCheckoutAvailability() {
  if (!checkoutAvailabilityPromise) {
    checkoutAvailabilityPromise = fetch('/api/paypal/status')
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Unable to check checkout status.')
        return {
          paypalEnabled: result.paypalEnabled === true || result.checkoutEnabled === true,
          stripeEnabled: result.stripeEnabled === true,
        }
      })
      .catch((error) => {
        checkoutAvailabilityPromise = undefined
        throw error
      })
  }
  return checkoutAvailabilityPromise
}

function loadPayPalSdk() {
  if (window.paypal) return Promise.resolve(window.paypal)
  if (paypalSdkPromise) return paypalSdkPromise

  paypalSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(paypalClientId)}&currency=USD&intent=capture&components=buttons`
    script.async = true
    script.onload = () => window.paypal ? resolve(window.paypal) : reject(new Error('PayPal SDK did not initialize.'))
    script.onerror = () => reject(new Error('PayPal SDK could not be loaded.'))
    document.head.append(script)
  })

  return paypalSdkPromise
}

async function createPayPalOrder() {
  if (!shippingAddressForm.reportValidity()) {
    throw new Error('Complete your U.S. shipping address before continuing.')
  }

  const items = getOrderItemsFromCart([...cart.entries()])
  const address = Object.fromEntries(new FormData(shippingAddressForm).entries())
  const quoteKey = JSON.stringify({ items, address })
  if (!currentTaxQuoteToken || currentTaxQuoteKey !== quoteKey) {
    throw new Error('Please wait for the 6% sales tax quote before continuing.')
  }

  const response = await fetch('/api/paypal/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items,
      address,
      taxQuoteToken: currentTaxQuoteToken,
    }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Unable to start checkout.')
  if (typeof result.orderID !== 'string') throw new Error('PayPal did not return an order ID.')
  return result.orderID
}

async function capturePayPalOrder(orderID) {
  const response = await fetch('/api/paypal/capture-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderID }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Unable to confirm payment.')
  if (result.status !== 'COMPLETED') throw new Error('PayPal has not confirmed this payment.')
  return result
}

async function startStripeCheckout() {
  if (!shippingAddressForm.reportValidity()) {
    checkoutStatus.textContent = 'Complete your U.S. shipping address before continuing.'
    return
  }

  const items = getOrderItemsFromCart([...cart.entries()])
  const address = Object.fromEntries(new FormData(shippingAddressForm).entries())
  const quoteKey = JSON.stringify({ items, address })
  if (!currentTaxQuoteToken || currentTaxQuoteKey !== quoteKey) {
    checkoutStatus.textContent = 'Please wait for the 6% sales tax quote before continuing.'
    return
  }

  stripeCheckoutButton.disabled = true
  checkoutStatus.textContent = 'Preparing secure Stripe checkout…'
  try {
    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, address, taxQuoteToken: currentTaxQuoteToken }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Unable to start card checkout.')
    if (
      typeof result.url !== 'string'
      || new URL(result.url).origin !== 'https://checkout.stripe.com'
    ) throw new Error('Stripe returned an invalid checkout link.')

    try {
      sessionStorage.setItem('za-house-stripe-cart', JSON.stringify([...cart.entries()]))
    } catch (error) {
      console.warn('The cart could not be saved for Stripe checkout return.', error)
    }
    window.location.assign(result.url)
  } catch (error) {
    console.error('Stripe checkout could not be started.', error)
    checkoutStatus.textContent = error instanceof Error
      ? error.message
      : 'Unable to start card checkout. Please try again.'
    stripeCheckoutButton.disabled = false
  }
}

function renderPayPalButtons() {
  if (paypalButtonsRendered) return Promise.resolve()
  if (paypalButtonsPromise) return paypalButtonsPromise

  paypalButtonsPromise = loadPayPalSdk()
    .then((paypal) => {
      const buttons = paypal.Buttons({
        createOrder: createPayPalOrder,
        onApprove: async (data) => {
          checkoutStatus.textContent = 'Confirming your payment with PayPal…'
          try {
            const result = await capturePayPalOrder(data.orderID)
            cart.clear()
            renderCart()
            checkoutStatus.textContent = `Payment complete. PayPal confirmation: ${result.captureID}.`
          } catch (error) {
            console.error('PayPal payment capture failed.', error)
            checkoutStatus.textContent = error instanceof Error
              ? error.message
              : 'We could not confirm the payment. Check your PayPal activity or contact support before trying again.'
          }
        },
        onCancel: () => {
          checkoutStatus.textContent = 'Checkout was cancelled. No payment was completed.'
        },
        onError: () => {
          checkoutStatus.textContent = 'PayPal checkout encountered an error. Please try again.'
        },
      })

      return buttons.render(paypalButtonContainer)
    })
    .then(() => {
      paypalButtonsRendered = true
    })
    .catch((error) => {
      paypalButtonsPromise = undefined
      throw error
    })

  return paypalButtonsPromise
}

function updateCheckoutAvailability(entries) {
  taxQuoteCanRetry = false
  paypalButtonContainer.hidden = true
  stripeCheckoutButton.hidden = true
  stripeCheckoutButton.disabled = false
  checkoutUnavailable.hidden = false
  checkoutUnavailable.disabled = true
  shippingAddressForm.hidden = true

  if (entries.length === 0) {
    checkoutStatus.textContent = 'Add a product to get started.'
    return
  }

  if (!isPurchasableCart(entries)) {
    checkoutStatus.textContent = 'One or more items are coming soon and cannot be purchased yet.'
    return
  }

  checkoutStatus.textContent = 'Checking secure checkout options…'
  getCheckoutAvailability()
    .then(async (available) => {
      if (!isPurchasableCart([...cart.entries()])) return
      paypalEnabled = available.paypalEnabled && Boolean(paypalClientId)
      stripeEnabled = available.stripeEnabled
      if (!paypalEnabled && !stripeEnabled) {
        checkoutStatus.textContent = 'Secure checkout is not configured for this store yet. Please contact the store.'
        return
      }

      shippingAddressForm.hidden = false
      if (!shippingAddressForm.checkValidity()) {
        taxQuoteVersion += 1
        currentTaxCents = null
        currentTaxQuoteKey = ''
        currentTaxQuoteToken = ''
        taxQuoteInFlightKey = ''
        updateCartTotals()
        checkoutUnavailable.textContent = 'Complete shipping address'
        checkoutStatus.textContent = 'Enter a complete U.S. shipping address to calculate tax.'
        return
      }

      const items = getOrderItemsFromCart(entries)
      const address = Object.fromEntries(new FormData(shippingAddressForm).entries())
      const quoteKey = JSON.stringify({ items, address })
      if (currentTaxQuoteKey === quoteKey && currentTaxQuoteToken) {
        checkoutUnavailable.hidden = true
        paypalButtonContainer.hidden = !paypalEnabled
        stripeCheckoutButton.hidden = !stripeEnabled
        checkoutStatus.textContent = paypalEnabled && !stripeEnabled
          ? 'Sales tax calculated at 6%. PayPal is ready; Stripe is off. Choose PayPal to continue.'
          : 'Sales tax calculated at a flat 6%. Choose PayPal or secure card checkout.'
        if (paypalEnabled) {
          try {
            await renderPayPalButtons()
          } catch {
            paypalButtonContainer.hidden = true
            checkoutStatus.textContent = stripeEnabled
              ? 'PayPal could not load. You can still continue with secure card checkout.'
              : 'PayPal checkout could not be loaded. Please try again later.'
          }
        }
        return
      }

      if (taxQuoteInFlightKey === quoteKey) return

      const requestVersion = ++taxQuoteVersion
      taxQuoteInFlightKey = quoteKey
      taxQuoteCanRetry = false
      checkoutUnavailable.textContent = 'Calculating tax…'
      checkoutStatus.textContent = 'Calculating tax for this U.S. address…'
      try {
        const response = await fetch('/api/paypal/quote-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items, address }),
          signal: AbortSignal.timeout(12000),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || 'Unable to calculate tax.')
        if (
          !Number.isInteger(result.taxCents)
          || result.taxCents < 0
          || typeof result.taxQuoteToken !== 'string'
        ) throw new Error('The server returned an invalid sales tax quote.')
        if (requestVersion !== taxQuoteVersion) return

        currentTaxCents = result.taxCents
        currentTaxQuoteKey = quoteKey
        currentTaxQuoteToken = result.taxQuoteToken
        taxQuoteInFlightKey = ''
        taxQuoteCanRetry = false
        updateCartTotals(entries)
        checkoutUnavailable.hidden = true
        paypalButtonContainer.hidden = !paypalEnabled
        stripeCheckoutButton.hidden = !stripeEnabled
        checkoutStatus.textContent = paypalEnabled && !stripeEnabled
          ? 'Sales tax calculated at 6%. PayPal is ready; Stripe is off. Choose PayPal to continue.'
          : 'Sales tax calculated at a flat 6%. Choose PayPal or secure card checkout.'
        if (paypalEnabled) await renderPayPalButtons()
      } catch (error) {
        if (requestVersion !== taxQuoteVersion) return
        taxQuoteInFlightKey = ''
        taxQuoteCanRetry = true
        checkoutUnavailable.disabled = false
        checkoutUnavailable.textContent = 'Retry tax calculation'
        checkoutStatus.textContent = error?.name === 'TimeoutError' || error?.name === 'AbortError'
          ? 'Tax calculation took too long. Please try again.'
          : error instanceof Error
            ? error.message
            : 'Unable to calculate tax. Please check the address and try again.'
      }
    })
    .catch(() => {
      if (isPurchasableCart([...cart.entries()])) {
        checkoutStatus.textContent = 'Unable to check checkout availability. Please try again later.'
      }
    })
}

async function handleStripeReturn() {
  const params = new URLSearchParams(window.location.search)
  const sessionId = params.get('stripe_session_id')
  const cancelled = params.get('stripe_checkout') === 'cancelled'
  if (!sessionId && !cancelled) return

  showCart()
  let clearCheckoutQuery = cancelled
  if (cancelled) {
    try {
      const savedCart = JSON.parse(sessionStorage.getItem('za-house-stripe-cart') || '[]')
      if (Array.isArray(savedCart)) {
        for (const [key, quantity] of savedCart) {
          const { product } = getCartVariant(key)
          if (product.availableForSale && Number.isInteger(quantity) && quantity > 0 && quantity <= 99) {
            cart.set(key, quantity)
          }
        }
      }
    } catch (error) {
      console.warn('The previous cart could not be restored after Stripe cancellation.', error)
    }
    try {
      sessionStorage.removeItem('za-house-stripe-cart')
    } catch (error) {
      console.warn('The previous cart could not be cleared after Stripe cancellation.', error)
    }
    renderCart()
    checkoutStatus.textContent = 'Checkout was cancelled. No payment was completed.'
  } else {
    checkoutStatus.textContent = 'Confirming your payment with Stripe…'
    try {
      const response = await fetch(`/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to confirm the Stripe payment.')
      if (result.status !== 'paid' || typeof result.sessionId !== 'string') {
        throw new Error('Stripe has not confirmed this payment.')
      }
      cart.clear()
      try {
        sessionStorage.removeItem('za-house-stripe-cart')
      } catch (error) {
        console.warn('The previous cart could not be cleared after Stripe payment.', error)
      }
      renderCart()
      checkoutStatus.textContent = `Payment complete. Stripe confirmation: ${result.sessionId}.`
      clearCheckoutQuery = true
    } catch (error) {
      checkoutStatus.textContent = error instanceof Error
        ? error.message
        : 'We could not confirm the payment. Check your card activity or contact support before trying again.'
    }
  }

  if (!clearCheckoutQuery) return
  const cleanUrl = new URL(window.location.href)
  cleanUrl.searchParams.delete('stripe_session_id')
  cleanUrl.searchParams.delete('stripe_checkout')
  window.history.replaceState(null, '', `${cleanUrl.pathname}${cleanUrl.hash}`)
}

shippingAddressForm.addEventListener('input', () => {
  taxQuoteVersion += 1
  taxQuoteCanRetry = false
  currentTaxCents = null
  currentTaxQuoteKey = ''
  currentTaxQuoteToken = ''
  taxQuoteInFlightKey = ''
  paypalButtonContainer.hidden = true
  stripeCheckoutButton.hidden = true
  checkoutUnavailable.hidden = false
  checkoutUnavailable.textContent = 'Complete shipping address'
  updateCartTotals()
  checkoutStatus.textContent = 'Tax estimate will update for this address.'
  window.clearTimeout(taxQuoteTimer)
  taxQuoteTimer = window.setTimeout(() => updateCheckoutAvailability([...cart.entries()]), 400)
})

checkoutUnavailable.addEventListener('click', () => {
  if (!taxQuoteCanRetry) return
  taxQuoteCanRetry = false
  updateCheckoutAvailability([...cart.entries()])
})

function showCart() {
  cartOverlay.hidden = false
  document.body.classList.add('cart-open')
  closeCartButton.focus()
}

function hideCart() {
  cartOverlay.hidden = true
  document.body.classList.remove('cart-open')
  openCartButton.focus()
}

document.querySelector('#app').addEventListener('click', (event) => {
  const galleryButton = event.target.closest('[data-gallery-image]')
  if (galleryButton) {
    const mainImage = productDetailContent.querySelector('.product-card__visual img')
    mainImage.src = galleryButton.dataset.galleryImage
    mainImage.alt = galleryButton.dataset.galleryAlt
    productDetailContent.querySelectorAll('[data-gallery-image]').forEach((button) => {
      const selected = button === galleryButton
      button.classList.toggle('is-active', selected)
      button.setAttribute('aria-pressed', String(selected))
    })
    return
  }

  const productButton = event.target.closest('[data-product]')
  if (productButton) {
    const product = products.find((item) => item.id === productButton.dataset.product)
    if (product) showProductDetails(product, productButton)
    return
  }

  const categoryButton = event.target.closest('[data-category]')
  if (categoryButton) {
    activeCategory = categoryButton.dataset.category
    renderProducts()
    return
  }

  if (event.target.closest('#clear-filters')) {
    activeCategory = 'All products'
    searchQuery = ''
    productSearch.value = ''
    renderProducts()
    return
  }

  const addButton = event.target.closest('[data-add]')
  if (addButton) {
    const id = addButton.dataset.add
    const product = products.find((item) => item.id === id)
    if (!product) return
    if (product.sizes && !productDetailContent.contains(addButton)) {
      showProductDetails(product, addButton)
      return
    }

    const size = product.sizes
      ? productDetailContent.querySelector('[data-size-select]')?.value
      : undefined
    if (product.sizes && !product.sizes.includes(size)) {
      productDetailContent.querySelector('[data-size-select]')?.focus()
      return
    }

    const key = getCartKey(id, size)
    cart.set(key, (cart.get(key) || 0) + 1)
    renderCart()
    addButton.innerHTML = 'Added <span aria-hidden="true">&#10003;</span>'
    window.setTimeout(() => {
      if (addButton.isConnected) addButton.innerHTML = 'Add to bag <span aria-hidden="true">+</span>'
    }, 1200)
    return
  }

  const quantityButton = event.target.closest('[data-quantity]')
  if (quantityButton) {
    const id = quantityButton.dataset.quantity
    const quantity = (cart.get(id) || 0) + Number(quantityButton.dataset.delta)
    if (quantity <= 0) cart.delete(id)
    else cart.set(id, quantity)
    renderCart()
    return
  }

  const removeButton = event.target.closest('[data-remove]')
  if (removeButton) {
    cart.delete(removeButton.dataset.remove)
    renderCart()
    return
  }

  if (event.target.closest('[data-close-cart]')) hideCart()
  if (event.target.closest('[data-close-product]')) hideProductDetails()
})

document.querySelector('#app').addEventListener('change', (event) => {
  const sizeSelect = event.target.closest('[data-size-select]')
  if (!sizeSelect) return
  const addButton = productDetailContent.querySelector('[data-add]')
  if (addButton) addButton.disabled = !sizeSelect.value
})

productSearch.addEventListener('input', () => {
  searchQuery = productSearch.value
  if (searchQuery && window.location.hash !== '#vintage-wood') {
    window.location.hash = 'vintage-wood'
    return
  }
  renderProducts()
})
sortProducts.addEventListener('change', () => {
  sortOrder = sortProducts.value
  renderProducts()
})
openCartButton.addEventListener('click', showCart)
stripeCheckoutButton.addEventListener('click', startStripeCheckout)
window.addEventListener('hashchange', renderRoute)
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !productOverlay.hidden) {
    hideProductDetails()
    return
  }
  if (event.key === 'Escape' && !cartOverlay.hidden) {
    hideCart()
    return
  }

  if (event.key === 'Tab' && !productOverlay.hidden) {
    const focusableElements = [...document.querySelectorAll('#product-detail button:not([disabled])')]
    const firstElement = focusableElements[0]
    const lastElement = focusableElements.at(-1)

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
    return
  }

  if (event.key === 'Tab' && !cartOverlay.hidden) {
    const focusableElements = [...document.querySelectorAll('#cart-panel button:not([disabled]), #cart-panel iframe')]
    const firstElement = focusableElements[0]
    const lastElement = focusableElements.at(-1)

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }
})

renderProducts()
renderCart()
renderRoute()
handleStripeReturn()
