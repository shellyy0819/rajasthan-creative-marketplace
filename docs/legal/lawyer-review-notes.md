# Craftofy legal drafts: notes for counsel

Drafts: `src/app/terms/page.tsx` and `src/app/privacy/page.tsx` (routes `/terms`, `/privacy`). Both are `noindex`, marked DRAFT on the page, **not linked from the footer** and **not in the sitemap**. Anything in [square brackets] is open.

## What the product does (facts the drafts rely on)
- Marketplace in India. **Craftofy takes no payments.** Shoppers contact makers (phone, email, Instagram, YouTube, website, WhatsApp, as each maker chooses) and pay them directly. No commission.
- Only makers (and admins) sign in, with Google. Shoppers do not need an account.
- Maker onboarding: full name, mobile, brand name, city, category, description, optional logo, contact options. Becomes a seller immediately, no approval to join. Products start as drafts; an admin publishes them. Sellers cannot publish or delete. After onboarding a seller cannot edit their profile; their public email is fixed to their registration email.
- Workshops/pop-ups: hosts write to us, an admin lists them. Attendees "Reserve spot" (name, email, seats, note). Free or paid, paid directly to the host.
- An orders/cart feature exists in the code but is switched off.
- Data stores: Postgres (host/region: TBC), S3 for images, Vercel hosting, Google sign-in, GA4 with a consent banner.
- Visitor cookie `rr_vid` (1 year, HttpOnly) for likes; first-party view/contact counts use a daily-salted hash of IP + user agent (IP/UA not stored).

## Questions for counsel
1. Entity name, registered address, governing-law city, grievance officer details.
2. Is Craftofy a "marketplace e-commerce entity" under the Consumer Protection (E-Commerce) Rules, 2020 although it takes no payments? If so: seller details display, grievance redressal timelines, no unfair terms.
3. Intermediary status and safe harbour under the IT Act 2000 s.79 and the IT (Intermediary Guidelines) Rules, 2021: required notices, takedown and grievance timelines.
4. DPDP Act 2023 / Rules: consent notice wording, lawful-use basis, children (under-18 shoppers/attendees), retention periods, cross-border transfer, rights handling and breach notification.
5. Is a sign-in-only maker model enough, or do we need explicit acceptance of the Terms at onboarding (checkbox + versioned record)? Recommended; not built yet.
6. Content licence scope and duration, indemnity, limit of liability amount, prohibited-items list, arbitration.
7. GST and other tax statements for makers; any licence needed for food, cosmetics, textiles, etc.
8. Workshop hosts: insurance, safety, minors, refund expectations.
9. Trademark: file for "Craftofy" (name and logo). Use ™ until registered.

## To do after approval
- Fill the brackets, remove the draft banner and `noindex`, add `/terms` and `/privacy` to the footer and sitemap.
- Restore the "Cookie settings" link in the footer (currently commented out) so the privacy policy's "change your choice" statement is true.
- Add an acceptance checkbox to maker onboarding and to the booking dialog.
