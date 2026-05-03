/**
 * via demo script — hardcoded scripted responses keyed to user inputs.
 *
 * The dashboard primary path is this state machine; real backend is a
 * fallback when no scene matches. Each scene returns a list of "actions"
 * with built-in delays the dashboard's executeActions runs sequentially.
 *
 * Action shapes:
 *   { type: 'append_message',    message: {...},        delay: ms }
 *   { type: 'add_todo',          todo: {...},           delay: ms }
 *   { type: 'update_todo',       id: '...', patch: {}, delay: ms }
 *   { type: 'set_trip_field',    field: '...', value: ..., delay: ms }
 *   { type: 'append_trip_array', field: '...', value: ..., delay: ms }
 *
 * `delay` is "wait this long BEFORE applying this action" — they pause
 * sequentially within a single scene, but a scene runs detached from the
 * caller (handleSend doesn't await the full sequence) so further user
 * messages can fire scenes in parallel — that's how we demo the hotel +
 * flight agents running concurrently.
 */

const lc = (s) => (s || "").toLowerCase();
const has = (text, ...needles) => {
  const t = lc(text);
  return needles.some((n) => t.includes(n.toLowerCase()));
};

// ─── canonical demo data (single source of truth for cards + plan) ───────────

const DESTINATIONS = [
  {
    name: "Lisbon, Portugal",
    short: "Lisbon",
    image:
      "https://images.unsplash.com/photo-1588535231156-d52a3a3f9e72?w=400",
    sub: "old-town charm, atlantic beaches 20 min away, ~£90 flights from LHR",
  },
  {
    name: "Madrid, Spain",
    short: "Madrid",
    image:
      "https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=400",
    sub: "not coastal but valencia is a 90min train; great food, ~£70 flights",
  },
  {
    name: "Barcelona, Spain",
    short: "Barcelona",
    image:
      "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=400",
    sub: "city beach, gaudí, ~£100 flights from LGW",
  },
];

// trip dates: friday 2026-05-08 → sunday 2026-05-10 (next weekend from May 2)
const TRIP_DATES = { start: "2026-05-08", end: "2026-05-10" };

const HOTEL = {
  _id: "stay-memmo",
  name: "Memmo Alfama Hotel",
  area: "Alfama",
  style: "boutique",
  check_in: "2026-05-08",
  check_out: "2026-05-10",
  nights: 2,
  price: 190,
  price_per_night_gbp: 95,
  rating: 4.6,
  reviews: 1200,
  image:
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400",
  bullets: [
    "boutique stay in historic alfama district",
    "£95 / night",
    "4.6 stars · 1,200 reviews",
    "8 min walk to riverside",
    "rooftop pool with castle views",
  ],
  booking_url:
    "https://www.booking.com/searchresults.html?ss=Memmo+Alfama+Hotel+Lisbon",
};

const FLIGHT_OUT = {
  _id: "flight-tap-out",
  carrier: "TAP Air Portugal",
  flight_no: "TP1361",
  from: "LHR",
  to: "LIS",
  depart: "2026-05-08T09:35:00",
  arrive: "2026-05-08T12:10:00",
  duration: "2h 35m",
  kind: "outbound",
  price: 71,
  booking_url:
    "https://www.skyscanner.net/transport/flights/lhr/lis/260508/",
};

const FLIGHT_BACK = {
  _id: "flight-tap-back",
  carrier: "TAP Air Portugal",
  flight_no: "TP1366",
  from: "LIS",
  to: "LHR",
  depart: "2026-05-10T21:15:00",
  arrive: "2026-05-10T23:50:00",
  duration: "2h 35m",
  kind: "return",
  price: 71,
  booking_url:
    "https://www.skyscanner.net/transport/flights/lis/lhr/260510/",
};

const FLIGHT_CARD = {
  carrier: "TAP Air Portugal",
  flightNos: "TP1361 / TP1366",
  pricePerPerson: 142,
  duration: "~2h35m each way · direct",
  groundTime: "60h on the ground in lisbon",
  legs: [
    {
      day: "Fri",
      from: "LHR",
      to: "LIS",
      depart: "09:35",
      arrive: "12:10",
    },
    {
      day: "Sun",
      from: "LIS",
      to: "LHR",
      depart: "21:15",
      arrive: "23:50",
    },
  ],
  booking_url: FLIGHT_OUT.booking_url,
};

