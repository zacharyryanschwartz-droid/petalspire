// Book promos for the bottom banner. Add a future book by appending one entry.
// BOOKS_PROMO_ENABLED is the only switch: false takes every book out of the rotation.
export const BOOKS_PROMO_ENABLED = true;

export const BOOKS = [
  { title: 'Love Bug Critters', url: 'https://a.co/d/040I747u' },
];

export const BOOK_PROMO_LINE = 'Buy any Schwarze Spiele book for bonus Petalspire content';

/** Books currently allowed in the banner. Empty while the promo is off. */
export function promoBooks() {
  if (!BOOKS_PROMO_ENABLED) return [];
  return BOOKS.filter((b) => b && b.title && b.url);
}
