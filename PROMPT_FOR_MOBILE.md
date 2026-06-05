# Prompt: Make track.it Mobile-Friendly (PWA)

> Paste this whole file to Claude Code when you're ready to start the mobile pass.
> It captures the decisions already made so you don't have to re-explain.

---

## Goal

Make the **track.it** web app fully usable and pleasant on a phone, and make it
**installable as a PWA** (Add to Home Screen, offline-capable, standalone fullscreen).
The target is **full feature parity with desktop** — everything I can do on desktop
(dashboards, expense splits, installments, settings) I should be able to do on my phone.
This is not a "quick capture only" companion; it's the same app, responsive.

## Current stack (don't change frameworks)

- **Frontend:** React 18 + Vite, Tailwind CSS 3, React Router 6, TanStack Query 5, axios
- **Pages** (`frontend/src/pages/`): Dashboard, Expenses, Income, Installments, Loans,
  Bills, Calendar, People, PaymentMethods, Settings, Summary, Login
- **Components:** `frontend/src/components/layout/` and `frontend/src/components/shared/`
- **Backend:** FastAPI (`backend/app`), JWT auth (access token + httpOnly refresh cookie),
  Postgres via SQLAlchemy. Deployed on Railway; frontend served separately.

Keep the existing design language — just adapt it for small screens. Don't rewrite working
desktop layouts; make them responsive with Tailwind breakpoints (`sm:`, `md:`, `lg:`).

---

## Scope of work

### 1. Responsive layout pass (foundation — do this first)
- Audit every page for phone widths (360–430px). Fix horizontal overflow, tiny tap targets
  (min 44×44px), cramped tables, and modals that don't fit.
- Convert wide data tables (Expenses, Installments, Loans, Bills, Income) into a
  **card/list view on mobile**, table on `md:` and up.
- Make all modals/forms full-screen or bottom-sheet style on mobile.
- Ensure the Dashboard and Summary charts/cards stack cleanly and stay readable.
- Make Calendar usable on a phone (this is usually the hardest — consider an agenda/list
  view on mobile instead of a full month grid).
- Respect safe areas (notch / home indicator) with `env(safe-area-inset-*)`.

### 2. Mobile navigation — bottom tab bar + FAB
- Replace (or supplement) the desktop sidebar with a **fixed bottom tab bar** on mobile
  showing the 4–5 most-used destinations (suggest: Dashboard, Expenses, Calendar, Summary,
  + a "More" sheet for the rest).
- Add a **floating action button (FAB)** for quick-add. Tapping it opens a quick-add sheet
  (default: add expense) with a way to switch to income/bill/etc.
- The sidebar stays for desktop (`md:` and up); bottom bar shows only on mobile.

### 3. Quick-add + receipt capture
- A fast bottom-sheet form to log an expense in as few taps as possible: amount-first,
  big numeric keypad-friendly input, category, payment method, date defaulting to today.
- **Receipt scan:** allow attaching a photo from camera/gallery (`<input capture>`).
  Phase 1: just attach/store the image to the expense. Phase 2 (optional, note it as
  future): OCR to auto-fill amount/merchant. Flag clearly which phase you're implementing.
- Will need a backend change to store an image reference on expenses — propose the
  minimal schema/migration and confirm before running it against prod (Supabase DB is
  already migrated; new model changes need a deliberate `alembic` migration).

### 4. Gestures & pull-to-refresh
- **Swipe actions** on list items (Expenses, Bills, etc.): swipe to reveal edit/delete.
- **Pull-to-refresh** on the main list pages (re-fetch via TanStack Query `refetch`).
- **Swipe between months** on Calendar and Summary (ties into the existing month navigator).
- Prefer a small, well-maintained library over hand-rolling touch math; propose the lib
  and keep bundle size in mind. Make sure gestures don't fight native scroll.

### 5. Biometric / PIN app lock
- Optional lock screen for the app since it holds financial data.
- On the **web/PWA**, true FaceID/fingerprint isn't directly available, so:
  - Implement a **PIN lock** (stored hashed locally, gates the app on open/resume), and
  - Use the **WebAuthn / Web Authentication API** for platform biometrics where supported
    (FaceID/Touch ID/Android biometric prompt via passkey-style auth), falling back to PIN.
- Add a Settings toggle to enable/disable the lock and set/change the PIN.
- Lock on app background/resume after a configurable timeout.

### 6. PWA setup
- Add a web app manifest (name, icons in all required sizes, theme/background color,
  `display: standalone`, portrait orientation).
- Add a service worker (use `vite-plugin-pwa` — it fits this Vite setup well).
  - Cache the app shell and static assets for offline load.
  - Be careful with API caching: auth'd financial data should use network-first or
    stay uncached; don't serve stale balances. Define a sensible runtime caching strategy.
- Add an **"Install app"** prompt/affordance (listen for `beforeinstallprompt`).
- Generate/include all required icon and splash assets (note if you need me to provide a
  logo; otherwise generate placeholders I can swap).
- Verify it passes the Lighthouse PWA checks.

---

## Constraints & notes

- **Don't break desktop.** Everything should still look and work as it does now on wide
  screens. Mobile is additive/responsive, not a rewrite.
- **Auth:** the app uses an httpOnly refresh cookie + access token. Make sure PWA/standalone
  mode and any service worker don't break cookie-based refresh or CORS. Production frontend
  origin is `https://track-it.danpablo.dev` (already in backend `ALLOWED_ORIGINS`).
- **Backend changes** (receipt images, any new fields) require an Alembic migration that I
  must run deliberately against the Supabase DB. Always propose the migration and pause for
  my confirmation before touching prod data.
- Keep PRs/commits scoped: ideally land the **responsive pass + bottom nav + PWA shell**
  first (the highest-value foundation), then layer quick-add/receipt, gestures, and app lock.

## Suggested order of work

1. Responsive layout pass (all pages) + safe areas
2. Bottom tab nav + FAB + mobile "More" sheet
3. PWA manifest + service worker + install prompt
4. Quick-add sheet (expense) — frontend only first
5. Receipt capture (attach image) + backend field + migration
6. Gestures (swipe actions, pull-to-refresh, swipe months)
7. PIN lock + WebAuthn biometrics + Settings toggle

## Acceptance criteria

- [ ] Every page is usable with no horizontal scroll at 390px wide
- [ ] Tap targets ≥ 44px; modals/forms fit the screen
- [ ] Bottom nav + FAB on mobile; sidebar preserved on desktop
- [ ] Installable to home screen; loads offline (app shell); passes Lighthouse PWA
- [ ] Quick-add expense in ≤ 4 taps from anywhere
- [ ] Receipt photo attaches to an expense
- [ ] Swipe-to-edit/delete and pull-to-refresh work on list pages
- [ ] Optional PIN/biometric lock, toggleable in Settings
- [ ] Desktop experience unchanged

---

## Open questions for future-me to decide when starting

- Receipt OCR: ship phase 1 (attach only) now, or invest in auto-fill?
- Push notifications (bill reminders already exist via Telegram — do we also want web push)?
- Offline *writes* (queue an expense added offline and sync later) — worth it, or online-only?
