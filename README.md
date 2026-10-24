# CRAVE

**Tinder for deciding what to eat.** Swipe through real meals from real restaurants near you, see honest prices and hours, and hand off to the restaurant's or delivery app's own ordering page.

> I'm hungry, I don't know what I want, and I don't want to spend 45 minutes scrolling.

First market: **Tucson, AZ**. Adding a market is a data change, not a code change.

---

## What's real and what isn't

CRAVE would rather say "we don't know" than guess. Read [`docs/FEASIBILITY.md`](docs/FEASIBILITY.md) for the full data-source assessment. In short:

| Data | Source | Status |
|---|---|---|
| Restaurants, branches, hours | OpenStreetMap via Overpass (keyless, ODbL) | **Automated**, scheduled refresh with change detection |
| Chain recognition | `brand:wikidata` + name/alias matching | Automated; national chains first, then regional |
| Chain menus | Curated catalog (31 chains, 121 items) from public menus | Names/descriptions *reported*; prices are labeled **Est.** ranges |
| Verified prices, independents' menus | Admin dashboard | Manual, stamped with who/when |
| DoorDash / Uber Eats / Grubhub | Search links + admin-verified store URLs | **No scraping.** Their APIs are merchant/POS-partner only |
| Address coverage, live fees, ETAs | — | **Not available.** UI always says "check availability on their site" |
| Ratings, live hours, photos | Google Places (optional key) | Live only; only `place_id` is stored, per Google's terms |

Hard product rules enforced in code (`src/lib/ranking.ts`, with tests):

- Blocked restaurants/chains never appear. Blocks, temporary dislikes ("not tonight" / "tired of it") and single-meal rejections are three separate preference types.
- Closed restaurants stay out of the feed unless you turn them on.
- Delivery mode hides *known* pickup-only places; it never assumes delivery because a place is on an app.
- "Accepting delivery now" requires a live authorized integration. With none configured, it honestly matches nothing and says why.
- Users who list allergies don't see items without verified allergen data (unless they opt in).
- Estimates never mix one platform's menu price with another platform's fees.
- Demo mode uses obviously fictional restaurants, never touches the database, and shows a banner on every screen.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS 4 · Motion · Supabase (Postgres + Auth + RLS) · Zod · Vitest · installable PWA.

```
src/
  app/                    screens + API routes
    api/deck              ranked swipe deck for a location + preference snapshot
    api/admin/*           admin CRUD, refresh, change log, reports (auth + CSRF guarded)
    api/cron/refresh      scheduled refresh (Vercel Cron)
  lib/
    providers/            adapter architecture
      discovery/          osm.ts, google.ts, foursquare.ts
      geocoding/          Census → Google → Nominatim fallback chain
      delivery/           DoorDash / Uber Eats / Grubhub / Direct (link-only) + disabled aggregator slot
      menu/               Spoonacular nutrition enrichment
      registry.ts         one place that lists every adapter
    hours.ts              timezone/DST/overnight-correct hours engine
    refresh.ts            discover → match chain → dedupe → diff → change log
    dedupe.ts             branches vs duplicates vs virtual brands
    ranking.ts            product rules + transparent weighted recommender
    pricing.ts            price display, value score, order estimates
    db/                   Repository interface; Supabase + local JSON implementations
supabase/
  migrations/             schema, RLS, geo query
  seed.sql                generated from src/lib/catalog (npm run db:seed-sql)
  tests/                  RLS checks (npm run db:test)
```

### Adding an authorized delivery integration

Each platform is a `DeliveryAdapter` with capability flags (`listingLookup`, `addressCoverage`, `liveQuote`, `deepLink`, …). Today only `deepLink` and `manualListing` are on. With a partner agreement, subclass the adapter in `src/lib/providers/delivery/`, implement `lookupListing()` / `quote()`, and flip the capabilities. The deck, filters ("accepting delivery now"), estimates and UI already read those flags — no schema or screen changes needed.

## Run it locally

```bash
npm install
cp .env.example .env.local      # everything is optional for local dev
npm run dev                     # http://localhost:3000
```

Without Supabase, CRAVE uses a local JSON store at `.data/crave-local.json` and the admin dashboard is open in development.

Load real Tucson restaurants (needs outbound access to overpass-api.de):

```bash
npm run refresh -- --market tucson --brands-only   # chains first
npm run refresh -- --market tucson                 # full sweep incl. independents
```

Or use **Admin → Overview → Refresh**. Then open the app, set a Tucson address, and swipe.

## Production setup (Supabase + Vercel)

1. **Create a Supabase project.** In the SQL editor, run `supabase/migrations/20261024000000_init.sql`, then `supabase/seed.sql`. (Or `supabase db push` + `psql -f supabase/seed.sql` with the CLI.)
2. **Auth:** enable Email (magic link). Add `https://YOUR_DOMAIN/api/auth/callback` to the redirect allow-list.
3. **Env vars** (Vercel → Settings → Environment Variables): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `CRAVE_CONTACT_EMAIL`, `NEXT_PUBLIC_SITE_URL`.
4. **Make yourself admin:** sign in once in the app (Profile → Account & sync), then in the SQL editor:
   ```sql
   update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
   ```
5. **Deploy.** `vercel.json` schedules `/api/cron/refresh` daily (chains on weekdays, full sweep on Sundays). For heavier use, point `OVERPASS_URL` at your own Overpass instance.
6. **Optional:** `GOOGLE_PLACES_API_KEY` (live ratings/hours/photos), `FOURSQUARE_API_KEY`, `SPOONACULAR_API_KEY`. Each adapter shows up as active in **Admin → Data sources**.

Security notes: the service role key is only used server-side (`src/lib/db/index.ts` is `server-only`); every admin route checks the session/role and blocks cross-origin mutations; user tables are owner-only via RLS; role escalation is blocked by a trigger (verified by `npm run db:test`).

## Tests

```bash
npm test            # 52 unit tests: hours/DST/overnight, dedupe, ranking rules, pricing, refresh pipeline
npm run db:test     # migration + seed + RLS behaviour against a throwaway Postgres (needs PG binaries)
npm run lint
npm run typecheck
npm run build
```

## Attribution

Map data © OpenStreetMap contributors, available under the Open Database License. CRAVE is not affiliated with any restaurant or delivery platform.
