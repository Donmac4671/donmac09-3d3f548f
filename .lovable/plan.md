## Overview

Big multi-part update covering bundles, ordering, admin, resellers, auth, live chat, and a public API. I'll break it into phases so we can ship and verify in chunks.

## Phase 1 — Bundle catalog + pricing

1. Add two new networks at the **top** of the Data Bundles section:
   - **MTN MASHUP DATA** (8 packages): 1.7GB ₵6, 3.4GB ₵12, 5.1GB ₵18, 6.8GB ₵24, 8.5GB ₵30, 10.2GB ₵36, 15.3GB ₵54, 20.4GB ₵72.
   - **MTN MASHUP MINUTES + DATA** (4 packages): 350min+870MB ₵20, 700min+1.6GB ₵30, 1000min+2.6GB ₵40, 1400min+3.5GB ₵50.
2. Final network order: MTN MASHUP DATA → MTN MASHUP MINUTES+DATA → MTN → TELECEL → AT BIG TIME → AT PREMIUM.
3. **Remove**: old Mashup, Airtime, Telecel V+D+S.
4. **Telecel new prices**: 2GB ₵9.50, 3GB ₵14.20, 5GB ₵21.20, 10GB ₵40, 15GB ₵59, 20GB ₵79, 25GB ₵97, 30GB ₵116, 40GB ₵154, 50GB ₵189.
5. **MTN cost map** (admin profit calc) updated to: 1GB 3.74, 2GB 7.47, 3GB 11.22, 4GB 14.94, 5GB 18.69, 6GB 22.42, 7GB 26.16, 8GB 29.90, 10GB 37.37, 15GB 56.06, 20GB 74.74, 25GB 93.47, 30GB 112.11, 40GB 149.48, 50GB 186.85.
6. Mashup cost maps added for profit analytics (values provided).
7. The two new Mashup networks **do not route to GHData** — they go to manual fulfillment (admin marks delivered).

## Phase 2 — Bundle online/offline status

- Add an `is_online` flag per bundle (default online). Reuse existing `hidden_bundles` mechanism but with a new status (online/offline) so packages still display.
- In admin Bundle Visibility: toggle Online/Offline per package.
- On storefront/dashboard: offline packages are shown but greyed out with an "Offline" badge; cart/checkout blocks them.

## Phase 3 — Live chat width fix

- Constrain message bubbles in live chat to `max-w-[80%]` with `break-words` / `whitespace-pre-wrap` so long text wraps instead of stretching the panel.

## Phase 4 — Reseller flow polish

- Admin creates resellers (already in AdminResellers). After first login, if the reseller has no `reseller_stores` row, redirect to a **"Create your store"** onboarding screen (slug, name, WhatsApp, store message).
- After store is created, reseller sees MyStore with: set prices, profit card, withdrawal request, withdrawal history (already mostly built — verify and polish).
- Storefront customers continue to be hidden from MyStore (already shipped).
- **Main login** rejects users whose role is reseller-customer (has a `store_referrals` row) — they must use their reseller storefront URL.

## Phase 5 — Auth: turn off email confirmation

- Call `configure_auth` with `auto_confirm_email: true`. Storefront signups (and all signups) will skip email confirmation.

## Phase 6 — Public API for external sites

New edge function `public-api` with these endpoints, authenticated by Bearer API token:
- `GET /networks` — list available bundles.
- `POST /orders` — place an order (network, phone, bundle). Debits the API owner's wallet, creates order, routes to GHData (or manual for Mashup).
- `GET /orders/:ref` — order status.
- `POST /wallet/balance` — check balance.

Tables:
- `api_tokens` (id, user_id, token_hash, label, last_used_at, created_at, revoked_at)
- `api_webhooks` (user_id, url, secret, events)
- `api_order_logs` for debugging.

Outgoing webhook: when an order's status changes, POST `{ ref, status, ... }` signed with HMAC to the user's webhook URL.

## Phase 7 — Profile → API section

- New "API Access" card in Profile:
  - Generate token (shown once, copy button), list tokens, revoke.
  - Webhook URL input + secret display + "Test webhook" button.
  - Link to API Documentation page (`/api-docs`) with examples (curl + JS) for every endpoint.

## Technical Notes

- New migration: `bundle_status` table or extend `hidden_bundles` with `status` enum (`hidden`,`offline`); `api_tokens`, `api_webhooks`, `api_order_logs` tables with RLS scoping to `auth.uid()`.
- `pay_with_wallet` RPC reused by the public API edge function via service role, passing the resolved `user_id`.
- Network constants in `src/lib/data.ts` extended with `mtn_mashup_data` and `mtn_mashup_minutes` ids; checkout/dispatcher branches skip GHData for these ids (same path used for current `mashup`/`airtime`).
- Admin profit analytics cost map gains the two new bundle sets.
- Live chat fix is CSS-only in the chat message component.

## Suggested order of delivery

I'll ship in this order so you can test as we go:

1. Phase 1 + 2 + 3 (catalog, pricing, online/offline, chat fix) — one batch.
2. Phase 4 + 5 (reseller onboarding + auth confirm off) — one batch.
3. Phase 6 + 7 (public API + Profile UI + docs page) — final batch.

Approve and I'll start with batch 1.