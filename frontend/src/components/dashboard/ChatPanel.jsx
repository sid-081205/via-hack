import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Send, Sparkles, Star, Plane, MapPin } from "lucide-react";
import "./ChatPanel.css";

/**
 * Chat panel — middle column.
 *
 * Renders the message history with the user, an empty hint when the
 * conversation hasn't started yet, a memory facts strip (collapsible),
 * a textarea input, and a mic button (inert — wires to LiveKit in
 * Phase 2 per BUILD_PLAN.md).
 *
 * Special message kinds (rendered as rich cards instead of bubbles):
 *   destination_picker | hotel_result | flight_result | itinerary_result
 *
 * Card buttons feed a follow-up message back into onSend so the demo
 * state machine can react.
 */
export default function ChatPanel({ messages, onSend, user, memoryFacts }) {
  const [draft, setDraft] = useState("");
  const [showMemory, setShowMemory] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat">
      <header className="chat__header">
        <div>
          <h2 className="chat__title">your conversation</h2>
          <span className="chat__subtitle">via, your travel agent</span>
        </div>
        <button
          className="chat__memory-toggle"
          onClick={() => setShowMemory((v) => !v)}
          aria-label="toggle memory panel"
        >
          <Sparkles size={14} />
          {memoryFacts.length}
        </button>
      </header>

      <AnimatePresence>
        {showMemory && memoryFacts.length > 0 && (
          <motion.section
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            className="chat__memory"
          >
            <div className="chat__memory-inner">
              <span className="label">what via remembers about you</span>
              <ul className="chat__memory-list">
                <AnimatePresence>
                  {memoryFacts.slice(0, 5).map((f) => (
                    <motion.li
                      key={f._id}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <span className="chat__memory-dot" />
                      {f.fact}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
              {memoryFacts.length > 5 && (
                <span className="chat__memory-more">
                  + {memoryFacts.length - 5} more
                </span>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div ref={scrollRef} className="chat__scroll">
        {messages.length === 0 && (
          <div className="chat__empty">
            <span className="chat__empty-mark">v</span>
            <p className="chat__empty-text">
              hi {user?.name?.split(" ")[0] || "there"} — where are you
              thinking of going?
            </p>
            <span className="chat__empty-hint">
              try: <em>"i wanna go somewhere beachy next weekend"</em>
            </span>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <MessageRow key={msg._id} message={msg} onSend={onSend} />
          ))}
        </AnimatePresence>
      </div>

      <div className="chat__composer">
        <button
          className="chat__mic"
          aria-label="hold to talk (coming soon)"
          title="voice — coming in phase 2"
        >
          <Mic size={16} />
        </button>
        <textarea
          className="chat__input"
          placeholder="message via…"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="chat__send"
          onClick={handleSend}
          disabled={!draft.trim()}
          aria-label="send"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────── message row ─────────────────── */

function MessageRow({ message, onSend }) {
  // rich card kinds render full-width without a bubble
  if (message.kind === "destination_picker") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="chat__row chat__row--card"
      >
        <span className="chat__agent-mark">v</span>
        <DestinationPicker destinations={message.destinations} onSend={onSend} />
      </motion.div>
    );
  }

  if (message.kind === "hotel_result") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="chat__row chat__row--card"
      >
        <span className="chat__agent-mark">v</span>
        <HotelCard hotel={message.hotel} onSend={onSend} />
      </motion.div>
    );
  }

  if (message.kind === "flight_result") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="chat__row chat__row--card"
      >
        <span className="chat__agent-mark">v</span>
        <FlightCard flight={message.flight} onSend={onSend} />
      </motion.div>
    );
  }

  if (message.kind === "itinerary_result") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="chat__row chat__row--card"
      >
        <span className="chat__agent-mark">v</span>
        <ItineraryCard itinerary={message.itinerary} onSend={onSend} />
      </motion.div>
    );
  }

  if (message.kind === "itinerary_revised") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="chat__row chat__row--card"
      >
        <span className="chat__agent-mark">v</span>
        <ItineraryCard
          itinerary={message.itinerary}
          onSend={onSend}
          revised
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`chat__row ${message.role === "user" ? "chat__row--user" : ""}`}
    >
      {message.role === "agent" && <span className="chat__agent-mark">v</span>}
      <div className={`chat__bubble chat__bubble--${message.role}`}>
        {message.content}
      </div>
    </motion.div>
  );
}

/* ─────────────────── destination picker ─────────────────── */

