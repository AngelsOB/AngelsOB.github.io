# PRD-006: Monetization & Subscription Tiers

> **Status:** In Progress (Phase 1, 2 complete; Phase 3A, 3B complete)
> **Created:** 2026-03-06
> **Updated:** 2026-03-15
> **Depends on:** PRD-002 (Users, Cloud Storage, Sharing)
> **Phases:** 3 (Tier Infrastructure, Payment Integration, Premium Features)

---

## Context

BeerApp is a fully-featured homebrewing recipe builder with cloud storage, community sharing, and advanced calculators — all currently free. The app has no revenue stream and no way to sustain ongoing costs (hosting, Firestore reads/writes, future LLM API calls for PRD-003).

The homebrewing software market has established pricing norms:
- **Brewfather:** Free (25 recipes) → ~$30/yr (unlimited) → Premium Plus (AI, higher price)
- **BeerSmith:** $19.95-49.95/yr (cloud sync tiers), $44.95 one-time desktop
- **Brewer's Friend:** Free (5 recipes) → $36/yr (unlimited) → $120/yr (groups/alerts) → $149.99 lifetime

BeerApp competes most directly with Brewer's Friend — both are web-first recipe builders, but BeerApp is more approachable with a cleaner UI and better-integrated calculators. Brewfather is more complex/feature-rich but harder to use. BeerApp's value proposition is **approachability + better science in a unified interface**, not feature count.

The monetization model should be lightweight and generous. The tone is "support an indie developer" not "pay or suffer." Users should always feel good about upgrading, never forced.

## Goals

- Two user states for signed-in users: **Free** (5 cloud recipes) and **Premium** (unlimited + extras)
- **Anonymous users can use the full builder** but cannot save — signing in is required to persist recipes
- Anonymous recipe state is preserved through the auth flow so no work is lost
- Premium adds power features that feel like genuine upgrades, not hostage-taking
- Payment processing via Stripe Checkout (no custom payment forms)
- Price point significantly undercuts all competitors to win market share
- AI features (PRD-003) are decoupled — will be a separate tier decision when built

## Non-Goals (For Now)

- Multiple paid tiers (one Premium tier is enough)
- Team/organization plans
- In-app purchase via Apple/Google (web-only payments)
- AI tier or credits (deferred to PRD-003)
- Affiliate/referral system
- Ads (not worth the revenue at our scale, cheapens the product)
- Free trial (price is low enough to be its own trial)

---

## Tier Definitions

### Anonymous (Not Signed In)

No account. The app works as a playground — full builder access, but no saving.

| Feature | Access |
|---------|--------|
| Recipe builder (full) | All calculations, all ingredient sections, all calculators |
| Save recipes | **No** — must sign in to save |
| Browse community recipes | Yes |
| Fork community recipes | No — must sign in |
| Publish/Share recipes | No — must sign in |
| Export (BeerXML/Markdown) | No — must sign in |
| Calculators (ABV, dilution, boil-off) | All |
| Water chemistry | Manual salt entry |

**Landing experience:** Anonymous users land directly on the recipe builder (`/recipes/new` or `/`). No login wall, no splash page. They can immediately start building a recipe. A persistent but dismissable banner at the top of the builder says: "Sign in with Google to save your recipe — it's free and takes one click." The save button is replaced with a "Sign In to Save" button that triggers the auth flow.

**Why no anonymous saving?** This is industry standard — Brewfather, BeerSmith, and Brewer's Friend all require accounts to save. Google sign-in is one click. More importantly, it eliminates the complexity of localStorage recipe management, local-to-cloud migration, and anonymous recipe limits entirely.

**Recipe preservation through auth:** When an anonymous user clicks "Sign In to Save", the current in-progress recipe must be preserved through the Google auth redirect. Before redirecting to Google, stash the recipe JSON in `sessionStorage`. After sign-in completes and the page reloads, check `sessionStorage` for a pending recipe and prompt the user to save it to their new account.

**Upgrade nudge:** "Sign in with Google to save your recipe — it's free and takes one click."

### Free (Signed In)

Signed in with Google. Recipes sync to Firestore.

| Feature | Access |
|---------|--------|
| Cloud-saved recipes | **5 max** (published recipes count toward limit) |
| Recipe builder (full) | All calculations, all sections |
| Calculators | All |
| Browse community recipes | Yes |
| Fork community recipes | Yes (counts toward recipe limit) |
| Publish/Share recipes | Yes |
| Version history | Yes |
| Export (BeerXML/Markdown) | **No** — Premium only |
| Enhanced brew mode | **No** — Premium only |
| Auto water salt calculator | **No** — Premium only |
| Brew session tracking | Basic |

**Why 5 recipes?** Matches Brewer's Friend's free tier and creates a conversion moment at the right time — 5 recipes covers a few favorites, but a brewer who's actively developing recipes will hit it within a month or two. At $1.99/month, the upgrade is an impulse buy.

**Why free users can publish?** Published recipes drive community content, browse page traffic, and SEO. Every free user who publishes makes the platform more discoverable. This is good for growth.

**Upgrade nudge:** Shown when user hits 5-recipe limit: "You've got 5 recipes — you're clearly serious about this. Unlock unlimited recipes for just $1.99/month."

### Premium ($1.99/month or $19.99/year)

~$24/year monthly, ~$20/year annual. The cheapest paid plan in the homebrewing software market.

| Feature | Access |
|---------|--------|
| Cloud-saved recipes | **Unlimited** |
| Export (BeerXML + Markdown) | Yes |
| Enhanced brew mode | Yes — guided brew-day tracking with target vs actual comparisons |
| Auto water salt calculator | Yes — enter target profile → get exact salt additions |
| Premium browse badge/boost | Yes — subtle badge on published recipes, slight ranking boost in browse |
| Everything in Free | Yes |

**Why this is worth paying for:**
1. **Unlimited recipes** — the primary conversion driver
2. **Export** — proof the app is strong enough that you want to take data elsewhere
3. **Enhanced brew mode** — follow along on brew day, record stats, know if you hit your numbers
4. **Auto water calc** — solves the full 6-ion/5-salt optimization problem, not available for free elsewhere
5. **Browse boost** — premium users' recipes get subtle visibility boost (these are likely the strongest recipes anyway)

---

## Pricing Rationale

**$1.99/month** is an impulse purchase, not a budget decision. It undercuts every competitor while keeping Stripe fee overhead reasonable (18% vs 23% at $1.49):

| App | Cheapest Paid Tier | BeerApp |
|-----|-------------------|---------|
| Brewfather | ~$2.50/month ($30/yr) | **$1.99/month** |
| BeerSmith | ~$1.66/month ($19.95/yr) | **$1.99/month** |
| Brewer's Friend | ~$3.00/month ($36/yr) | **$1.99/month** |

At this price, the goal is market share over margin. Every brewer who uses BeerApp contributes to the community recipe library and SEO, whether they pay or not. Premium is for the brewers who brew regularly enough to need unlimited recipes and power features — and for anyone who just wants to support an indie project.

**Annual billing:** $19.99/year saves ~$4 vs monthly (~2 months free). Standard pattern, available from launch.

---

## Data Model

### `users/{userId}` Document

This document already exists from PRD-002 (with `displayName`, `email`, `photoURL`). Extend it:

