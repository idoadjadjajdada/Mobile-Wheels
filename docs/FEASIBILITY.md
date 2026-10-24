# CRAVE — Data Source Feasibility Assessment

_Assessed October 2026. Prices change; confirm on each provider's pricing page before committing spend._

CRAVE needs six kinds of data: **restaurant discovery**, **business hours**, **menus + prices**, **food imagery**, **delivery availability / fees**, and **ratings**. No single legitimate source covers all six, and the source that would (delivery marketplaces) is closed to third-party consumer apps. The architecture below follows from that.

## 1. Summary verdict

| Need | Best legitimate source | Automated? | Verdict |
|---|---|---|---|
| Discover restaurants + branches | OpenStreetMap (Overpass API) | Yes, keyless | **Primary.** Free, real, chain-tagged via `brand:wikidata`. Coverage of independents is uneven. |
| Enrich / fill gaps | Google Places API (New), Foursquare Places | Yes, keyed + billed | **Optional enrichment.** Best coverage, but Google forbids storing content beyond `place_id`. |
| Hours | OSM `opening_hours`; Google `currentOpeningHours` (incl. special days) | Yes | Published hours only. **Never** proof of order acceptance. |
| Menus + prices | Admin-curated catalog (chain menus first), Spoonacular menu items (nutrition, no prices) | Partially | **No legitimate free API offers location-specific menu prices.** Prices are admin-verified or labeled estimates. |
| Delivery platform presence | Admin-verified store URLs; search deep links | Manual + links | DoorDash/Uber Eats/Grubhub APIs are merchant/POS-partner only. |
| Address-specific delivery coverage, live fees, ETAs | Not available without a partner agreement | No | Always shown as **"Check availability"** with a direct link. |
| Imagery | Admin-entered official/licensed URLs; Google Places photos (live, attributed); Wikimedia Commons (licensed) | Partially | Unknown imagery falls back to a designed placeholder, never a stock photo passed off as the item. |
| Ratings | Google Places (live, attributed) | Keyed | Shown with source + count only when an adapter supplied them. |

## 2. Delivery platforms — can we programmatically access public listings?

### DoorDash
- **Marketplace API** (menus, store hours, orders): "Limited access — not generally available." Built for merchants and their POS/middleware partners to *push* their own menus *into* DoorDash. It does not let a third-party consumer app read other restaurants' listings.
- **DoorDash Drive**: on-demand courier dispatch for your own goods. Not discovery, not menus.
- **Consumer site ToS** prohibit automated access (scraping, crawlers) and the site is protected by bot mitigation. Collecting it would require bypassing access controls → **prohibited for CRAVE**.

### Uber Eats
- **Marketplace APIs** (store, menu, order): "Access may require written approval from Uber," scoped to merchants and approved integrators managing *their own* stores. The Uber Eats API Terms explicitly ban spiders/crawlers/robots.
- **Uber Direct**: courier dispatch, not discovery.
- → **No authorized read path to listings for CRAVE today.**

### Grubhub
- **Partner APIs** (menu ingestion, onboarding, orders) exist for POS/integration partners acting on behalf of merchants. No public consumer listing API.
- → **No authorized read path today.**

### What we *can* do legitimately
1. **Search deep links** — public, unauthenticated URLs that open the platform's own search for a restaurant name near the user (`doordash.com/search/store/…`, `ubereats.com/search?q=…`, `grubhub.com/search?queryText=…`). These are links, not data collection.
2. **Verified store URLs** — an admin (or a restaurant owner) pastes the exact store page URL after checking it by hand. Stored with `source = manual`, `verified_at`, `verified_by`.
3. **Restaurant-owned ordering** — chains publish their own ordering sites/apps; those links are first-class "Order direct" options.
4. **Adapter slots** — `DoorDashAdapter`, `UberEatsAdapter`, `GrubhubAdapter` exist with capability flags (`listingLookup`, `addressCoverage`, `liveQuote`, `deepLink`). Today only `deepLink` and `manualListing` are true. If a partnership is signed, implementing the adapter methods turns the other capabilities on without schema or UI changes.

### Third-party aggregators (e.g. MealMe)
MealMe sells menu/quote APIs (~$0.10/call or $250/mo at time of writing) and describes aggregating "realtime updates of individual webpages." Because the upstream provenance of that data is unclear relative to the platforms' ToS, CRAVE ships an **adapter stub that is disabled by default** and documented as "requires legal review of upstream licensing before enabling."

## 3. Discovery sources