function DestinationPicker({ destinations = [], onSend }) {
  return (
    <div className="chat-card chat-card--picker">
      <div className="chat-card__grid">
        {destinations.map((d) => (
          <article key={d.short} className="dest-card">
            <div
              className="dest-card__img"
              style={{ backgroundImage: `url(${d.image})` }}
            />
            <div className="dest-card__body">
              <h4 className="dest-card__name">
                <MapPin size={11} /> {d.name}
              </h4>
              <p className="dest-card__sub">{d.sub}</p>
              <button
                className="chat-card__btn chat-card__btn--primary"
                onClick={() => onSend(d.short)}
              >
                pick this
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────── hotel result ─────────────────── */

function HotelCard({ hotel, onSend }) {
  if (!hotel) return null;
  return (
    <div className="chat-card chat-card--hotel">
      <div
        className="chat-card__hero"
        style={{ backgroundImage: `url(${hotel.image})` }}
      >
        <span className="chat-card__price-pill">£{hotel.price_per_night_gbp}/night</span>
      </div>
      <div className="chat-card__body">
        <div className="chat-card__title-row">
          <h4 className="chat-card__title">{hotel.name}</h4>
          <span className="chat-card__rating">
            <Star size={11} fill="currentColor" />
            {hotel.rating} <em>· {hotel.reviews?.toLocaleString()} reviews</em>
          </span>
        </div>
        <ul className="chat-card__bullets">
          {hotel.bullets?.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
        <div className="chat-card__actions">
          <button
            className="chat-card__btn chat-card__btn--primary"
            onClick={() => onSend("add the hotel to my plan")}
          >
            add to plan
          </button>
          <button
            className="chat-card__btn"
            onClick={() => onSend("show me other options")}
          >
            see other options
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── flight result ─────────────────── */

function FlightCard({ flight, onSend }) {
  if (!flight) return null;
  return (
    <div className="chat-card chat-card--flight">
      <div className="chat-card__body">
        <div className="chat-card__title-row">
          <h4 className="chat-card__title">
            <Plane size={13} /> {flight.carrier}
          </h4>
          <span className="chat-card__price-pill chat-card__price-pill--inline">
            £{flight.pricePerPerson} return
          </span>
        </div>
        <span className="chat-card__sub">{flight.flightNos} · {flight.duration}</span>

        <div className="chat-card__legs">
          {flight.legs?.map((leg, i) => (
            <div key={i} className="flight-leg">
              <span className="flight-leg__day">{leg.day}</span>
              <span className="flight-leg__time">{leg.depart}</span>
              <span className="flight-leg__from">{leg.from}</span>
              <span className="flight-leg__arrow">→</span>
              <span className="flight-leg__to">{leg.to}</span>
              <span className="flight-leg__time flight-leg__time--arr">{leg.arrive}</span>
            </div>
          ))}
        </div>

        <p className="chat-card__note">{flight.groundTime}</p>

        <div className="chat-card__actions">
          <button
            className="chat-card__btn chat-card__btn--primary"
            onClick={() => onSend("add the flights to my plan")}
          >
            add to plan
          </button>
          <button
            className="chat-card__btn"
            onClick={() => onSend("show me other flights")}
          >
            see other options
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── itinerary result ─────────────────── */

function ItineraryCard({ itinerary, onSend, revised = false }) {
  if (!itinerary?.days) return null;
  const isRevised = revised || itinerary.revised;
  return (
    <div
      className={`chat-card chat-card--itin ${
        isRevised ? "chat-card--itin-revised" : ""
      }`}
    >
      <div className="chat-card__body">
        {itinerary.days.map((day, di) => (
          <div
            key={di}
            className={`itin-day ${day.revised ? "itin-day--revised" : ""}`}
          >
            <h5 className="itin-day__label">
              {day.label}
              {day.revised && (
                <span className="itin-day__pill">revised</span>
              )}
            </h5>
            <ul className="itin-day__list">
              {day.items.map((item, ii) => (
                <li key={ii} className="itin-row">
                  <span className="itin-row__time">{item.time}</span>
                  <div className="itin-row__body">
                    <span className="itin-row__title">{item.title}</span>
                    <span className="itin-row__sub">{item.sub}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="chat-card__actions">
          {isRevised ? (
            <>
              <button
                className="chat-card__btn chat-card__btn--primary"
                onClick={() => onSend("looks good, update plan")}
              >
                looks good, update plan
              </button>
              <button
                className="chat-card__btn"
                onClick={() => onSend("no, revert")}
              >
                no, revert
              </button>
            </>
          ) : (
            <>
              <button
                className="chat-card__btn chat-card__btn--primary"
                onClick={() => onSend("add all to plan")}
              >
                add all to plan
              </button>
              <button
                className="chat-card__btn"
                onClick={() => onSend("can you tweak the itinerary?")}
              >
                tweak
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