```
users/{userId}
  - displayName: string
  - email: string
  - photoURL: string | null
  - createdAt: Timestamp
  - tier: 'free' | 'premium'                    ← current effective tier (updated by webhook)
  - recipeCount: number                          ← maintained on recipe create/delete, used for limit enforcement
  - stripeCustomerId: string | null              ← Stripe customer ID
  - subscriptionStatus: 'none' | 'active' | 'past_due' | 'canceled'
  - subscriptionCurrentPeriodEnd: Timestamp | null
```

### Computed Tier Logic

The effective tier is determined by:

```
1. If subscriptionStatus === 'active' → Premium
2. Otherwise → Free
```

Simple. No trial states, no expiry logic, no computed windows. The `tier` field on the document is a cached value updated by the Stripe webhook — but the canonical source of truth is `subscriptionStatus`.

### Recipe Count Tracking

The `recipeCount` field on the user document is the source of truth for limit enforcement:
- **Incremented** when a recipe is created (including forks)
- **Decremented** when a recipe is deleted
- **Checked** before allowing new recipe creation: `if (recipeCount >= 5 && tier !== 'premium') → block`
- **Server-side enforcement:** API routes (e.g., `/api/fork`) read the user doc and check `recipeCount` before creating recipes
- **Firestore security rules:** Recipe `create` rules validate against the user doc's `recipeCount` and `tier`

This is cheap — one read of the user doc per recipe create. No aggregation queries, no counting documents.

**Migration note:** No existing users have `recipeCount` fields yet. Since there are no real users on the platform currently, all new accounts will be created with `recipeCount: 0` from day one. No backfill or migration needed.

**Implementation note:** `recipeCount` is maintained via Firestore `runTransaction()` — each recipe create/delete atomically updates both the recipe doc and the user doc's `recipeCount` in a single transaction. This minimizes total Firestore operations (no separate Cloud Function invocations). **Future improvement:** if recipe write paths proliferate or become more complex, consider migrating to Cloud Functions `onCreate`/`onDelete` triggers on `recipes/{recipeId}` to decouple counting from application code entirely.

### localStorage as Offline Cache

The existing localStorage system is **retained as an offline cache for signed-in users**. This reduces Firestore reads and provides offline resilience:
- Signed-in users write to both Firestore and localStorage
- On load, the app reads from localStorage first (instant) and syncs with Firestore in the background
- This is the existing behavior from PRD-002 — no changes needed
- Anonymous users do NOT get localStorage saving (the builder works in-memory only until they sign in)

---

## Architecture

### Anonymous → Signed In Flow (Recipe Preservation)

```
Anonymous user builds a recipe in the editor
    → Clicks "Save" or "Sign In"
    → App serializes current recipe to sessionStorage (key: 'pending-recipe')
    → Google auth redirect
    → User signs in with Google
    → Page reloads, auth state restored
    → App checks sessionStorage for 'pending-recipe'
    → If found: prompt "Save the recipe you were working on?" with [Save] [Discard]
    → On save: create recipe in Firestore, increment recipeCount
    → Clear sessionStorage key
```

This ensures zero data loss through the auth redirect. The recipe is preserved even if the page fully reloads.

### Payment Flow (Stripe Checkout)

```
User clicks "Upgrade"
    → Client calls POST /api/checkout
    → Server creates Stripe Checkout Session (with userId in metadata)
    → Server returns session URL
    → Client redirects to Stripe Checkout
    → User pays on Stripe's hosted page
    → Stripe redirects to /account?session_id=xxx (success page)
    → Stripe fires webhook → POST /api/webhooks/stripe
    → Webhook handler updates users/{userId} document:
        - tier: 'premium'
        - subscriptionStatus: 'active'
        - stripeCustomerId: cus_xxx
        - subscriptionCurrentPeriodEnd: <timestamp>
    → Client detects user doc change (Firestore listener) → UI updates
```

### Cancellation Flow

```
User clicks "Manage Subscription"
    → Client calls POST /api/billing-portal
    → Server creates Stripe Billing Portal session
    → Client redirects to Stripe portal
    → User cancels in Stripe portal
    → Stripe fires webhook (subscription.updated with cancel_at_period_end)
    → Webhook updates subscriptionStatus: 'canceled'
    → User retains Premium until subscriptionCurrentPeriodEnd
    → At period end, Stripe fires subscription.deleted webhook
    → Webhook updates: tier: 'free', subscriptionStatus: 'none'
```

### Recipe Limit Enforcement

Enforcement happens at **three levels:**

1. **Client-side (UX):** Before creating a new recipe, check `recipeCount` from the user doc. If count >= 5 and tier !== 'premium', show the upgrade modal instead of saving. This is the primary enforcement — it's immediate and provides a good UX.

2. **Server-side (API routes):** Routes like `/api/fork` read the user doc and check `recipeCount` before creating recipes.

3. **Firestore security rules (hard stop):** Recipe `create` rules read the user doc and reject writes when `recipeCount >= 5` and `tier !== 'premium'`. This prevents any client-side bypass.

### Feature Gating Pattern

A shared utility determines feature access:

```ts
// src/modules/auth/tierAccess.ts

export type UserState = 'anonymous' | 'free' | 'premium';

export type Feature =
  | 'save_recipe'
  | 'unlimited_recipes'
  | 'export'
  | 'enhanced_brew_mode'
  | 'auto_water_calc'
  | 'fork'
  | 'publish';

const REQUIRES_AUTH: Feature[] = [
  'save_recipe',
  'fork',
  'publish',
  'export',
];

const PREMIUM_FEATURES: Feature[] = [
  'unlimited_recipes',
  'export',
  'enhanced_brew_mode',
  'auto_water_calc',
];

export function canAccess(feature: Feature, state: UserState): boolean {
  if (state === 'anonymous') {
    return !REQUIRES_AUTH.includes(feature) && !PREMIUM_FEATURES.includes(feature);
  }
  if (state === 'premium') return true;
  return !PREMIUM_FEATURES.includes(feature);
}
```

UI components call `canAccess()` and render either the feature, a sign-in prompt (anonymous), or an upgrade prompt (free). This keeps gating logic centralized and easy to adjust.

---

## Tech Stack Addition

```
Payments:       Stripe (Checkout + Billing Portal + Webhooks)
New deps:       stripe (server-side SDK)
```

### Why Stripe?

- Industry standard for SaaS subscriptions
- Hosted Checkout page means no PCI compliance burden (we never handle card data)
- Billing Portal handles subscription management (cancel, update payment method) with zero custom UI
- Webhooks provide reliable async payment event handling
- Generous startup pricing (2.9% + $0.30 per transaction)
- Excellent Next.js integration patterns

---

## Phase 1: Tier Infrastructure (No Payments Yet)

Build the user tier system, feature gating, anonymous UX, and upgrade prompts — without Stripe. This lets us test the UX and gating logic before introducing real payments.

### Implementation Order & Break Points

Phase 1 is split into 5 sequential steps. Each step has a **break point** — a stop-and-verify moment before moving on. Don't skip these; later steps depend on earlier ones being correct.

#### Step 1: `tierAccess.ts` + unit tests ✅ COMPLETE
> **Files:** `src/modules/auth/tierAccess.ts`, `src/modules/auth/tierAccess.test.ts`
> **Break point:** All 19 unit tests pass (`npx vitest run src/modules/auth/tierAccess.test.ts`).
> **Risk:** None — additive only, nothing imports it yet.

