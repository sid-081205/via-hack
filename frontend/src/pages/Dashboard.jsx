import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Settings as SettingsIcon } from "lucide-react";
import Logo from "../components/Logo.jsx";
import ChatPanel from "../components/dashboard/ChatPanel.jsx";
import TripWorkspace from "../components/dashboard/TripWorkspace.jsx";
import BookingPane from "../components/dashboard/BookingPane.jsx";
import SettingsPanel from "../components/dashboard/SettingsPanel.jsx";
import {
  getTrip,
  getTodos,
  getMessages,
  sendMessage,
  confirmTodo,
} from "../lib/api.js";
import "./Dashboard.css";

const TRIP_ID = import.meta.env.VITE_DEMO_TRIP_ID || "trip_lisbon";
const USER_ID = "alex";

const FALLBACK_USER = {
  _id: USER_ID,
  name: "Alex Morgan",
  home_city: "London, UK",
  home_airport: "LHR",
  passport_country: "United Kingdom",
  preferences: {
    flight_class: "economy",
    departure_window: "morning",
    seat: "window",
    loyalty: "",
    stay_style: "boutique",
    area: "old",
    diet: "",
    dislikes: "",
    default_budget: "",
    flag_threshold: "",
    notify_reroutes: true,
    notify_reminders: true,
    notify_memory: false,
  },
};

const FALLBACK_TRIP = {
  _id: TRIP_ID,
  user_id: USER_ID,
  destination: "—",
  start_date: null,
  end_date: null,
  travelers: null,
  budget_total: null,
  status: "planning",
  flights: [],
  stays: [],
  itinerary: [],
  trip_documents: [],
};

/**
 * Dashboard — 3-column layout wired to the FastAPI backend.
 *
 *   [ trip workspace ] [ chat ] [ booking pane ]
 *
 * Data flow:
 *   - Initial mount: parallel GET trip + todos + messages.
 *   - Polling: GET todos every 2s while mounted (the agentic UX).
 *   - On user send: optimistic user bubble → POST → append reply → refetch
 *     trip + todos (a specialist may have updated trip.flights / stays / etc).
 *   - On "I booked it": find todo whose result.booking_url matches the
 *     pending booking, POST /todos/:id/confirm, refetch trip + todos.
 *
 * Settings save is local-only for now — there is no PATCH /users/:id yet.
 * The memory strip in ChatPanel is rendered with an empty list (no
 * /users/:id/memory endpoint in Phase 1).
 */
