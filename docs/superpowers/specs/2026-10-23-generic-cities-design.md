# Generic cities: design

Part 1 of 3. Part 2 is the location hero (city picker, remembered city, "use my location"). Part 3 is the USP copy rewrite. This part is the foundation for both.

## Intent and why

Craftology's positioning: local makers in any city, reached directly, no commission, no payments on the site. Launch focus is Rajasthan, but the platform must work for any city in India. Today the cities Udaipur, Jaipur and Jodhpur are hardcoded in one constant (`CITIES` in `src/lib/catalog-shared.ts`) and read in about ten places. A maker in Kota cannot post. This change removes the constant so any Indian city is valid.

## Goals

- Any city in India is a valid city for a product, workshop, artist profile, or user profile. All of these reference the same `cities` table; none is free text.
- Makers choose their city by searching, not from a fixed dropdown. Reuse the existing India place search (`src/lib/places.ts`, `/api/places`, `PlaceInput`).
- A city is stored as name plus state, so Udaipur (Rajasthan) and Udaipur (Tripura) are different cities.
- `/cities/<slug>` works for any city. City pages, footer links, the home page link row, and the sitemap list only cities that have at least one product, workshop, or artist, so lists never show empty cities.
- `/cities/<slug>` exists only for cities that have at least one product, workshop, or artist; any other city returns 404. A visitor whose city has no makers sees the empty-state message on the homepage instead (see Decisions). No page is generated for cities nobody has posted in.
- Existing Udaipur, Jaipur and Jodhpur data is migrated to the new shape with no visible loss.

## Non-goals

- No admin approval step for cities. (Decided with the product owner.)
- No shipping or cross-country selling.
- No location detection, remembered city, or hero changes. That is part 2.
- No copy or messaging rewrite. That is part 3. Hardcoded "Udaipur, Jaipur and Jodhpur" strings in descriptions (site.ts, shop page, workshops page) are only made generic enough not to be wrong; final wording is part 3.

## Anti-goals

- Typos or near-duplicates creating junk cities ("Udaipure"). Picking from search results is how this is avoided; free typing must not create a city.
- Existing city URLs (`/cities/udaipur`) breaking or losing search ranking.
- An empty city page that looks broken.

## Decisions (the product owner's, as decided)

- All Indian cities are valid. There is no curated or approved list.
- A visitor in a city with no makers sees a message like "Right now we don't have anything for you to shop at, but you can still explore nearby cities' shops and workshops", followed by makers from the nearest cities that have some. This message appears on the homepage, not on a city page. Part 2 wires the visitor's chosen city to it; this part supplies the "nearest cities with makers" lookup and the message component.
- A city page is not generated for a city with no makers (product owner accepted the recommendation: avoids junk pages and thin search results).

## Calls made by me (the author), to check

- **City identity is name plus state.** Slug is built from both where needed (e.g. `udaipur` stays for Rajasthan to keep existing URLs; a second Udaipur would become `udaipur-tripura`).
- **Coordinates are stored per city** (latitude, longitude), taken from the place search result. They are needed for "nearest city with makers" here and for location matching in part 2.
- **A `cities` table** (id, name, state, slug, lat, lng) holds every city that has ever been used. Products, workshops, and artist profiles reference it. Rows are created when a maker first selects a new city from search results. This is not an approval list; it is a normalized record of cities in use.
- **Listing surfaces show only cities with content.** Direct URLs work only for a city that has content; any other city returns 404.
- **Migration** creates `cities` rows for Udaipur, Jaipur and Jodhpur (state Rajasthan) and converts existing text city values on products, workshops, seller profiles and users.
- **Shop and workshop filters** change from a fixed dropdown to the list of cities that have content.
- **Place search outage:** if the geocoder is down, the post form shows an error and keeps the maker's previous city rather than accepting free text.

## More calls made by me (from the builder check), to check

- **Accepted place types:** city, town and village results from the place search (not states, districts, or neighbourhoods). The OSM id from the result is stored on the `cities` row and is the uniqueness key, so spelling variants (Bengaluru/Bangalore) resolve to one city. The display name is whatever the search returned.
- **Existing city values** other than the three known cities: trim, match case-insensitively, and create a `cities` row for each distinct value (no coordinates until a maker re-selects). Blank values become null. The migration does not fail on unknown values.
- **Every city field links to the `cities` table, not free text:** products, workshops, `seller_profiles.city`, the artist `bio_city`, and `users.city`. Profile forms use the same city search as the post form. (Product owner's decision.) Part 2 can store a visitor's remembered city by pointing at the same table; nothing in this part decides how a signed-out visitor's choice is saved.
- **Slugs:** the three existing cities keep their bare slugs (`udaipur`, `jaipur`, `jodhpur`). For any later city, the first one to claim a bare slug keeps it; a namesake gets `<name>-<state>`.
- **Nearest cities:** up to 5 cities that have content, within 300 km, nearest first. If none are within 300 km, the empty state shows all cities that have content instead.
- **Old filter URLs:** `?city=Udaipur` and `?city=udaipur` keep working (matched by name or slug).

## Constraints

- Next.js in this repo has breaking changes from standard Next.js. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code (see AGENTS.md).
- Drizzle migrations live in `drizzle/`; the latest is `0008_artist_bio_city.sql`.
- Existing tests under `tests/` cover catalog, filters, places and admin; they must be updated, not deleted.
- The Photon geocoder is fair-use only; keep the existing cache and rate behavior.
- Follow the project's design tokens and control sizing (see the `rang-rajasthan-design` skill) for any new UI.

## Left to the builder

- Exact schema, column types, indexes, and the migration approach for existing rows.
- Slug collision rules beyond the example above.
- How "nearest cities" is computed (simple distance over cities with content is fine).
- Test strategy and the order of changes.

## Places that read the hardcoded list today

Validation: `src/lib/admin.ts`, `src/lib/filters.ts`. Forms and dropdowns: `src/components/PostForm.tsx`, `src/components/LiveCatalog.tsx`. Routing and listings: `src/app/cities/[city]/page.tsx`, `src/app/page.tsx`, `src/components/Footer.tsx`, `src/app/sitemap.ts`. Definition: `src/lib/catalog-shared.ts`, re-exported from `src/lib/catalog.ts`.