const ITINERARY = [
  {
    _id: "itin-1",
    day: "Fri",
    time: "15:00",
    title: "Time Out Market",
    area: "Cais do Sodré",
    description: "Quick lunch on arrival.",
  },
  {
    _id: "itin-2",
    day: "Fri",
    time: "19:30",
    title: "Belcanto (Michelin **)",
    area: "Chiado",
    description: "Fine dining by José Avillez.",
  },
  {
    _id: "itin-3",
    day: "Sat",
    time: "10:00",
    title: "Tram 28 → Castelo de São Jorge",
    area: "Alfama",
    description: "Iconic tram ride up to the castle.",
  },
  {
    _id: "itin-4",
    day: "Sat",
    time: "13:00",
    title: "Pastéis de Belém + Jerónimos Monastery",
    area: "Belém",
    description: "Classic custard tarts and the cloisters.",
  },
  {
    _id: "itin-5",
    day: "Sat",
    time: "17:00",
    title: "Sunset at Miradouro da Senhora do Monte",
    area: "Graça",
    description: "Best sunset view in the city.",
  },
  {
    _id: "itin-6",
    day: "Sat",
    time: "20:00",
    title: "Cervejaria Ramiro",
    area: "Anjos",
    description: "Seafood institution.",
  },
  {
    _id: "itin-7",
    day: "Sun",
    time: "11:00",
    title: "Sintra day trip",
    area: "Sintra",
    description: "Train from Rossio (~40 min).",
  },
  {
    _id: "itin-8",
    day: "Sun",
    time: "19:00",
    title: "Alma (Michelin **)",
    area: "Chiado",
    description: "Final fancy dinner.",
  },
];

const ITINERARY_CARD = {
  days: [
    {
      label: "Day 1 (Fri) — arrive afternoon",
      items: [
        { time: "3pm", title: "Time Out Market", sub: "quick lunch" },
        {
          time: "7:30pm",
          title: "Belcanto",
          sub: "Michelin ** — fine dining, José Avillez",
        },
      ],
    },
    {
      label: "Day 2 (Sat)",
      items: [
        {
          time: "10am",
          title: "Tram 28 → Castelo de São Jorge",
          sub: "ride up through alfama",
        },
        {
          time: "1pm",
          title: "Pastéis de Belém + Jerónimos Monastery",
          sub: "tarts and cloisters",
        },
        {
          time: "5pm",
          title: "Sunset at Miradouro da Senhora do Monte",
          sub: "best view in the city",
        },
        {
          time: "8pm",
          title: "Cervejaria Ramiro",
          sub: "seafood institution",
        },
      ],
    },
    {
      label: "Day 3 (Sun)",
      items: [
        {
          time: "11am",
          title: "Sintra day trip",
          sub: "train from Rossio (40min)",
        },
        {
          time: "7pm",
          title: "Alma",
          sub: "Michelin ** — final fancy dinner",
        },
      ],
    },
  ],
};

