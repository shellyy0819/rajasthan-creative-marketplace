const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const PRICE_ON_REQUEST = 'Price on request';
/** Products may have no price; show "Price on request" instead of a number. */
export const money = (paise: number | null | undefined) => (paise == null ? PRICE_ON_REQUEST : fmt.format(paise / 100));
