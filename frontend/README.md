# via — frontend

A React + Vite implementation of the via marketing site and dashboard. Soft-brutalist aesthetic, paper plane logo, four routes:

- `/` — home (animated chat preview hero)
- `/how-it-works` — narrative explainer + agent architecture
- `/pricing` — three tiers + FAQs
- `/dashboard` — the 3-column working app (chat + trip workspace + booking pane)

The dashboard now talks to the FastAPI backend in `../backend`. Marketing pages (Home, HowItWorks, Pricing) still reference `src/data/mockTrip.js` for the static chat preview, but the dashboard pulls live data through `src/lib/api.js`.

---

## Running locally

```bash
npm install
cp .env.local.example .env.local   # adjust if your backend isn't on :8000
npm run dev                         # http://localhost:5173
npm run build                       # production build to ./dist
npm run preview                     # preview the production build
```

Requires Node 18+ and the backend running on `http://localhost:8000` (`uvicorn app.main:app --reload` from `../backend`).

### Environment variables

Vite injects any `VITE_*` variable into `import.meta.env`.

| var | default | purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | base URL of the FastAPI backend |
| `VITE_DEMO_TRIP_ID` | `trip_lisbon` | trip id the dashboard loads (no auth in phase 1) |

> Do not use `NEXT_PUBLIC_*` — this is Vite, not Next.js.

---

## Project structure

```
src/
├── main.jsx                    # entry, BrowserRouter
├── App.jsx                     # route definitions
├── pages/
│   ├── Home.jsx                # marketing landing
│   ├── HowItWorks.jsx          # marketing — narrative + arch overview
│   ├── Pricing.jsx             # marketing — 3 tiers + FAQ
│   └── Dashboard.jsx           # the app — 3-column layout
├── components/
│   ├── Logo.jsx                # inline-SVG paper plane wordmark
│   ├── MarketingNav.jsx        # nav for marketing pages
│   ├── Footer.jsx              # marketing footer
│   ├── HeroChatPreview.jsx     # animated chat loop on home
│   └── dashboard/
│       ├── ChatPanel.jsx       # left col — messages + memory + composer
│       ├── TripWorkspace.jsx   # middle col — todos + cards + docs
│       └── BookingPane.jsx     # right col — mock browser frame
├── data/
│   └── mockTrip.js             # legacy fixtures — used only by marketing pages
├── lib/
│   └── api.js                  # fetch wrapper + backend↔frontend field mapping
└── styles/
    └── globals.css             # palette, type, paper grain, shared utilities
```

---

# integrations: how the backend plugs in

The dashboard is wired to FastAPI through `src/lib/api.js`. That module owns
all `fetch()` calls AND the field-mapping that translates the backend schema
(`TodoModel`, `TripModel`, `MessageModel` in `backend/app/models.py`) into the
shape the existing components were originally written against.

## the seam

`src/lib/api.js` is the only place that knows about the network. It exports
`getTrip`, `getTodos`, `getMessages`, `sendMessage`, `confirmTodo`, `health`
— each performs the field translation below before returning.

| concept | backend (Mongo / Pydantic) | frontend (component-facing) |
|---|---|---|
| trip dates | `dates.{start,end}` | `start_date` / `end_date` |
| todo title | `text` | `title` |
| todo agent | `FlightAgent` / `StayAgent` / `ItineraryAgent` | `flight` / `stay` / `itinerary` |
| todo memory | `memory_facts_used` | `memory_used` |
| message role | `assistant` | `agent` |
| message timestamp | `ts` | `created_at` (ISO) |
| send body | `{text, user_id}` | (frontend constructs from chat draft) |

## API contract (Phase 1)

| Method | Path | Purpose | Frontend caller |
|---|---|---|---|
| `GET` | `/trips/:id` | full trip document (flights, stays, itinerary, trip_documents) | `Dashboard` on mount + after each `messages` POST |
| `GET` | `/trips/:id/todos` | live todos list | `Dashboard` polls every 2s |
| `POST` | `/trips/:id/messages` | send a user message — agent responds | `ChatPanel.handleSend` |
| `GET` | `/trips/:id/messages` | full conversation log | `Dashboard` on mount |
| `POST` | `/todos/:id/confirm` | mark a booking as confirmed | `BookingPane.onConfirm` → `Dashboard` |
| `GET` | `/health` | liveness | (deploy check) |

> **Out of scope until Phase 2:** `/users/:id/memory` (read-only memory strip)
> and `PATCH /users/:id` (settings save). The memory strip currently renders
> empty; the settings drawer keeps changes in local state only.

### data shapes

`mockTrip.js` already uses the shapes from `BUILD_PLAN.md` § 6, so when the backend serializes Mongo docs as JSON they should drop in cleanly. Important fields:

