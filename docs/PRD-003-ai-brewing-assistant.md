# PRD-003: AI Brewing Assistant (Conversational Recipe Coach)

> **Status:** Draft
> **Created:** 2026-03-04
> **Depends on:** PRD-001 (Next.js + Vercel, for API routes), PRD-002 Phase 1 (Auth, for premium gating + rate limiting)

---

## Context

BeerApp's recipe editor is powerful but assumes brewing knowledge. For beginners — people who want to brew with friends but don't know grain bills from hop schedules — the editor is intimidating. An AI assistant that guides them through recipe construction via conversation makes the app accessible to anyone.

This is NOT a recipe generator. It's a **back-and-forth conversation** where the LLM acts as a brewing coach: explaining concepts, suggesting ingredients, and making targeted changes to the recipe as the user talks through what they want. The user and the LLM collaborate on the recipe together.

**Primary use case:** "I want to give this app to my friends who don't know much about brewing, have them work with the AI to build a recipe, and then we brew it together."

## Goals

- Beginners can build a working recipe through conversation without brewing knowledge
- The LLM explains *why* it makes each suggestion (educational, not just generative)
- Changes are applied directly to the recipe editor in real-time via tool calls
- The assistant only modifies the sections relevant to the conversation
- Advanced users can also use it for quick adjustments ("make it drier", "swap to a Belgian yeast")
- Feature is gated behind premium tier to cover API costs

## Non-Goals

- Replacing the manual recipe editor (the assistant is additive, not a different mode)
- Generating complete recipes in one shot
- Brew day guidance or process instructions (future feature)
- Image generation (recipe labels, etc.)
- Free-tier AI access (premium only)

---

## Architecture

### Request Flow

```
User types message in chat panel
        |
Frontend sends to Next.js API route (app/api/ai/chat/route.ts):
  - Conversation history
  - Current recipe JSON
  - Calculated values (OG, FG, IBU, SRM, ABV)
        |
API route verifies auth + premium tier
        |
API route calls Claude API with:
  - System prompt (brewing coach persona + tool definitions)
  - Conversation history
  - Current recipe context
        |
Claude responds with:
  - Streamed conversational text (explanation, questions, suggestions)
  - Tool calls (targeted recipe modifications, emitted at end of stream)
        |
Frontend streams text into chat + executes tool calls against recipeStore
        |
Recipe editor updates live
```

### Why Tool Use (Not JSON Patches)

Claude's tool_use feature lets the LLM call specific functions alongside its text response. This is better than returning JSON patches because:

1. **Maps 1:1 to existing store actions** — `addHop()`, `updateFermentable()`, etc. already exist in `recipeStore.ts`
2. **Changes are explicit and auditable** — the chat shows "Added 56g Citra as dry hop" not a raw JSON diff
3. **The LLM explains while it acts** — text says "Citra will give you big citrus notes" while the tool call adds the hop
4. **Partial updates are natural** — the LLM only calls tools for what's relevant to the conversation
5. **The user sees what changed** — tool calls render as compact change cards in the chat

### Tool Definitions

These map directly to the existing `recipeStore` actions in `src/modules/beta-builder/presentation/stores/recipeStore.ts`:

```
Recipe metadata:
  set_recipe_name        -> recipeStore.updateRecipe({ name })
  set_recipe_style       -> recipeStore.updateRecipe({ style })
  set_batch_volume       -> recipeStore.updateRecipe({ batchVolumeL })
  set_recipe_notes       -> recipeStore.updateRecipe({ notes })

Fermentables:
  add_fermentable        -> recipeStore.addFermentable(fermentable)
  update_fermentable     -> recipeStore.updateFermentable(id, updates)
  remove_fermentable     -> recipeStore.removeFermentable(id)

Hops:
  add_hop                -> recipeStore.addHop(hop)
  update_hop             -> recipeStore.updateHop(id, updates)
  remove_hop             -> recipeStore.removeHop(id)

Yeast:
  add_yeast              -> recipeStore.addYeast(yeast)
  update_yeast           -> recipeStore.updateYeast(id, updates)
  remove_yeast           -> recipeStore.removeYeast(id)

Other ingredients:
  add_other_ingredient   -> recipeStore.addOtherIngredient(ingredient)

Mash:
  add_mash_step          -> recipeStore.addMashStep(step)
  update_mash_step       -> recipeStore.updateMashStep(id, updates)
  remove_mash_step       -> recipeStore.removeMashStep(id)

Fermentation:
  add_fermentation_step  -> via updateRecipe with updated fermentationSteps

Equipment:
  set_equipment          -> recipeStore.updateRecipe({ equipment, equipmentProfileName })
```

