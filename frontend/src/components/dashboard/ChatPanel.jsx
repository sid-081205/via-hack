import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Send, Sparkles } from "lucide-react";
import "./ChatPanel.css";

/**
 * Chat panel — left column.
 *
 * Shows the message history with the active user, a memory facts strip
 * (collapsible), a textarea input, and a mic button (currently inert —
 * wires to LiveKit in Phase 2 per BUILD_PLAN.md).
 */
export default function ChatPanel({ messages, onSend, user, memoryFacts }) {
  const [draft, setDraft] = useState("");
  const [showMemory, setShowMemory] = useState(true);
  const scrollRef = useRef(null);

  // auto-scroll to bottom on new message
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
        {showMemory && (
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
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg._id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`chat__row ${msg.role === "user" ? "chat__row--user" : ""}`}
            >
              {msg.role === "agent" && <span className="chat__agent-mark">v</span>}
              <div className={`chat__bubble chat__bubble--${msg.role}`}>
                {msg.content}
              </div>
            </motion.div>
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
