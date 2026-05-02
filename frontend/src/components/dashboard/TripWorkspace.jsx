import { motion, AnimatePresence } from "framer-motion";
import {
  Plane,
  Building2,
  Utensils,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Circle,
} from "lucide-react";
import "./TripWorkspace.css";

const AGENT_META = {
  flight: { icon: Plane, label: "flight specialist", color: "var(--accent-deep)" },
  stay: { icon: Building2, label: "stay specialist", color: "#a86b3d" },
  itinerary: { icon: Utensils, label: "itinerary specialist", color: "#7a5da6" },
};

const STATUS_META = {
  pending: { label: "pending", color: "var(--status-pending)" },
  running: { label: "working…", color: "var(--status-running)" },
  needs_user: { label: "needs your call", color: "var(--status-needs-user)" },
  done: { label: "done", color: "var(--status-done)" },
  failed: { label: "failed", color: "var(--status-failed)" },
};

const PLAN_ITEM_ICONS = {
  flight: Plane,
  stay: Building2,
  itinerary: Utensils,
};

/**
 * Trip workspace · left column · stacked vertically
 *
 *   1. Header (sticky)
 *   2. Live agents     (~65-70% of remaining vertical space)
 *   3. Travel plan     (~30-35%)
 *
 * Trip documents now live in the booking pane, not here.
 */
export default function TripWorkspace({ trip, todos, onOpenBooking, confirmedBookingIds }) {
  const plan = buildUnifiedPlan(trip);

  return (
    <div className="trip">
      <header className="trip__header">
        <div>
          <h2 className="trip__title">{trip.destination}</h2>
          <span className="trip__meta">
            {formatDates(trip.start_date, trip.end_date)} · {trip.travelers} travelers · budget £{trip.budget_total}
          </span>
        </div>
        <span className="trip__status">{trip.status}</span>
      </header>

      {/* live agents · ~70% */}
      <section className="trip__agents">
        <header className="trip__section-header">
          <span className="label">live agents</span>
          <span className="trip__section-meta">
            {todos.filter(t => t.status === "running").length > 0
              ? "working…"
              : `${todos.length} done`}
          </span>
        </header>

        <div className="trip__agents-list">
          <AnimatePresence>
            {todos.map((todo) => {
              const AgentIcon = AGENT_META[todo.agent]?.icon || Sparkles;
              const status = STATUS_META[todo.status];
              return (
                <motion.div
                  key={todo._id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`agent-card agent-card--${todo.status}`}
                >
                  <div className="agent-card__top">
                    <div className="agent-card__head">
                      <span
                        className="agent-card__icon"
                        style={{ color: AGENT_META[todo.agent]?.color }}
                      >
                        <AgentIcon size={14} />
                      </span>
                      <span className="agent-card__name">{AGENT_META[todo.agent]?.label}</span>
                    </div>
                    <span
                      className="agent-card__status"
                      style={{ "--status-color": status.color }}
                    >
                      {todo.status === "running" && <span className="agent-card__pulse" />}
                      {todo.status === "done" && <CheckCircle2 size={11} />}
                      {status.label}
                    </span>
                  </div>

                  <h4 className="agent-card__title">{todo.title}</h4>
                  <p className="agent-card__sub">{todo.sub_status}</p>

                  {todo.memory_used?.length > 0 && (
                    <div className="agent-card__memory">
                      <Sparkles size={11} />
                      <span>used: <em>"{todo.memory_used[0]}"</em></span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </section>

      {/* travel plan · ~30% */}
      <section className="trip__plan">
        <header className="trip__section-header">
          <span className="label">travel plan</span>
          <span className="trip__section-meta">
            {plan.filter(p => confirmedBookingIds.includes(p._id)).length} / {plan.length} booked
          </span>
        </header>

        <div className="plan-list">
          {plan.map((item, i) => {
            const Icon = PLAN_ITEM_ICONS[item.kind] || Circle;
            const confirmed = confirmedBookingIds.includes(item._id);
            const showDayHeader = i === 0 || plan[i - 1].dayKey !== item.dayKey;

            return (
              <div key={item._id}>
                {showDayHeader && (
                  <div className="plan-day-header">
                    <span className="plan-day-label">{item.dayLabel}</span>
                    <span className="plan-day-line" />
                  </div>
                )}

                <button
                  className={`plan-row ${confirmed ? "plan-row--done" : ""}`}
                  onClick={() => !confirmed && onOpenBooking(item._raw, item.kind)}
                  disabled={confirmed}
                >
                  <span className="plan-row__check">
                    {confirmed ? (
                      <CheckCircle2 size={15} strokeWidth={2} />
                    ) : (
                      <Circle size={15} strokeWidth={1.5} />
                    )}
                  </span>

                  <span className="plan-row__icon" aria-hidden="true">
                    <Icon size={12} />
                  </span>

                  <div className="plan-row__body">
                    <div className="plan-row__top">
                      <span className="plan-row__title">{item.title}</span>
                      <span className="plan-row__price">{item.price ? `£${item.price}` : ""}</span>
                    </div>
                    <span className="plan-row__sub">{item.sub}</span>
                  </div>

                  {!confirmed && (
                    <span className="plan-row__cta">
                      <ExternalLink size={11} />
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ---------- helpers ---------- */

function buildUnifiedPlan(trip) {
  const items = [];

  trip.flights?.forEach((f) => {
    const dt = new Date(f.depart);
    items.push({
      _id: f._id,
      kind: "flight",
      sortKey: dt.getTime(),
      dayKey: dayKey(dt),
      dayLabel: dayLabel(dt),
      title: `${f.from} → ${f.to}`,
      sub: `${f.carrier} ${f.flight_no} · ${formatTime(dt)} · ${f.kind}`,
      price: f.price,
      _raw: f,
    });
  });

  trip.stays?.forEach((s) => {
    const dt = new Date(s.check_in);
    items.push({
      _id: s._id,
      kind: "stay",
      sortKey: dt.getTime() + 1,
      dayKey: dayKey(dt),
      dayLabel: dayLabel(dt),
      title: s.name,
      sub: `${s.style} · ${s.area} · ${s.nights} nights`,
      price: s.price,
      _raw: s,
    });
  });

  trip.itinerary?.forEach((i) => {
    const dt = synthesizeItineraryDate(i, trip);
    items.push({
      _id: i._id,
      kind: "itinerary",
      sortKey: dt.getTime(),
      dayKey: dayKey(dt),
      dayLabel: dayLabel(dt),
      title: i.title,
      sub: `${i.area} · ${i.time}`,
      price: i.price,
      _raw: i,
    });
  });

  items.sort((a, b) => a.sortKey - b.sortKey);
  return items;
}

function synthesizeItineraryDate(itineraryItem, trip) {
  const start = new Date(trip.start_date);
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const target = dayMap[itineraryItem.day];
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d.getDay() === target) {
      const [h, m] = itineraryItem.time.split(":").map(Number);
      d.setHours(h, m, 0, 0);
      return d;
    }
  }
  return start;
}

function dayKey(d) { return d.toISOString().slice(0, 10); }

function dayLabel(d) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(d) {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDates(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const opts = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-GB", opts)} – ${e.toLocaleDateString("en-GB", opts)}`;
}