| Source | Access | Licensing / storage | Expected cost | Reliability |
|---|---|---|---|---|
| **OpenStreetMap via Overpass** | No key. Public instances ask for ≤ ~10k req/day and fair use; self-host for scale. | **ODbL** — may store and cache; must attribute "© OpenStreetMap contributors"; share-alike applies to a publicly distributed derived *database*. | $0 (or a small VPS to self-host Overpass) | Chains in Tucson are well tagged with `brand`, `brand:wikidata`, `cuisine`, `opening_hours`. Independents: variable. Hours can be stale. |
| **Google Places API (New)** | API key + billing. | **Cannot pre-fetch, cache or store content except `place_id`** (lat/lng up to 30 days). Must show attribution; photos/reviews carry author attributions. | Pay-as-you-go with ~10k free billable events per SKU/month (since Mar 2025). Text Search / Details "Pro/Enterprise" SKUs run roughly $20–40 per 1,000; Photos ~$7 per 1,000. | Best coverage + `currentOpeningHours` with special days, ratings, photos. |
| **Foursquare Places API** | Key; pay-as-you-go, ~10k free Pro calls. | Commercial terms; Pro vs Premium fields. | Low at Tucson scale. | Good POI coverage, categories, chains. |
| **Foursquare OS Places** (open dataset) | Download (Apache 2.0). | Permissive. | $0 + storage. | Good bulk seed; no hours. |
| **Yelp Places API** | Paid only after 30-day trial. | Display-oriented license, strict attribution. | $229–$643/mo + overage. | Strong ratings data; expensive for a v1. **Not used in v1.** |
| **Overture Maps Places** | Download (CDLA-Permissive). | Permissive. | $0 + storage. | Good dedupe/bulk seed; no hours. Future option. |

**Decision:** OSM/Overpass is the automated backbone (it's the only source we may *store* freely). Google Places is an optional live-enrichment adapter that only persists `place_id` and fetches details on demand with short in-memory caching (TTL ≤ 15 min, within ToS for transient caching of a response being displayed). Foursquare adapter is included for coverage.

## 4. Geocoding

| Source | Access | Notes |
|---|---|---|
| **US Census Geocoder** | No key, public domain | US addresses only — perfect for Tucson. Default. |
| **Nominatim (OSM)** | No key; 1 req/s, identifying User-Agent required, no bulk | Fallback + reverse geocoding for "use my location". |
| **Google Geocoding** | Key + billing | Optional, used only if configured. |

## 5. Menus, prices, nutrition

- **There is no legitimate, free, location-specific menu-price API.** Prices vary by franchisee and by channel (delivery menus are routinely marked up 10–30% over in-store).
- **Spoonacular Menu Items** — ~115k chain items with nutrition; no prices, no locations. Free tier 150 points/day; paid $29–$149/mo. Adapter included (nutrition enrichment only).
- **Nutritionix** — 200k+ restaurant foods with dietitian-verified nutrition; $499+/mo. Adapter slot documented, not built (cost).
- **Strategy:** a curated **chain catalog** (national + regional chains first, per the brief) with item names, descriptions, categories and portion notes compiled from chains' public menus. Prices are stored with an explicit `price_status`:
  - `verified` — an admin checked this location's price on a dated source.
  - `estimate` — a typical range, never shown as a quote; UI says "Est."
  - `unknown` — UI says "Price not verified".
- Independents get menus only through the admin dashboard (or a future restaurant self-serve flow).

## 6. Fees, tax, totals

- Delivery fee, service fee, small-order fee and minimums are set per platform, per address, per moment. With no partner API, CRAVE **never displays a platform fee as fact**.
- The order estimator shows: item subtotal (verified or estimated), **estimated** Tucson sales tax (Pima County / City of Tucson combined rate is configurable per market, default 8.7%), user-chosen tip, and a **user-adjustable delivery-cost assumption** clearly labeled as the user's own estimate. It never combines one platform's menu price with another's fees as a single quote.

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| OSM hours stale | Show source + last verified date; admin overrides; never infer order acceptance. |
| Chain catalog drifts from reality | Per-item `verified_at`; refresh queue surfaces items older than 90 days in the admin dashboard. |
| Public Overpass instance throttles | Token-bucket limiter, exponential backoff, Retry-After, configurable endpoint (self-host). |
| Duplicate places (OSM + Google + manual) | Dedupe on `brand_wikidata` + ≤ 60 m distance, normalized-name similarity, phone match; virtual brands linked to a host kitchen rather than merged. |
| Platform ToS change | Adapters are isolated; capability flags drive UI. Enabling anything requires a code change + review, not a toggle. |

## 8. Resulting architecture (implemented)

```
Discovery adapters ─┐                      ┌─> restaurants (+ field-level provenance)
 (OSM, Google,      ├─> normalize ─> dedupe├─> restaurant_sources (raw payload hash)
  Foursquare)       ┘                      └─> data_changes (change detection log)
Menu adapters (catalog, Spoonacular) ─────────> menu_items (+ price_status, verified_at)
Delivery adapters (DoorDash/UberEats/Grubhub/
  Direct; link-only today) ──────────────────> delivery_listings (listing ≠ coverage ≠ live)
Admin dashboard ───────────────────────────────> any table, source = 'manual', verified_by
Scheduled refresh (Vercel Cron / pg_cron) ─────> refresh_runs (rate-limited, diffed)
```

Tucson (`America/Phoenix`, no DST) is the first market row in `markets`; adding a market is a row (bbox, timezone, tax rate), not a code change.
