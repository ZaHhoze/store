import './style.css'

document.querySelector('#app').innerHTML = `
  <div class="announcement">
    <span>New season. New perspective.</span>
    <span class="announcement__date">Arriving Winter 2026</span>
  </div>

  <header class="site-header">
    <a class="wordmark" href="#home" aria-label="za.house home"><span>za</span><i>.</i><small>house</small></a>
    <nav class="site-nav" aria-label="Main navigation">
      <a href="#living">Living</a>
      <a href="#style">Style</a>
      <a href="#objects">Objects</a>
    </nav>
    <a class="header-cta" href="#waitlist">Join the list <span aria-hidden="true">&#8599;</span></a>
  </header>

  <main id="home">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero__copy">
        <p class="eyebrow"><span class="eyebrow__line"></span> The house of considered living</p>
        <h1 id="hero-title">A life,<br />well <em>considered.</em></h1>
        <p class="hero__intro">More than what you wear. A point of view on how you live, what you choose, and the details that make it yours.</p>
        <a class="text-link" href="#collections">Discover the house <span aria-hidden="true">&#8595;</span></a>
        <div class="hero__edition"><span>01 / 03</span><span>Orlando, Florida</span></div>
      </div>
      <div class="hero__image-wrap">
        <img class="hero__image" src="/images/poai-leather-jacket.jpeg" alt="Black leather POAI jacket from the Winter 2026 collection" fetchpriority="high" />
        <div class="hero__image-note"><span>01</span><span>Wear your point of view</span></div>
        <span class="hero__seal" aria-hidden="true">ZA<br />HOUSE</span>
      </div>
      <div class="hero__caption"><span>Wear it like you mean it.</span><span>Winter 2026 / Collection one</span></div>
    </section>

    <section class="manifesto" id="collections" aria-labelledby="manifesto-title">
      <p class="eyebrow eyebrow--dark"><span class="eyebrow__line"></span> One house. Three expressions.</p>
      <h2 id="manifesto-title">How you live. What you wear.<br /><em>How you shine.</em></h2>
      <p class="manifesto__copy">Objects with presence. Pieces with a story. A softer kind of statement, made for the way you move through the world.</p>
    </section>

    <section class="collections" aria-label="Shop the collections">
      <a class="collection collection--living" id="living" href="#waitlist">
        <div class="collection__image"><img src="/images/dining-room.jpeg" alt="A warm, sculptural dining room made for gathering" loading="lazy" /></div>
        <div class="collection__details"><div><span class="collection__number">01</span><h3>Living</h3><p>Make room for the good life.</p></div><span class="collection__arrow" aria-hidden="true">&#8599;</span></div>
        <span class="collection__descriptor">Furnishings &amp; home</span>
      </a>
      <a class="collection collection--style" id="style" href="#waitlist">
        <div class="collection__image"><img src="/images/poai-leather-jacket.jpeg" alt="POAI black leather jacket, a statement piece from the collection" loading="lazy" /></div>
        <div class="collection__details"><div><span class="collection__number">02</span><h3>Style</h3><p>Wear the feeling.</p></div><span class="collection__arrow" aria-hidden="true">&#8599;</span></div>
        <span class="collection__descriptor">Fashion with a point of view</span>
      </a>
      <a class="collection collection--objects" id="objects" href="#waitlist">
        <div class="collection__image"><img src="/images/sunglasses.jpeg" alt="Sculptural black sunglasses from the accessories collection" loading="lazy" /></div>
        <div class="collection__details"><div><span class="collection__number">03</span><h3>Objects</h3><p>Find your finishing touch.</p></div><span class="collection__arrow" aria-hidden="true">&#8599;</span></div>
        <span class="collection__descriptor">Accessories &amp; the details</span>
      </a>
    </section>

    <section class="waitlist" id="waitlist" aria-labelledby="waitlist-title">
      <div class="waitlist__left">
        <p class="eyebrow"><span class="eyebrow__line"></span> First to the house</p>
        <h2 id="waitlist-title">Be here<br />for the <em>beginning.</em></h2>
        <p class="waitlist__copy">The first collection arrives Winter 2026. Join the list for a first look, early access, and a place at the table.</p>
      </div>
      <div class="waitlist__right">
        <form class="waitlist-form" id="waitlist-form">
          <label for="email-address">Your email address</label>
          <div class="waitlist-form__field">
            <input id="email-address" name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
            <button type="submit" aria-label="Join the waitlist">Join <span aria-hidden="true">&#8594;</span></button>
          </div>
          <p class="waitlist-form__note" id="waitlist-status" aria-live="polite">A note from us, only when it matters.</p>
        </form>
        <div class="waitlist__stamp"><span>THE FIRST<br />EDITION</span><b>W</b><span>WINTER<br />2026</span></div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="footer__brand"><a class="wordmark wordmark--footer" href="#home" aria-label="za.house home"><span>za</span><i>.</i><small>house</small></a><p>Live beautifully.<br />Wear your point of view.</p></div>
    <div class="footer__contact"><span class="footer__label">Visit the house</span><a href="https://maps.google.com/?q=5205+Edgewater+Dr,+Orlando,+FL+32810" target="_blank" rel="noreferrer">5205 Edgewater Dr<br />Orlando, FL 32810 <span aria-hidden="true">&#8599;</span></a></div>
    <div class="footer__contact"><span class="footer__label">Get in touch</span><a href="mailto:info@za.house">info@za.house</a><a href="tel:+16197966346">619.796.6346</a></div>
    <div class="footer__bottom"><span>&copy; 2026 za.house. All rights reserved.</span><a href="#home">Back to top &#8593;</a><span>Made for the way you live.</span></div>
  </footer>
`

const waitlistForm = document.querySelector('#waitlist-form')
const waitlistStatus = document.querySelector('#waitlist-status')

waitlistForm.addEventListener('submit', (event) => {
  event.preventDefault()

  const email = new FormData(waitlistForm).get('email')
  const subject = encodeURIComponent('Winter 2026 waitlist')
  const body = encodeURIComponent(`Please add ${email} to the shop.za.house Winter 2026 waitlist.`)
  const emailLink = document.createElement('a')

  emailLink.href = `mailto:info@za.house?subject=${subject}&body=${body}`
  emailLink.textContent = 'Tap here to email your request.'
  waitlistStatus.replaceChildren('Your email app will open with your request. ', emailLink)
})