#### Step 2: User doc schema + `recipeCount` tracking ✅ COMPLETE
> **Files:** Modify `authStore.ts` (or `AuthProvider.tsx`) to create/read user doc on sign-in. Modify `FirestoreRecipeRepository.ts` to use transactions for recipe writes that also update `recipeCount`. Create `useUserTier.ts` hook.
>
> **Break point:** Sign in → user doc created with `tier: 'free'`, `recipeCount: 0`. Save a recipe → `recipeCount` = 1. Delete → `recipeCount` = 0. Existing save/edit/delete flows still work. **This is the highest-risk step** — it changes how every recipe write works.
>
> **Risk: MEDIUM.** Touches the recipe save/delete path. Transactional writes replace single-doc `setDoc()`/`deleteDoc()`. If transaction logic is wrong, saves break for everyone.
>
> **Key decisions:**
> - User doc read goes in `AuthProvider.tsx` (it already runs `onAuthStateChanged` and force-reloads stores — adding a user doc read here keeps the auth lifecycle in one place)
> - `useUserTier()` reads from a new Zustand slice in `authStore.ts`, NOT from a separate store — keeps auth state unified
> - Transaction scope: `recipes/{recipeId}` + `users/{userId}.recipeCount` in one `runTransaction()` call
> - The `/api/recipes/delete` route (admin SDK) must also decrement `recipeCount` — use `FieldValue.increment(-1)` since admin bypasses rules

#### Step 3: Recipe limit enforcement ✅
> **Files:** Modify `recipeStore.ts` (check count before create). Update `firestore.rules` (hard stop on write). Modify `BetaBuilderPage.tsx` (grey out save, show modal). New `RecipeLimitModal.tsx`. Modify `RecipeListPage.tsx` (warning badge on recipe count chip). Modify `ForkButton.tsx` (limit check before fork).
>
> **Implementation notes:**
> - Three-layer enforcement: UI gating (greyed save button + modal) → store guard (`checkRecipeLimit()` in recipeStore) → Firestore security rules (hard stop on `create`)
> - Save button stays as "Save & Close" but gets `opacity-50` when at limit; clicking opens `RecipeLimitModal` instead of saving
> - Recipe count chip on My Recipes page shows ⚠️ notification badge (animated wiggle/pulse) when at limit; badge and chip are both clickable → opens `RecipeLimitModal`; hover tooltip provides context
> - `RecipeLimitModal` is a standalone component (`src/modules/auth/components/RecipeLimitModal.tsx`) reused in both builder and recipe list pages
> - Editing existing recipes is never blocked — only new creates are gated
> - Fork limit check uses toast (not modal) since it's a single-action button
>
> **Break point:** Create 5 recipes → 6th blocked. Delete one → can create again. Fork at limit → blocked. Direct Firestore write at limit → rejected by security rules.
>
> **Risk: MEDIUM.** Firestore rule changes affect all recipe writes. A bad rule can lock out legitimate saves.

#### Step 4: Anonymous UX — `SignInPrompt` + recipe preservation ✅ COMPLETE
> **Files:** New `SignInPrompt.tsx`. Modify `BetaBuilderPage.tsx` (gate save button, auto-save after sign-in, dismissable banner).
>
> **Break point:** Build recipe while anonymous → click "Sign In to Save" → sign in via popup → recipe auto-saves → appears in My Recipes with correct count. Dismissable banner disappears on X click. Existing save flow unchanged for signed-in users.
>
> **Implementation note:** Since `signInWithGoogle` uses `signInWithPopup` (not redirect), the recipe in Zustand survives the popup — no `sessionStorage` preservation was needed. A `useEffect` watching the `user` transition from null → signed-in triggers auto-save with a 500ms delay to let `AuthProvider` sync the user doc first.

#### Step 5: Feature gating UI — `UpgradeModal`, `TierBadge`, export gating ✅ COMPLETE
> **Files:** New `UpgradeModal.tsx`, `TierBadge.tsx`. Modify `RecipeListPage.tsx`, `PublicRecipeView.tsx`, `BrowseCard.tsx` (export gating). Modify `UserMenu.tsx` (TierBadge). Modify `ModalOverlay.tsx` (portal + entrance animation). Modify `SectionSidebar.tsx` (portal to body). Modify `ClientShell.tsx` (add `id="app-shell"`). Modify `index.css` (modal keyframes).
>
> **Break point:** Free user sees greyed-out export buttons in recipe card menu → clicks one → UpgradeModal. TierBadge shows "Free" or "Premium" in user menu dropdown. Premium user (set tier manually in Firestore) sees none of this.
>
> **Implementation notes:**
> - No lock icons — premium features are greyed out (`opacity-50`) and show `UpgradeModal` on click
> - No `UsageMeter` component — the existing recipe count chip with ⚠️ badge (from Step 3) already serves this purpose
> - Auto water salt calculator gating is infrastructure-ready (`canAccess('auto_water_calc')`) but the feature UI itself is not yet built
> - `UpgradeModal` accepts an optional `reason` prop for contextual messaging (e.g., "Export is a Premium feature.")
> - Export gating applied in three locations: `RecipeListPage.tsx` (My Recipes cards), `PublicRecipeView.tsx` (shared recipe page), `BrowseCard.tsx` (browse page cards)
> - All modals now use `createPortal(…, document.body)` in `ModalOverlay.tsx` to escape stacking context issues (e.g., modals inside recipe cards with transforms)
> - Modal entrance animation: backdrop fades in, modal scales up from click point using CSS custom properties (`--modal-dx`, `--modal-dy`) computed as offset from viewport center to last pointer position
> - Page content (`#app-shell`) scales down to 0.92 with `brightness(0.92)` when a modal opens; skipped when the builder sidebar is present (CSS `transform` on a parent breaks `position: fixed` children)
> - `SectionSidebar` portals to `document.body` so `#app-shell` transform doesn't break the fixed sidebar positioning
> - `ClientShell.tsx` wrapper div has `id="app-shell"` for the scale-down targeting
> - Water salt calculator and enhanced brew mode commented out in upgrade modals (features not built yet)
> - "Buy a solo dev a coffee" messaging in both `RecipeLimitModal` and `UpgradeModal`
>
> **Risk: LOW.** Additive UI components. Worst case: a modal doesn't appear or a button isn't greyed.

### Test Infrastructure

Vitest is already configured (`vitest.config.ts`, pattern `src/**/*.test.ts`). Run all tier-related tests with:
```bash
npx vitest run src/modules/auth/
```

For integration tests (Steps 2-3), test against the Firebase Emulator or dev Firestore. The transactional writes and auth flow are hard to unit test without heavy mocking — manual testing is the primary verification method for these steps.

### New Files

```
src/modules/auth/tierAccess.ts                     ← Feature gating utility (canAccess, UserState, Feature)
src/modules/auth/tierAccess.test.ts                ← Unit tests for feature gating (19 tests)
src/modules/auth/useUserTier.ts                    ← Hook: returns UserState from auth + user doc
src/modules/auth/components/RecipeLimitModal.tsx     ← "Recipe limit reached" modal with upgrade CTA (Step 3)
src/modules/auth/components/UpgradeModal.tsx        ← "Upgrade to Premium" modal with benefits list
src/modules/auth/components/SignInPrompt.tsx         ← "Sign in to save" prompt for anonymous users
src/modules/auth/components/TierBadge.tsx           ← Small "Free" / "Premium" indicator
```

