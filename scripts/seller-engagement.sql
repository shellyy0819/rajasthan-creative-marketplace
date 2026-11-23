-- Seller engagement on the live site. Read-only. Run against PROD:
--   psql "$DATABASE_URL" -v days=30 -f scripts/seller-engagement.sql      (DATABASE_URL from .env.backend)
-- Same numbers as the admin page /dashboard/engagement.
--
-- Unit = visitor-day. The visitor id (product_events.actor) is a salted hash that changes every UTC day, so one person on three days counts three
-- times, and one person touching several of a seller's listings on one day counts once for that seller.
-- "looked" = view, "opened" = opened the contact options, "reached_out" = a real contact (call, email, Instagram, YouTube, WhatsApp, website, copy).
-- Contacts made from an artist's own page are not in these tables (GA4 only).
\if :{?days} \else \set days 30 \endif

with ev as (
  select p.seller_id, e.type, e.actor || '|' || e.day::text as vd
    from product_events e join products p on p.id = e.product_id
   where e.day >= (now() at time zone 'utc')::date - (:days - 1)
  union
  select w.host_id, e.type, e.actor || '|' || e.day::text
    from workshop_events e join workshops w on w.id = e.workshop_id
   where e.day >= (now() at time zone 'utc')::date - (:days - 1) and w.host_id is not null
)
-- 1. Whole site (a visitor-day that contacted two sellers counts once)
select 'ALL SELLERS' as seller,
       count(distinct vd) filter (where type = 'view')            as looked,
       count(distinct vd) filter (where type = 'contact')         as opened,
       count(distinct vd) filter (where type like 'contact\_%')   as reached_out,
       count(distinct seller_id) filter (where type like 'contact\_%') as sellers_contacted
  from ev;

-- 2. Per seller, most contacted first (sellers with no activity are listed too)
with ev as (
  select p.seller_id, e.type, e.actor || '|' || e.day::text as vd
    from product_events e join products p on p.id = e.product_id
   where e.day >= (now() at time zone 'utc')::date - (:days - 1)
  union
  select w.host_id, e.type, e.actor || '|' || e.day::text
    from workshop_events e join workshops w on w.id = e.workshop_id
   where e.day >= (now() at time zone 'utc')::date - (:days - 1) and w.host_id is not null
)
select coalesce(nullif(trim(sp.display_name), ''), u.name) as seller,
       count(distinct ev.vd) filter (where ev.type = 'view')            as looked,
       count(distinct ev.vd) filter (where ev.type = 'contact')         as opened,
       count(distinct ev.vd) filter (where ev.type like 'contact\_%')   as reached_out,
       count(distinct ev.vd) filter (where ev.type = 'contact_call')      as call,
       count(distinct ev.vd) filter (where ev.type = 'contact_whatsapp')  as whatsapp,
       count(distinct ev.vd) filter (where ev.type = 'contact_email')     as email,
       count(distinct ev.vd) filter (where ev.type = 'contact_instagram') as instagram,
       count(distinct ev.vd) filter (where ev.type = 'contact_youtube')   as youtube,
       count(distinct ev.vd) filter (where ev.type = 'contact_website')   as website,
       count(distinct ev.vd) filter (where ev.type = 'contact_copy')      as copied
  from seller_profiles sp
  join users u on u.id = sp.user_id and u.active
  left join ev on ev.seller_id = sp.user_id
 group by sp.user_id, sp.display_name, u.name
 order by reached_out desc, opened desc, looked desc, seller;

-- 3. Per day, whole site: is it growing?
select e.day,
       count(distinct e.actor) filter (where e.type = 'view')          as looked,
       count(distinct e.actor) filter (where e.type like 'contact\_%') as reached_out
  from (select day, type, actor from product_events union all select day, type, actor from workshop_events) e
 where e.day >= (now() at time zone 'utc')::date - (:days - 1)
 group by e.day order by e.day desc;