Tool parameters use the exact same types as the store actions (Fermentable, Hop, Yeast, MashStep, etc.) so no translation layer is needed.

---

## Model Strategy

### V1: Claude Haiku

Start with Claude Haiku (claude-haiku-4-5-20251001):
- ~$0.014 per message (1.4 cents) — including full system prompt
- Reliable tool use / structured output
- Good brewing knowledge from training data
- Fast enough for conversational UX

### Future: Cost Optimization Options

| Option | Cost/message | Tradeoff |
|--------|-------------|----------|
| **Claude Haiku** (V1) | ~$0.014 | Reliable tool use, good knowledge |
| **Claude Haiku + prompt caching** | ~$0.005 | 90% discount on cached system prompt |
| **Groq (Llama 3.1 70B)** | ~$0.003 | Fastest inference, but tool use less reliable |
| **Claude Sonnet** | ~$0.015 | Better for complex recipe building, similar cost to Haiku |

**Prompt caching** is the biggest win: Anthropic caches the system prompt across requests within a ~5 minute window. In a back-and-forth conversation, the 11k-token system prompt is cached after the first message, reducing input cost by 90% for subsequent messages.

**Groq/Llama** is a future option if cost becomes an issue at scale. The API route is the only thing that changes — tool definitions, frontend, and store integration are model-agnostic. Tool use reliability on open source models is the main concern.

The model choice can be swapped without touching any frontend code. Start with what works, optimize later.

---

## Context Sent to Claude

### System Prompt (~3-4k tokens, static, cacheable)

```
Persona:
  - Friendly homebrewing assistant helping people build beer recipes
  - Educational: always explain WHY, not just WHAT
  - For beginners: explain brewing concepts in plain language
  - For advanced users: be concise and technical

Knowledge:
  - BJCP 2021 style guidelines
  - Brewing ingredients and their characteristics
  - Brewing science (mash chemistry, hop utilization, yeast behavior)
  - Recipe formulation best practices
```

### V1 Prompt Strategy: Lean (No Preset Data)

For V1, **don't send full preset lists in the system prompt**. Claude already knows brewing ingredients from its training data. Instead:
- Let Claude suggest ingredients based on its knowledge
- The frontend `aiToolExecutor` validates suggestions against presets
- If Claude suggests an unknown ingredient, snap to the nearest match or flag it

This keeps the system prompt small (~1-2k tokens) and cheap. Add preset data in V2 if Claude frequently suggests unknown ingredients.

### V2 Prompt Strategy: Rich (With Preset Data, Cached)

If needed, add to system prompt:
- BJCP style specs (SPEC_MAP from `src/utils/bjcpSpecs.ts`) — ~2,500 tokens
- Hop presets with flavor profiles — ~4,500 tokens
- Fermentable presets — ~2,500 tokens
- Yeast presets — ~1,200 tokens

Total: ~11,000 tokens. With prompt caching, this costs full price on first message and 90% less on subsequent messages within the conversation.

### Per-Message Context (Dynamic)

```
Current recipe state:
  {full recipe JSON — ~500-1,500 tokens}

Calculated values:
  OG: 1.062, FG: 1.012, ABV: 6.6%, IBU: 55, SRM: 8

BJCP style target (if set):
  21A American IPA — OG: 1.056-1.070, FG: 1.008-1.014, IBU: 40-70, SRM: 6-14
  [recipe is within/outside each range]

User message: "Can we make it more citrusy?"
```

### Conversation History

Previous messages in the session, trimmed to most recent ~10 messages (~2-4k tokens) if the conversation gets long.

---

## Premium Gating

### User Tier Model

```
users/{userId}
  - tier: "free" | "premium"
  - premiumSince?: Timestamp
```

- **Free tier:** Full app access, no AI assistant
- **Premium tier:** AI assistant enabled, 50 messages/day

### API Route Auth Check

```ts
// app/api/ai/chat/route.ts
const user = await verifyFirebaseToken(request);
if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

const userData = await getUser(user.uid);
if (userData.tier !== 'premium') {
  return Response.json({ error: 'premium_required' }, { status: 403 });
}
```

### Rate Limiting

Track daily usage in Firestore:
```
users/{userId}/usage/ai
  - dailyCount: number
  - lastReset: Timestamp (resets when date changes)
```