export default function Dashboard() {
  const [user, setUser] = useState(FALLBACK_USER);
  const [trip, setTrip] = useState(FALLBACK_TRIP);
  const [todos, setTodos] = useState([]);
  const [messages, setMessages] = useState([]);
  const [memoryFacts] = useState([]); // memory feature out of scope for phase 1
  const [pendingBooking, setPendingBooking] = useState(null);
  const [confirmedBookings, setConfirmedBookings] = useState([]);
  const [activeTab, setActiveTab] = useState("chat");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const todosRef = useRef(todos);
  todosRef.current = todos;

  // initial load
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getTrip(TRIP_ID).catch((e) => { console.error("getTrip", e); return null; }),
      getTodos(TRIP_ID).catch((e) => { console.error("getTodos", e); return []; }),
      getMessages(TRIP_ID).catch((e) => { console.error("getMessages", e); return []; }),
    ]).then(([t, td, m]) => {
      if (cancelled) return;
      if (t) setTrip(t);
      else setLoadError("could not reach the api — is the backend running on :8000?");
      setTodos(td || []);
      setMessages(m || []);
    });
    return () => { cancelled = true; };
  }, []);

  // poll todos every 2s — the live UI is the demo
  useEffect(() => {
    const id = setInterval(() => {
      getTodos(TRIP_ID)
        .then(setTodos)
        .catch((e) => console.error("poll todos", e));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const refreshTripAndTodos = async () => {
    try {
      const [t, td] = await Promise.all([getTrip(TRIP_ID), getTodos(TRIP_ID)]);
      if (t) setTrip(t);
      setTodos(td || []);
    } catch (e) {
      console.error("refreshTripAndTodos", e);
    }
  };

  const handleSend = async (text) => {
    const userMsg = {
      _id: `m-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);

    try {
      const resp = await sendMessage(TRIP_ID, text, USER_ID);
      const reply = resp?.reply || "(no reply)";
      const agentMsg = {
        _id: `m-${Date.now()}-r`,
        role: "agent",
        content: reply,
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, agentMsg]);
      await refreshTripAndTodos();
    } catch (e) {
      console.error("sendMessage", e);
      const errMsg = {
        _id: `m-${Date.now()}-e`,
        role: "agent",
        content: "sorry, something broke. try again?",
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, errMsg]);
    }
  };

  const handleOpenBooking = (item, kind) => {
    setPendingBooking({ ...item, kind });
    setActiveTab("booking");
  };

  const handleConfirmBooking = async (item) => {
    setConfirmedBookings((c) => [
      ...c,
      { ...item, confirmed_at: new Date().toISOString() },
    ]);
    setPendingBooking(null);

    // find the todo whose result.booking_url matches this item, confirm it
    const todo = todosRef.current.find((t) => {
      if (!t.result) return false;
      if (item.booking_url && t.result.booking_url === item.booking_url) return true;
      if (item._id && t.result._id === item._id) return true;
      return false;
    });

    try {
      if (todo?._id) {
        await confirmTodo(todo._id);
      }
    } catch (e) {
      console.error("confirmTodo", e);
    } finally {
      await refreshTripAndTodos();
    }
  };

  const handleSaveSettings = (updated) => {
    // local-only — no PATCH /users/:id endpoint in phase 1
    setUser(updated);
  };

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-header__inner">
          <div className="dash-header__brand">
            <Link to="/" aria-label="back to home">
              <Logo size={28} />
            </Link>
            <span className="dash-header__divider">/</span>
            <span className="dash-header__trip-name">
              {trip.destination} ·{" "}
              <span className="dash-header__dates">
                {formatDates(trip.start_date, trip.end_date)}
              </span>
            </span>
          </div>

          <div className="dash-header__right">
            <Link to="/" className="dash-header__back">← back to site</Link>

            <div className="dash-header__user">
              <div className="dash-header__avatar">{user.name?.[0] || "?"}</div>
              <span className="dash-header__user-name">{user.name?.split(" ")[0]}</span>
            </div>

            <button
              className="dash-header__settings"
              onClick={() => setSettingsOpen(true)}
              aria-label="open settings"
              title="settings"
            >
              <SettingsIcon size={16} />
            </button>
          </div>
        </div>
        {loadError && (
          <div className="dash-header__error" style={{
            padding: "8px 16px",
            fontSize: 12,
            color: "var(--ink-muted, #3a4526)",
            background: "rgba(225, 106, 78, 0.08)",
            borderTop: "1px solid rgba(31, 40, 24, 0.1)",
            fontFamily: "monospace",
          }}>
            {loadError}
          </div>
        )}
      </header>

      {/* mobile tab bar */}
      <div className="dash-tabs">
        <button
          className={`dash-tabs__btn ${activeTab === "trip" ? "dash-tabs__btn--active" : ""}`}
          onClick={() => setActiveTab("trip")}
        >trip</button>
        <button
          className={`dash-tabs__btn ${activeTab === "chat" ? "dash-tabs__btn--active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >chat</button>
        <button
          className={`dash-tabs__btn ${activeTab === "booking" ? "dash-tabs__btn--active" : ""}`}
          onClick={() => setActiveTab("booking")}
        >
          booking
          {pendingBooking && <span className="dash-tabs__badge" />}
        </button>
      </div>

      {/* 3-column layout · trip · chat · booking */}
      <main className="dash-main">
        <section
          className={`dash-col dash-col--trip ${activeTab === "trip" ? "dash-col--active" : ""}`}
        >
          <TripWorkspace
            trip={trip}
            todos={todos}
            onOpenBooking={handleOpenBooking}
            confirmedBookingIds={confirmedBookings.map((b) => b._id)}
          />
        </section>

        <section
          className={`dash-col dash-col--chat ${activeTab === "chat" ? "dash-col--active" : ""}`}
        >
          <ChatPanel
            messages={messages}
            onSend={handleSend}
            user={user}
            memoryFacts={memoryFacts}
          />
        </section>

        <section
          className={`dash-col dash-col--booking ${activeTab === "booking" ? "dash-col--active" : ""}`}
        >
          <BookingPane
            pendingBooking={pendingBooking}
            confirmedBookings={confirmedBookings}
            tripDocuments={trip.trip_documents || []}
            onConfirm={handleConfirmBooking}
            onClose={() => setPendingBooking(null)}
          />
        </section>
      </main>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        onSave={handleSaveSettings}
      />
    </div>
  );
}

function formatDates(start, end) {
  if (!start || !end) return "";
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "";
  const opts = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-GB", opts)} – ${e.toLocaleDateString("en-GB", opts)}`;
}