// ─── revised itinerary (tweak scene — friend at 6pm Sat) ─────────────────────
//
// Day 1 + Day 3 untouched. Day 2 is rebuilt around the 6pm meet:
//   • drop the 5pm sunset miradouro
//   • slot a 4pm "head back to alfama, freshen up" buffer
//   • add 6pm drinks with the friend at Park Bar (rooftop, Bairro Alto)
//   • shift Cervejaria Ramiro from 8pm → 9pm so dinner stays in the plan
const REVISED_ITINERARY = [
  {
    _id: "itin-1",
    day: "Fri",
    time: "15:00",
    title: "Time Out Market",
    area: "Cais do Sodré",
    description: "Quick lunch on arrival.",
  },
  {
    _id: "itin-2",
    day: "Fri",
    time: "19:30",
    title: "Belcanto (Michelin **)",
    area: "Chiado",
    description: "Fine dining by José Avillez.",
  },
  {
    _id: "itin-3",
    day: "Sat",
    time: "10:00",
    title: "Tram 28 → Castelo de São Jorge",
    area: "Alfama",
    description: "Iconic tram ride up to the castle.",
  },
  {
    _id: "itin-4",
    day: "Sat",
    time: "13:00",
    title: "Pastéis de Belém + Jerónimos Monastery",
    area: "Belém",
    description: "Classic custard tarts and the cloisters.",
  },
  {
    _id: "itin-5b",
    day: "Sat",
    time: "16:00",
    title: "head back to alfama, freshen up",
    area: "Alfama",
    description: "Buffer before evening plans.",
  },
  {
    _id: "itin-friend",
    day: "Sat",
    time: "18:00",
    title: "drinks with friend at Park Bar",
    area: "Bairro Alto",
    description: "Rooftop bar with sunset views.",
  },
  {
    _id: "itin-6",
    day: "Sat",
    time: "21:00",
    title: "Cervejaria Ramiro",
    area: "Anjos",
    description: "Seafood institution — late dinner.",
  },
  {
    _id: "itin-7",
    day: "Sun",
    time: "11:00",
    title: "Sintra day trip",
    area: "Sintra",
    description: "Train from Rossio (~40 min).",
  },
  {
    _id: "itin-8",
    day: "Sun",
    time: "19:00",
    title: "Alma (Michelin **)",
    area: "Chiado",
    description: "Final fancy dinner.",
  },
];

const ITINERARY_REVISED_CARD = {
  revised: true,
  days: [
    {
      label: "Day 1 (Fri) — arrive afternoon",
      items: [
        { time: "3pm", title: "Time Out Market", sub: "quick lunch" },
        {
          time: "7:30pm",
          title: "Belcanto",
          sub: "Michelin ** — fine dining, José Avillez",
        },
      ],
    },
    {
      label: "Day 2 (Sat) — revised",
      revised: true,
      items: [
        {
          time: "10am",
          title: "Tram 28 → Castelo de São Jorge",
          sub: "ride up through alfama",
        },
        {
          time: "1pm",
          title: "Pastéis de Belém + Jerónimos Monastery",
          sub: "tarts and cloisters",
        },
        {
          time: "4pm",
          title: "head back to alfama, freshen up",
          sub: "buffer before the evening",
        },
        {
          time: "6pm",
          title: "meet friend (drinks at Park Bar)",
          sub: "rooftop in bairro alto",
        },
        {
          time: "9pm",
          title: "Cervejaria Ramiro",
          sub: "seafood, late dinner",
        },
      ],
    },
    {
      label: "Day 3 (Sun)",
      items: [
        {
          time: "11am",
          title: "Sintra day trip",
          sub: "train from Rossio (40min)",
        },
        {
          time: "7pm",
          title: "Alma",
          sub: "Michelin ** — final fancy dinner",
        },
      ],
    },
  ],
};

const HEATHROW_DOCS = [
  {
    _id: "doc-eliz-out",
    title: "Elizabeth line → Heathrow (out)",
    category: "transport",
    summary:
      "Paddington → LHR T2/T3, £12.80, ~30min. Friday morning.",
    source: "agent",
  },
  {
    _id: "doc-eliz-back",
    title: "Elizabeth line → home (return)",
    category: "transport",
    summary: "LHR → Paddington, £12.80, runs til ~midnight Sunday.",
    source: "agent",
  },
];

// ─── tiny helpers ────────────────────────────────────────────────────────────

let msgCounter = 0;
const mid = (suffix = "") => {
  msgCounter += 1;
  return `m-${Date.now()}-${msgCounter}${suffix ? `-${suffix}` : ""}`;
};

const agentText = (content) => ({
  _id: mid(),
  role: "agent",
  content,
  created_at: new Date().toISOString(),
});

const agentCard = (kind, payload) => ({
  _id: mid(kind),
  role: "agent",
  kind,
  ...payload,
  created_at: new Date().toISOString(),
});

const todoExists = (todos, id) => (todos || []).some((t) => t._id === id);
const todoStatus = (todos, id) =>
  (todos || []).find((t) => t._id === id)?.status;
