# Hyperframes Composition Brief: Craftology

## Objective
Create a short launch-style brag video for Craftology, an India-wide handmade-products marketplace and workshop discovery app.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 18 seconds

## Source Material
- Project root: `/Users/shellyagarwal/Downloads/rajasthan-creative-marketplace`
- Primary files read: `src/app/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `src/components/Hero.tsx`, `src/lib/site.ts`, `README.md`
- Product name: Craftology
- Tagline / strongest claim: "Handmade finds & creative workshops across India"
- Key UI or visual moment to recreate: the hero-art block (sun circle, two overlapping arches in sage/cream, pottery glyph centerpiece, rotated "LOCAL LOVE ✳" circular sticker) plus the product grid cards and a workshop date-tile card
- Copy that must appear verbatim:
  - "Discover the Craft. Meet the Maker. Learn the Art."
  - "Handmade finds & creative workshops across India"
  - "There's room for your craft here."
  - "THE CREATIVE SIDE OF INDIA" (eyebrow)

## Creative Direction
- Tone preset: polished
- Creative direction: quiet, premium product film for an earnest artisan marketplace — warm, unhurried, craft-gallery feel, not a loud SaaS launch
- Angle: Craftology is a real working marketplace (Next.js + Postgres, Google OAuth, buyer/seller/admin roles) presented through its own warm terracotta-and-sage visual language — the video should feel like a gallery walkthrough of the brand, not a feature-dump.
- Hook (0–2.5s): cream paper background fades in, small eyebrow text "THE CREATIVE SIDE OF INDIA" types/settles, serif wordmark "Craftology" draws in
- Outro / punchline (16.5–18s): green maker-cta band with flower glyph and "There's room for your craft here."
- Avoid:
  - Generic SaaS language ("streamline", "workflow", etc. — never used by this project)
  - Abstract filler visuals unrelated to the craft/marketplace theme
  - Any visual redesign of the brand — reuse its actual colors, shapes, and type

## Visual Identity
- Background: `#f8f4ee` (paper), secondary `#eee5d8` (cream)
- Text/ink: `#252a24`; muted: `#77796f`
- Accent: `#c66b43` (orange), secondary accent `#405746` (green)
- Display font: Playfair Display (serif), 500 weight, tight letter-spacing (-1 to -2.8px at large sizes) — use a Google Fonts–equivalent serif if Playfair isn't available locally
- Body font: DM Sans — a clean geometric sans fallback is fine
- Visual references from the project:
  - Hero arch illustration: large cream/sage rounded-arch shapes (`border-radius: 48% 48% 0 0`), one terracotta sun circle, a pottery emoji/glyph centered in the front arch, a small rotated circular sticker badge
  - Product card: colored rounded tile (`#ead9ce` / `#d8dfd0` / `#e9d8b9` / `#d5dce0`) with a large centered craft-symbol glyph, "HANDMADE" micro-label bottom-right, title in serif, price + outlined "add" button below
  - Workshop card: a date-tile (sage background, large serif day number, small uppercase month) beside workshop title/description and a price
  - Maker CTA band: solid green background, a flower glyph (✿), serif headline, light "I'm a maker ↗" pill button

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 2.5s — paper background, eyebrow text settles, "Craftology" wordmark draws in serif type
2. Reveal — 3.5s — hero arch illustration assembles (sun, back arch, front arch with pottery glyph, sticker badge) behind the headline "Discover the Craft. Meet the Maker. Learn the Art."
3. Highlight 1 — 4.0s — product grid: 3–4 colored tile cards slide/settle into a row, each with glyph + price + add button; caption "Handmade finds from independent makers"
4. Highlight 2 — 4.0s — one workshop card scales in with its date-tile and price; caption "Hands-on workshops, city by city"
5. Highlight 3 — 2.5s — a short row of circular craft-category glyphs (pottery / textile / jewellery / painting) pass by quickly
6. Outro — 1.5s — green maker-cta band with flower glyph and "There's room for your craft here.", wordmark settles for the final hold

