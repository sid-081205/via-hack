import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Settings as SettingsIcon } from "lucide-react";
import Logo from "../components/Logo.jsx";
import ChatPanel from "../components/dashboard/ChatPanel.jsx";
import TripWorkspace from "../components/dashboard/TripWorkspace.jsx";
import BookingPane from "../components/dashboard/BookingPane.jsx";
import SettingsPanel from "../components/dashboard/SettingsPanel.jsx";
import { sendMessage, confirmTodo } from "../lib/api.js";
import { runDemoStep } from "../lib/demoScript.js";
import "./Dashboard.css";

const TRIP_ID = import.meta.env.VITE_DEMO_TRIP_ID || "trip_lisbon";
const USER_ID = "alex";

const DEFAULT_USER = {
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

// Empty stub trip — the dashboard starts blank and fills up as the
// scripted demo (or real agents) drive it.
const makeEmptyTrip = () => ({
  _id: TRIP_ID,
  user_id: USER_ID,
  destination: null,
  start_date: null,
  end_date: null,
  travelers: null,
  budget_total: null,
  status: "planning",
  flights: [],
  stays: [],
  itinerary: [],
  trip_documents: [],
});

/**
 * Dashboard — 3-column layout driven primarily by the scripted demo
 * engine in `lib/demoScript.js`. The real backend is a fallback for
 * messages that don't match any scripted trigger.
 *
 *   [ trip workspace ] [ chat ] [ booking pane ]
 *
 * The dashboard never auto-fetches state on mount — every demo opens
 * with an empty chat, no live agents, and no trip details. This makes
 * the 90-second demo flow deterministic and replayable.
 */
export default function Dashboard() {
  const [user, setUser] = useState(DEFAULT_USER);
  const [trip, setTrip] = useState(makeEmptyTrip);
  const [todos, setTodos] = useState([]);
  const [messages, setMessages] = useState([]);
  const [memoryFacts] = useState([]);
  const [pendingBooking, setPendingBooking] = useState(null);
  const [confirmedBookings, setConfirmedBookings] = useState([]);
  const [activeTab, setActiveTab] = useState("chat");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // refs hold latest snapshots so the async action runner sees current state
  // even when multiple scenes are draining concurrently (parallel agents).
  const tripRef = useRef(trip);
  tripRef.current = trip;
  const todosRef = useRef(todos);
  todosRef.current = todos;

  // ── action execution ──────────────────────────────────────────────────────
  const applyAction = (action) => {
    switch (action.type) {
      case "append_message":
        setMessages((prev) => [...prev, action.message]);
        break;
      case "add_todo":
        setTodos((prev) =>
          prev.some((t) => t._id === action.todo._id)
            ? prev
            : [...prev, action.todo]
        );
        break;
      case "update_todo":
        setTodos((prev) =>
          prev.map((t) =>
            t._id === action.id ? { ...t, ...action.patch } : t
          )
        );
        break;
      case "set_trip_field":
        setTrip((prev) => ({ ...prev, [action.field]: action.value }));
        break;
      case "append_trip_array": {
        const value = Array.isArray(action.value) ? action.value : [action.value];
        setTrip((prev) => ({
          ...prev,
          [action.field]: [...(prev[action.field] || []), ...value],
        }));
        break;
      }
      default:
        console.warn("unknown demo action", action);
    }
  };

  const executeActions = async (actions) => {
    for (const action of actions) {
      if (action.delay > 0) {
        await new Promise((r) => setTimeout(r, action.delay));
      }
      applyAction(action);
    }
  };

  // ── send handler — demo engine first, real backend fallback ───────────────
  const handleSend = async (text) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return;

    const userMsg = {
      _id: `m-${Date.now()}-u`,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);

    // primary path — scripted demo
    const step = runDemoStep(trimmed, {
      trip: tripRef.current,
      todos: todosRef.current,
      messages,
    });

    if (step.matched) {
      // fire-and-forget — multiple scenes can drain in parallel
      executeActions(step.actions).catch((e) =>
        console.error("demo executeActions", e)
      );
      return;
    }

    // fallback — real backend
    try {
      const resp = await Promise.race([
        sendMessage(TRIP_ID, trimmed, USER_ID),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 8000)
        ),
      ]);
      const reply = resp?.reply || "let me think on that.";
      setMessages((m) => [
        ...m,
        {
          _id: `m-${Date.now()}-r`,
          role: "agent",
          content: reply,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      console.warn("backend fallback failed", e);
      setMessages((m) => [
        ...m,
        {
          _id: `m-${Date.now()}-e`,
          role: "agent",
          content: "let me think on that.",
          created_at: new Date().toISOString(),
        },
      ]);
    }
  };

  // ── booking handlers ──────────────────────────────────────────────────────
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

    const todo = todosRef.current.find((t) => {
      if (!t.result) return false;
      if (item.booking_url && t.result.booking_url === item.booking_url) return true;
      if (item._id && t.result._id === item._id) return true;
      return false;
    });

    if (todo?._id) {
      try {
        await confirmTodo(todo._id);
      } catch (e) {
        // backend offline during demo — ignore
        console.warn("confirmTodo (likely offline)", e);
      }
    }
  };

  const handleSaveSettings = (updated) => setUser(updated);

  const handleResetDemo = () => {
    setTrip(makeEmptyTrip());
    setTodos([]);
    setMessages([]);
    setPendingBooking(null);
    setConfirmedBookings([]);
    setActiveTab("chat");
  };

  const tripTitle = trip.destination || "untitled trip";
  const tripDates = formatDates(trip.start_date, trip.end_date);

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
              {tripTitle}
              {tripDates && (
                <>
                  {" "}
                  ·{" "}
                  <span className="dash-header__dates">{tripDates}</span>
                </>
              )}
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
        onResetDemo={handleResetDemo}
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
