# Via — Final Build Plan

**Hackathon:** MongoDB Agentic Evolution — London, May 2
**Required for finalist eligibility:** MongoDB Atlas + AWS
**Team:** ≤ 4

---

## 1. The pitch (60 seconds)

> Via is your personal travel agent. You tell it where you want to go — it researches flights, hotels, restaurants, and activities, applies what it remembers about you, and hands you the one link to click. It also keeps the paperwork side sane: visas, insurance, confirmations, and anything else you need for the trip lives with the trip in MongoDB so nothing gets lost in chat. You stay in control. Need a 3am reroute? Via is one message — or one phone call — away.

## 2. Why judges care

The hackathon explicitly asks for **integrations, memory systems, and self-evolution**. Via hits all three:

| Theme | How Via delivers it |
|-------|---------------------|
| **Integrations** | Adaptive retrieval across vector memory, trip/message documents, and JSON corpora; planner + 3 parallel specialists. Live to-do list makes orchestration visible. |
| **Memory systems** | `memory_facts` + Atlas Vector Search plus structured Mongo slices; retrieval adapts queries, chunking, and ranking each turn. |
| **Self-evolution** | MemoryAgent extracts new facts from each conversation, embeds via Voyage, stores back. Agent demonstrably knows more after the conversation than before. |

## 3. Stack

### Phase 1 — required (5 accounts, all free)

| Service | Role |
|---------|------|
| MongoDB Atlas | Primary database (5 collections), vector search, conversation + trip state |
| Voyage AI | Embeddings (MongoDB-native, judging alignment) |
| Google Gemini (2.5 Flash) | LLM for planner + specialists, free tier |
| AWS EC2 | Backend hosting (single instance + Docker) |
| Vercel | Frontend hosting (free) |

### Phase 2 — voice (2 more accounts)

| Service | Role |
|---------|------|
| LiveKit Cloud | Voice rooms + Phase 3 phone numbers |
| ElevenLabs | TTS voice (also bonus prize hook) |

### Skipped deliberately

Amadeus, Google Places, Skyscanner API → hardcoded JSON for flights, hotels, restaurants. Booking URLs are deep links, not API integrations. The agentic story is about how Via reasons over the data, not where the data comes from. Adding these would burn hours and add zero to the demo.

## 4. Architecture

```
User → Next.js (chat + trip + booking) → FastAPI → orchestrator
                                              ↓
   adaptive_retrieve → planner → [flight, stay, itinerary parallel] → synthesize → extract_memory
        ↑ (multi-source)                   ↓                                          ↓
   memory_facts / trips / data/*.json    todos                                   memory_facts
                                        (live UI)                                  (writes)
                                               ↓
                                        MongoDB Atlas
```

## 5. The booking model

Via does NOT pretend to book. It generates a `booking_url` (deep link) and the user clicks through. After booking externally, the user marks "I booked it" in the UI.

This is a deliberate product decision:
- Honest (no fake PNRs that could be questioned)
- Simpler (no payment, no API integration)
- More credible (real travel agents work this way)
- Demos better ("Via does the 90% that's actually hard")

## 6. Data model — 5 collections

**`users`** — `{_id: "alex", name, home_airport, ...}`. Hardcoded for demo but if you can get a simple sign up thing working amazing

**`trips`** — embeds flights, stays, itinerary as nested arrays. Document model is the point.

**Trip documents (on `trips`)** — The agent can store **trip documents**: structured items the traveler needs for this itinerary (not a sixth collection). Embed a nested array on the trip document, for example `trip_documents[]` with fields like `title`, `category` (e.g. visa, insurance, confirmation, checklist), `summary` or notes, `created_at`, and `source` (`agent` | `user`). The planner or a lightweight post-synthesis step can append rows when the conversation surfaces requirements (“don’t forget Schengen rules,” “save your TAP confirmation email”). The UI shows them in the trip workspace so they are visible alongside flights and bookings. Phase 1 can stay **metadata and text only** (fast, demo-safe); skip OCR and heavy file pipelines unless time allows optional uploads later.

**`todos`** — first-class collection. Status: `pending | running | needs_user | done | failed`. UI polls this every 2s. Every status change is a `$set` update with `updated_at`.

**`messages`** — conversation log per trip.

**`memory_facts`** — `{user_id, fact, embedding[1024], source_trip_id}`. Atlas Vector Search index `memory_vector_index` with `user_id` as filter field.

## 7. UI layout