50 messages/day for premium users. Return 429 with friendly message when exceeded.

### Payments (Future)

Stripe Checkout for premium subscriptions is a separate implementation. For V1/testing, manually set `tier: "premium"` in Firestore for friends/testers.

---

## Streaming

### Why Stream

Without streaming: user sends message, stares at spinner for 2-3 seconds, gets full response. With streaming: text appears word-by-word, feels conversational and fast.

### How It Works

1. API route uses `client.messages.stream()` (Anthropic SDK)
2. Returns a `ReadableStream` to the frontend
3. Frontend renders text tokens as they arrive in real-time
4. Tool calls emit at end of stream (they don't stream token-by-token)
5. Tool calls execute immediately, change cards appear, recipe updates

UX sequence:
```
[User sends message]
[Text streams in word-by-word: "Let me add some Citra — it'll give you..."] (2-3 sec)
[Tool calls arrive at end]
[Change cards appear: "+ Added Citra (28g, dry hop)"]
[Recipe editor updates live]
```

Next.js API routes support streaming natively. ~20 lines of extra code vs non-streaming.

---

## UX Design

### Chat Panel

- **Collapsed state:** Floating button in bottom-right corner of recipe editor: "AI Assistant" icon
- **Expanded state (desktop):** Side panel slides in from right, ~350px wide
- **Expanded state (mobile):** Bottom sheet slides up, ~60% viewport height
- **Persists across section navigation** — chat stays open as user scrolls through recipe sections

### Message Rendering

- User messages: right-aligned, accent-colored bubble
- Assistant messages: left-aligned, neutral bubble, text streams in
- Change cards: compact inline cards between messages showing what tools were called

### Change Cards

When Claude calls tools, compact cards appear in the chat:

```
+-------------------------------------+
| + Added Citra (28g, dry hop)        |
| + Added Galaxy (28g, whirlpool)     |
| ~ Set style: 21A American IPA      |
+-------------------------------------+
```

Changes are already applied to the editor when cards appear. Cards are informational.

### Conversation Starters

For beginners who don't know what to ask, show clickable prompt suggestions on empty chat:
- "I want to brew a light summer beer"
- "Help me make an IPA"
- "I have Cascade and Centennial hops — what can I make?"
- "What's a good first recipe for a beginner?"

### Empty Recipe vs Existing Recipe

- **Empty recipe:** "What kind of beer do you want to make? Something light, dark, hoppy, malty?"
- **Existing recipe:** "I see you've got a solid IPA base going. The OG is a bit high for the style — want me to adjust?"

---

## Privacy

### What Gets Sent to Claude API
- Recipe JSON (ingredient names, weights, volumes, process parameters)
- Conversation text
- No PII (no email, name, user ID, auth tokens)

### What Does NOT Get Sent
- User account information
- Other users' recipes
- Auth tokens or session data

### Anthropic Data Policy
- API inputs are **not used for model training** (per Anthropic ToS)
- Data is processed per-request and not retained

### User Transparency
- Display a brief privacy note in the chat panel: "Your recipe data is sent to Anthropic's API for processing. It is not stored or used for training."
- AI Assistant is opt-in (premium feature, not enabled by default)

---

## New Files

```
app/api/ai/chat/route.ts                              <- API route (Claude proxy + auth + rate limit)

src/modules/ai-assistant/
|-- aiChatStore.ts                                     <- Zustand store (messages, loading, sendMessage)
|-- aiSystemPrompt.ts                                  <- System prompt builder
|-- aiToolExecutor.ts                                  <- Maps tool calls to recipeStore actions
|-- aiToolDefinitions.ts                               <- Claude tool schemas
|-- aiTypes.ts                                         <- Message, ToolCall, ChangeCard types
+-- components/
    |-- AiChatPanel.tsx                                <- Main chat panel (collapsible side/bottom)
    |-- AiMessageBubble.tsx                            <- Individual message rendering
    |-- AiChangeCard.tsx                               <- Tool call visualization
    +-- AiConversationStarters.tsx                     <- Prompt suggestions for empty state
```

## Modified Files

```
src/modules/beta-builder/presentation/components/BetaBuilderPage.tsx
  -> Add AiChatPanel alongside the recipe editor

package.json
  -> Add @anthropic-ai/sdk

.env.local / Vercel env vars
  -> ANTHROPIC_API_KEY
```

---

## Implementation Checklist

### Backend (API Route)
- [ ] Create `app/api/ai/chat/route.ts`
- [ ] Install `@anthropic-ai/sdk` dependency
- [ ] Add `ANTHROPIC_API_KEY` to Vercel environment variables
- [ ] Implement Firebase auth token verification from request header
- [ ] Implement premium tier check (reject free-tier users with 403)
- [ ] Implement rate limiting (daily message count in Firestore, 50/day)
- [ ] Build system prompt with brewing coach persona
- [ ] Define tool schemas matching recipeStore action signatures
- [ ] Accept request body: `{ messages, currentRecipe, calculations }`
- [ ] Call Claude API with streaming: `client.messages.stream()`
- [ ] Return streamed response (text + tool calls) to frontend
- [ ] Return 429 with friendly message when rate limit exceeded
- [ ] Return 401/403 for unauthenticated/non-premium users

### Frontend (Chat Store)
- [ ] Create `aiChatStore.ts` — Zustand store
  - `messages: Message[]` (conversation history)
  - `isLoading: boolean`
  - `isStreaming: boolean`
  - `error: string | null`
  - `sendMessage(text: string): void`
  - `clearConversation(): void`
- [ ] `sendMessage()` collects current recipe + calculations from recipeStore
- [ ] Sends to `/api/ai/chat` with Firebase auth token in header
- [ ] Handles streamed response: appends text tokens as they arrive
- [ ] On tool calls: passes to aiToolExecutor, appends change cards to message
- [ ] Handles errors: network failure, rate limit, auth failure

### Frontend (Tool Executor)
- [ ] Create `aiToolExecutor.ts`
- [ ] Map each tool name to the corresponding recipeStore action:
  - `set_recipe_name` -> `recipeStore.updateRecipe({ name })`
  - `set_recipe_style` -> `recipeStore.updateRecipe({ style })`
  - `set_batch_volume` -> `recipeStore.updateRecipe({ batchVolumeL })`
  - `add_fermentable` -> `recipeStore.addFermentable()` (generate ID, look up preset data)
  - `update_fermentable` -> `recipeStore.updateFermentable()`
  - `remove_fermentable` -> `recipeStore.removeFermentable()`
  - `add_hop` -> `recipeStore.addHop()` (generate ID, look up flavor profile from presets)
  - `update_hop` -> `recipeStore.updateHop()`
  - `remove_hop` -> `recipeStore.removeHop()`
  - `add_yeast` -> `recipeStore.addYeast()` (generate ID, look up attenuation from presets)
  - `update_yeast` -> `recipeStore.updateYeast()`
  - `remove_yeast` -> `recipeStore.removeYeast()`
  - `add_other_ingredient` -> `recipeStore.addOtherIngredient()`
  - `add_mash_step` -> `recipeStore.addMashStep()`
  - `update_mash_step` -> `recipeStore.updateMashStep()`
  - `remove_mash_step` -> `recipeStore.removeMashStep()`
  - `set_equipment` -> `recipeStore.updateRecipe({ equipment, equipmentProfileName })`
- [ ] Validate ingredient names against presets — snap to nearest match if unknown
- [ ] Return change summary for each tool call (for rendering change cards)

### Frontend (Tool Definitions)
- [ ] Create `aiToolDefinitions.ts` — Claude tool schemas as JSON
- [ ] Each tool has: name, description, input_schema with properties and required fields
- [ ] Tool schemas use the exact same field names and types as Recipe model types
- [ ] Export as array for inclusion in API call

### Frontend (UI Components)
- [ ] Create `AiChatPanel.tsx` — collapsible panel
  - Desktop: side panel from right, ~350px wide
  - Mobile: bottom sheet, ~60vh
  - Toggle button (floating, bottom-right of editor)
  - Conversation history scrollable area
  - Text input at bottom with send button
- [ ] Create `AiMessageBubble.tsx` — message rendering
  - User messages: right-aligned, accent color
  - Assistant messages: left-aligned, neutral, supports streaming text
  - Typing indicator while waiting for response
- [ ] Create `AiChangeCard.tsx` — tool call visualization
  - Compact card showing what changed ("+Added Citra 28g dry hop")
  - Color-coded by action type (add=green, update=blue, remove=red)
- [ ] Create `AiConversationStarters.tsx` — clickable prompt suggestions
  - Show when conversation is empty
  - 4-5 beginner-friendly prompts
- [ ] Wire `AiChatPanel` into `BetaBuilderPage.tsx`

### System Prompt
- [ ] Create `aiSystemPrompt.ts` — builds the system prompt string
- [ ] Include brewing coach persona and instructions
- [ ] Include instruction to always explain "why" alongside changes
- [ ] Include instruction to be beginner-friendly by default
- [ ] V1: Do NOT include full preset lists (rely on Claude's training knowledge)
- [ ] V2 (later): Add BJCP specs from `src/utils/bjcpSpecs.ts` and presets with prompt caching

### Premium UX
- [ ] Show "AI Assistant" button only for premium users
- [ ] Free users who click see an upgrade prompt
- [ ] Premium badge or indicator somewhere subtle in the UI

---

## Testing Plan

### Conversation Quality Tests (Manual)
- [ ] "I want to make a light summer beer" -> suggests appropriate style, starts building simple recipe
- [ ] "Make it more bitter" -> adds/adjusts hop additions, explains IBU impact
- [ ] "I don't like wheat" -> adjusts grain bill, suggests alternatives, explains the swap
- [ ] "What does OG mean?" -> explains in plain language without being condescending
- [ ] "Help me make an IPA" -> builds recipe within BJCP 21A ranges
- [ ] Starting from existing recipe: "This is too sweet" -> adjusts fermentables or yeast attenuation
- [ ] "Can we add some fruit flavor?" -> suggests fruit addition or fruity hops, explains options
- [ ] Multi-turn conversation maintains context (references earlier choices correctly)
- [ ] Off-topic question -> politely redirects to brewing

### Tool Execution Tests
- [ ] `add_fermentable` -> fermentable appears in recipe editor grain bill with correct values
- [ ] `add_hop` -> hop appears with correct alpha acid, timing, and flavor profile looked up from presets
- [ ] `add_yeast` -> yeast appears with correct attenuation
- [ ] `update_fermentable` -> weight/color changes reflected in editor
- [ ] `remove_hop` -> hop removed from editor, IBU recalculates
- [ ] `set_recipe_style` -> BJCP style set, gauge comparisons appear
- [ ] `add_mash_step` -> mash step appears in schedule with correct temp/duration
- [ ] `set_equipment` -> equipment profile applied correctly
- [ ] Multiple tool calls in one response all execute correctly and in order
- [ ] Calculated values (OG, FG, IBU, SRM, ABV) update correctly after tool calls
- [ ] Unknown ingredient name -> snapped to nearest preset match or gracefully handled

### UI Tests
- [ ] Chat panel opens/closes smoothly (desktop: slide from right, mobile: bottom sheet)
- [ ] Messages render correctly (user right, assistant left)
- [ ] Text streams in real-time during response
- [ ] Change cards appear inline after tool calls
- [ ] Conversation starters appear on empty chat, disappear after first message
- [ ] Loading/typing indicator shows while waiting for response
- [ ] Error state shows on failure (with retry option)
- [ ] Mobile layout works (bottom sheet doesn't block recipe editor)
- [ ] Chat panel doesn't interfere with recipe editor scrolling or drag-and-drop
- [ ] Chat persists when scrolling between recipe sections
- [ ] Clear conversation button works

### Auth & Rate Limiting Tests
- [ ] Unauthenticated user -> 401, no AI panel visible
- [ ] Free-tier user -> 403, upgrade prompt shown
- [ ] Premium user -> AI assistant works
- [ ] 50 messages in a day -> subsequent messages return 429 with friendly "limit reached" message
- [ ] Rate limit resets after 24 hours (new day)
- [ ] Expired/invalid auth token -> 401, prompt to re-sign-in

### Streaming Tests
- [ ] Text appears word-by-word in the chat bubble
- [ ] Tool calls execute at end of stream, not during text streaming
- [ ] If stream is interrupted (network error), partial text is preserved and error shown
- [ ] Long responses stream correctly without freezing the UI

### Edge Cases
- [ ] Empty recipe + first message -> assistant handles gracefully, asks what they want to brew
- [ ] Very long conversation (20+ messages) -> older messages trimmed, context preserved
- [ ] Claude returns no tool calls (just text explanation) -> renders normally, no empty change card
- [ ] Claude returns only tool calls (rare, no text) -> change cards render without empty message bubble
- [ ] Recipe has no hops and user says "make it less bitter" -> explains there are no hops to adjust
- [ ] Network failure mid-stream -> error message, conversation history preserved, can retry
- [ ] User asks to modify an ingredient by name that has multiple matches -> assistant asks for clarification
- [ ] Concurrent recipe edits (user manually edits while AI is responding) -> recipe state is consistent

---

## Cost Estimate

### Per-Message Cost

| Scenario | Input tokens | Output tokens | Cost |
|----------|-------------|---------------|------|
| V1 Haiku (lean prompt) | ~4,000 | ~500 | ~$0.005 |
| V1 Haiku (lean prompt, cached) | ~4,000 (90% cached) | ~500 | ~$0.002 |
| V2 Haiku (rich prompt, cached) | ~17,000 (90% cached) | ~500 | ~$0.005 |
| V1 Sonnet (if needed) | ~4,000 | ~500 | ~$0.020 |

### Monthly Cost Projections

| Users (premium, daily active) | Messages/day | Model | Monthly cost |
|------|-------------|-------|-------------|
| 5 (friends testing) | 50 | Haiku | ~$3 |
| 50 | 500 | Haiku | ~$30 |
| 200 | 2,000 | Haiku | ~$120 |
| 200 | 2,000 | Haiku + caching | ~$50 |

At $5/month premium subscription with 50 premium users = $250/month revenue vs ~$30/month API cost. Healthy margin.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM suggests bad recipes (off-style, undrinkable) | User brews a bad beer | Include BJCP ranges in context. Post-check: if recipe is far outside style guidelines after changes, warn user in chat. |
| LLM hallucinates ingredient names not in presets | Tool executor can't find ingredient | Validate against presets in aiToolExecutor. Snap to nearest match. If no match, show message: "I suggested [X] but it's not in your ingredient database — would you like to add something similar?" |
| API costs grow unexpectedly | Surprise bill | Rate limit per user (50/day). Premium-only access. Monitor daily spend via Anthropic dashboard. Can downgrade to cheaper model or reduce limit. |
| Latency (2-3 seconds for first token) | Feels slow | Streaming mitigates perceived latency. Typing indicator while waiting. Tool calls execute instantly once received. |
| Prompt injection via user input | Security concern | API route is server-side (no secrets exposed). Claude's safety training handles adversarial inputs. Tool calls are bounded (can only modify the current user's current recipe). No destructive actions possible. |
| Model quality degrades on complex recipes | Bad suggestions for advanced recipes | Start with Haiku, monitor quality. Upgrade specific conversation types to Sonnet if needed. Users can always manually override AI suggestions. |
| System prompt too large (if using preset data) | Higher costs, slower first response | V1: skip preset data entirely. V2: use prompt caching (90% discount on repeated system prompts). Trim to most common ingredients only. |
| Streaming implementation complexity | Dev time | Next.js and Anthropic SDK both support streaming natively. ~20 lines of extra code vs non-streaming. Worth doing from the start. |

---

## Example Conversation Flow

```
[User opens chat panel on an empty recipe]

AI: "Hey! What kind of beer are you thinking about? Something
    light and refreshing, dark and roasty, or hoppy and bitter?"

User: "Something light for summer, my friends and I want to
      brew something easy"

AI: "A Blonde Ale would be perfect for that — it's one of the
    easiest styles to brew and super drinkable in warm weather.
    Light body, clean flavor, just a touch of hop character.

    Let me set up a starting point for you."

    [+ Set style: 18A Blonde Ale]
    [+ Set batch volume: 19L]
    [+ Added Pale 2-Row (4.0kg)]
    [+ Added Munich Malt (0.3kg)]
    [+ Added Cascade (21g, 60min boil)]
    [+ Added US-05 yeast (77% attenuation)]
    [+ Added Saccharification rest (67C, 60min)]

    "I went with Pale 2-Row as the base — that's your main
    fermentable, it'll give you a clean, bready flavor. A bit
    of Munich adds a light biscuity sweetness.

    Cascade hops at 60 minutes give you about 20 IBU of
    bitterness — enough to balance the malt without being
    obviously hoppy. US-05 is a clean, reliable yeast that
    ferments well at room temperature.

    Your estimated ABV is about 4.8% and it should be a
    beautiful golden color. Want to adjust anything?"

User: "Can we make it a bit more interesting? Maybe more
      flavor?"

AI: "Sure! Let's add a late hop addition for some aroma
    without adding much bitterness."

    [+ Added Cascade (14g, whirlpool 80C)]
    [+ Added Crystal 20L (0.2kg)]

    "I added a whirlpool addition of Cascade — steeping hops
    at 80C pulls out floral and citrus aromas without the
    bitterness you'd get from a full boil. And a small amount
    of Crystal 20L malt adds a hint of caramel sweetness and
    gives the beer a bit more body.

    Still light and easy-drinking, just more going on.
    What do you think?"
```
