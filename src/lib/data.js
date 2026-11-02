/* Blinca – static data.
   Real static content: images, cuisines, hero slides, moods, VAT. Offers are not static: real mode reads promos, design-check uses data.dev.js.
   Demo restaurants, menus and seed state live in data.dev.js (dev only).
   Images are the self-hosted files under /img/food/ (see F below); an image
   that fails to load falls back to the plate placeholder automatically. */

  /** @param {string} n @returns {string} */
  var F = function (n) { return '/img/food/' + n + '.jpg'; };
  var IMG = {
    pizza: F('pizza'), pizza2: F('pizza'), sushi: F('sushi'), sushi2: F('hero-sushi'),
    burger: F('hero-burger'), burger2: F('burgers'), burger3: F('burgers'), thai: F('thai'),
    vegan: F('vegan'), kebab: F('kebab'), falafel: F('kebab'), fika: F('fika'), healthy: F('healthy'),
    offer1: F('offer1'), offer2: F('offer2'), offer3: F('offer3')
  };


  /* ---------- Cuisines ---------- */
  var cuisines = [
    { id: 'pizza',   name: { en: 'Pizza',   sv: 'Pizza' },      image: IMG.pizza },
    { id: 'sushi',   name: { en: 'Sushi',   sv: 'Sushi' },      image: IMG.sushi },
    { id: 'burgers', name: { en: 'Burgers', sv: 'Hamburgare' }, image: IMG.burger3 },
    { id: 'thai',    name: { en: 'Thai',    sv: 'Thai' },       image: IMG.thai },
    { id: 'vegan',   name: { en: 'Vegan',   sv: 'Veganskt' },   image: IMG.vegan },
    { id: 'kebab',   name: { en: 'Kebab',   sv: 'Kebab' },      image: IMG.kebab },
    { id: 'fika',    name: { en: 'Fika',    sv: 'Fika' },       image: IMG.fika },
    { id: 'healthy', name: { en: 'Healthy', sv: 'Nyttigt' },    image: IMG.healthy },
    { id: 'italian', name: { en: 'Italian', sv: 'Italienskt' }, image: '/food/pasta-2-400.webp' },
    { id: 'indian',  name: { en: 'Indian',  sv: 'Indiskt' },    image: '/food/curry-1-400.webp' },
    { id: 'mexican', name: { en: 'Mexican', sv: 'Mexikanskt' }, image: '/food/tacos-1-400.webp' },
    { id: 'ramen',   name: { en: 'Ramen',   sv: 'Ramen' },      image: '/food/ramen-1-400.webp' }
  ];



  /* ---------- Home page content ---------- */
  var heroSlides = [
    { theme: 'red', image: IMG.burger,
      title: { en: 'Free delivery on your first order', sv: 'Fri leverans på din första beställning' },
      text:  { en: 'Hungry? On it. Sign up and your first delivery from any kitchen is on us.',
               sv: 'Hungrig? Vi fixar det. Skapa ett konto så bjuder vi på din första leverans, från vilket kök som helst.' } },
    { theme: 'dark', image: IMG.sushi2,
      title: { en: '20% off at Kumo Sushi until 3 pm', sv: '20 % rabatt på Kumo Sushi till kl. 15' },
      text:  { en: 'Salmon rolls, nigiri and poke bowls – order before 3 pm.',
               sv: 'Laxrullar, nigiri och pokebowls – beställ före kl. 15.' } },
    { theme: 'pink', image: IMG.fika,
      title: { en: 'Fika for two, every afternoon', sv: 'Fika för två, varje eftermiddag' },
      text:  { en: 'Two coffees and two cinnamon buns for 79 kr between 2 and 5 pm.',
               sv: 'Två kaffe och två kanelbullar för 79 kr mellan kl. 14 och 17.' } }
  ];

  var moods = [
    { id: 'comfort', icon: 'flame', image: IMG.burger2, cuisines: ['burgers', 'pizza', 'kebab', 'mexican'],
      name: { en: 'Comfort food', sv: 'Husmanskänsla' }, text: { en: 'Burgers, pizza, kebab', sv: 'Burgare, pizza, kebab' } },
    { id: 'light', icon: 'leaf', image: IMG.healthy, cuisines: ['vegan', 'healthy'],
      name: { en: 'Light & fresh', sv: 'Lätt & fräscht' }, text: { en: 'Bowls, salads, vegan', sv: 'Bowls, sallader, veganskt' } },
    { id: 'treat', icon: 'star', image: IMG.sushi, cuisines: ['sushi', 'thai', 'indian', 'ramen', 'italian'],
      name: { en: 'Treat yourself', sv: 'Unna dig' }, text: { en: 'Sushi, Thai & chef’s picks', sv: 'Sushi, thai & kockens val' } },
    { id: 'fika', icon: 'heart', image: IMG.fika, cuisines: ['fika'],
      name: { en: 'Fika break', sv: 'Fikapaus' }, text: { en: 'Coffee, buns & sweets', sv: 'Kaffe, bullar & sött' } }
  ];




const vatRate = 0.12;
/** Static content real mode still needs (images, cuisines, hero, moods, VAT). */
/** @type {import('./types.js').SiteData} */
const STATIC = {
  images: IMG,
  cuisines,
  restaurants: [],
  addresses: [],
  heroSlides,
  offers: [],
  popular: [],
  trending: [],
  moods,
  seed: { address: '', favorites: [], cart: [], orders: [] },
  vatRate
};

/** Demo restaurants and seed state: dev only. The dynamic import sits in a branch Vite removes from production builds, so data.dev.js is never bundled. */
/** @type {import('./types.js').SiteData} */
export const DATA = import.meta.env.DEV ? { ...STATIC, ...(await import('./data.dev.js')).devData(IMG) } : STATIC;
