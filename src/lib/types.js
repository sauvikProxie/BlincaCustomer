/* Blinca – shared domain typedefs (JSDoc only, no runtime). */

/**
 * @typedef {Object} LocalizedText
 * @property {string} en
 * @property {string} sv
 */

/**
 * @typedef {Object} Cuisine
 * @property {string} id
 * @property {LocalizedText} name
 * @property {string} image
 */

/**
 * @typedef {Object} OptionChoice
 * @property {string} id
 * @property {LocalizedText} name
 * @property {number} price
 */

/**
 * @typedef {Object} OptionGroup
 * @property {string} id
 * @property {LocalizedText} name
 * @property {number} min
 * @property {number} max
 * @property {boolean} [variant]  the item's sizes: absolute prices, replaces the item price
 * @property {OptionChoice[]} choices
 */

/**
 * @typedef {Object} Dish
 * @property {string} id
 * @property {LocalizedText} name
 * @property {LocalizedText} desc
 * @property {number} price
 * @property {boolean} [from]  has sizes: `price` is the cheapest ("from")
 * @property {string[]} tags
 * @property {OptionGroup[]} options
 * @property {string|null} image
 */

/**
 * @typedef {Object} MenuCat
 * @property {string} id
 * @property {LocalizedText} name
 * @property {Dish[]} items
 */

/**
 * @typedef {Object} Restaurant
 * @property {string} slug
 * @property {string} name
 * @property {boolean} listed
 * @property {string[]} cuisines
 * @property {number} priceLevel
 * @property {number} rating
 * @property {number} reviews
 * @property {number} fee
 * @property {number} eta
 * @property {number} pickupEta
 * @property {boolean} veg
 * @property {string} status
 * @property {string} closesAt
 * @property {string} opensAt
 * @property {string} address
 * @property {string} [postalCode]
 * @property {string} [city]
 * @property {Array<string[]|null>} hours Mon..Sun `[open, close]`; null = closed
 * @property {{ date: string, ranges: string[][] }[]} [specialDays] Date overrides (empty ranges = closed)
 * @property {string} image
 * @property {number} [minOrder]
 * @property {number} [km]
 * @property {string[]} [popular]
 * @property {MenuCat[]} menu
 */

/**
 * @typedef {Object} OfferRule
 * @property {string} type
 * @property {number} [min]
 * @property {number} [value]
 * @property {number} [weekday]
 * @property {number} [untilHour]
 */

/**
 * @typedef {Object} Offer
 * @property {string} code
 * @property {string} theme
 * @property {string} image
 * @property {OfferRule} rule
 * @property {LocalizedText} title
 * @property {LocalizedText} text
 */

/**
 * @typedef {Object} Address
 * @property {string} id
 * @property {string} label
 * @property {string} street
 * @property {string} zip
 * @property {string} city
 * @property {boolean} [deliverable]
 * @property {number} [extraEta]
 */

/**
 * @typedef {Object} CartLine
 * @property {string} key
 * @property {string} slug
 * @property {string} itemId
 * @property {Record<string, string[]>} opts
 * @property {number} qty
 * @property {string} [note]
 */

/**
 * @typedef {Object} OrderItem
 * @property {string} itemId
 * @property {Record<string, string[]>} opts
 * @property {number} qty
 */

/**
 * @typedef {Object} Order
 * @property {string} id
 * @property {string} slug
 * @property {string} date
 * @property {number} amount
 * @property {number} [total]
 * @property {string} [mode]
 * @property {OrderItem[]} items
 */

/**
 * @typedef {Object} Mood
 * @property {string} id
 * @property {string} icon
 * @property {string} image
 * @property {string[]} cuisines
 * @property {LocalizedText} name
 * @property {LocalizedText} text
 */

/**
 * @typedef {Object} SiteData
 * @property {Record<string, string>} images
 * @property {Cuisine[]} cuisines
 * @property {Restaurant[]} restaurants
 * @property {Address[]} addresses
 * @property {any[]} heroSlides
 * @property {Offer[]} offers
 * @property {string[][]} popular
 * @property {any[][]} trending
 * @property {Mood[]} moods
 * @property {{ address: string, favorites: string[], cart: any[], orders: Order[] }} seed
 * @property {number} vatRate
 */

/**
 * @typedef {Object} User
 * @property {string} name
 * @property {string} email
 * @property {string} phone
 */

/**
 * @typedef {Object} Pricing
 * @property {Restaurant|null} r
 * @property {number} sub
 * @property {number} fee
 * @property {number} discount
 * @property {number} total
 * @property {number} vat
 * @property {number|null} min   Zone/restaurant minimum from the preview; null until one is known
 * @property {{ code: string, valid: boolean, msg: string, label?: string }|null} promo
 * @property {string} mode
 * @property {boolean} [loading]  Real mode: this cart has never been priced; numbers are 0
 * @property {boolean} [stale]  Real mode: the numbers are the previous preview, a fresh one is loading
 * @property {any} [view]  Real mode: the checkout.preview answer (issues, slots, asapPossible)
 */

export {};
