// Configuration for the automatic content filter.
//
// Every pattern in this file is an "I would like a human to have another
// look at this post" signal, not a "delete it" signal. Posts that match
// any pattern are held for review with a visible banner; the community
// can still see, rate, and flag them.
//
// Add, remove, or tighten patterns here rather than in filter.ts - the
// filter function is deliberately dumb and just walks this list.

export const FILTER_CONFIG = {
  // --- Cryptocurrency wallet address patterns -------------------------
  // Matching these is inherently imperfect: a regex for Solana addresses
  // will false-positive on any base58-looking string. We only include
  // patterns that are strict enough to rarely fire on prose.
  cryptoPatterns: [
    // Bitcoin: legacy (1...), P2SH (3...), bech32 (bc1...)
    /\b(bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/,
    // Ethereum: 0x followed by 40 hex
    /\b0x[a-fA-F0-9]{40}\b/,
    // NB: Solana base58 is intentionally not matched here - the pattern
    // false-positives on arbitrary strings. Add it in future with a
    // "solana:" scheme match or a contextual keyword requirement.
  ],

  // --- Payment / tipping / solicitation domains -----------------------
  // A URL with any of these hostnames (or subdomains of them) in a post
  // trips the filter. Hostnames are compared case-insensitively on the
  // full authority - so `paypal.me` and `pay.paypal.me` both match
  // `paypal.me` but `unrelated-paypal.me.example.com` does not.
  paymentDomains: [
    'stripe.com',
    'paypal.me',
    'paypal.com/donate',
    'ko-fi.com',
    'patreon.com',
    'buymeacoffee.com',
    'gofundme.com',
    'cash.app',
    'venmo.com',
    'tip.cc',
    'throne.me',
  ],

  // --- Affiliate link parameter patterns ------------------------------
  // These are the most common affiliate tracking parameters. A URL
  // whose query string contains any of these keys is flagged.
  affiliateParams: [
    'ref',
    'referral',
    'aff',
    'affiliate',
    'partner',
    'tag',      // Amazon affiliate tag
    'utm_affiliate',
  ],

  // --- Promotional language patterns ----------------------------------
  // Case-insensitive substring matches inside the post content. If you
  // add a pattern here, add a test case in scripts/test-brigading.ts or
  // similar so regressions are caught.
  promotionalPhrases: [
    'dm me',
    'check my bio',
    'click my profile',
    'link in bio',
    'buy now',
    'limited offer',
    'discount code',
    'promo code',
  ],

  // --- Known-spam domains ---------------------------------------------
  // Add hostnames here that have a track record of being used purely
  // for monetisation / link-spam. Kept as a configurable list so future
  // maintainers can update it without redeploying new code.
  spamDomains: [] as string[],

  // --- New-account link limit -----------------------------------------
  // Accounts younger than newAccountDays may post this many external
  // links per post before the filter trips.
  newAccountDays: 7,
  newAccountMaxLinks: 3,

  // --- Duplicate detection --------------------------------------------
  // How far back we look for identical content from the same author.
  duplicateWindowHours: 24,
  // Max identical copies before the next one trips. Spec says "more
  // than twice in 24 hours" so the third trips.
  duplicateMaxCopies: 2,
}

// Filter trigger reasons. These strings are stored in posts.hold_reasons
// and logged to flags.reason, so keep them stable.
export const FILTER_REASONS = {
  CRYPTO_ADDRESS: 'crypto_address',
  PAYMENT_LINK: 'payment_link',
  AFFILIATE_LINK: 'affiliate_link',
  PROMOTIONAL_LANGUAGE: 'promotional_language',
  DUPLICATE_CONTENT: 'duplicate_content',
  NEW_ACCOUNT_MANY_LINKS: 'new_account_many_links',
  SPAM_DOMAIN: 'spam_domain',
} as const

export type FilterReason = (typeof FILTER_REASONS)[keyof typeof FILTER_REASONS]
