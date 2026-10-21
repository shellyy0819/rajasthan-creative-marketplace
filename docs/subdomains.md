# Public site and dashboard on two subdomains (one deployment)

One container serves both hostnames. `src/proxy.ts` decides, from the hostname, what each host may show.
This separates the two sites; it is **not** the security layer: every API route and every dashboard page still checks the user's role.

| Host | Shows |
|---|---|
| `www.example.com` (`NEXT_PUBLIC_SITE_URL`) | the shop. `/dashboard/*` is a 404 here. Old `/admin/*` links redirect to the dashboard host |
| `dashboard.example.com` (`DASHBOARD_URL`) | `/` is the dashboard, `/dashboard/*` is served, shop pages redirect to `www`. `robots.txt` disallows everything |
| both | `/api/*` (authorised per request), static files |

Without `DASHBOARD_URL` (local development) there is one host and `/dashboard/*` is served on it; `/admin/*` redirects to `/dashboard/*`.

## 1. Settings (`.env.backend`)
```
NEXT_PUBLIC_SITE_URL=https://www.example.com
NEXTAUTH_URL=https://www.example.com          # sign-in always starts on the public host
DASHBOARD_URL=https://dashboard.example.com
COOKIE_DOMAIN=.example.com                    # one login for both hosts (must cover both hosts, or it is ignored)
```
Run `docker compose -f docker-compose.prod.yml --env-file .env.backend up -d --build` after changing them.

## 2. DNS
Two `A` records pointing at the server's IP: `www` and `dashboard` (and `@` if you want the bare domain).

## 3. HTTPS with Caddy (free certificates, automatic)
`/etc/caddy/Caddyfile`:
```
www.example.com, dashboard.example.com {
    reverse_proxy 127.0.0.1:3000
}
```
Keep the app container on `127.0.0.1:3000` (the default compose mapping) so only Caddy is public. Caddy passes the original `Host` header, which is what the app uses. Open ports 80 and 443 in the cloud firewall.

Optional extra protection for the dashboard host only (for example an office IP allow-list):
```
www.example.com {
    reverse_proxy 127.0.0.1:3000
}
dashboard.example.com {
    @notoffice not remote_ip 203.0.113.10
    respond @notoffice 403
    reverse_proxy 127.0.0.1:3000
}
```

## 4. Google sign-in
In the Google Cloud console, on the OAuth client, add the authorised redirect URI
`https://www.example.com/api/auth/callback/google`.
Sign-in starts on the public host and returns to the dashboard host through the shared cookie, so only the public host needs a redirect URI.

## 5. Check
- `https://www.example.com/dashboard/posts` is a 404.
- `https://dashboard.example.com/` asks you to sign in, then shows the dashboard.
- `https://dashboard.example.com/shop` redirects to `https://www.example.com/shop`.
- `https://dashboard.example.com/robots.txt` says `Disallow: /`.
- Signing in on one host keeps you signed in on the other.