const messagesHaveKind = (messages, kind) =>
  (messages || []).some((m) => m.kind === kind);
const itineraryHasFriend = (trip) =>
  (trip?.itinerary || []).some((i) => i._id === "itin-friend");

// ─── scene matchers ──────────────────────────────────────────────────────────

/**
 * Each scene is { name, match(text, state) → bool, build(state) → actions[] }.
 * Order matters — the first scene that matches wins.
 */
const SCENES = [
  // ── Scene 5 — add hotel to plan ────────────────────────────────────────────
  {
    name: "add_hotel",
    match: (text, { trip, todos }) => {
      const hasHotelResult =
        todoStatus(todos, "todo-hotel-1") === "needs_user" ||
        todoStatus(todos, "todo-hotel-1") === "running";
      const alreadyAdded = (trip?.stays || []).some(
        (s) => s._id === HOTEL._id
      );
      if (alreadyAdded) return false;
      const trigger = has(
        text,
        "add the hotel",
        "book that hotel",
        "lock in the hotel",
        "add memmo",
        "add hotel to my plan",
        "add hotel to plan"
      );
      return hasHotelResult && trigger;
    },
    build: () => [
      {
        type: "update_todo",
        id: "todo-hotel-1",
        patch: { status: "done", sub_status: "added to your travel plan." },
        delay: 0,
      },
      {
        type: "append_trip_array",
        field: "stays",
        value: HOTEL,
        delay: 0,
      },
      {
        type: "append_message",
        message: agentText("added Memmo Alfama to your travel plan."),
        delay: 600,
      },
    ],
  },

  // ── Scene 6 — add flight to plan ───────────────────────────────────────────
  {
    name: "add_flight",
    match: (text, { trip, todos }) => {
      const hasFlightResult =
        todoStatus(todos, "todo-flight-1") === "needs_user" ||
        todoStatus(todos, "todo-flight-1") === "running";
      const alreadyAdded = (trip?.flights || []).some(
        (f) => f._id === FLIGHT_OUT._id
      );
      if (alreadyAdded) return false;
      const trigger = has(
        text,
        "add the flight",
        "add the flights",
        "book that flight",
        "book those flights",
        "lock in the flight",
        "lock in flights",
        "add flight to my plan",
        "add flights to plan"
      );
      return hasFlightResult && trigger;
    },
    build: () => [
      {
        type: "update_todo",
        id: "todo-flight-1",
        patch: { status: "done", sub_status: "flights locked in." },
        delay: 0,
      },
      {
        type: "append_trip_array",
        field: "flights",
        value: [FLIGHT_OUT, FLIGHT_BACK],
        delay: 0,
      },
      {
        type: "append_message",
        message: agentText("flights locked in."),
        delay: 600,
      },
    ],
  },

  // ── Scene 8 — add itinerary to plan ────────────────────────────────────────
  {
    name: "add_itinerary",
    match: (text, { trip, todos }) => {
      const hasItinResult =
        todoStatus(todos, "todo-itinerary-1") === "needs_user" ||
        todoStatus(todos, "todo-itinerary-1") === "running";
      const alreadyAdded = (trip?.itinerary || []).length >= ITINERARY.length;
      if (alreadyAdded) return false;
      const trigger = has(
        text,
        "add all to plan",
        "add all to my plan",
        "lock in itinerary",
        "lock the itinerary",
        "add itinerary",
        "looks great"
      );
      return hasItinResult && trigger;
    },
    build: () => [
      {
        type: "update_todo",
        id: "todo-itinerary-1",
        patch: {
          status: "done",
          sub_status: "8 stops added to your plan.",
        },
        delay: 0,
      },
      {
        type: "append_trip_array",
        field: "itinerary",
        value: ITINERARY,
        delay: 0,
      },
      {
        type: "append_message",
        message: agentText(
          "itinerary's in. anything else to handle before you go?"
        ),
        delay: 700,
      },
    ],
  },

  // ── Scene 8b — apply tweak (must come before tweak_itinerary so the      ──
  //              "looks good" / "update plan" confirmation wins once the    ──
  //              revised card has been shown) ────────────────────────────────
  {
    name: "apply_tweak",
    match: (text, { trip, messages }) => {
      if (!messagesHaveKind(messages, "itinerary_revised")) return false;
      if (itineraryHasFriend(trip)) return false;
      return has(
        text,
        "looks good",
        "update plan",
        "apply changes",
        "confirm tweak"
      );
    },
    build: () => [
      {
        type: "set_trip_field",
        field: "itinerary",
        value: REVISED_ITINERARY,
        delay: 0,
      },
      {
        type: "update_todo",
        id: "todo-itinerary-1",
        patch: {
          status: "done",
          sub_status: "saturday rescheduled",
        },
        delay: 0,
      },
      {
        type: "append_message",
        message: agentText(
          "saturday's rescheduled. drinks with your friend at 6, dinner pushed to 9."
        ),
        delay: 700,
      },
    ],
  },

  // ── Scene 8c — tweak itinerary around a 6pm friend meet ────────────────────
  //
  // Only fires once the original itinerary has been added AND we haven't
  // already shown a revised card. The itinerary agent re-runs as a live todo
  // with sub_status updates, then surfaces a revised day-2 card.
  {
    name: "tweak_itinerary",
    match: (text, { trip, todos, messages }) => {
      if (!todoExists(todos, "todo-itinerary-1")) return false;
      if ((trip?.itinerary || []).length === 0) return false;
      if (messagesHaveKind(messages, "itinerary_revised")) return false;
      if (itineraryHasFriend(trip)) return false;
      return has(
        text,
        "meeting a friend",
        "meeting someone",
        "friend at",
        "tweak the itinerary",
        "change the itinerary",
        "swap saturday",
        "something at 6",
        "at 6pm",
        "at 6 pm",
        "6pm"
      );
    },
    build: () => [
      {
        type: "append_message",
        message: agentText(
          "no problem — clearing 5–8pm Saturday and shifting the dinner reservation later."
        ),
        delay: 1300,
      },
      {
        type: "update_todo",
        id: "todo-itinerary-1",
        patch: {
          status: "running",
          sub_status: "reshuffling saturday around your 6pm meet...",
        },
        delay: 600,
      },
      {
        type: "update_todo",
        id: "todo-itinerary-1",
        patch: {
          sub_status: "scouting rooftop bars in bairro alto...",
        },
        delay: 2400,
      },
      {
        type: "update_todo",
        id: "todo-itinerary-1",
        patch: {
          sub_status: "pushing Cervejaria Ramiro to 9pm...",
        },
        delay: 2400,
      },
      {
        type: "update_todo",
        id: "todo-itinerary-1",
        patch: {
          status: "needs_user",
          sub_status: "revised day 2 ready — review below.",
        },
        delay: 4000,
      },
      {
        type: "append_message",
        message: agentCard("itinerary_revised", {
          itinerary: ITINERARY_REVISED_CARD,
        }),
        delay: 400,
      },
    ],
  },

  // ── Scene 1 — destination suggestions ──────────────────────────────────────
  {
    name: "destinations",
    match: (text, { trip }) => {
      // don't re-fire after the user has already picked a destination
      if (trip?.destination) return false;
      return has(
        text,
        "beach",
        "beachy",
        "somewhere warm",
        "next weekend",
        "warm weather"
      );
    },
    build: () => [
      {
        type: "append_message",
        message: agentText(
          "since you're in London, a few weekend-friendly beach options come to mind. all under 3 hours flying:"
        ),
        delay: 1300,
      },
      {
        type: "append_message",
        message: agentCard("destination_picker", { destinations: DESTINATIONS }),
        delay: 400,
      },
    ],
  },

  // ── Scene 2 — Lisbon picked ────────────────────────────────────────────────
  {
    name: "lisbon_picked",
    match: (text, { trip }) => {
      if (trip?.destination === "Lisbon") return false;
      return has(text, "lisbon");
    },
    build: () => [
      {
        type: "set_trip_field",
        field: "destination",
        value: "Lisbon",
        delay: 0,
      },
      {
        type: "set_trip_field",
        field: "start_date",
        value: TRIP_DATES.start,
        delay: 0,
      },
      {
        type: "set_trip_field",
        field: "end_date",
        value: TRIP_DATES.end,
        delay: 0,
      },
      {
        type: "set_trip_field",
        field: "travelers",
        value: 1,
        delay: 0,
      },
      {
        type: "append_message",
        message: agentText(
          "great pick. lisbon's a vibe. for sleeping — hotel or airbnb? and any sense of budget?"
        ),
        delay: 1000,
      },
    ],
  },

  // ── Scene 3 — cheap hotel → deploy stay agent ──────────────────────────────
  {
    name: "cheap_hotel",
    match: (text, { todos }) => {
      if (todoExists(todos, "todo-hotel-1")) return false;
      const wantsHotel = has(text, "hotel", "stay", "place to sleep");
      const wantsCheap = has(
        text,
        "cheap",
        "budget",
        "affordable",
        "low cost",
        "not expensive"
      );
      return wantsHotel && wantsCheap;
    },
    build: () => [
      {
        type: "append_message",
        message: agentText(
          "got it, deploying the hotel agent to find you something cheap and good in lisbon."
        ),
        delay: 800,
      },
      {
        type: "add_todo",
        todo: {
          _id: "todo-hotel-1",
          title: "find cheap hotel in lisbon",
          agent: "stay",
          status: "running",
          sub_status: "searching boutique stays under £100/night...",
          memory_used: [],
          created_at: new Date().toISOString(),
        },
        delay: 0,
      },
      {
        type: "update_todo",
        id: "todo-hotel-1",
        patch: { sub_status: "ranking by reviews + price..." },
        delay: 2000,
      },
      {
        type: "append_message",
        message: agentText(
          "while that runs — flights. any preference on times or stopovers?"
        ),
        delay: 2000,
      },
      {
        type: "update_todo",
        id: "todo-hotel-1",
        patch: {
          status: "needs_user",
          sub_status: "found a strong match — review below.",
          result: { _id: HOTEL._id, booking_url: HOTEL.booking_url },
        },
        delay: 8500,
      },
      {
        type: "append_message",
        message: agentCard("hotel_result", { hotel: HOTEL }),
        delay: 400,
      },
    ],
  },

  // ── Scene 4 — flights "anything works" → deploy flight agent ───────────────
  {
    name: "flights_flexible",
    match: (text, { trip, todos }) => {
      if (!trip?.destination) return false;
      if (todoExists(todos, "todo-flight-1")) return false;
      return has(
        text,
        "anything works",
        "anytime",
        "flexible",
        "most of my time",
        "whatever",
        "no preference",
        "open to anything",
        "early flight",
        "late flight"
      );
    },
    build: () => [
      {
        type: "append_message",
        message: agentText(
          "perfect, deploying the flight agent. it'll optimise for time on the ground."
        ),
        delay: 800,
      },
      {
        type: "add_todo",
        todo: {
          _id: "todo-flight-1",
          title: "find flights LHR ↔ LIS",
          agent: "flight",
          status: "running",
          sub_status: "scanning TAP, easyJet, Ryanair...",
          memory_used: [],
          created_at: new Date().toISOString(),
        },
        delay: 0,
      },
      {
        type: "update_todo",
        id: "todo-flight-1",
        patch: { sub_status: "comparing total ground time..." },
        delay: 2400,
      },
      {
        type: "update_todo",
        id: "todo-flight-1",
        patch: {
          status: "needs_user",
          sub_status: "found a direct return — review below.",
          result: { _id: FLIGHT_OUT._id, booking_url: FLIGHT_OUT.booking_url },
        },
        delay: 9000,
      },
      {
        type: "append_message",
        message: agentCard("flight_result", { flight: FLIGHT_CARD }),
        delay: 400,
      },
    ],
  },

  // ── Scene 7 — restaurants/itinerary → deploy itinerary agent ───────────────
  {
    name: "itinerary",
    match: (text, { trip, todos }) => {
      if (!trip?.destination) return false;
      if (todoExists(todos, "todo-itinerary-1")) return false;
      return has(
        text,
        "restaurant",
        "restaurants",
        "dinner",
        "itinerary",
        "things to do",
        "activities",
        "what to do",
        "sightseeing"
      );
    },
    build: () => [
      {
        type: "append_message",
        message: agentText(
          "love it — fancy dinners, touristy by day, breathing room. deploying the itinerary agent."
        ),
        delay: 800,
      },
      {
        type: "add_todo",
        todo: {
          _id: "todo-itinerary-1",
          title: "build 3-day lisbon itinerary",
          agent: "itinerary",
          status: "running",
          sub_status: "matching neighbourhoods to your prefs...",
          memory_used: [],
          created_at: new Date().toISOString(),
        },
        delay: 0,
      },
      {
        type: "update_todo",
        id: "todo-itinerary-1",
        patch: { sub_status: "cross-referencing michelin + local picks..." },
        delay: 2400,
      },
      {
        type: "update_todo",
        id: "todo-itinerary-1",
        patch: {
          status: "needs_user",
          sub_status: "draft itinerary ready — 8 stops across 3 days.",
        },
        delay: 9000,
      },
      {
        type: "append_message",
        message: agentCard("itinerary_result", { itinerary: ITINERARY_CARD }),
        delay: 400,
      },
    ],
  },

  // ── Scene 9 — heathrow / "anything else" ───────────────────────────────────
  {
    name: "anything_else",
    match: (text, { trip }) => {
      // only relevant once a trip is in motion
      if (!trip?.destination) return false;
      const alreadyAdded = (trip?.trip_documents || []).some(
        (d) => d._id === "doc-eliz-out"
      );
      if (alreadyAdded) return false;
      return has(
        text,
        "anything else",
        "what else",
        "take care of",
        "should i take care",
        "forgetting",
        "anything i'm missing",
        "anything i am missing"
      );
    },
    build: () => [
      {
        type: "append_message",
        message: agentText(
          "yeah — getting to/from heathrow. since you're being budget-aware:\n\n• out: Elizabeth line from Paddington → LHR T2/T3 (£12.80, 30min). way cheaper than the Express.\n• back: same line, runs until ~midnight.\n\nadded both to your travel plan as transport notes."
        ),
        delay: 1000,
      },
      {
        type: "append_trip_array",
        field: "trip_documents",
        value: HEATHROW_DOCS,
        delay: 0,
      },
    ],
  },

  // ── Bonus — gentle response to "see other options" / "alternatives" ────────
  {
    name: "alternatives",
    match: (text, { trip }) => {
      if (!trip?.destination) return false;
      return has(
        text,
        "other options",
        "see alternatives",
        "show alternatives",
        "different one",
        "different option",
        "other hotels",
        "other flights"
      );
    },
    build: () => [
      {
        type: "append_message",
        message: agentText(
          "this was the strongest match by reviews + price. i can widen the search if you'd like — just say the word."
        ),
        delay: 800,
      },
    ],
  },
];

/**
 * runDemoStep — given the user's text and the dashboard state, return a
 * scripted action plan if a scene matches, otherwise { matched: false }.
 *
 * @param {string} text  — raw user input
 * @param {object} state — { trip, todos, messages }
 * @returns {{matched: boolean, scene?: string, actions?: object[]}}
 */
export function runDemoStep(text, state) {
  if (!text || !text.trim()) return { matched: false };
  for (const scene of SCENES) {
    try {
      if (scene.match(text, state)) {
        return { matched: true, scene: scene.name, actions: scene.build(state) };
      }
    } catch (e) {
      console.warn("demo scene match error", scene.name, e);
    }
  }
  return { matched: false };
}

// exposed for tests / debugging
export const __DEMO_DATA = {
  DESTINATIONS,
  HOTEL,
  FLIGHT_OUT,
  FLIGHT_BACK,
  FLIGHT_CARD,
  ITINERARY,
  ITINERARY_CARD,
  REVISED_ITINERARY,
  ITINERARY_REVISED_CARD,
  HEATHROW_DOCS,
  TRIP_DATES,
};
