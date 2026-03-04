# PRD-002: Users, Cloud Storage, Sharing & Community

> **Status:** Phase 2 In Progress — Admin SDK workaround applied
> **Created:** 2026-03-03
> **Depends on:** PRD-001 (Next.js + Vercel Migration)
> **Phases:** 3 (Auth + Cloud, Sharing, Community)

---

## Context

BeerApp currently stores all data in the browser's localStorage. This means recipes are lost if the user clears browser data, and there's no way to access recipes across devices or share them with others.

To grow BeerApp from a personal tool into a platform that real users can rely on, we need:
1. User accounts so recipes persist in the cloud
2. Shareable recipe links that work anywhere
3. A community of brewers discovering and forking each other's recipes
4. Public recipe pages indexed by Google for organic discovery

This PRD builds on the Next.js + Vercel foundation established by PRD-001.

## Goals

- Users can sign in with Google (Apple deferred until user demand justifies $99/year Apple Developer fee)
- Recipes sync to the cloud and are accessible on any device
- Users can share recipes via public links
- Public recipes are server-rendered and indexed by Google (SEO)
- Users can browse, search, and fork community recipes
- The app remains **fully functional without signing in** — auth unlocks sync and sharing, it does not gate features

## Non-Goals (For Now)

- Apple Sign-In (deferred)
- Email/password or magic-link auth
- Recipe comments or activity feeds
- Real-time collaboration on recipes
- Mobile native app (PWA is fine)
- Full-text search (client-side filtering is sufficient for V1)
- Recipe ratings/reviews

---

## Tech Stack Addition

```
Auth:           Firebase Auth (Google sign-in)
Database:       Cloud Firestore (NoSQL, JSON-native)
Client SDK:     firebase (client-side)
Server SDK:     firebase-admin (server-side, for SSR in Next.js server components)
```

### Why Firebase?

- **Auth + DB in one SDK** — single integration, single dashboard
- **Firestore is JSON-native** — our `Recipe` type maps directly to a Firestore document with zero transformation
- **Free tier is generous** — unlimited auth users, 50k reads/day, 20k writes/day, 1GB storage
- **Offline persistence built-in** — Firestore caches data in IndexedDB, seamless offline/online sync
- **Security rules run server-side** — React app talks directly to Firestore, no custom backend needed
- **Google Sign-In is trivial** — it's Google's own auth product

### Why Not Supabase?

Supabase (Postgres) is more flexible for complex queries and avoids vendor lock-in, but:
- Requires SQL schema design and migrations
- No built-in offline persistence
- Smaller free tier (500MB vs 1GB, 5GB bandwidth vs 10GB)
- More setup for the same outcome at our current scale

We can migrate to Supabase/Postgres later if Firestore's querying limitations become a real blocker.

---

## Data Model

### Firestore Collections

```
users/{userId}
  - displayName: string
  - email: string
  - photoURL: string | null
  - createdAt: Timestamp

recipes/{recipeId}
  - ownerId: string                    ← who owns this recipe
  - isPublic: boolean                  ← default false
  - shareSlug: string | null           ← URL-friendly slug for public link
  - publishedAt: Timestamp | null      ← when it was made public
  - name: string
  - style?: string                     ← BJCP style name
  - notes?: string
  - tags?: string[]
  - currentVersion: number
  - parentRecipeId?: string            ← for forks/variations
  - parentVersionNumber?: number
  - batchVolumeL: number
  - equipmentProfileName?: string
  - equipment: { ... }                 ← embedded object (all equipment fields)
  - fermentables: Fermentable[]        ← embedded array
  - hops: Hop[]                        ← embedded array
  - yeasts: Yeast[]                    ← embedded array
  - otherIngredients: OtherIngredient[]
  - mashSteps: MashStep[]
  - waterChemistry?: { ... }
  - fermentationSteps: FermentationStep[]
  - brewDayChecklist?: BrewDayChecklistItem[]
  - createdAt: Timestamp
  - updatedAt: Timestamp

recipes/{recipeId}/versions/{versionNumber}    ← subcollection
  - [full Recipe snapshot]
  - createdAt: Timestamp
  - changeNotes?: string

brewSessions/{sessionId}
  - ownerId: string
  - recipeId: string
  - recipeName: string                 ← denormalized for display without extra read
  - [all existing BrewSession fields]
  - createdAt: Timestamp

equipment/{profileId}
  - ownerId: string
  - isCustom: boolean
  - [all existing EquipmentProfile fields]

publicRecipeIndex/{recipeId}           ← lightweight docs for browse page
  - name: string
  - style: string
  - ownerName: string
  - ownerId: string
  - shareSlug: string
  - stats: { og, fg, ibu, srm, abv }  ← precomputed at publish time
  - tags: string[]
  - hopNames: string[]                 ← for discovery/search
  - createdAt: Timestamp
  - publishedAt: Timestamp
  - forkCount: number
```

### Why This Structure?

**Recipes as top-level collection (not nested under users):**
Allows querying across all users — needed for "browse all public recipes." If recipes were at `users/{id}/recipes/{id}`, cross-user queries would be impossible in Firestore.

