# Remaining Work

> Consolidated from PRD-003 and PRD-006 Phase 3. All other PRDs (001, 002, 004, 005) are complete.

---

## 1. Enhanced Brew Mode (Premium)

_From PRD-006 Phase 3C_

Upgrade brew sessions from basic tracking to a guided brew-day experience.

### Requirements

- Step-by-step brew day flow following the recipe's mash schedule, boil, and fermentation phases
- Record actual measurements at each step: pre-boil gravity, post-boil gravity, mash pH, temperatures, times
- Target vs actual comparisons with deltas (e.g. "Target OG: 1.055, Actual: 1.052 — 0.5% under")
- Post-brew summary: what hit target, what missed, variance analysis, space for notes/learnings
- Searchable session history

### Gating

- `canAccess('enhanced_brew_mode')` check
- Free: basic session tracking (current behavior)
- Premium: full guided experience

---

## 2. Premium Browse Badge & Ranking Boost

_From PRD-006 Phase 3D. Lower priority — can wait._

- Small, tasteful "Premium" badge on recipe cards from Premium users in `/browse`
- Slight algorithmic ranking boost for Premium users' published recipes in browse/search
- Badge should not dominate the card

---

## 3. AI Brewing Assistant (TBD)

_From PRD-003. Draft — decision pending on whether to pursue._

Conversational AI brewing coach that guides users through recipe building via dialogue. Not a recipe generator — the LLM collaborates, explains concepts, and applies targeted changes to the recipe in real-time.

### Architecture

- Frontend -> Next.js API route -> Claude API -> streamed response (text + tool calls) -> frontend executes tools against recipeStore
- Uses Claude tool_use to call recipeStore actions directly (13 tool categories)
- V1 model: Claude Haiku (~$0.014/message); prompt caching reduces ~90%

### UX

- Chat panel: collapsed floating button -> expanded side panel (desktop) or bottom sheet (mobile)
- Change cards visualize tool calls inline between messages
- Conversation starters for empty chat

### Gating

- Free: no AI access
- Premium: AI assistant, 50 messages/day rate limit
- Usage tracked in Firestore (`users/{userId}/usage/ai`)

### Cost Projections

- 5 test users ~$3/mo, 50 users ~$30/mo, 200 users ~$120/mo
- At $5/mo premium with 50 users = $250 revenue vs $30 cost
