# Seller Self-Signup Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A maker signs in with Google from the navbar, completes a two-step onboarding, becomes a seller immediately, and lands on `/dashboard/posts` with the new-product form open.

**Architecture:** One public route `/sell` (server page) decides what to show: welcome for signed-out, the wizard for roleless accounts, a redirect to the dashboard for sellers and admins. A client wizard posts once to `POST /api/onboarding`, which validates (`src/lib/onboarding.ts`) and, in one transaction, grants the seller role and saves the profile. New profile columns come from migration 0013. Everything else reuses existing components (`CityInput`, `PostsAdmin`, `PostForm`, `validate.ts`, `phone.ts`, rate limiter).

**Tech Stack:** Next.js (breaking-change version, see constraints), next-auth (Google, JWT), drizzle + Postgres (PGlite in tests), Vitest + testing-library, TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-07-seller-onboarding-design.md`. Read it first. Design canvas: claude.ai/artifact/FNKqzec7x2GTnskZSWb5b5 (boards 1 to 5). Entry-point mock: claude.ai/artifact/KcYZpjEFKoq41JrBoFtjXo (option B).

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing routing, page or proxy code (`AGENTS.md`). Interception file is `src/proxy.ts`, not `middleware.ts`.
- Use the `rang-rajasthan-design` skill rules for every new UI piece. Font DM Sans; tokens from `src/app/globals.css` only.
- Seller-versus-admin restrictions must not change: sellers cannot set APPROVED, cannot delete, see no seller picker, never see seller emails; seller products stay DRAFT.
- Google is the only provider. Only a verified Google email (`email_verified === true`) can onboard. Deactivated users never get a role.
- Role is granted at Finish (not Step 1), in the same transaction as the profile save.
- Field limits: full name max 100; brand name max 100; description required, max 200 (profile dialog keeps 500); website max 200, http or https only; mobile is a valid Indian mobile per `PHONE_RE = /^(?:\+?91|0)?[6-9]\d{9}$/` stored normalised via `normalizePhone`.
- Logo: JPG or PNG, at least 400 by 400, max 5 MiB (`MAX_IMAGE_BYTES`), required.
- Contact methods: subset of `whatsapp | instagram | website | phone`, at least one; WhatsApp needs a valid number (defaults to mobile via "Same as my mobile number"); Phone uses the mobile number; Instagram and Website need their value.
- Exact copy: "Enter a 10-digit mobile number."; "Add an Instagram handle or a website."; "Choose at least one way for customers to reach you."; nav link "Are you a seller? Login here" (phones: "Seller login"); green strip text unchanged "Handmade, direct from the maker".
- Errors appear next to the field with `aria-invalid` and `aria-describedby`, same messages client and server, page scrolls to the first error.
- New profile fields (logo, website, WhatsApp, category, contact methods) are stored only; no public page renders them in this release.
- Split-host mode: any redirect to `/dashboard/*` is absolute via `hostConfig().dashboardOrigin`; sign-in starts on the public host.
- Migrations via `npm run db:generate` (next is `0013`). Tests: `npm test` (Vitest, PGlite applies all migrations).
- Work on top of the current uncommitted seller-login-entry changes (`AuthButton.tsx`, `Header.tsx`, `Footer.tsx`, `admin-page.ts` and tests). Do not revert them.

## Review Focus

1. Double-tap on "Finish": two concurrent submits must create one role row and one profile, second returns ok (test in Task 3).
2. Mobile typed as `+91 98765 43210`, `098765 43210`, or with spaces and dashes: accepted and stored as the same normalised value; `12345` rejected (Task 2).
3. Whitespace-only name, brand name or description counts as empty (Task 2).
4. Session expires mid-wizard: the submit returns 401, the client sends the user back to sign-in and keeps their draft (Tasks 4 and 8).
5. Google account with no display name or a deactivated account: no crash, no role granted, clear message (Task 3).

---

### Task 1: Schema and migration for new profile fields

**Files:**
- Modify: `src/db/schema.ts` (`seller_profiles` table), `src/lib/types.ts` (`SellerProfile`)
- Create: `drizzle/0013_<name>.sql` (generated), `drizzle/meta/*` (generated)
- Test: `tests/db-schema.test.ts`

**Interfaces:**
- Produces: `seller_profiles` columns `website text`, `category text`, `logo_url text`, `whatsapp text`, `contact_methods text[] not null default '{}'`, `onboarded_at timestamptz`; migration backfills `onboarded_at = now()` for all existing rows. `SellerProfile` gains optional `website, category, logoUrl, whatsapp, contactMethods: ContactMethod[], onboardedAt`. Export `type ContactMethod = 'whatsapp' | 'instagram' | 'website' | 'phone'` from `src/lib/types.ts`.

- [ ] **Step 1: Write the failing test** in `tests/db-schema.test.ts`: `seller_profiles has onboarding columns` asserts the six columns exist (query `information_schema.columns`), and `existing profiles are backfilled as onboarded` inserts a profile via the pre-migration seed fixture and asserts `onboarded_at` is not null.
- [ ] **Step 2: Run** `npx vitest run tests/db-schema.test.ts` and confirm both fail.
- [ ] **Step 3: Edit the schema, run `npm run db:generate`, then append the backfill `UPDATE seller_profiles SET onboarded_at = now() WHERE onboarded_at IS NULL` to the generated SQL** (column added first, update after).
- [ ] **Step 4: Run** the same test file; confirm pass. Run `npm test` to confirm nothing else broke.
- [ ] **Step 5: Commit** `feat: seller profile onboarding columns`.

### Task 2: Onboarding validation

**Files:**
- Create: `src/lib/onboarding.ts` (validation part)
- Test: `tests/onboarding-validate.test.ts`

**Interfaces:**
- Consumes: `validate.ts` helpers, `phone.ts` (`PHONE_RE`, `normalizePhone`, `PHONE_HINT`), `ContactMethod`.
- Produces: `type OnboardingInput = { fullName: string; mobile: string; brandName: string; category: string; description: string; cityId?: number; cityRef?: string; instagram?: string; website?: string; logoUrl: string; contactMethods: ContactMethod[]; whatsapp?: string }`; `type FieldErrors = Partial<Record<keyof OnboardingInput | 'form', string>>`; `validateOnboarding(raw: unknown): { ok: true; value: OnboardingInput } | { ok: false; errors: FieldErrors }`. Returns all field errors at once, trimmed values, normalised phone numbers.

- [ ] **Step 1: Write failing tests**, one per rule from the Global Constraints: `rejects blank full name`, `rejects whitespace-only brand name`, `mobile accepts +91, 0 prefix and spaces and stores normalised`, `mobile 12345 gives "Enter a 10-digit mobile number."`, `description over 200 rejected`, `needs instagram or website with exact message`, `website must be http or https`, `needs at least one contact method with exact message`, `whatsapp method needs a valid number`, `phone method needs mobile`, `instagram method needs instagram value`, `logoUrl required`, `returns every error at once`.
- [ ] **Step 2: Run** `npx vitest run tests/onboarding-validate.test.ts`; confirm fail.
- [ ] **Step 3: Implement `validateOnboarding`** collecting errors per field instead of throwing on the first (the existing helpers throw; wrap each in try/catch into the errors map).
- [ ] **Step 4: Run** the test file; confirm pass.
- [ ] **Step 5: Commit** `feat: onboarding input validation`.

### Task 3: Atomic onboarding persistence

**Files:**
- Modify: `src/lib/onboarding.ts` (add persistence), `src/lib/users.ts` or `src/db/people.ts` only if a helper must be exported
- Test: `tests/onboarding.test.ts` (PGlite, follow `tests/users.test.ts` setup)

**Interfaces:**
- Consumes: Task 2 types; `ensureUser`, `grantRole(tx, userId, 'seller', userId)`, `ensureSellerProfile`, `resolveCityInput`, `canonicalCategory`, `resolveAccess` from `src/lib/roles.ts`.
- Produces: `completeOnboarding(email: string, input: OnboardingInput): Promise<{ status: 'created' | 'completed' | 'unchanged'; userId: string }>`. Throws `ApiError` 403 for deactivated user. `created` = role granted and profile saved; `completed` = existing seller or admin with null `onboarded_at`, profile saved, role untouched; `unchanged` = already onboarded.

- [ ] **Step 1: Write failing tests**: `new account becomes seller with profile and onboarded_at`, `users.name and users.phone updated`, `brand name saved as display_name`, `existing seller with null onboarded_at gets completed, role untouched`, `already onboarded returns unchanged and writes nothing`, `deactivated user refused and gets no role`, `invalid category rejected`, `two concurrent calls leave one role row and one profile` (Promise.all), `profile failure rolls back the role` (force an invalid cityRef).
- [ ] **Step 2: Run** `npx vitest run tests/onboarding.test.ts`; confirm fail.
- [ ] **Step 3: Implement `completeOnboarding`** in one drizzle transaction, locking the user row (`SELECT ... FOR UPDATE`) so concurrent calls serialise. Phone contact method copies the normalised mobile into `public_phone`.
- [ ] **Step 4: Run** the test file; confirm pass.
- [ ] **Step 5: Commit** `feat: atomic seller onboarding`.

### Task 4: Onboarding API, relaxed city search, logo upload route

**Files:**
- Create: `src/app/api/onboarding/route.ts`, `src/app/api/uploads/seller-logo/route.ts`
- Modify: `src/app/api/places/route.ts` (`requireStaff` to `requireUser`), `src/lib/rate-limit.ts` (new limiters if limiters are declared there)
- Test: `tests/onboarding-api.test.ts`, `tests/uploads-api.test.ts`, `tests/places-api.test.ts`

**Interfaces:**
- Consumes: `validateOnboarding`, `completeOnboarding`, `requireUser`, existing presign helper behind `product-image`.
- Produces: `POST /api/onboarding` body `OnboardingInput`; 200 `{ status }`; 401 signed out; 403 deactivated or unverified; 422 `{ errors: FieldErrors }`; 429 rate-limited (per email and per IP). `POST /api/uploads/seller-logo` (signed-in, per-email limit) returns the same presigned shape as product-image with JPG and PNG only and `MAX_IMAGE_BYTES`; 503 when storage is unset.

- [ ] **Step 1: Write failing tests**: onboarding `401 when signed out`, `422 returns field-keyed errors`, `200 and role granted for new verified user`, `429 after limit`; places `works for a signed-in non-seller, 401 signed out`; logo route `rejects webp and over 5 MiB`, `503 without storage config`, `requires sign-in`, product-image route still requires staff (unchanged).
- [ ] **Step 2: Run** the three test files; confirm the new cases fail.
- [ ] **Step 3: Implement routes** following the patterns in `api/profile/route.ts` and `api/uploads/product-image/route.ts`; call `revalidatePath('/', 'layout')` after a successful onboarding.
- [ ] **Step 4: Run** the three test files and `npx vitest run tests/authz.test.ts`; confirm pass.
- [ ] **Step 5: Commit** `feat: onboarding api and signed-in city and logo endpoints`.

### Task 5: Access gating, `/sell` route skeleton, host-aware redirects

**Files:**
- Modify: `src/lib/admin-page.ts` (roleless redirect target `/sell`), `src/lib/hosts.ts` (add `dashboardPostsUrl(opts?: { newPost?: boolean }): string`), `src/app/seller-access/page.tsx` (redirect to `/sell`), `src/proxy.ts` if `/sell` needs routing rules
- Create: `src/app/sell/page.tsx`
- Test: `tests/admin-page.test.ts`, `tests/hosts.test.ts`, `tests/proxy.test.ts`

**Interfaces:**
- Produces: `dashboardPostsUrl({ newPost })` returns `/dashboard/posts` (plus `?new=1`) in single-host mode and `${dashboardOrigin}/dashboard/posts...` in split-host mode. `/sell` page: signed out renders `<SellerWelcome />`; seller or admin redirects to `dashboardPostsUrl()`; roleless renders `<SellerOnboarding initialName initialEmail />`; deactivated shows a refusal message. Components are built in Tasks 6 to 8; this task renders placeholders so the route tests pass.

- [ ] **Step 1: Write failing tests**: `requireStaffPage sends roleless user to /sell` (update the existing assertion for `/seller-access`), `dashboardPostsUrl single host and split host, with and without newPost`, `/sell is served on the public host and rewritten correctly on the dashboard host` (proxy), `seller-access redirects to /sell`.
- [ ] **Step 2: Run** the three files; confirm fail.
- [ ] **Step 3: Implement** the above; read the Next docs for `redirect` and page conventions first.
- [ ] **Step 4: Run** those files plus `npx vitest run tests/roles.test.ts`; confirm pass.
- [ ] **Step 5: Commit** `feat: /sell route and onboarding access gating`.

### Task 6: Welcome and Step 1 UI

**Files:**
- Create: `src/components/SellerWelcome.tsx`, `src/components/SellerOnboarding.tsx` (wizard shell, Step 1, draft persistence in `sessionStorage` keyed `craftofy.onboarding`), `src/components/onboarding/FieldError.tsx`
- Modify: `src/app/globals.css` (wizard styles using existing tokens), `src/app/sell/page.tsx`
- Test: `tests/seller-onboarding-step1.test.tsx`

**Interfaces:**
- Produces: `<SellerWelcome />` ("List your craft on Craftofy", three bullets, "Continue with Google" calling `signIn('google', { callbackUrl: '/sell' })`). `<SellerOnboarding initialName: string; initialEmail: string />` renders Step 1 ("Step 1 of 2: You"): name (editable), email (read-only, "Verified by Google"), mobile (+91). `<FieldError id message />` renders the shared error line with the icon pattern from the design. Step 1 "Continue" validates with the client copy of Task 2 rules (import `validateOnboarding` partially or share field validators) and moves to Step 2 or shows inline errors and scrolls to the first.

- [ ] **Step 1: Write failing tests**: `welcome button calls signIn with callbackUrl /sell`, `step 1 shows prefilled name and read-only email`, `blank name shows error and aria-invalid`, `short mobile shows "Enter a 10-digit mobile number."`, `valid step 1 advances to step 2`, `refreshing restores draft from sessionStorage`, `works when sessionStorage throws`.
- [ ] **Step 2: Run** the test file; confirm fail.
- [ ] **Step 3: Implement** the components; reuse existing form, button and input classes; mobile-first layout per the design boards 1 and 2.
- [ ] **Step 4: Run** the test file; confirm pass.
- [ ] **Step 5: Commit** `feat: seller welcome and onboarding step 1`.

### Task 7: Step 2 "Your craft" with logo upload

**Files:**
- Create: `src/components/onboarding/StepCraft.tsx`, `src/components/onboarding/LogoUpload.tsx`
- Modify: `src/components/SellerOnboarding.tsx`
- Test: `tests/seller-onboarding-step2.test.tsx`, `tests/logo-upload.test.tsx`

**Interfaces:**
- Consumes: `CityInput` (state shown read-only from the picked city), `GET /api/categories`, `POST /api/uploads/seller-logo`, presign-then-POST logic shared with `ImageUploader` (extract a small shared helper if one is not already separable).
- Produces: `<LogoUpload value: string; onChange(url: string): void; onBusyChange(b: boolean): void />` with client-side checks (JPG or PNG, 400x400 minimum, 5 MiB) and retry on failure. `StepCraft` fields: brand name, category select, description with `n / 200` counter, city, Instagram, website, logo, contact-method toggles with the WhatsApp box and the "Same as my mobile number" checkbox. Instagram and Website toggles use the entered values.

- [ ] **Step 1: Write failing tests**: each error from the spec error table renders next to its field (brand name, category, description over 200, city not picked, neither instagram nor website, logo missing, no contact method, WhatsApp invalid), `description counter updates`, `same-as-mobile copies and locks WhatsApp`, `logo under 400x400 rejected with message`, `logo upload failure shows retry`, `storage unavailable (503) shows message`.
- [ ] **Step 2: Run** both files; confirm fail.
- [ ] **Step 3: Implement** the components per board 3 and board 4.
- [ ] **Step 4: Run** both files; confirm pass.
- [ ] **Step 5: Commit** `feat: onboarding step 2 and logo upload`.

### Task 8: Submit, error mapping, done screen, redirect

**Files:**
- Modify: `src/components/SellerOnboarding.tsx`
- Create: `src/components/onboarding/OnboardingDone.tsx`
- Test: `tests/seller-onboarding-submit.test.tsx`

**Interfaces:**
- Consumes: `POST /api/onboarding`, `dashboardPostsUrl` result passed from the server page as a prop (`postsUrl`, `postsUrlNew`).
- Produces: "Finish and add my first product" posts the collected input. 422 maps `errors` onto fields (jumping back to the step that owns the first error). 401 saves the draft and calls `signIn('google', { callbackUrl: '/sell' })`. 403 shows the refusal. 429 and network failure show a retry message and re-enable the button. Success shows `<OnboardingDone name brand />` (board 5) with "Add your first product" (navigates to `postsUrlNew`) and "Go to my dashboard" (`postsUrl`). The submit button is disabled while pending to block double-taps.

- [ ] **Step 1: Write failing tests**: `finish posts once even if clicked twice`, `422 shows server errors on fields and returns to step 1 when name or mobile is wrong`, `401 keeps the draft and starts sign-in`, `403 shows message`, `network error shows retry and re-enables button`, `success shows done screen with two actions and correct links`.
- [ ] **Step 2: Run** the test file; confirm fail.
- [ ] **Step 3: Implement** the submit flow and done screen.
- [ ] **Step 4: Run** the test file; confirm pass.
- [ ] **Step 5: Commit** `feat: onboarding submit and completion`.

### Task 8b: Draft-review information dialog on Finish (added after the plan, user request)

**Files:**
- Create: `src/components/onboarding/DraftNoticeDialog.tsx`
- Modify: `src/components/SellerOnboarding.tsx` (and `StepCraft.tsx` only if the Finish button lives there), `src/app/globals.css`
- Test: `tests/seller-onboarding-notice.test.tsx` (update `tests/seller-onboarding-submit.test.tsx` where Finish now opens the dialog first)

**Interfaces:**
- Produces: `<DraftNoticeDialog open onConfirm onCancel />`. Clicking "Finish and add my first product" validates Step 2 first (errors still show inline and the dialog does not open), then opens the dialog. Dialog text: title "Before you add your products"; body "Every product you add starts as a draft. Once an admin reviews it, it is published automatically."; buttons "Got it, finish" (confirm, sends the single POST) and "Go back" (cancel, returns to the form, nothing sent). Focus moves into the dialog, is trapped, Escape cancels, focus returns to the Finish button on cancel. Double-submit guards unchanged.

- [ ] **Step 1:** Write failing tests: dialog opens only when Step 2 is valid; invalid Step 2 shows inline errors and no dialog; confirm sends exactly one POST; cancel and Escape send none and restore focus; dialog has role="dialog", aria-modal, labelled title; copy matches exactly.
- [ ] **Step 2:** Run them; confirm fail.
- [ ] **Step 3:** Implement the dialog following the existing dialog pattern (see `ProfileDialog.tsx` / `ListingRequestButton.tsx`) and wire it in.
- [ ] **Step 4:** Run covering tests and the full suite; confirm pass.
- [ ] **Step 5:** Commit `feat: draft-review notice before onboarding submit`.

### Task 9: Open the new-product form on arrival

**Files:**
- Modify: `src/app/dashboard/posts/page.tsx`, `src/components/PostsAdmin.tsx`
- Test: `tests/posts-admin.test.tsx`

**Interfaces:**
- Produces: `PostsAdmin` gains optional prop `openNew?: boolean`; the page passes `openNew` when `searchParams.new === '1'` (read the Next docs for the current `searchParams` convention). When true, initial `editing` state is `"new"`. No other behaviour or role gate changes.

- [ ] **Step 1: Write failing tests**: `openNew opens the new post form immediately`, `without openNew the form stays closed`, `seller view still hides Delete and the seller picker and disables Published` (guards the restrictions), `admin view unchanged`.
- [ ] **Step 2: Run** `npx vitest run tests/posts-admin.test.tsx tests/seller-products.test.ts`; confirm the new cases fail.
- [ ] **Step 3: Implement** the prop and the page wiring.
- [ ] **Step 4: Run** the same files; confirm pass.
- [ ] **Step 5: Commit** `feat: open new post form via ?new=1`.

### Task 10: Entry points and listing-request cleanup

**Files:**
- Modify: `src/components/AuthButton.tsx`, `src/components/Header.tsx` (pass `dashboardUrl={hostConfig().dashboardOrigin ?? ''}`), `src/app/page.tsx` (replace `<ListingRequestButton />` in `section.maker-cta` with a link to `/sell`), `src/app/globals.css` (navbar link and "Seller login" button styles), `tests/footer-links.test.tsx`, `tests/listing-requests-admin.test.tsx` (line asserting the button), `tests/listing-request-form.test.tsx`
- Test: `tests/auth-button.test.tsx` (create if absent), updated tests above

**Interfaces:**
- Produces: signed-out `AuthButton` renders "Are you a seller? Login here" (hidden at phone width) and a "Seller login" button (phone width only); both call `signIn('google', { callbackUrl: '/sell' })`. Signed-in rendering (Admin, My products, Sign out with role suffix) is unchanged. `ListingRequestButton` component, API and admin tab stay in the codebase; only the home-page usage is removed.

- [ ] **Step 1: Write failing tests**: `signed out shows seller prompt and Seller login`, `click calls signIn with callbackUrl /sell`, `signed-in admin and seller rendering unchanged`, `My products link uses dashboard origin when split-host`, `home page links to /sell and no longer renders ListingRequestButton`, `footer Seller login link still present`. Update the two listing-request tests to match.
- [ ] **Step 2: Run** `npx vitest run tests/auth-button.test.tsx tests/footer-links.test.tsx tests/listing-requests-admin.test.tsx tests/listing-request-form.test.tsx`; confirm new cases fail.
- [ ] **Step 3: Implement** the changes; keep the green strip untouched.
- [ ] **Step 4: Run** the same files plus `npx vitest run tests/themes-lib.test.ts`; confirm pass.
- [ ] **Step 5: Commit** `feat: seller login in navbar, replace list-your-craft form on home`.

### Task 11: Edit new profile fields from "My profile"

**Files:**
- Modify: `src/lib/users.ts` (`saveProfile`), `src/components/ProfileDialog.tsx`, `src/app/api/profile/route.ts` only if validation lives there
- Test: `tests/users.test.ts`, `tests/profile-dialog.test.tsx` (create if absent)

**Interfaces:**
- Produces: `saveProfile` accepts and validates `website, category, logoUrl, whatsapp, contactMethods` with the same rules as Task 2 (reuse its field validators, export them from `src/lib/onboarding.ts`); `ProfileDialog` shows these fields. Existing fields and the 500-character bio limit are unchanged.

- [ ] **Step 1: Write failing tests**: `saveProfile stores the new fields`, `rejects invalid website and contact methods`, `existing profile saves still work without new fields`, `dialog renders and submits new fields`.
- [ ] **Step 2: Run** the two files; confirm fail.
- [ ] **Step 3: Implement** the validator reuse and the dialog fields.
- [ ] **Step 4: Run** the two files and `npx vitest run tests/posts-admin.test.tsx`; confirm pass.
- [ ] **Step 5: Commit** `feat: edit onboarding fields in My profile`.

### Task 12: Whole-suite verification

**Files:** none new.

- [ ] **Step 1: Run** `npm test`; all pass.
- [ ] **Step 2: Run** `npx tsc --noEmit` and the project's lint command; no errors.
- [ ] **Step 3: Run** the app (`npm run dev`) and walk the flow with a fresh Google account at 390px and 1440px: navbar link, welcome, Step 1, Step 2, finish, dashboard opens with the new post form, saved product is DRAFT and the status dropdown disables Published. Also confirm an existing seller and an admin sign in straight to the dashboard.
- [ ] **Step 4: Report** any step that could not be exercised (for example no storage config for logo upload locally).

## Self-Review

- **Spec coverage:** entry (Task 10), start route and redirects (5), Step 1 (6), Step 2 and error table (2, 7), submit and done (8), atomic role plus profile and modes (3), relaxed endpoints and logo route (4), data columns and backfill (1), first-product open (9), restrictions guarded (9), listing requests kept and button removed (10), My profile edit (11), calls list items covered by the matching tasks.
- **Step scan:** each step names its test, signature or command.
- **Type consistency:** `OnboardingInput`, `FieldErrors`, `ContactMethod`, `completeOnboarding`, `dashboardPostsUrl` named identically across tasks.
- **Review Focus:** items 1 to 5 each map to a named test above (Tasks 2, 3, 8).