- **trip**: `_id`, `destination`, `start_date`, `end_date`, `travelers`, `status`, `budget_total`, `flights[]`, `stays[]`, `itinerary[]`, `trip_documents[]`
- **todo**: `_id`, `trip_id`, `agent` (`"flight" | "stay" | "itinerary"`), `status` (`"pending" | "running" | "needs_user" | "done" | "failed"`), `sub_status`, `title`, `memory_used[]`, `result_id`, `updated_at`
- **memory_fact**: `_id`, `user_id`, `fact`, `embedding[1024]` (frontend never sees the embedding), `source_trip_id`, `created_at`
- **flight / stay / itinerary item**: must include `booking_url` (deep link the user opens in a new tab) and `memory_used[]` (the facts the specialist applied — surfaced as the green badges in the UI)

## wiring (current state)

`Dashboard.jsx` performs:

1. **Initial load** — `Promise.all([getTrip, getTodos, getMessages])` on mount.
2. **Todo polling** — `setInterval(getTodos, 2000)` while the dashboard is mounted.
3. **Send** — optimistic `user` bubble → `POST /trips/:id/messages` → append the
   reply as an `agent` bubble → refetch trip + todos (a specialist may have
   added a new flight / stay / itinerary item to the trip doc).
4. **Confirm booking** — match the pending booking to a todo via
   `result.booking_url`, `POST /todos/:id/confirm`, refetch trip + todos.

### CORS

The backend defaults to `CORS_ALLOW_ORIGINS=*` (see `backend/.env.example`),
which already accepts `http://localhost:5173`. If you tighten this in
production, add the Vercel origin explicitly:

```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://via.vercel.app", "http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
```

## the agentic UX, mapped to UI

This is the demo story (`BUILD_PLAN.md` § 12) seen from the frontend's side:

| Demo beat | What changes in the UI | Behind the scenes |
|---|---|---|
| User types "Plan a weekend in Lisbon…" in `ChatPanel` | message bubble appears immediately (optimistic) | `POST /trips/:id/messages` |
| 3 todos appear in `TripWorkspace` with status `pending` | todos list fades them in via `motion` `AnimatePresence` | planner agent writes 3 todo docs |
| Status flips `pending → running` with sub-status updating | shimmer animation on the todo card; sub_status text swaps | each specialist's first `$set` after pickup |
| Memory badge "✨ used: 'Alex prefers morning departures'" | green pill renders below sub_status | specialist persists which memory_facts contributed to the rank |
| Status flips to `needs_user` and the result card appears | trip_card slides in with `layout` animation | specialist writes to `trips.flights[]` (etc.) and updates the todo with a `result_id` |
| User clicks "open booking" | `BookingPane` shows the mock browser frame for that item | no API call — pure UI state until "I booked it" |
| User opens the airline site in a new tab, books, returns, clicks "I booked it" | trip_card flips to `confirmed` color, item moves to confirmed list in `BookingPane` | `POST /todos/:id/confirm` |
| User says "Cutting back on red wine" in chat | ~1.2s later a new memory fact appears in the green strip | MemoryAgent extracts → embeds via Voyage → writes to `memory_facts` |

## phase 2 — voice

When LiveKit is wired:

- The `ChatPanel.__mic` button currently does nothing. Replace its `onClick` with a LiveKit room toggle.
- Wrap `Dashboard` in `<LiveKitRoom>` from `@livekit/components-react`.
- Add a backend route `POST /livekit/token` that mints a join token for `agent_name="via-agent"`.
- Voice transcripts can be shown in the same `ChatPanel` message list — just push them as `role: "user"` messages.

## phase 3 — phone number

No frontend work. The phone path uses the same agent on the backend; the laptop's UI just needs to be open during the demo so the live todo updates (from the call's planner output) show on screen.

---

## design system

CSS custom properties on `:root` in `src/styles/globals.css`:

| token | hex | use |
|---|---|---|
| `--paper` | `#f4f1e8` | main background |
| `--paper-warm` | `#ede8d8` | secondary surfaces (footers, footers, totals row) |
| `--soft-green` | `#c8e089` | featured cards, memory badges |
| `--accent` | `#9bc555` | buttons, the plane body |
| `--ink` | `#1f2818` | text, all strokes |
| `--ink-muted` | `#3a4526` | body copy |
| `--sage` | `#5a6448` | metadata, captions |

Type:
- **Playfair Display** (display, headlines, italics, the wordmark)
- **Inter** (body, UI, buttons)
- **JetBrains Mono** (tags, agent labels, URL bar in booking frame)

Soft-brutalist tells: 1.5px borders, offset shadows (`box-shadow: 4px 4px 0 var(--ink)`), pill buttons, dotted dividers, paper grain texture overlay. Hover states translate elements up-left to suggest the shadow is "real."

## using the paper plane logo

`Logo` is an inline SVG component (`src/components/Logo.jsx`). It scales with a `size` prop and has a `variant` (light/dark) for different backgrounds:

```jsx
<Logo size={32} />                        // marketing nav
<Logo size={28} />                        // dashboard header
<Logo size={48} variant="dark" />         // anywhere on ink backgrounds
<Logo size={24} showTrail={false} />      // tight horizontal slots, no trail
```

To swap it for a custom PNG, replace the `Logo` component contents with an `<img src="/logo.png" />`. Drop your PNG into `/public/logo.png` and it will be served at the root.
