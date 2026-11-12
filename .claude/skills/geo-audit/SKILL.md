---
name: geo-audit
description: Use when asked to run a GEO (Generative Engine Optimization) audit, check whether a page can be cited by ChatGPT, Perplexity, Claude or Google AI answers, review robots.txt or llms.txt for AI crawlers, or improve a page's AI citability, E-E-A-T or JSON-LD schema in the Craftofy / Rang Rajasthan marketplace.
---

# GEO audit (Craftofy / Rang Rajasthan)

Act as a Senior Generative Engine Optimization (GEO) Auditor. Audit one page (or a set of pages) against target AI prompts and output a prioritized action plan.

## Inputs (ask only for what is missing)

1. **Target AI prompts** (3-5 questions users would ask an AI that this page should answer).
2. **Page**: a URL, a route in `src/app/...`, or pasted content. For a local route, read the page source and the data it renders.
3. **robots.txt**: this repo generates it in `src/app/robots.ts` (dynamic, per host). Read the file; if a live URL is given, also fetch `/robots.txt`.

## The four pillars

### 1. AI crawler and indexing access
- Check whether robots rules block or omit: `OAI-SearchBot`, `GPTBot`, `ChatGPT-User`, `PerplexityBot`, `Google-Extended`, `ClaudeBot`. Under `userAgent: '*'` with `allow: '/'` they are allowed unless named separately. State that explicitly per bot.
- Check for `llms.txt` (`public/llms.txt` or an app route). Report missing, or incomplete (no site summary, no links to key pages).
- Note that the dashboard host is intentionally `Disallow: /`. Do not recommend opening it.

### 2. Citability and answer extraction
- For each H2/H3, check for a direct 40-60 word factual answer immediately under the heading.
- List weak sections and **rewrite each** into a crisp, quotable statement. Facts only; no marketing adjectives.

### 3. Information gain and authority (E-E-A-T)
- Look for original statistics, verifiable data, expert quotes, named author or artisan credentials, dates.
- Flag generic text an LLM already knows from baseline training. Suggest what unique data this marketplace can add (artisan counts, craft origins, workshop details, pricing ranges).
- Never invent statistics, quotes or credentials in rewrites. Mark needed data as `[NEEDS REAL DATA: ...]`.

### 4. Entity and schema clarity
- Review JSON-LD (see `src/components/JsonLd.tsx` and where it is used). Check for `Organization`, `Product`, `FAQPage`, `Article`, `Person`, `BreadcrumbList`, `Event` (workshops).
- Suggest specific additions with a valid JSON-LD snippet, using `sameAs` links to disambiguate the brand. Only include fields backed by real page content.

## Output format

1. **Scorecard**: four pillars, each Pass / Partial / Fail with one line of evidence.
2. **Prompt coverage**: per target prompt, does the page answer it, and where?
3. **Prioritized action plan**: table with Priority (P0-P2), Pillar, Issue, Fix, Effort. Most impact first.
4. **Rewrites and snippets**: the rewritten sections and JSON-LD, ready to paste.

## Rules

- Audit and propose. Do not edit code unless the user asks to apply fixes.
- Base every finding on content you actually read; quote the line or file.
- Keep seller/admin role gates and private routes (`/api/`, `/dashboard/`, `/admin/`) out of scope for opening to crawlers.