### Modified Files

```
src/modules/auth/authStore.ts
  → On first sign-in, create users/{userId} doc with tier: 'free', recipeCount: 0, subscriptionStatus: 'none'
  → On subsequent sign-ins, read existing doc — do not overwrite any fields

src/modules/auth/components/AuthProvider.tsx
  → Syncs user doc on sign-in, populates authStore with tier/recipeCount

src/modules/beta-builder/presentation/stores/recipeStore.ts
  → Add recipe count check before creating new recipes
  → Increment/decrement recipeCount on user doc on create/delete

src/modules/beta-builder/presentation/components/BetaBuilderPage.tsx
  → Gate save button for anonymous users (show SignInPrompt on click)
  → Auto-save after sign-in via useEffect watching user transition
  → Dismissable sign-in banner for anonymous users

src/modules/beta-builder/presentation/components/RecipeListPage.tsx
  → Export buttons gated with canAccess('export') + UpgradeModal
  → Anonymous banner kept on My Recipes page

src/modules/beta-builder/presentation/components/ModalOverlay.tsx
  → Portal to document.body via createPortal (fixes stacking context)
  → Entrance animation: backdrop fade + modal scale from click point
  → Page content scale-down effect (#app-shell → scale 0.92 + brightness 0.92)
  → Skips scale-down when builder sidebar is present

src/modules/beta-builder/presentation/components/SectionSidebar.tsx
  → Portal to document.body so fixed positioning isn't broken by #app-shell transform

src/modules/sharing/PublicRecipeView.tsx
  → Export button gated with canAccess('export') + UpgradeModal

src/modules/sharing/BrowseCard.tsx
  → Export menu items gated with canAccess('export') + UpgradeModal
  → Fixed hydration mismatch (toLocaleDateString → toISOString().slice(0, 10))

src/modules/sharing/ForkButton.tsx
  → Shows "Sign in to save this recipe" for anonymous users

src/modules/auth/components/UserMenu.tsx
  → TierBadge rendered below user email

app/ClientShell.tsx
  → Added id="app-shell" to wrapper div for modal scale-down targeting

src/index.css
  → Added @keyframes modal-backdrop-in and modal-scale-in

firestore.rules
  → Recipe create rules validate recipeCount + tier

app/layout.tsx (or ClientShell.tsx)
  → No anonymous-specific chrome needed — builder works the same, save is just gated
```

### Phase 1 Implementation Checklist

#### Anonymous UX
- [ ] Anonymous users land directly on the recipe builder — no login wall
- [ ] Full recipe builder works in-memory (all sections, all calculators, all ingredient additions)
- [ ] No localStorage saving for anonymous users — recipe lives in Zustand store only
- [x] Persistent dismissable banner at top of builder: "Sign in with Google to save your recipe — it's free and takes one click"
- [x] Save button replaced with "Sign In to Save" button that triggers Google auth
- [x] Sign-in uses `signInWithPopup` — recipe preserved in Zustand (no sessionStorage needed)
- [x] After sign-in completes, auto-save triggers via useEffect watching user transition
- [x] Recipe list page banner updated for anonymous users (no longer claims local saving)
- [ ] Fork/Publish buttons for anonymous users show `SignInPrompt`
- [ ] Export buttons for anonymous users show `SignInPrompt`
- [ ] Browse page is fully accessible to anonymous users
- [ ] Calculators page is fully accessible to anonymous users

