/**
 * Thin fetch wrapper around the FastAPI backend.
 *
 * Every helper here also performs the field mapping required to keep the
 * existing dashboard components (which were originally shaped against
 * `data/mockTrip.js`) working without modification.
 *
 * Backend ↔ frontend field map:
 *   trip.dates.{start,end}         → trip.start_date / trip.end_date
 *   todo.text                      → todo.title
 *   todo.agent  (FlightAgent…)     → todo.agent  (flight | stay | itinerary)
 *   todo.memory_facts_used         → todo.memory_used
 *   message.role  (assistant)      → message.role  (agent)
 *   message.ts                     → message.created_at  (ISO string)
 *
 * Send-message body uses `{text, user_id}` per the FastAPI schema, NOT
 * `{content}` like the README mock-up suggested.
 */

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail || JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(`${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const AGENT_TO_KIND = {
  FlightAgent: "flight",
  StayAgent: "stay",
  ItineraryAgent: "itinerary",
};

function mapTrip(doc) {
  if (!doc) return doc;
  const start = doc.dates?.start ?? doc.start_date ?? null;
  const end = doc.dates?.end ?? doc.end_date ?? null;
  return {
    ...doc,
    start_date: start,
    end_date: end,
    travelers: doc.travelers ?? null,
    budget_total: doc.budget_total ?? null,
    flights: doc.flights || [],
    stays: doc.stays || [],
    itinerary: doc.itinerary || [],
    trip_documents: doc.trip_documents || [],
  };
}

function mapTodo(doc) {
  if (!doc) return doc;
  return {
    ...doc,
    title: doc.text ?? doc.title ?? "",
    agent: AGENT_TO_KIND[doc.agent] ?? doc.agent,
    memory_used: doc.memory_facts_used ?? doc.memory_used ?? [],
    result_id: doc.result?._id ?? doc.result_id ?? null,
    result: doc.result ?? null,
  };
}

function mapMessage(doc) {
  if (!doc) return doc;
  const ts = doc.ts ?? doc.created_at ?? null;
  return {
    ...doc,
    role: doc.role === "assistant" ? "agent" : doc.role,
    created_at: ts ? new Date(ts).toISOString() : new Date().toISOString(),
  };
}

// ─── public API ──────────────────────────────────────────────────────────────

export async function health() {
  return request("/health");
}

export async function getTrip(tripId) {
  const doc = await request(`/trips/${tripId}`);
  return mapTrip(doc);
}

export async function getTodos(tripId) {
  const docs = await request(`/trips/${tripId}/todos`);
  return Array.isArray(docs) ? docs.map(mapTodo) : [];
}

export async function getMessages(tripId) {
  const docs = await request(`/trips/${tripId}/messages`);
  return Array.isArray(docs) ? docs.map(mapMessage) : [];
}

export async function sendMessage(tripId, content, userId = "alex") {
  return request(`/trips/${tripId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text: content, user_id: userId }),
  });
}

export async function confirmTodo(todoId, bookingRef) {
  const body = bookingRef ? { booking_ref: bookingRef } : {};
  const res = await request(`/todos/${todoId}/confirm`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { ...res, todo: mapTodo(res?.todo) };
}
