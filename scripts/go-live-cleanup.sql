-- Go-live clean-up for the PRODUCTION database. Nothing here runs by itself:
-- 1. Run the SELECT section and read the result. Decide what is test data.
-- 2. Un-comment ONLY the DELETE lines you want, fix the ids/names, and run the whole file.
--    Everything is inside one transaction: it ends with ROLLBACK, so a first run changes nothing.
--    When the counts at the end look right, change the last line to COMMIT and run again.
-- Take a backup first (Neon: create a branch or snapshot; Docker: pg_dump).
-- Run with:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/go-live-cleanup.sql
--
-- Photos: deleting a product here does NOT delete its files in the S3 bucket. Afterwards empty the
-- bucket's products/ folder of the removed products' files (S3 console, bucket, products/).

BEGIN;

-- ===== 1. Review =====
SELECT id, name, status, seller_id, created_at FROM products ORDER BY id;
SELECT id, title, status, host_name, starts_at FROM workshops ORDER BY id;
SELECT c.name, (SELECT count(*) FROM products p WHERE p.category = c.name) AS products FROM categories c ORDER BY c.id;
SELECT u.email, u.name, u.active, array_agg(r.name) FILTER (WHERE r.name IS NOT NULL) AS roles
  FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id GROUP BY u.id ORDER BY u.email;
SELECT (SELECT count(*) FROM orders) AS orders, (SELECT count(*) FROM bookings) AS bookings,
       (SELECT count(*) FROM listing_requests) AS listing_requests;
SELECT id, owner_name, email, business_name, status, created_at FROM listing_requests ORDER BY created_at;

-- ===== 2. Delete test data (un-comment what applies) =====
-- Test products (photos, likes and events are removed with them):
-- DELETE FROM products WHERE id IN ('p1', 'p2');
-- Test workshops (bookings for them go too; delete products linked to them first if you keep them):
-- DELETE FROM bookings WHERE workshop_id IN ('w1');
-- DELETE FROM workshops WHERE id IN ('w1');
-- Test orders:
-- DELETE FROM orders WHERE id IN ('...');          -- its order_items go with it
-- Test categories (only ones no product uses). Keep the real ones:
-- DELETE FROM categories WHERE name NOT IN ('Crochet & Textiles', 'Accessories', 'Resin Art', 'Pottery')
--   AND NOT EXISTS (SELECT 1 FROM products p WHERE p.category = categories.name);
-- Test maker requests from your own form testing:
-- DELETE FROM listing_requests WHERE business_name ILIKE '%test%';
-- Test users who own nothing (do NOT delete the legacy placeholder or real admins):
-- DELETE FROM users WHERE email IN ('someone@test.example') AND NOT EXISTS (SELECT 1 FROM products WHERE seller_id = users.id);

-- ===== 3. Check =====
SELECT (SELECT count(*) FROM products) AS products, (SELECT count(*) FROM workshops) AS workshops,
       (SELECT count(*) FROM categories) AS categories, (SELECT count(*) FROM orders) AS orders, (SELECT count(*) FROM bookings) AS bookings;

ROLLBACK;   -- change to COMMIT once the numbers above are what you expect