## Audio
- Audio role: warm bed, understated
- Audio arc: music fades in under the hook, stays low and steady through the highlights, swells very slightly into the outro, then fades out cleanly after the final hold
- Music: `assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (steady/clean, matches `polished`/`cinematic`)
- Music treatment: volume ~0.3; fade-in over first 0.5s; fade-out over final 0.8s; no hard cuts
- Music cue guidance: `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json` / `.md` (tempo ~110 BPM). Strong cues in window: 8.74s, 9.29s, 10.93s, 13.11s, 17.47s, 18.56s. Suggested (not mandatory): nudge the Scene 3 product-grid reveal toward ~8.74s, and the Scene 5 category-row cut toward ~17.47s — only if it doesn't hurt readability of the fixed 2.5/3.5/4.0/4.0/2.5/1.5s scene lengths above.
- Audio-reactive treatment: subtle — let the hero-art sun/glow or the green outro band's background warmth breathe slightly with music RMS; no waveform/equalizer/particle visuals
- Audio-coupled moments:
  - Scene 1 wordmark draw-in — soft reveal, very light SFX only
  - Scene 3 product cards settling — one soft card/drop SFX on the first or last card only
  - Scene 6 outro band landing — one gentle bell/announcement SFX as the final hold begins
- SFX selection guidance: minimal and soft per `polished` tone — 2-3 cues total, nothing aggressive; prefer low high-frequency-risk picks
- Exact SFX choice: Hyperframes should pick exact timestamps/volumes based on the implemented animation from the files already staged below; `interface/bong_001.ogg` and `interface/drop_001.ogg` and `impact/impactSoft_medium_000.ogg` are staged as polished-tone candidates — use them, swap for comparably restrained files if better suited once motion is built
- Audio files staged at:
  - `composition/assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`
  - `composition/assets/sfx/interface/bong_001.ogg`
  - `composition/assets/sfx/interface/drop_001.ogg`
  - `composition/assets/sfx/impact/impactSoft_medium_000.ogg`

## Hyperframes Instructions
Load the composition-building Hyperframes skills — `hyperframes` (composition contract + `data-*` timing, `references/format.md`; motion, eases and seek-safe keyframes in `references/motion.md`; look in `references/look.md`), `hyperframes-registry` (ready-made effects, transitions, titles), `media-use` (music, SFX, audio-reactive data), and `hyperframes-cli` (lint/check/render). /brag is its own workflow: skip the `hyperframes` storyline step: don't read `references/types/*` or `references/story.md`, don't propose storylines, and don't write a `SPEC.md`. The brag plan and composition brief replace them, including the LOOK line `references/look.md` asks for. Also skip its `usage`, `history`, `feedback` and REVIEW.md steps; `check` is brag's gate. Do not route into its generic launch-video workflow. Prefer native Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project.
- Keep all text readable in the final render.
- Keep the video within 15-25 seconds.
- Include the planned music/SFX layer unless audio was explicitly disabled or documented as intentionally silent.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet. Choose SFX after the visual animation exists.
- Treat music cue metadata as optional timing hints. Hyperframes decides exact animation timing and should ignore cues that hurt readability, scene pacing, or the product story.
- Major reveals may move toward nearby strong cues within about 0.15s. Smaller entrances may align to nearby beat points within about 0.10s. Use only 1-3 strong cue locks in a 15-25s video unless the edit clearly benefits from more.
- Use SFX to support motion and interaction: card sounds for card-like reveals, short announcement cues for major payoffs, key/click sounds for text or user actions, and restraint when the edit is already busy.
- Honor planned music treatment such as fade-outs, ducking, beat-aligned reveals, or letting a final SFX ring over the music, using the best Hyperframes-supported implementation.
- When music is present and the treatment is not `none`, consider Hyperframes audio-reactive workflow: extract audio data and use RMS/frequency bands for subtle, brand-specific motion. Good targets are glow, depth, background warmth, card presence, title emphasis, or other existing visual elements. Avoid waveform/equalizer visuals, musical-note graphics, generic particle systems, strobing, or heavy pulsing.
- Use local assets for audio and any required runtime/media dependencies when possible.
- Run `hyperframes check` before render — it is brag's single gate.
- Keep creation and rendering local. Remote or publishing workflows require a separate explicit user request.
