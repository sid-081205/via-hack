/**
 * Mock data for the dashboard.
 *
 * Mirrors the Phase 1 MongoDB schema from BUILD_PLAN.md so the frontend
 * components are already shaped for the real API. When the backend is
 * wired, swap these imports for fetch() calls — see README.md.
 */

export const USER = {
  _id: "alex",
  name: "Alex Morgan",
  home_city: "London, UK",
  home_airport: "LHR",
  passport_country: "United Kingdom",
  preferences: {
    flight_class: "economy",
    departure_window: "morning",
    seat: "window",
    loyalty: "TAP Miles&Go, BA Executive Club",
    stay_style: "boutique",
    area: "old",
    diet: "",
    dislikes: "red wine",
    default_budget: "£1500",
    flag_threshold: "£500",
    notify_reroutes: true,
    notify_reminders: true,
    notify_memory: false,
  },
};

// memory_facts collection · seeds + ones added during demo
export const MEMORY_FACTS = [
  { _id: "f1", fact: "Alex prefers morning departures (before 11am).", source_trip_id: "t-prev-1", created_at: "2026-02-12T09:14:00Z" },
  { _id: "f2", fact: "Has a TAP frequent flyer account.", source_trip_id: "t-prev-1", created_at: "2026-02-12T09:14:00Z" },
  { _id: "f3", fact: "Likes boutique hotels in old quarters, not chains.", source_trip_id: "t-prev-2", created_at: "2026-03-02T18:22:00Z" },
  { _id: "f4", fact: "Budget-conscious — flags any single line item over £500.", source_trip_id: "t-prev-2", created_at: "2026-03-02T18:22:00Z" },
  { _id: "f5", fact: "Cutting back on red wine.", source_trip_id: "t-current", created_at: "2026-04-30T20:14:00Z" },
];

// the active trip
export const TRIP = {
  _id: "t-current",
  user_id: "alex",
  destination: "Lisbon, Portugal",
  start_date: "2026-05-09",
  end_date: "2026-05-11",
  travelers: 2,
  status: "planning",
  budget_total: 1200,
  flights: [
    {
      _id: "fl1",
      kind: "outbound",
      carrier: "TAP",
      flight_no: "TP203",
      from: "LHR",
      to: "LIS",
      depart: "2026-05-09T09:15:00Z",
      arrive: "2026-05-09T12:00:00Z",
      price: 187,
      booking_url: "https://www.flytap.com/en-gb",
      memory_used: ["Alex prefers morning departures (before 11am)."],
    },
    {
      _id: "fl2",
      kind: "return",
      carrier: "TAP",
      flight_no: "TP206",
      from: "LIS",
      to: "LHR",
      depart: "2026-05-11T19:30:00Z",
      arrive: "2026-05-11T22:15:00Z",
      price: 0,
      booking_url: "https://www.flytap.com/en-gb",
    },
  ],
  stays: [
    {
      _id: "st1",
      name: "Casa do Príncipe",
      area: "Alfama",
      style: "boutique",
      nights: 2,
      check_in: "2026-05-09",
      check_out: "2026-05-11",
      price: 612,
      booking_url: "https://www.booking.com",
      memory_used: ["Likes boutique hotels in old quarters, not chains."],
    },
  ],
  itinerary: [
    {
      _id: "it1",
      day: "Sat",
      time: "20:00",
      kind: "restaurant",
      title: "Belcanto · tasting menu",
      area: "Chiado",
      price: 388,
      booking_url: "https://www.belcanto.pt/en/reservations",
      memory_used: ["Cutting back on red wine."],
      note: "Pre-noted: pairing menu without red wine.",
    },
  ],
  trip_documents: [
    {
      _id: "td1",
      title: "Schengen entry rules",
      category: "visa",
      summary: "UK passport: 90 days visa-free. Carry passport + return ticket.",
      source: "agent",
      created_at: "2026-04-30T19:42:00Z",
    },
    {
      _id: "td2",
      title: "Travel insurance — Allianz",
      category: "insurance",
      summary: "Policy AZ-22310. 24/7 line: +44 20 8603 9853.",
      source: "user",
      created_at: "2026-04-30T19:50:00Z",
    },
  ],
};

// todos collection · live UI polls these every 2s in real impl
export const TODOS = [
  {
    _id: "todo1",
    trip_id: "t-current",
    agent: "flight",
    status: "needs_user",
    sub_status: "Found 3 morning options · TAP TP203 ranked #1",
    title: "find flights LHR → LIS",
    memory_used: ["Alex prefers morning departures (before 11am)."],
    result_id: "fl1",
    updated_at: "2026-04-30T20:15:32Z",
  },
  {
    _id: "todo2",
    trip_id: "t-current",
    agent: "stay",
    status: "needs_user",
    sub_status: "Casa do Príncipe · 9.4 rating · matches your taste",
    title: "find a place to stay in Lisbon",
    memory_used: ["Likes boutique hotels in old quarters, not chains."],
    result_id: "st1",
    updated_at: "2026-04-30T20:15:48Z",
  },
  {
    _id: "todo3",
    trip_id: "t-current",
    agent: "itinerary",
    status: "needs_user",
    sub_status: "Belcanto, Sat 8pm · pairing without red wine",
    title: "pick a Saturday dinner spot",
    memory_used: ["Cutting back on red wine."],
    result_id: "it1",
    updated_at: "2026-04-30T20:16:02Z",
  },
];

// messages collection
export const MESSAGES = [
  {
    _id: "m1",
    role: "user",
    content: "Plan a weekend in Lisbon, May 9–11. Romantic Saturday dinner.",
    created_at: "2026-04-30T20:14:55Z",
  },
  {
    _id: "m2",
    role: "agent",
    content: "On it. Pulling flights, hotels, and a restaurant for Saturday — I'll use what I remember about you.",
    created_at: "2026-04-30T20:15:01Z",
  },
  {
    _id: "m3",
    role: "agent",
    content: "Found a TAP TP203 morning flight (you prefer those), Casa do Príncipe in Alfama (boutique, your favourite), and Belcanto Saturday 8pm with a pairing menu — no red wine, as you mentioned. £1,187 total, under your £1,200 budget.",
    created_at: "2026-04-30T20:16:08Z",
  },
];