#### User Document & Tier Logic
- [ ] Extend `users/{userId}` document schema with tier fields (tier, recipeCount, stripeCustomerId, subscriptionStatus, subscriptionCurrentPeriodEnd)
- [ ] On first sign-in (user doc doesn't exist yet), create doc with `tier: 'free'`, `recipeCount: 0`, `subscriptionStatus: 'none'`
- [ ] On subsequent sign-ins, read existing doc — do not overwrite any fields
- [ ] Create `useUserTier()` hook that returns `UserState` ('anonymous' | 'free' | 'premium')
- [ ] Create `tierAccess.ts` with `canAccess(feature, state)` utility

#### Free Tier Recipe Limit (5 recipes)
- [ ] Maintain `recipeCount` on user doc: increment on recipe create/fork, decrement on recipe delete
- [ ] In `recipeStore` — before creating a new recipe, check `recipeCount` against limit (5)
- [ ] When limit reached, show `UpgradeModal`
- [ ] Show `UsageMeter` ("3 / 5 recipes") on the My Recipes page
- [ ] Published recipes count toward the 5-recipe limit (they're still in the user's collection)
- [ ] Update `/api/fork` to check `recipeCount` before forking
- [ ] Add Firestore security rule: reject recipe `create` if user doc `recipeCount >= 5` and `tier !== 'premium'`

#### Feature Gating UI
- [ ] Create `UpgradeModal` — shown when free user hits a premium feature:
  - "Upgrade to Premium for $1.99/month" (placeholder until Stripe)
  - Brief list of Premium benefits (unlimited recipes, export, brew mode, water calc)
  - [Upgrade] and [Not Now] buttons
- [ ] Create `TierBadge` — small "Free" / "Premium" indicator in nav or account area
- [ ] Create `UsageMeter` — "3 / 5 recipes" bar for free users
- [ ] Gate export buttons (BeerXML + Markdown download) — show lock icon + "Premium" label, click triggers `UpgradeModal`
- [ ] Gate auto water salt calculator button — show lock icon, click triggers `UpgradeModal`
- [ ] Gate enhanced brew mode (when built) — show lock icon, click triggers `UpgradeModal`

#### Post-Limit Behavior
- [ ] When free user has 5 recipes and tries to create a new one → `UpgradeModal`
- [ ] When free user at limit tries to fork → `UpgradeModal`
- [ ] All existing recipes remain fully editable (no read-only mode)
- [ ] User can delete recipes to get back under 5

#### Testing Checklist (Phase 1)

##### Unit Tests (`tierAccess.test.ts`)
These are pure logic — no mocking, no Firestore, no browser. Set up a test runner (Vitest recommended — already compatible with the Next.js/Turbopack setup) if one doesn't exist.
- [ ] `canAccess('save_recipe', 'anonymous')` → `false`
- [ ] `canAccess('save_recipe', 'free')` → `true`
- [ ] `canAccess('save_recipe', 'premium')` → `true`
- [ ] `canAccess('export', 'anonymous')` → `false`
- [ ] `canAccess('export', 'free')` → `false`
- [ ] `canAccess('export', 'premium')` → `true`
- [ ] `canAccess('fork', 'anonymous')` → `false`
- [ ] `canAccess('fork', 'free')` → `true`
- [ ] `canAccess('publish', 'anonymous')` → `false`
- [ ] `canAccess('publish', 'free')` → `true`
- [ ] `canAccess('unlimited_recipes', 'free')` → `false`
- [ ] `canAccess('unlimited_recipes', 'premium')` → `true`
- [ ] `canAccess('enhanced_brew_mode', 'free')` → `false`
- [ ] `canAccess('auto_water_calc', 'free')` → `false`
- [ ] All features return `true` for `'premium'`

##### Unit Tests (`useUserTier` / tier resolution logic)
- [ ] No auth user → returns `'anonymous'`
- [ ] Auth user, no user doc → returns `'free'` (and creates doc)
- [ ] Auth user, `tier: 'free'` → returns `'free'`
- [ ] Auth user, `tier: 'premium'`, `subscriptionStatus: 'active'` → returns `'premium'`
- [ ] Auth user, `subscriptionStatus: 'canceled'`, `subscriptionCurrentPeriodEnd` in future → returns `'premium'` (grace period)
- [ ] Auth user, `subscriptionStatus: 'canceled'`, `subscriptionCurrentPeriodEnd` in past → returns `'free'`
- [ ] Auth user, `subscriptionStatus: 'past_due'` → returns `'premium'` (Stripe still retrying)

##### Integration Tests (Recipe Count Transactions)
Run against Firebase Emulator or dev Firestore.
- [ ] Create recipe → user doc `recipeCount` increments by 1
- [ ] Delete recipe → user doc `recipeCount` decrements by 1
- [ ] Delete recipe when `recipeCount` is 0 → `recipeCount` stays at 0 (floor, no negative)
- [ ] Fork recipe → user doc `recipeCount` increments by 1
- [ ] Create recipe via direct Firestore write (bypassing client) when `recipeCount >= 5` and `tier !== 'premium'` → rejected by security rules
- [ ] Create recipe when `recipeCount >= 5` and `tier === 'premium'` → succeeds
- [ ] Rapid create+delete (race condition): create 2 recipes fast, count ends at correct value
- [ ] `/api/recipes/delete` route → decrements `recipeCount` on user doc

##### Manual / E2E Tests (Anonymous Flow)
- [ ] Anonymous user lands on builder — all sections render, all calculators work, ingredient additions work
- [ ] Anonymous user clicks Save → SignInPrompt modal appears (not the normal save flow)
- [ ] Anonymous user clicks "Sign in with Google" in modal → popup sign-in → recipe auto-saves → navigates to /recipes
- [ ] Dismiss sign-in banner → banner stays dismissed for session (useState flag)
- [ ] Anonymous user clicks Fork on a community recipe → SignInPrompt, not UpgradeModal
- [ ] Anonymous user clicks Export → SignInPrompt, not UpgradeModal

##### Manual / E2E Tests (Free Tier Limits)
- [ ] New signed-in user → user doc created with `tier: 'free'`, `recipeCount: 0`
- [ ] Create recipes 1 through 5 → all succeed, `recipeCount` tracks correctly, `UsageMeter` updates
- [ ] Create recipe 6 → UpgradeModal appears, recipe is NOT created, `recipeCount` stays at 5
- [ ] Fork at 5 recipes → UpgradeModal appears, fork does NOT happen
- [ ] Delete 1 recipe → `recipeCount` = 4 → can create again
- [ ] All 5 existing recipes remain fully editable (no read-only mode)
- [ ] Export buttons show lock icon + "Premium" label → click → UpgradeModal

##### Manual / E2E Tests (Premium User — simulate by setting tier in Firestore console)
- [ ] Premium user can create recipes beyond 5
- [ ] Premium user sees no UsageMeter or sees "Unlimited"
- [ ] Premium user can export BeerXML and Markdown
- [ ] Premium user sees TierBadge showing "Premium"
- [ ] No lock icons visible on any features

##### Regression Tests (Existing Functionality)
- [ ] Existing recipe save/edit flow still works for signed-in users (no regressions from transaction refactor)
- [ ] Recipe delete still works (including publicRecipeIndex cleanup)
- [ ] Publishing/unpublishing still works
- [ ] Forking still works (for users under limit)
- [ ] localStorage offline cache still works (read on load, write on save)
- [ ] IndexedDB cache (`loadAllWithCache`) still works
- [ ] Browse page still loads for all users
- [ ] Public recipe pages (`/r/[slug]`) still render correctly

---

## Phase 2: Stripe Integration ✅ COMPLETE

Wire up real payments. Users can upgrade to Premium and manage their subscription.

### New Files

```
src/config/stripe.ts                               ← Lazy Stripe SDK initialization (same pattern as firebase-admin)
src/modules/auth/stripeCheckout.ts                 ← Client-side checkout redirect + billing portal helper
app/api/checkout/route.ts                          ← Create Stripe Checkout session (transaction-protected customer creation)
app/api/webhooks/stripe/route.ts                   ← Handle Stripe webhook events
app/api/billing-portal/route.ts                    ← Create Stripe Billing Portal session
app/account/page.tsx                               ← Account/subscription management page
```

### Environment Variables

```
STRIPE_SECRET_KEY=sk_live_xxx              ← Stripe secret key (server-side only)
STRIPE_WEBHOOK_SECRET=whsec_xxx            ← Stripe webhook signing secret
NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY=price_xxx   ← Stripe Price ID for Premium monthly ($1.99)
NEXT_PUBLIC_STRIPE_PRICE_ID_ANNUAL=price_xxx    ← Stripe Price ID for Premium annual ($19.99)
```

### Implementation Notes
- Stripe SDK uses lazy initialization via `src/config/stripe.ts` (same pattern as `firebase-admin.ts`) to avoid build-time crashes when env vars are absent
- Stripe customer creation uses a Firestore transaction to prevent duplicate customers on double-click
- `current_period_end` lives on `SubscriptionItem` (not `Subscription`) in Stripe SDK v20+
- `AuthProvider.tsx` now uses `onSnapshot` instead of `getDoc` for real-time tier propagation from webhook updates
- Account page uses `Suspense` wrapper for `useSearchParams` (required by Next.js App Router)
- UpgradeModal has monthly/annual toggle; RecipeLimitModal defaults to monthly with clickable annual link
- Webhook handler always returns 200 (even on internal errors) to prevent Stripe retry floods; only returns 400 on signature failure

### Phase 2 Implementation Checklist

#### Stripe Setup (Manual, in Stripe Dashboard)
- [x] Create Stripe account
- [x] Create a Product: "Brewing.It Premium"
- [x] Create two Prices: $1.99/month recurring, $19.99/year recurring
- [x] Note both Price IDs
- [x] Set up webhook endpoint pointing to `https://www.brewing.it.com/api/webhooks/stripe`
- [x] Subscribe to events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [x] Note the webhook signing secret (whsec_xxx)
- [x] Add all env vars to Vercel

#### Code: API Routes
- [x] `POST /api/checkout`:
  - Verify Firebase auth token
  - Read user doc to get stripeCustomerId (if exists)
  - Create or reuse Stripe customer (transaction-protected against double-click)
  - Accept `plan: 'monthly' | 'annual'` in request body
  - Create Checkout Session with `mode: 'subscription'`, appropriate price ID, and `metadata: { userId }`
  - Return `{ url: session.url }`
- [x] `POST /api/webhooks/stripe`:
  - Verify webhook signature with `stripe.webhooks.constructEvent()`
  - Handle `checkout.session.completed`: extract userId from metadata, update user doc (tier, stripeCustomerId, subscriptionStatus, subscriptionCurrentPeriodEnd)
  - Handle `customer.subscription.updated`: update subscriptionStatus, period end
  - Handle `customer.subscription.deleted`: set tier to 'free', subscriptionStatus to 'none'
  - Handle `invoice.payment_failed`: set subscriptionStatus to 'past_due'
  - Return 200 OK (Stripe retries on non-2xx)
- [x] `POST /api/billing-portal`:
  - Verify Firebase auth token
  - Read user doc to get stripeCustomerId
  - Create Billing Portal session
  - Return `{ url: session.url }`

#### Code: Client Integration
- [x] Wire UpgradeModal CTA button to call `POST /api/checkout` and redirect to Stripe
- [x] Add monthly/annual toggle to UpgradeModal
- [x] Create account page (`/account`) showing:
  - Current tier
  - Subscription status (active, canceled — retains until period end)
  - Next billing date (if Premium)
  - "Manage Subscription" button → Billing Portal
- [x] Handle Stripe Checkout success redirect: `/account?session_id=xxx` → show "Welcome to Premium!" confirmation
- [x] Set up Firestore listener on `users/{userId}` so tier updates from webhook propagate to the UI in real-time without page refresh

#### Code: Firestore Security Rules Update
- [ ] Add/update rule for users collection:
  ```
  match /users/{userId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
  ```

#### Testing Checklist (Phase 2)

##### API Route Tests (use Stripe test mode + test clock)
- [ ] `POST /api/checkout` without auth token → 401
- [ ] `POST /api/checkout` with valid auth + `plan: 'monthly'` → returns Stripe Checkout URL with correct price ID
- [ ] `POST /api/checkout` with valid auth + `plan: 'annual'` → returns Stripe Checkout URL with correct price ID
- [ ] `POST /api/checkout` for user with existing `stripeCustomerId` → reuses customer, doesn't create duplicate
- [ ] `POST /api/checkout` for user without `stripeCustomerId` → creates new Stripe customer, stores ID on user doc
- [ ] `POST /api/billing-portal` without auth → 401
- [ ] `POST /api/billing-portal` for user without `stripeCustomerId` → 400 (no subscription to manage)
- [ ] `POST /api/billing-portal` for Premium user → returns Stripe Portal URL

##### Webhook Tests (use Stripe CLI `stripe trigger` or test events)
- [ ] `checkout.session.completed` → user doc updated: `tier: 'premium'`, `subscriptionStatus: 'active'`, `stripeCustomerId` set, `subscriptionCurrentPeriodEnd` set
- [ ] `customer.subscription.updated` (cancel at period end) → `subscriptionStatus: 'canceled'`, user retains Premium until period end
- [ ] `customer.subscription.deleted` (period actually ends) → `tier: 'free'`, `subscriptionStatus: 'none'`
- [ ] `invoice.payment_failed` → `subscriptionStatus: 'past_due'`, user sees warning banner
- [ ] Webhook with invalid signature → 400 rejected, no user doc changes
- [ ] Duplicate webhook delivery (same event ID) → idempotent, no errors, no double-writes
- [ ] Webhook for unknown userId in metadata → logged, no crash, returns 200

##### E2E Payment Flow (Stripe test mode, test card 4242...)
- [ ] Free user → clicks Upgrade → selects monthly → Stripe Checkout loads → complete with test card → redirected to `/account?session_id=xxx` → "Welcome to Premium!" shown → tier updates in UI
- [ ] Same flow with annual plan
- [ ] Premium user → `/account` page shows: tier, next billing date, "Manage Subscription" button
- [ ] Click "Manage Subscription" → Stripe Billing Portal loads → cancel subscription → return to app → status shows "Canceled — Premium until [date]"
- [ ] After `subscriptionCurrentPeriodEnd` passes (use Stripe test clock to fast-forward) → user drops to Free, recipe limit enforced
- [ ] Firestore real-time listener: webhook updates user doc → client UI reflects change without page refresh

##### Edge Cases
- [ ] User pays, closes browser before redirect, reopens app → webhook already fired, user is Premium
- [ ] User starts checkout but abandons (doesn't pay) → no user doc changes, stays Free
- [ ] User with `past_due` status → Premium features still work, warning banner shown
- [ ] User downgrades from Premium with >5 recipes → all recipes remain accessible and editable, but cannot create new ones until under 5

##### Regression (after Phase 2)
- [ ] All Phase 1 tests still pass
- [ ] Anonymous flow unchanged
- [ ] Free tier limits unchanged

---

## Phase 3: Premium Features

Build the features that only Premium users get. Phase 1 set up the gates; this phase builds what's behind them.

### 3A: Auto Water Salt Calculator ✅ COMPLETE

Implemented. Currently available to all users (not gated behind Premium). Can be gated later via `canAccess('auto_water_calc')` if desired.

### 3B: Export Gating ✅ COMPLETE

Export buttons gated behind `canAccess('export')` in Phase 1 Step 5. Free users see greyed-out export buttons that trigger UpgradeModal on click.

### 3C: Enhanced Brew Mode

Upgrade brew sessions from basic tracking to a guided brew-day experience where the user follows along with their recipe, records actual measurements at each step, and sees how their numbers compare to targets.

#### Features
- Step-by-step brew day flow following the recipe's mash schedule, boil, and fermentation
- Record actual measurements at each step (pre-boil gravity, post-boil gravity, mash pH, temperatures)
- Target vs actual comparisons: "Target OG: 1.055, Actual: 1.052 — you're 0.5% under"
- Post-brew summary: what hit, what missed, notes for next time
- Session history with searchable notes

#### Checklist
- [ ] Design enhanced brew mode UI (step-by-step flow with measurement inputs)
- [ ] Add target vs actual comparison calculations
- [ ] Add post-brew summary view
- [ ] Gate behind `canAccess('enhanced_brew_mode')`
- [ ] Free users see basic session tracking (current behavior)
- [ ] Premium users get the full guided experience

### 3D: Premium Browse Badge/Boost

#### Checklist
- [ ] Add subtle "Premium" badge to published recipes from Premium users in browse results
- [ ] Slight ranking boost for Premium users' recipes in browse/search results
- [ ] Badge design: small, tasteful, doesn't dominate the recipe card

---

## Implementation Notes

### Use Firestore Transactions for Recipe Count

Recipe create/delete must atomically update both the recipe document and the `recipeCount` field on the user doc. If the recipe write succeeds but the count increment fails (or vice versa), the count drifts. Use a Firestore transaction (or batched write) that includes both operations.

**Codebase note:** `FirestoreRecipeRepository` currently does single-doc writes via `setDoc()` and `deleteDoc()`. The `saveAsync()` and `deleteAsync()` methods will need to be refactored to use `runTransaction()` or `writeBatch()` that touches both `recipes/{recipeId}` and `users/{userId}`. The optimistic local updates in `recipeStore.ts` (`saveCurrentRecipe`, `deleteRecipe`) should stay — the transaction replaces the Firestore write, not the local state update.

### Recipe Save Path Is Dual-Write — Don't Break It

`recipeStore.ts` writes to both localStorage and Firestore on every save (signed-in users). The localStorage write happens synchronously before the async Firestore write. When adding the recipe count transaction, only modify the Firestore path — the localStorage write must remain untouched as the offline fallback.

### AuthProvider Runs Before Stores Are Ready

`AuthProvider.tsx` listens to `onAuthStateChanged()` and force-reloads recipes via `loadRecipes()`. The pending recipe check (sessionStorage) must happen *after* auth state is fully resolved AND after the user doc has been read/created. If the check runs too early, `useUserTier()` will return `'anonymous'` briefly, which could trigger the wrong UI. Sequence: `onAuthStateChanged` → create/read user doc → check sessionStorage → prompt.

### Firestore Rejects `undefined` Values

All Firestore writes in the codebase use `JSON.parse(JSON.stringify(data))` to strip `undefined` fields before writing. The new user doc fields (`stripeCustomerId: null`, `subscriptionCurrentPeriodEnd: null`) must use `null`, not `undefined`, or they'll be silently stripped. This is already the pattern — just don't break it.

### The `/api/recipes/delete` Route Uses Admin SDK

The existing delete route (`app/api/recipes/delete/route.ts`) uses the Firebase Admin SDK and verifies ownership server-side. It currently deletes from `recipes/` and `publicRecipeIndex/`. This route must also decrement `recipeCount` on the user doc — and since it uses admin SDK, it bypasses security rules entirely, so the decrement must be done explicitly in the handler code. No transaction is needed here since admin SDK has full access — a simple `FieldValue.increment(-1)` suffices.

### No User Doc Exists Today

Despite the PRD saying "This document already exists from PRD-002", the codebase does NOT create a `users/{userId}` document on sign-in. `authStore.ts` only stores the Firebase Auth `User` object in Zustand — it never writes to Firestore. `userPreferences/{userId}` is a separate collection. Phase 1 must create the user doc on first sign-in. Use `setDoc()` with `{ merge: true }` to avoid overwriting if a doc somehow already exists.

### Recipe Model Has No `ownerId` — Repository Adds It

The `Recipe.ts` domain model does not include `ownerId`. The `FirestoreRecipeRepository` injects `ownerId` during `save()`. This means the recipe count transaction can't rely on the recipe object alone to know the user — it must use the authenticated user's UID from the auth store or the repository's stored `userId`.

### IndexedDB Cache Must Stay Consistent

`FirestoreRecipeRepository` uses IndexedDB as a stale-while-revalidate cache (`loadAllWithCache()`, `loadByIdFromCache()`). When a recipe is deleted, the store calls `clearCachedRecipe(id)` to remove it from IndexedDB. If the transaction-based delete fails but the optimistic local delete already cleared IndexedDB, the cache is now out of sync. Consider: only clear IndexedDB after the transaction confirms success, not optimistically.

### Webhook Idempotency

Stripe can deliver the same webhook event multiple times. The webhook handler should be idempotent — e.g., use the Stripe event ID as a deduplication key, or simply make all updates unconditional SET operations (setting `tier: 'premium'` when it's already `'premium'` is a no-op in practice).

### `past_due` UX

The PRD sets `subscriptionStatus: 'past_due'` on failed payment but doesn't define the user experience. Recommended behavior: keep Premium access during `past_due` (Stripe retries payment for ~3 weeks before canceling) but show a warning banner: "Your payment failed — please update your payment method to keep Premium."

### Cancellation Grace Period vs Tier Logic

The computed tier logic says `subscriptionStatus === 'active' → Premium, otherwise → Free`. But a canceled subscription with remaining paid time has status `'canceled'` — which would immediately drop the user to Free, even though they've paid through the period. Fix: the effective tier should be Premium if `subscriptionStatus` is `'active'` OR (`'canceled'` AND `subscriptionCurrentPeriodEnd > now()`). Update the `canAccess()` logic and the `useUserTier()` hook accordingly.

### sessionStorage Recipe Serialization

The `Recipe` model contains nested objects (ingredients, mash schedule, fermentation steps, equipment). `JSON.stringify()` handles this fine, but `JSON.parse()` will lose any `Date` objects — they'll come back as strings. Since the recipe model uses ISO strings for timestamps (not Date objects), this should work. Verify by round-tripping a fully-populated recipe through `JSON.stringify` → `JSON.parse` and comparing.

### User Doc Read Is One-Shot, Cached in Zustand

The user doc is read once on login and cached in the Zustand auth store for the rest of the session. No subsequent Firestore reads for tier checks — all `canAccess()` calls read from local state. The only things that write to the user doc are: (1) first sign-in (create), (2) recipe create/delete (increment/decrement `recipeCount`), (3) Stripe webhook (Phase 2). For Phase 2, add a Firestore `onSnapshot` listener on the user doc so webhook-triggered tier changes propagate to the UI in real-time.

### `canCreateRecipe()` Is Separate from `canAccess()`

`canAccess()` checks feature-level permissions (binary: yes/no for a feature given a user state). `canCreateRecipe()` checks the recipe count against the limit — it needs the current `recipeCount` as an argument. These are intentionally separate functions because recipe creation is the only feature gated by a counter, not just by tier.

### Cancellation Grace Period — `useUserTier` Must Handle This

The computed tier logic in the Data Model section says `subscriptionStatus === 'active' → Premium`. But a canceled subscription with remaining paid time has `status: 'canceled'` — which would immediately drop the user to Free even though they've paid through the period. The `useUserTier()` hook must return `'premium'` when `subscriptionStatus === 'canceled'` AND `subscriptionCurrentPeriodEnd > now()`. Same for `'past_due'` (Stripe is still retrying payment).

### Water Salt Optimizer Algorithm

The greedy iterative approach in Phase 3A works for most cases but can get stuck in local minima when multiple ions have competing salt dependencies. Consider a least-squares minimization approach as an alternative — even a simple one would be more robust for edge-case source/target combinations.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Stripe webhook fails / is delayed | Medium | Users pay but don't get Premium immediately | Poll Stripe session status on success redirect as fallback; show "processing" state |
| $1.99 is too low to be sustainable | Low | Revenue doesn't cover costs | At this price, even modest conversion covers Firestore + Vercel. Can always raise price for new subscribers. |
| Recipe preservation through auth loses data | Low | Bad first impression | sessionStorage is synchronous and reliable. Test thoroughly across browsers. Fallback: also write to localStorage. |
| recipeCount gets out of sync | Low | User blocked or gets extra recipes | Periodic reconciliation job (count actual recipes vs stored count). Admin SDK can fix mismatches. |
| Users game the system with multiple Google accounts | Very Low | Extra free recipes | Not worth preventing — the friction of managing multiple Google accounts is its own deterrent |

---

## Cost Impact

### Stripe Fees
- 2.9% + $0.30 per successful payment
- On $1.99/month: $0.36 fee → **$1.63 net** per subscriber per month
- On $19.99/year: $0.88 fee → **$19.11 net** per subscriber per year ($1.59/month)

The annual plan is more efficient per dollar ($19.11 net vs $19.56 net for 12 monthly payments). Both are reasonable at this price point.

### Firestore Impact
- Minimal additional reads/writes — user doc is read once per session, written on webhook events
- Recipe count increment/decrement is one write per recipe create/delete (already happening)

### Estimated Revenue (Conservative)

At 1,000 registered users with 5% conversion:
- 50 Premium subscribers × $1.63 net/month = **~$82/month ($978/year)**

At 5,000 registered users with 5% conversion:
- 250 Premium subscribers × $1.63 net/month = **~$408/month ($4,890/year)**

At 5,000 registered users with 5% conversion (mostly annual):
- 250 Premium subscribers × $1.59 net/month = **~$398/month ($4,778/year)**

---

## Future Considerations (Not In Scope)

- **AI tier:** When PRD-003 ships, decide whether AI is bundled into Premium or a separate higher tier. Depends on actual API costs at scale.
- **Lifetime deal:** One-time $49-99 payment for permanent Premium. Good for early adopters / launch buzz. Align with Brewer's Friend's $149.99 lifetime but undercut significantly.
- **Affiliate links:** "Shop This Recipe" ingredient links to homebrew supply stores. Separate revenue stream, doesn't require tier infrastructure.
- **Team/club tier:** Group features for homebrew clubs. Deferred until community features mature.

---

## Developer Onboarding — Read This First

If you're picking up this PRD mid-implementation, here's what you need to know.

### Current State (as of March 23, 2026)

- **Phase 1 is complete.** All 5 steps done: tier access, user doc schema, recipe limit enforcement, anonymous UX, and feature gating UI.
- **Phase 2 is complete.** Stripe Checkout, webhooks, billing portal, account page, real-time tier updates — all live on production.
- **Next up: Phase 3** — Premium features (auto water salt calculator, enhanced brew mode, browse badge/boost). Export gating is already wired from Phase 1.

### Key File Map

```
# Auth & Tier (new for this PRD)
src/modules/auth/tierAccess.ts              ← canAccess(), canCreateRecipe(), types. DONE.
src/modules/auth/tierAccess.test.ts         ← 19 unit tests. DONE.
src/modules/auth/useUserTier.ts             ← TODO: hook returning UserState from Zustand

# Auth (existing — you'll modify these)
src/modules/auth/authStore.ts               ← Zustand store. Has user + isLoading. Add tier + recipeCount here.
src/modules/auth/components/AuthProvider.tsx ← onAuthStateChanged listener. Add user doc read/create here.
src/modules/auth/preferencesStore.ts        ← Separate store for user prefs. Don't put tier stuff here.

# Recipe (existing — you'll modify these)
src/modules/beta-builder/presentation/stores/recipeStore.ts
    ← saveCurrentRecipe(), deleteRecipe(), createNewRecipe(). Add limit checks here.
src/modules/beta-builder/domain/repositories/FirestoreRecipeRepository.ts
    ← saveAsync(), deleteAsync(). Refactor to use transactions that also update recipeCount.
src/modules/beta-builder/domain/models/Recipe.ts
    ← Domain model. Does NOT have ownerId — the repo adds it during save.

# API routes (existing)
app/api/recipes/delete/route.ts             ← Admin SDK delete. Must also decrement recipeCount.

# Stripe (new for Phase 2)
src/config/stripe.ts                        ← Lazy Stripe SDK init (same pattern as firebase-admin)
src/modules/auth/stripeCheckout.ts          ← Client: startCheckout(), openBillingPortal()
app/api/checkout/route.ts                   ← POST: creates Stripe Checkout Session
app/api/webhooks/stripe/route.ts            ← POST: handles 4 webhook events, updates user doc
app/api/billing-portal/route.ts             ← POST: creates Stripe Billing Portal session
app/account/page.tsx                        ← Account/subscription management page

# Firebase
src/config/firebase.ts                      ← Client SDK init (auth, db with IndexedDB persistence)
src/config/firebase-admin.ts                ← Admin SDK with lazy Proxy init (avoids build crashes)
firestore.rules                             ← Security rules. Must add recipe count enforcement.

# UI entry points (you'll modify these)
src/modules/beta-builder/presentation/components/BetaBuilderPage.tsx  ← Save/export buttons live here
app/ClientShell.tsx                         ← Wraps app in AuthProvider + NavBar + Footer
```

### Patterns You Must Follow

1. **Firestore writes strip `undefined` with `JSON.parse(JSON.stringify(data))`** — every repo does this. Use `null` for empty fields, never `undefined`.

2. **Optimistic local updates + async Firestore write** — `recipeStore.ts` updates the local Zustand array immediately, then fires the async Firestore write. The localStorage write happens synchronously between these. When adding transactions, replace only the Firestore write — don't touch the optimistic update or localStorage write.

3. **Dual-write: localStorage + Firestore** — signed-in users write to both on every save. localStorage is the offline cache. Anonymous users get neither (in-memory only via Zustand).

4. **Repository injects `ownerId`** — the `Recipe` domain model has no `ownerId` field. `FirestoreRecipeRepository.save()` adds it from the stored `userId`. Your transactions need the UID from the repo or auth store, not from the recipe object.

5. **Firebase admin uses lazy Proxy** — `firebase-admin.ts` wraps the admin SDK in a Proxy that initializes on first access. This prevents crashes during `next build` when `FIREBASE_ADMIN_KEY` is absent. Don't import admin SDK at module scope in any file that runs during static builds.

6. **`'use client'` boundaries** — files like `recipeExport.ts` are marked `'use client'` and cannot be imported in server components. New tier UI components will also need this directive.

### Things That Will Bite You

- **`AuthProvider` fires before stores are ready.** It calls `loadRecipes()` inside `onAuthStateChanged`. If you add a sessionStorage check for pending recipes, it must wait until AFTER the user doc is read/created and the auth store is fully hydrated. Otherwise `useUserTier()` briefly returns `'anonymous'`.

- **IndexedDB cache can desync.** `FirestoreRecipeRepository` caches recipes in IndexedDB (`loadAllWithCache()`). If you optimistically clear a recipe from IndexedDB but the Firestore transaction fails, the cache is wrong. Clear IndexedDB only after transaction success.

- **`recipeCount` can drift.** If the app crashes between a recipe write and the count update, they'll be out of sync. Firestore transactions prevent this for client writes, but the admin SDK delete route (`/api/recipes/delete`) uses a separate `FieldValue.increment(-1)` — if that fails silently, the count is off. Consider a periodic reconciliation (count actual recipes vs stored count).

- **The PRD says "user doc already exists from PRD-002" — it doesn't.** `authStore.ts` only stores the Firebase Auth `User` object in Zustand. No `users/{userId}` Firestore document is created on sign-in today. Phase 1 must create it. Use `setDoc()` with `{ merge: true }`.

- **Cancellation grace period.** A canceled Stripe subscription has `status: 'canceled'` but the user has paid through `subscriptionCurrentPeriodEnd`. The naive logic (`status === 'active' → premium`) would immediately drop them to Free. `useUserTier()` must check: premium if `active`, OR `canceled` with future period end, OR `past_due`.

- **`publicRecipeIndex` cleanup on delete.** The existing delete flow removes recipes from both `recipes/` and `publicRecipeIndex/`. Make sure the transaction or the admin route still handles this — don't accidentally drop the index cleanup when refactoring for `recipeCount`.

### How to Test Each Step

| Step | How to verify | What breaks if wrong |
|------|--------------|---------------------|
| 1 (tierAccess) | `npx vitest run src/modules/auth/tierAccess.test.ts` | Nothing — not imported yet |
| 2 (user doc + count) | Sign in → check Firestore console for user doc. Save recipe → `recipeCount` = 1. Delete → 0. | Recipe saves break for everyone |
| 3 (limit enforcement) | Create 5 recipes, try 6th. Test Firestore rules in emulator. | Legitimate saves get blocked by bad rules |
| 4 (anonymous flow) | Build recipe anonymous → sign in → check sessionStorage round-trip | Data loss through auth redirect |
| 5 (UI gating) | Visual check: lock icons, usage meter, upgrade modal | Cosmetic only — no data risk |

### Running the App Locally

```bash
npm run dev          # Next.js dev server (Turbopack)
npx vitest run       # All tests
npx vitest run src/modules/auth/  # Tier-specific tests
```

Firebase Emulator is recommended for testing Firestore rules changes before deploying. The app connects to the live Firebase project by default — be careful with production data during manual testing.

---

*Last updated: March 2026*
