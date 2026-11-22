-- One draft "Shilpgram Utsav" festive theme, so it is already in the admin's Festive themes list (as a draft: nothing changes on the site until an admin sets the real dates and schedules it).
-- Runs once, like any migration: if the admin deletes the row it stays deleted. Skipped when a Shilpgram theme already exists. Dates are the preset's sample window in IST.
INSERT INTO "site_themes" ("preset", "status", "starts_at", "ends_at", "config", "updated_by")
SELECT 'shilpgram', 'draft', '2026-12-24 06:00:00+05:30', '2026-12-30 23:59:00+05:30',
  '{"banner":"Shilpgram Utsav · handmade finds from makers near you","sign":"Craftofy at Shilpgram","chalkLabel":"Shilpgram Utsav","chalkTitle":"Meet the maker","chalkSub":"From Udaipur and beyond","bunting":false,"stickers":[]}'::jsonb,
  'system'
WHERE NOT EXISTS (SELECT 1 FROM "site_themes" WHERE "preset" = 'shilpgram');
