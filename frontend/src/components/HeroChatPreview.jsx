import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import "./HeroChatPreview.css";

const SCRIPT = [
  { role: "user", text: "weekend in lisbon, may 9–11. romantic saturday dinner.", delay: 600 },
  { role: "agent", text: "On it. Pulling flights, hotels, and a restaurant for Saturday — give me a sec.", delay: 1400, typing: true },
  { role: "trip-card", delay: 2400 },
  { role: "agent", text: "Found a TAP morning flight (you usually like those), a boutique stay in Alfama, and a tasting menu at Belcanto. £1,187, under your £1,200 budget.", delay: 1800, typing: true },
  { role: "user", text: "perfect, send the booking links", delay: 1200 },
];

const TOTAL_DURATION = SCRIPT.reduce((sum, m) => sum + m.delay, 0) + 2400;

export default function HeroChatPreview() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeouts = [];

    const runScript = () => {
      let elapsed = 0;
      SCRIPT.forEach((msg, i) => {
        elapsed += msg.delay;
        if (msg.typing) {
          timeouts.push(setTimeout(() => { if (!cancelled) setTyping(true); }, elapsed - 700));
          timeouts.push(setTimeout(() => { if (!cancelled) setTyping(false); }, elapsed));
        }
        timeouts.push(setTimeout(() => { if (!cancelled) setVisibleCount(i + 1); }, elapsed));
      });
      timeouts.push(setTimeout(() => {
        if (!cancelled) {
          setVisibleCount(0);
          setTyping(false);
          setTimeout(runScript, 800);
        }
      }, TOTAL_DURATION));
    };

    runScript();
    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="hero-chat">
      <div className="hero-chat__header">
        <span className="hero-chat__dot" style={{ background: "#e16a4e" }} />
        <span className="hero-chat__dot" style={{ background: "#e6b94c" }} />
        <span className="hero-chat__dot" style={{ background: "var(--accent)" }} />
        <span className="hero-chat__title">via · alex's trips</span>
      </div>

      <div className="hero-chat__body">
        <AnimatePresence mode="popLayout">
          {SCRIPT.slice(0, visibleCount).map((msg, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              className={`hero-chat__row ${msg.role === "user" ? "hero-chat__row--user" : ""}`}
            >
              {msg.role === "trip-card" ? (
                <MiniTripCard />
              ) : (
                <div className={`hero-chat__bubble hero-chat__bubble--${msg.role}`}>
                  {msg.text}
                </div>
              )}
            </motion.div>
          ))}

          {typing && (
            <motion.div
              key="typing"
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="hero-chat__row"
            >
              <div className="hero-chat__bubble hero-chat__bubble--agent hero-chat__typing">
                <span className="hero-chat__typing-dot" />
                <span className="hero-chat__typing-dot" />
                <span className="hero-chat__typing-dot" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MiniTripCard() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="hero-trip"
    >
      <div className="hero-trip__header">
        <div>
          <span className="hero-trip__label">booked in 3 minutes</span>
          <h4 className="hero-trip__title">Lisbon, 3 days</h4>
        </div>
        <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true">
          <path d="M2 8 L20 2 L13 8 L20 14 Z" fill="var(--accent)" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M13 8 L2 8" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="hero-trip__items">
        <Row icon="✈" label="LHR → LIS" price="£187" />
        <Row icon="⌂" label="boutique · Alfama" price="£612" />
        <Row icon="✦" label="Belcanto, sat 8pm" price="£388" />
      </div>
    </motion.div>
  );
}

function Row({ icon, label, price }) {
  return (
    <div className="hero-trip__row">
      <span className="hero-trip__row-label">
        <span className="hero-trip__row-icon">{icon}</span>
        {label}
      </span>
      <span className="hero-trip__row-price">{price}</span>
    </div>
  );
}