3 columns on desktop:

```
┌────────────────────────────────────────────────┐
│ Header                                         │
├──────────┬───────────────────┬────────────────┤
│ Chat     │ Trip workspace    │ Booking pane  │
│          │  - Live todos     │  - Pending    │
│ messages │  - Trip cards     │    bookings   │
│ + input  │  - Itinerary      │  - "Open in  │
│          │                   │    new tab"   │
└──────────┴───────────────────┴────────────────┘
```

Mobile: tabs at bottom (Chat / Trip / Bookings).

## 8. Phase 1 — Core agent + UI + booking handoff

**Goal:** A user types "plan a weekend in Lisbon," watches a live to-do list as 3 specialists work in parallel, sees results in the trip workspace, clicks "Open booking" to launch the airline/hotel site in a new tab. "I booked it" stores confirmation in MongoDB.

### Workstreams (parallel)

**Backend (Person A)**
- FastAPI skeleton, deployed to AWS EC2 mid-phase
- Endpoints: `POST /trips/:id/messages`, `GET /trips/:id`, `GET /trips/:id/todos`, `POST /todos/:id/confirm`, `GET /health`
- Orchestrator: `adaptive_retrieve` → planner → `asyncio.gather` specialists → synthesize; persistence via `messages` / `trips` / `todos` (no graph checkpointer package)

**MongoDB + Memory (Person B)**
- Atlas cluster from hackathon Sandbox link
- All 5 collections + indexes
- `memory_vector_index` (1024 dim, cosine, user_id filter)
- Voyage embeddings working
- `search_memory(user_id, query)` helper
- Seed Alex + 1 active Lisbon trip + 5–8 memory facts that fire during demo
- MemoryAgent: extracts + stores new facts per turn

**Agents (Person C)**
- Planner outputs structured `PlannerOutput` (chat reply + TODO list)
- 3 specialists with the same shape: `pending → running` (with sub_status) → look up from `agents/data/*.json`, rank with LLM using memory context, generate booking URL → `needs_user`
- Specialists run in parallel via `asyncio.gather`
- 8s timeout on every external call, graceful failure path

**Web (Person D)**
- Next.js 15 + Tailwind + shadcn/ui scaffold
- 3-column layout
- Chat panel (text input + message bubbles)
- Trip workspace with live todo cards (polling every 2s, animated state transitions, "✨ Used: '...'" memory badges)
- Trip workspace section for **trip documents** (list + categories from embedded `trip_documents` on the trip)
- Booking pane: "side-by-side browser" UX illusion (mock URL bar + "Open in new tab" button using `window.open`)

### Phase 1 done means

You can:
1. Type "Plan a weekend in Lisbon, May 9–11. Romantic Saturday dinner."
2. Watch 3 todos appear, transition pending → running → needs_user, with sub-status text
3. See "✨ Used: 'Alex prefers morning departures'" badge on the flight todo
4. Click "Open booking page" on the flight card → TAP's site opens in new tab
5. Mark "I booked it" → card moves to confirmed section

This alone is a viable demo. Everything beyond is upgrade.

## 9. Phase 2 — In-browser voice + booking pane polish

**Goal:** User can press a mic button and *talk* to Via. Booking pane has slick "side-by-side browser" UX.

**Voice (Person C)**
- LiveKit account, Python `livekit-agents` framework
- LLM: same Gemini agent as text path
- TTS: ElevenLabs (use coupon from hackathon email)
- STT: LiveKit's bundled default (no separate vendor signup)
- Filler phrase pattern: "Let me check that for you" plays immediately, specialists run in background, result speaks afterward
- Web: `<LiveKitRoom>` with mic toggle button, transcripts in chat panel
- Backend: `POST /livekit/token`

**Polish (Person D)**
- Booking pane "browser-chrome" frame: fake URL bar, favicon, prominent "Open in new tab" button
- After click: pane switches to "We've opened the booking page — finish there and come back" state
- Memory facts visibly applied + updated during conversation (sidebar widget)

## 10. Phase 3 — Phone number (the showstopper)

**Goal:** Real phone number rings into Via. Judge dials it from their phone. Via answers. Same agent code as in-browser voice.

- LiveKit Cloud → Telephony → buy US local number (free on included tier)
- Inbound dispatch rule routing calls to a room with `agent_name="via-agent"`
- Use **explicit dispatch** (give agent a name)
- Hardcode caller as Alex for demo
- Test: dial number from your own phone