**Ingredients embedded (not separate collections):**
Fermentables, hops, yeasts are always loaded with the recipe. Embedding means 1 read = 1 full recipe. Separate collections would cost N+1 reads for no benefit.

**Versions as subcollection:**
Only loaded when the user explicitly views history. Doesn't bloat the main recipe document. Saves reads (and cost) on every normal recipe load.

**publicRecipeIndex as separate collection:**
Browse page needs to show many recipe cards. Loading 50 full recipe documents (with all ingredients, mash steps, water chemistry) just to show name/style/stats would be wasteful. The index collection has ~500 byte documents optimized for list display.

### Document Size

A typical recipe with 10 fermentables, 8 hops, 2 yeasts, 5 mash steps, water chemistry = ~2-5 KB. Firestore's 1MB document limit is not a concern.

---

## Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null
                          && request.auth.uid == userId;
    }

    // Recipes: public readable, owner-only writable
    match /recipes/{recipeId} {
      allow read: if resource.data.isPublic == true;
      allow read: if request.auth != null
                   && request.auth.uid == resource.data.ownerId;
      allow create: if request.auth != null
                     && request.resource.data.ownerId == request.auth.uid;
      allow update, delete: if request.auth != null
                             && request.auth.uid == resource.data.ownerId;
    }

    // Recipe versions: follow parent recipe's access
    match /recipes/{recipeId}/versions/{versionId} {
      allow read: if get(/databases/$(database)/documents/recipes/$(recipeId))
                     .data.isPublic == true;
      allow read: if request.auth != null
                   && request.auth.uid == get(/databases/$(database)/documents/recipes/$(recipeId))
                     .data.ownerId;
      allow write: if request.auth != null
                    && request.auth.uid == get(/databases/$(database)/documents/recipes/$(recipeId))
                     .data.ownerId;
    }

    // Brew sessions: owner-only
    match /brewSessions/{sessionId} {
      allow read, write: if request.auth != null
                          && request.auth.uid == resource.data.ownerId;
      allow create: if request.auth != null
                     && request.resource.data.ownerId == request.auth.uid;
    }

    // Equipment profiles: owner-only
    match /equipment/{profileId} {
      allow read, write: if request.auth != null
                          && request.auth.uid == resource.data.ownerId;
      allow create: if request.auth != null
                     && request.resource.data.ownerId == request.auth.uid;
    }

    // Public recipe index: anyone can read, owner can write
    // (originally admin-SDK-only, now client SDK due to admin permissions issue)
    match /publicRecipeIndex/{recipeId} {
      allow read: if true;
      allow create, update: if request.auth != null
                              && request.auth.uid == request.resource.data.ownerId;
      allow delete: if request.auth != null
                     && request.auth.uid == resource.data.ownerId;
    }

    // User preferences (default recipe visibility, etc.)
    match /userPreferences/{userId} {
      allow read, write: if request.auth != null
                          && request.auth.uid == userId;
    }
  }
}
```

### Composite Indexes

```json
{
  "indexes": [
    {
      "collectionGroup": "recipes",
      "fields": [
        { "fieldPath": "ownerId", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "recipes",
      "fields": [
        { "fieldPath": "isPublic", "order": "ASCENDING" },
        { "fieldPath": "publishedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "recipes",
      "fields": [
        { "fieldPath": "isPublic", "order": "ASCENDING" },
        { "fieldPath": "style", "order": "ASCENDING" },
        { "fieldPath": "publishedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "publicRecipeIndex",
      "fields": [
        { "fieldPath": "style", "order": "ASCENDING" },
        { "fieldPath": "publishedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "publicRecipeIndex",
      "fields": [
        { "fieldPath": "publishedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "brewSessions",
      "fields": [
        { "fieldPath": "ownerId", "order": "ASCENDING" },
        { "fieldPath": "recipeId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## Phase 1: Auth + Cloud Storage

### What We're Building

Users can sign in with Google. When signed in, their recipes are stored in Firestore instead of localStorage. When signed out, the app works exactly as it does today.

### New Files

```
src/config/firebase.ts                           ← Firebase client init
src/config/firebase-admin.ts                     ← Firebase admin init (server-side)

src/modules/auth/
├── authStore.ts                                 ← Zustand store for auth state
└── components/
    ├── SignInButton.tsx                          ← "Sign in with Google" button
    ├── UserMenu.tsx                              ← Avatar dropdown (signed-in state)
    └── AuthProvider.tsx                          ← onAuthStateChanged listener wrapper

src/modules/beta-builder/domain/repositories/
├── FirestoreRecipeRepository.ts                 ← Firestore implementation
├── FirestoreEquipmentRepository.ts
└── FirestoreBrewSessionRepository.ts

firestore.rules                                  ← Security rules file
firestore.indexes.json                           ← Composite indexes
firebase.json                                    ← Firebase project config
.firebaserc                                      ← Firebase project alias
```

### Modified Files

```
src/modules/beta-builder/presentation/stores/recipeStore.ts
  → getRepo() switches between localStorage and Firestore based on auth state

src/modules/beta-builder/presentation/stores/equipmentStore.ts
  → Same repo switching pattern

src/modules/beta-builder/presentation/stores/brewSessionStore.ts
  → Same repo switching pattern

app/layout.tsx
  → Wrap app in AuthProvider, add SignInButton/UserMenu to NavBar

package.json
  → Add firebase dependency
```

### Repository Pattern

The existing repositories are classes with these methods:

**RecipeRepository** (`src/modules/beta-builder/domain/repositories/RecipeRepository.ts`):
- `loadAllSafe(): LoadResult<Recipe[]>`
- `loadAll(): Recipe[]`
- `loadById(id: RecipeId): Recipe | null`
- `save(recipe: Recipe): void`
- `delete(id: RecipeId): void`
- `deleteAll(): void`
- `isStorageAvailable(): boolean`

**EquipmentRepository** (`EquipmentRepository.ts`):
- `async loadAll(): Promise<EquipmentProfile[]>`
- `async saveCustomProfile(profile: EquipmentProfile): Promise<void>`
- `async deleteCustomProfile(name: string): Promise<void>`
- `async findByName(name: string): Promise<EquipmentProfile | undefined>`
- `clearCache(): void`

**BrewSessionRepository** (`BrewSessionRepository.ts`):
- `loadAll(): BrewSession[]`
- `loadById(id: SessionId): BrewSession | null`
- `loadByRecipeId(recipeId: string): BrewSession[]`
- `save(session: BrewSession): void`
- `delete(id: SessionId): void`
- `deleteByRecipeId(recipeId: string): void`
- `getSessionCount(recipeId: string): number`

The Firestore implementations will match these same interfaces. The stores switch between local and cloud repos based on auth state:

```ts
const getRecipeRepo = () => {
  const user = useAuthStore.getState().user;
  return user
    ? new FirestoreRecipeRepository(user.uid)
    : recipeRepository; // existing localStorage singleton
};
```

### Auth Flow

1. App loads → `AuthProvider` sets up `onAuthStateChanged` listener
2. Firebase checks IndexedDB for cached session → if found, fires with user (no network request)
3. If no session: `user = null`, app uses localStorage repos (current behavior)
4. User clicks "Sign in with Google" → `signInWithPopup(auth, googleProvider)`
5. Google OAuth popup → user consents → Firebase receives token → `onAuthStateChanged` fires with user
6. Auth store updates → Zustand stores re-initialize with Firestore repos
7. Recipes load from Firestore
8. On subsequent visits: step 2 auto-restores the session

### Firebase Config Values Are Public

The Firebase config (apiKey, projectId, etc.) in `src/config/firebase.ts` are **project identifiers, not secrets**. They're embedded in the built JS bundle and visible to anyone. Security comes from Firestore security rules, not from hiding config. Do not put them in `.env` or treat them as sensitive.

---

### Phase 1 Implementation Checklist

#### Firebase Project Setup (Manual, in Firebase Console)
- [x] Create a new Firebase project at console.firebase.google.com
- [x] Enable Google sign-in provider under Authentication > Sign-in Method
- [x] Create a Firestore database in **production mode** (Standard edition, billing disabled)
- [x] Note the Firebase config values (apiKey, authDomain, projectId, etc.)
- [x] Install Firebase CLI globally: `npm install -g firebase-tools`
- [x] Run `firebase login` and `firebase init` in the project root
- [x] Select Firestore (rules + indexes) during init
- [ ] ~~Set a budget alert at $5/month~~ — billing disabled, not needed

#### Code: Firebase Config
- [x] Create `src/config/firebase.ts` — initialize Firebase app, export `auth`, `db`, `googleProvider`
- [x] Create `src/config/firebase-admin.ts` — initialize admin SDK for server components (uses `FIREBASE_ADMIN_KEY` env var)
- [x] Add `firebase` to `package.json` dependencies
- [x] Add `firebase-admin` to `package.json` dependencies
- [x] Add `FIREBASE_ADMIN_KEY` to Vercel environment variables (generate service account key first — see deployment steps below)

#### Code: Auth Module
- [x] Create `src/modules/auth/authStore.ts` — Zustand store with `user`, `isLoading`, `signInWithGoogle()`, `signOut()`
- [x] Create `src/modules/auth/components/AuthProvider.tsx` — sets up `onAuthStateChanged` listener, updates auth store, re-fetches all data on auth change
- [x] Create `src/modules/auth/components/SignInButton.tsx` — "Sign in with Google" button with Google "G" icon
- [x] Create `src/modules/auth/components/UserMenu.tsx` — avatar, display name, sign-out dropdown
- [x] Wrap app in `AuthProvider` in `app/ClientShell.tsx` (not layout.tsx — ClientShell is the client boundary)
- [x] Add `SignInButton` / `UserMenu` to NavBar (conditionally render based on auth state, both desktop and mobile)
- [x] Add loading state handling — auth UI hidden while `isLoading` is true

#### Code: Firestore Repositories
- [x] Create `FirestoreRecipeRepository` matching the existing `RecipeRepository` interface
  - [x] `loadAllAsync()` — query `recipes` where `ownerId == userId`, ordered by `updatedAt desc`
  - [x] `loadByIdAsync()` — get single document
  - [x] `saveAsync()` — set document (upsert), include `ownerId`, `isPublic: false` defaults
  - [x] `deleteAsync()` — delete document
- [x] Create `FirestoreEquipmentRepository` matching the existing interface
  - [x] `loadAll()` — load preset profiles + user's custom profiles from Firestore
  - [x] `saveCustomProfile()` — set document with `ownerId` and `isCustom: true`
  - [x] `deleteCustomProfile()` — delete document
- [x] Create `FirestoreBrewSessionRepository` matching the existing interface
  - [x] `loadAllAsync()` — query where `ownerId == userId`
  - [x] `loadByRecipeIdAsync()` — query where `ownerId == userId` AND `recipeId == recipeId`
  - [x] `saveAsync()` — set document with `ownerId`
  - [x] `deleteAsync()` — delete document

#### Code: Store Integration
- [x] Update `recipeStore.ts` — switch repo based on auth state via `getRecipeRepo()` helper
- [x] Update `equipmentStore.ts` — switch repo based on auth state via `getEquipmentRepo()` helper
- [x] Update `brewSessionStore.ts` — switch repo based on auth state via `getSessionRepo()` helper
- [x] Ensure stores re-fetch data when auth state changes (AuthProvider triggers reload on `onAuthStateChanged`)
- [x] Ensure anonymous mode (localStorage) remains fully functional

#### Deploy Security Rules & Indexes
- [x] Write `firestore.rules` file
- [x] Write `firestore.indexes.json` file
- [x] Deploy rules: `firebase deploy --only firestore:rules`
- [x] Deploy indexes: `firebase deploy --only firestore:indexes`

### Implementation Notes & Gotchas

#### Async/Sync Interface Pattern
The localStorage repos are synchronous, but Firestore is inherently async. The Firestore repos expose both sync methods (for interface compatibility, return empty/null) and `*Async()` methods for actual data access. The stores detect which repo to use via `getRecipeRepo()` / `getSessionRepo()` helpers that check `useAuthStore.getState().user`. When Firestore is active, stores use `.then()` chains to update state.

#### Recipe Version History Still Uses localStorage
`RecipeVersionRepository` was **not** migrated to Firestore in this phase. Version snapshots still save to localStorage regardless of auth state. This means version history won't sync across devices. This is acceptable for Phase 1 — full version sync can be added later using the Firestore `recipes/{recipeId}/versions/{versionNumber}` subcollection that's already defined in the data model.

#### `@/*` Path Alias Added to tsconfig.json
Added `"@/*": ["./src/*"]` to `tsconfig.json` paths. All new Firebase/auth imports use this alias (e.g., `@/config/firebase`). Existing code still uses the older `@components/*`, `@utils/*` aliases.

#### AuthProvider Lives in ClientShell, Not layout.tsx
The PRD originally said to wrap in `app/layout.tsx`, but `layout.tsx` is a server component. `AuthProvider` needs client-side Firebase SDK access, so it wraps the children inside `app/ClientShell.tsx` (the existing client boundary component).

#### `signInWithPopup` → `signInWithRedirect` Fallback
If the Google OAuth popup is blocked (common in Safari), the auth store automatically falls back to `signInWithRedirect`. No user action needed.

#### Firestore Offline Persistence
Firestore's web SDK automatically caches data in IndexedDB. Reads work offline from cache, writes queue and sync when back online. No extra code needed.

#### Firebase Config Values Are Public (Not in .env)
Per the PRD, the Firebase client config (apiKey, projectId, etc.) is hardcoded in `src/config/firebase.ts`. These are project identifiers, not secrets. Security comes from Firestore rules. The only secret is `FIREBASE_ADMIN_KEY` (server-side only, stored as a Vercel env var).

#### Equipment Profile Document IDs
Firestore equipment docs use a composite ID: `{userId}_{profile-name-slugified}`. This ensures uniqueness per user while keeping IDs deterministic (so saves are upserts, not duplicates).

#### Firestore Rejects `undefined` Values
Firestore throws on any `undefined` in a document — including nested fields. Recipes have many optional fields (`style`, `notes`, `parentRecipeId`, etc.) that default to `undefined`. All Firestore repositories use `JSON.parse(JSON.stringify(data))` before `setDoc()` to strip `undefined` at all nesting levels.

#### Recipe Cache in Store
`loadRecipe(id)` first checks the Zustand store's `recipes` array (populated by `loadRecipes()`) before hitting Firestore. This avoids redundant reads — each recipe is only fetched once per session.

#### Vercel Domain Must Be in Firebase Authorized Domains
Google sign-in only works from domains listed in Firebase Console > Authentication > Settings > Authorized domains. Both `localhost` (default) and the Vercel deploy URL must be added. Custom domains need to be added separately when configured.

### Phase 1 Testing

#### Auth Tests
- [x] Click "Sign in with Google" → Google OAuth popup appears
- [x] Complete Google sign-in → user avatar and name appear in NavBar
- [x] Reload page → user remains signed in (session persisted)
- [ ] Click "Sign out" → returns to anonymous state, sign-in button reappears
- [ ] Sign in from a different browser/device → same user, same data

#### Cloud Storage Tests
- [x] Sign in → create a new recipe → verify it appears in Firestore (check Firebase Console)
- [x] Edit a recipe → save → verify changes persist in Firestore
- [ ] Delete a recipe → verify it's removed from Firestore
- [x] Reload page → all recipes load from Firestore correctly
- [ ] Create, edit, delete equipment profiles → verify in Firestore
- [ ] Create, edit, delete brew sessions → verify in Firestore

#### Anonymous Mode Regression Tests
- [ ] Sign out (or fresh browser with no account)
- [ ] Create a recipe → saves to localStorage (check devtools > Application > Local Storage)
- [ ] Edit and save recipe → persists in localStorage
- [ ] Reload → recipe loads from localStorage
- [ ] All existing features work identically to pre-migration behavior
- [ ] Theme switching works
- [ ] BeerXML import/export works
- [ ] Calculators work
- [ ] Drag-and-drop works

#### Security Rules Tests
- [ ] Signed-in user can read their own recipes
- [ ] Signed-in user can NOT read another user's private recipes (test with Firestore emulator or security rules simulator)
- [ ] Signed-in user can NOT write to another user's recipes
- [ ] Anonymous user can NOT read or write any recipes in Firestore
- [ ] Public recipes (isPublic: true) are readable by anyone

#### Edge Cases
- [ ] Sign in with slow network → loading state shows, eventually completes
- [ ] Sign in fails (user cancels popup) → app remains in anonymous mode, no errors
- [ ] Firestore unreachable (offline) → app handles gracefully (error toast, fallback to cached data)
- [ ] Large recipe with many ingredients saves and loads correctly from Firestore

---

## Phase 2: Sharing + Public Recipe Pages

### What We're Building

Users can make recipes public and share them via link. Public recipe pages are server-rendered for SEO. Other users can view and fork shared recipes.

### New Routes

```
app/
├── r/
│   └── [slug]/
│       └── page.tsx              ← PUBLIC: server-rendered recipe view (SEO)
```

### New Files

```
app/r/[slug]/page.tsx                ← Server component: fetches recipe, renders read-only view
app/r/[slug]/loading.tsx             ← Loading skeleton for public recipe page
app/r/[slug]/not-found.tsx           ← 404 for invalid/unpublished recipes

src/modules/sharing/
├── ShareModal.tsx                   ← "Make public?" confirmation + copy link UI
├── PublicRecipeView.tsx             ← Read-only recipe display (reuses existing components)
└── ForkButton.tsx                   ← "Fork to My Recipes" CTA

app/api/publish/route.ts            ← API route: publishes recipe + writes publicRecipeIndex
app/api/unpublish/route.ts          ← API route: unpublishes recipe + deletes from publicRecipeIndex
```

### Share Flow

1. User clicks "Share" button on their recipe
2. `ShareModal` opens: "Make this recipe public? Anyone with the link can view it."
3. User confirms → API route `/api/publish` is called:
   - Sets `isPublic: true` on the recipe document
   - Generates `shareSlug` from recipe name + short random suffix (e.g., `west-coast-ipa-7f3k`)
   - Sets `publishedAt` to current timestamp
   - Writes lightweight summary to `publicRecipeIndex` collection (using admin SDK)
4. Modal shows the shareable URL with a copy button: `brewing.it.com/r/west-coast-ipa-7f3k`
5. "Unshare" button calls `/api/unpublish` → reverses everything

### Public Recipe Page (Server Component)

The page at `/r/[slug]` is a **Next.js server component**:
- Uses `firebase-admin` SDK to fetch the recipe from Firestore on the server
- Renders full HTML with recipe content (no JavaScript needed for initial render)
- Google can crawl and index it directly
- Includes OpenGraph meta tags for rich link previews on social media / messaging apps

```tsx
// app/r/[slug]/page.tsx (server component — no 'use client')
export async function generateMetadata({ params }) {
  const recipe = await getPublicRecipeBySlug(params.slug);
  if (!recipe) return { title: 'Recipe Not Found' };
  return {
    title: `${recipe.name} — BeerApp`,
    description: `${recipe.style} | OG ${recipe.og} | ${recipe.ibu} IBU | ${recipe.abv}% ABV`,
    openGraph: {
      title: recipe.name,
      description: `${recipe.style} — ${recipe.abv}% ABV, ${recipe.ibu} IBU`,
      type: 'article',
    },
  };
}
```

### Forking

"Fork to My Recipes" creates a copy of the public recipe in the current user's collection:

```ts
{
  ...publicRecipe,                    // copy all recipe data
  id: generateNewId(),                // new unique ID
  ownerId: currentUser.uid,           // they own the fork
  isPublic: false,                    // their copy starts private
  shareSlug: null,
  publishedAt: null,
  parentRecipeId: publicRecipe.id,    // link back to original
  parentVersionNumber: publicRecipe.currentVersion,
  name: `${publicRecipe.name} (Fork)`,
  createdAt: now(),
  updatedAt: now(),
}
```

This reuses the existing `parentRecipeId` / `parentVersionNumber` fields already on the Recipe type.

### Phase 2 Implementation Checklist

#### Share UI
- [ ] Add "Share" button to recipe editor header (only visible for signed-in users with saved recipes)
- [ ] Create `ShareModal` component — confirmation dialog + link copy UI
- [ ] Generate URL-friendly slug from recipe name + 4-char random suffix
- [ ] Show "Unshare" option for already-public recipes
- [ ] Copy-to-clipboard button for the share URL
- [ ] Show share status indicator on recipe (public/private badge)

#### API Routes
- [ ] Create `app/api/publish/route.ts`:
  - Verify the request is authenticated (check Firebase auth token)
  - Verify the user owns the recipe
  - Update recipe: set `isPublic`, `shareSlug`, `publishedAt`
  - Write to `publicRecipeIndex` with precomputed stats (use calculation services)
- [ ] Create `app/api/unpublish/route.ts`:
  - Verify auth + ownership
  - Update recipe: clear `isPublic`, `shareSlug`, `publishedAt`
  - Delete from `publicRecipeIndex`

#### Public Recipe Page
- [ ] Create `app/r/[slug]/page.tsx` — server component
- [ ] Fetch recipe by slug using Firebase Admin SDK
- [ ] Generate OpenGraph metadata via `generateMetadata()`
- [ ] Create read-only recipe view component (reuse existing display components, strip edit controls)
- [ ] Show recipe name, style, stats (OG, FG, IBU, SRM, ABV)
- [ ] Show ingredient lists (fermentables, hops, yeasts, other)
- [ ] Show mash schedule
- [ ] Show water chemistry (if present)
- [ ] Show fermentation schedule
- [ ] Show flavor radar chart (if hops have flavor data)
- [ ] Show "Recipe by [owner name]" attribution
- [ ] Add "Fork to My Recipes" button (visible when signed in)
- [ ] Add "Sign in to save this recipe" prompt (visible when not signed in)
- [ ] Add "Export as BeerXML" button
- [ ] Create `not-found.tsx` for invalid/unpublished slugs
- [ ] Create `loading.tsx` skeleton

#### Forking
- [ ] Implement fork logic in recipe store
- [ ] Fork creates new recipe with `parentRecipeId` reference
- [ ] Show "Forked from [original recipe] by [original author]" on forked recipes
- [ ] After forking, redirect to the user's new copy in edit mode
- [ ] Increment `forkCount` on the `publicRecipeIndex` document when a fork occurs

### Phase 2 Testing

#### Share Flow Tests
- [ ] Sign in → open a saved recipe → click "Share"
- [ ] Confirmation modal appears with clear messaging
- [ ] Confirm → recipe marked public → shareable URL displayed
- [ ] Copy URL to clipboard → paste in new browser tab → public recipe loads
- [ ] "Unshare" removes public access → URL returns 404

#### Public Page Tests
- [ ] Public recipe page renders correctly with all recipe data
- [ ] View page source — HTML contains recipe content (not empty div waiting for JS)
- [ ] Page works without JavaScript enabled (server-rendered)
- [ ] Non-signed-in visitor can view public recipes
- [ ] Non-signed-in visitor sees "Sign in to save this recipe" prompt
- [ ] Invalid/unpublished slug shows 404 page

#### SEO & Social Tests
- [ ] OpenGraph meta tags present in page source (`og:title`, `og:description`, `og:type`)
- [ ] Test share URL in OpenGraph debugger (https://opengraph.xyz or Facebook Sharing Debugger)
- [ ] Page title is correct: "[Recipe Name] — BeerApp"
- [ ] Meta description includes style, ABV, IBU

#### Fork Tests
- [ ] Sign in → view a public recipe → click "Fork to My Recipes"
- [ ] New recipe appears in user's collection with "(Fork)" suffix
- [ ] Forked recipe has `parentRecipeId` referencing the original
- [ ] Forked recipe starts as private (`isPublic: false`)
- [ ] Editing the fork does not affect the original recipe
- [ ] "Forked from [name] by [author]" attribution shows on the forked recipe

#### Security Tests
- [ ] Unauthenticated API calls to `/api/publish` are rejected
- [ ] User cannot publish someone else's recipe
- [ ] User cannot unpublish someone else's recipe
- [ ] Public recipe page does not expose owner's email (only display name)

### Phase 2 Implementation Notes

#### Admin SDK `PERMISSION_DENIED` Issue (Unresolved)

The Firebase Admin SDK on Vercel returns `7 PERMISSION_DENIED: Missing or insufficient permissions` for all Firestore operations. This affects every API route that uses `firebase-admin` (`/api/browse`, `/api/publish`, `/api/unpublish`, `/api/fork`).

**Root cause:** Unknown. The service account key was regenerated and the GCP IAM console shows the project owner role is assigned. The issue may be related to the project's billing/IAM configuration on GCP. The Firebase project is `brewing-it`.

**Workaround applied:** All sharing features were migrated from Admin SDK API routes to the client-side Firestore SDK:
- **Browse page** → queries `publicRecipeIndex` directly from the client
- **Publish/Unpublish** → `publishService.ts` writes to `publicRecipeIndex` via client SDK
- **Fork** → `ForkButton.tsx` reads/writes Firestore documents directly
- **Share links** → `PublicRecipeClient.tsx` fetches recipe via client SDK

The Firestore security rules were updated to allow authenticated client writes to `publicRecipeIndex` (previously `allow write: if false` since only Admin SDK was intended to write).

**What still needs the Admin SDK:**
- `app/r/[slug]/page.tsx` uses Admin SDK in `generateMetadata()` for OpenGraph tags (title, description with recipe stats). This enables rich link previews when shared on social media / messaging apps. Currently falls back to generic `{ title: 'Shared Recipe' }` metadata.
- Any future server-side rendering or API route that needs to bypass Firestore security rules.

**To fix:** Debug the GCP IAM permissions for the `brewing-it` project's service account. Verify the service account has the `Cloud Datastore User` or `Firebase Admin SDK Administrator Service Agent` role. Once fixed, the Admin SDK can be re-enabled for `generateMetadata()` to restore rich link previews.

#### Firestore Rules Must Be Deployed

The updated security rules (allowing client writes to `publicRecipeIndex` and `userPreferences`) must be deployed via `firebase deploy --only firestore:rules`. Without this, publish/unpublish operations will fail with "Missing or insufficient permissions" on the live site.

#### Client SDK Approach — Tradeoffs

Using the client SDK instead of Admin SDK API routes means:
- **Pro:** No server-side cold starts, no Admin SDK permission issues, simpler architecture
- **Pro:** Firestore security rules enforce access control (owner can only write their own index entries)
- **Con:** No server-side rendering for SEO metadata on shared recipe pages (until Admin SDK is fixed)
- **Con:** Slightly less control over data validation (rules can validate, but not as flexibly as server-side code)
- **Con:** Anonymous/unauthenticated users can browse recipes (the `publicRecipeIndex` has `allow read: if true`), but cannot fork without signing in

#### Dead API Routes

These API routes are no longer called and can be cleaned up:
- `app/api/browse/route.ts` — replaced by client-side `BrowseRecipesPage.tsx`
- `app/api/publish/route.ts` — replaced by `publishService.ts`
- `app/api/unpublish/route.ts` — replaced by `publishService.ts`
- `app/api/fork/route.ts` — replaced by client-side `ForkButton.tsx`

#### Shared Recipe View Uses Full Builder (Read-Only)

Shared recipe links (`/r/[slug]`) render the full `BetaBuilderPage` in read-only mode instead of a separate `PublicRecipeView` component. This ensures visitors see the exact same layout as recipe owners. Read-only mode disables all inputs via `pointer-events-none` and hides Save/Cancel buttons. A "Fork to My Recipes" button lets signed-in users create their own editable copy.

---

## Phase 3: Community Features

### What We're Building

A browse page where users can discover public recipes, filter by BJCP style, and view brewer profiles.

### New Routes

```
app/
├── recipes/
│   └── browse/
│       └── page.tsx              ← Browse public recipes
├── u/
│   └── [userId]/
│       └── page.tsx              ← User profile (public recipes)
```

### Browse Page

Card grid showing public recipes with:
- Recipe name
- BJCP style
- Key stats: OG, FG, IBU, SRM, ABV
- Owner display name + avatar
- Published date
- Fork count

**Filtering:** Dropdown to filter by BJCP style category
**Sorting:** Newest first (default), most forked
**Pagination:** 20 recipes per page, cursor-based (Firestore `startAfter`)

Data source: `publicRecipeIndex` collection (lightweight documents, fast loading).

### User Profile Page

Public page at `/u/[userId]` showing:
- Display name + avatar
- List of their public recipes (same card format as browse)
- Basic stats (total public recipes, favorite styles)

### Phase 3 Implementation Checklist

#### Browse Page
- [ ] Create `app/recipes/browse/page.tsx`
- [ ] Fetch from `publicRecipeIndex` collection, ordered by `publishedAt desc`, limit 20
- [ ] Create recipe card component (name, style, stats, author, date, fork count)
- [ ] Add BJCP style filter dropdown (populated from distinct styles in index)
- [ ] Add sort toggle (newest / most forked)
- [ ] Implement cursor-based pagination ("Load More" button or infinite scroll)
- [ ] Empty state when no recipes match filters
- [ ] Link each card to `/r/[slug]` (public recipe page)
- [ ] Add link to browse page in NavBar

#### User Profile Page
- [ ] Create `app/u/[userId]/page.tsx`
- [ ] Fetch user document for display name + avatar
- [ ] Fetch their public recipes from `publicRecipeIndex` where `ownerId == userId`
- [ ] Display recipe cards in same format as browse page
- [ ] Show basic stats (recipe count, most-used styles)
- [ ] Link to user profile from recipe cards and public recipe pages

#### Index Maintenance
- [ ] Ensure `publicRecipeIndex` is written when a recipe is published (Phase 2 API route)
- [ ] Ensure `publicRecipeIndex` is deleted when a recipe is unpublished
- [ ] Ensure `publicRecipeIndex` is updated when a published recipe is edited (name, style, ingredients change → recalculate stats)
- [ ] Handle `forkCount` increment when a recipe is forked

#### SEO
- [ ] Browse page has proper title and meta tags
- [ ] User profile pages have proper title and meta tags
- [ ] Consider generating a sitemap (`app/sitemap.ts`) listing all public recipes
- [ ] Submit sitemap to Google Search Console

### Phase 3 Testing

#### Browse Page Tests
- [ ] Browse page loads with public recipe cards
- [ ] Cards display correct data (name, style, stats, author, date)
- [ ] BJCP style filter narrows results correctly
- [ ] Sort by "newest" and "most forked" both work
- [ ] Pagination loads next batch correctly (no duplicates, correct order)
- [ ] Clicking a card navigates to the public recipe page
- [ ] Empty state displays when no recipes match
- [ ] Page performs well with 100+ recipes (no lag, pagination works)

#### User Profile Tests
- [ ] Profile page loads with correct user info
- [ ] Only public recipes are shown (private recipes are not exposed)
- [ ] Clicking a recipe card navigates to the public recipe page
- [ ] Profile for user with no public recipes shows appropriate empty state

#### Index Consistency Tests
- [ ] Publish a recipe → appears in browse within seconds
- [ ] Unpublish a recipe → disappears from browse
- [ ] Edit a published recipe's name → name updates in browse
- [ ] Edit a published recipe's ingredients → stats update in browse
- [ ] Fork a recipe → fork count increments on the original's card
- [ ] Delete a published recipe → removed from browse

#### Performance Tests
- [ ] Browse page initial load < 2 seconds
- [ ] "Load more" pagination responds < 1 second
- [ ] Firestore reads stay within reasonable bounds (check Firebase Console usage tab)
- [ ] No N+1 query issues (browse uses index collection, not full recipe documents)

---

## Cost Estimate

| Service | Free Tier | When You'd Exceed |
|---------|-----------|-------------------|
| Vercel (Hobby) | 100GB bandwidth, serverless functions | >100GB bandwidth or commercial use ($20/mo Pro) |
| Firebase Auth | Unlimited users | Never (always free for email + social providers) |
| Firestore | 50k reads/day, 20k writes/day, 1GB storage | Hundreds of daily active users |
| Firebase Admin SDK | Free (runs in Vercel serverless functions) | N/A |
| Apple Developer | Not needed yet | $99/year when Apple Sign-In is added |
| **Total (launch)** | **$0/month** | **Significant traction needed to exceed free tiers** |

### Firestore Cost Mental Model
- User opens app, loads 20 recipes → 20 reads
- User edits and saves a recipe → 1 write
- User views browse page (20 cards) → 20 reads (from lightweight index)
- User views a public recipe → 1 read
- Free tier: 50k reads/day = ~2,500 users loading 20 recipes each, daily

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Firestore query limitations for complex filtering | Can't do multi-range queries (IBU > 60 AND OG > 1.065) | Start with style filter + sort only. Add client-side filtering for advanced queries. Migrate to Supabase/Postgres if this becomes a real blocker. |
| Firestore pricing unpredictability | Surprise billing if app goes viral | Set budget alert at $5/month. Paginate all list views (20/page). Use index collection for browse. Cache aggressively. |
| Firebase Admin SDK in Vercel serverless | Cold starts, timeout limits | Well-documented pattern. Firebase Admin initializes once per function instance. Cold starts add ~200ms, acceptable for SSR. |
| Google Sign-In popup blocked | Safari and some browsers block popups | Provide fallback `signInWithRedirect` if popup fails. Test across browsers. |
| Slug collisions | Two recipes generate the same slug | Include random 4-char suffix. Check for uniqueness before saving. |
| publicRecipeIndex getting out of sync | Browse page shows stale data | Use API routes (server-side) for all publish/unpublish/update operations to ensure atomic index updates. |
| SEO takes time | Public recipes not immediately indexed | Submit sitemap to Google Search Console. OpenGraph tags provide immediate value for social sharing while waiting for indexing. |
| Vendor lock-in (Firebase/Google) | Hard to migrate away later | Repository pattern abstracts Firestore. Migration path: export documents → import to Postgres → write new repository implementation. Effort is bounded and predictable. |

---

## Deferred from PRD-001

These items were deferred from PRD-001 because they depend on server-side recipe data or a live domain:

- [ ] **Server-side `generateMetadata` for `/recipes/[id]`** — Once recipes live in Firestore, add `generateMetadata()` to fetch the recipe name server-side for proper SEO titles and OpenGraph tags. Currently using a client-side `document.title` update as a stopgap.
- [ ] **Add `metadataBase` to root layout** — Set `metadataBase` in `app/layout.tsx` once the production domain is configured, so relative OG image paths resolve to full URLs.
- [ ] **Configure `brewing.it.com` domain in Vercel + update DNS** — Point the custom domain to Vercel and update DNS records.