**Hard fallback rule:** Cap phone setup at 90 minutes. If not working by then, kill it and put everyone on demo polish + recording the backup video. Phase 1 + Phase 2 is already a complete product.

## 11. Final phase — freeze, rehearse, submit

Regardless of which phases shipped:

- Code freeze. No new features, only fixes.
- Rehearse demo 3x — full run-through.
- Record backup video on QuickTime. WiFi will fail at the worst time.
- Submit on cerebralvalley.ai with: GitHub repo (public), backup video, slides (5 max).
- Submit to showcase.elevenlabs.io for $1980/person bonus prize.
- Confirm 1 person free for May 7 finals at MongoDB.local.

## 12. The 90-second demo script

**Beat 1 — Setup.** App open, Alex's profile loaded.
> "This is Via. I'm Alex. Planning a weekend in Lisbon."

**Beat 2 — Multi-agent planning.**
Type or say: "Plan a weekend in Lisbon, May 9–11, romantic Saturday dinner."
- Three todos appear, animate pending → running → needs_user
- "✨ Used: 'Alex prefers morning departures'" badge appears

> "Three specialist agents working in parallel. The to-do list isn't UI — it's MongoDB documents the agents are writing as they work."

**Beat 3 — Honest booking handoff.**
Click "Open booking" on flight card. New tab opens TAP.

> "Via doesn't pretend to book. It does the 90% that's actually hard, hands you the one link to click."

**Beat 4 — Memory evolution.**
Say: "Actually, I'm cutting back on red wine — keep that in mind."
Show MongoDB Atlas split-screen: new `memory_fact` appears with embedding.

> "That fact just got vector-indexed. Next trip, when I ask for restaurant recs, Atlas Vector Search retrieves it and Via avoids wine bars."

**Beat 5 — The phone call (Phase 3).**
Pull out phone, speaker on, dial Via's number.
> Via: "Hi Alex, what can I help with?"
"My flight just got cancelled, find me anything to Lisbon tonight."
[multi-agent flow runs again, laptop screen updates live]
> Via: "Done. Same agent, same memory, real phone number. That's Via."

If Phase 3 didn't ship, replace Beat 5 with: a follow-up message demonstrating agent updating an existing trip ("swap Saturday dinner for something casual" → todo appears, old item removed, new restaurant slots in).

## 13. The integration story (rehearse this)

Drill this paragraph — judges will ask:

> "We use MongoDB for heterogeneous trips, high-write todos and messages, and semantic memory_facts with Atlas Vector Search and Voyage embeddings. On top of that we built **adaptive retrieval**: each turn the agent reformulates queries, pulls from vector search and structured documents, reshapes chunks for the corpora, and reranks what enters the planner — then specialist agents run in parallel with todos mirrored in Mongo. Working context, long-term memory, and observable agent state all live in the database — that's integration, memory, and evolution without bolting on a separate graph runtime."

## 14. Risk register

| Risk | Mitigation |
|------|------------|
| Gemini structured tool calls fail >10% of the time | Add retry with stricter prompt. Test reliability early in Phase 1. If still flaky at end of Phase 1, swap planner only to a different LLM. |
| Multi-agent loop hangs | 8s timeout on every tool call. Specialist failure → planner says "having trouble with X" rather than freezing. |
| Vector index slow to build | Build at 9am, before retrieval code is written. |
| LLM produces invalid TODO JSON | `with_structured_output` + Pydantic schema. Test 5 inputs early. |
| Iframe approach breaks | You're already on new-tab pattern. Don't try to proxy real travel sites. |
| Scope creep into real bookings | Re-read the booking model section every 2 hours. Mocked is fine. |
| WiFi dies during demo | Backup video. Phone call survives wifi death (cellular). Hotspot ready. |

## 15. What you do NOT build (do not be tempted)

- ❌ Real airline/hotel booking APIs (deep links + user confirmation is the design)
- ❌ Auth / login (hardcode Alex)
- ❌ Multiple users / sharing
- ❌ Native iOS or Android
- ❌ Boarding pass OCR / automatic parsing of uploaded PDFs (trip document **metadata and notes** on `trips` are in scope; vision pipelines are not)
- ❌ Calendar integration
- ❌ UK phone number via Twilio (US LiveKit number, judges dial +1 free)
- ❌ Real flight/hotel/restaurant API integrations (hardcoded JSON)
- ❌ Anthropic, OpenAI, Deepgram, LangSmith, Amadeus signups
