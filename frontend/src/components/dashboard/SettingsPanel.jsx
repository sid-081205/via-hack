import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  X,
  MapPin,
  Plane,
  Wallet,
  Utensils,
  Bell,
  Shield,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import "./SettingsPanel.css";

/**
 * Settings panel — slide-in drawer triggered by the gear icon in the header.
 *
 * Frontend-only state for now. When the backend is wired, the save handler
 * does PATCH /users/:id with the diff. See README.md § integrations.
 */
export default function SettingsPanel({ open, onClose, user, onSave, onResetDemo }) {
  const [draft, setDraft] = useState(user);

  // re-sync if the upstream user object changes
  useEffect(() => { setDraft(user); }, [user]);

  // close on escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const setField = (path, value) => {
    setDraft((d) => {
      // path is "preferences.diet" etc — handle one level of nesting
      if (path.includes(".")) {
        const [outer, inner] = path.split(".");
        return { ...d, [outer]: { ...(d[outer] || {}), [inner]: value } };
      }
      return { ...d, [path]: value };
    });
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const handleResetDemo = () => {
    onResetDemo?.();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* backdrop */}
          <motion.div
            className="settings__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* drawer */}
          <motion.aside
            className="settings"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            role="dialog"
            aria-label="settings"
          >
            <header className="settings__header">
              <div>
                <h2 className="settings__title">settings</h2>
                <span className="settings__subtitle">profile & preferences</span>
              </div>
              <button className="settings__close" onClick={onClose} aria-label="close">
                <X size={16} />
              </button>
            </header>

            <div className="settings__body">
              {/* avatar + identity */}
              <section className="settings__section">
                <div className="settings__identity">
                  <div className="settings__avatar">{draft.name?.[0] || "?"}</div>
                  <div>
                    <h3 className="settings__name">{draft.name || "you"}</h3>
                    <span className="settings__id mono">user · {draft._id}</span>
                  </div>
                </div>
              </section>

              {/* about you */}
              <Group icon={MapPin} label="about you">
                <Field
                  label="full name"
                  value={draft.name || ""}
                  onChange={(v) => setField("name", v)}
                />
                <Field
                  label="home city"
                  value={draft.home_city || ""}
                  placeholder="London, UK"
                  onChange={(v) => setField("home_city", v)}
                />
                <Field
                  label="home airport"
                  value={draft.home_airport || ""}
                  placeholder="LHR"
                  hint="3-letter IATA code"
                  onChange={(v) => setField("home_airport", v.toUpperCase())}
                />
                <Field
                  label="passport country"
                  value={draft.passport_country || ""}
                  placeholder="United Kingdom"
                  onChange={(v) => setField("passport_country", v)}
                />
              </Group>

              {/* travel preferences */}
              <Group icon={Plane} label="travel preferences">
                <SelectField
                  label="cabin class"
                  value={draft.preferences?.flight_class || "economy"}
                  onChange={(v) => setField("preferences.flight_class", v)}
                  options={[
                    ["economy", "economy"],
                    ["premium", "premium economy"],
                    ["business", "business"],
                    ["first", "first"],
                  ]}
                />
                <SelectField
                  label="departure window"
                  value={draft.preferences?.departure_window || "morning"}
                  onChange={(v) => setField("preferences.departure_window", v)}
                  options={[
                    ["any", "no preference"],
                    ["morning", "morning (before 11am)"],
                    ["afternoon", "afternoon"],
                    ["evening", "evening"],
                    ["redeye", "red-eye / overnight"],
                  ]}
                />
                <SelectField
                  label="seat preference"
                  value={draft.preferences?.seat || "window"}
                  onChange={(v) => setField("preferences.seat", v)}
                  options={[
                    ["window", "window"],
                    ["aisle", "aisle"],
                    ["any", "no preference"],
                  ]}
                />
                <Field
                  label="airline programs"
                  value={draft.preferences?.loyalty || ""}
                  placeholder="TAP Miles&Go, BA Executive Club…"
                  onChange={(v) => setField("preferences.loyalty", v)}
                />
              </Group>

              {/* stay preferences */}
              <Group icon={MapPin} label="where you stay">
                <SelectField
                  label="vibe"
                  value={draft.preferences?.stay_style || "boutique"}
                  onChange={(v) => setField("preferences.stay_style", v)}
                  options={[
                    ["boutique", "boutique / independent"],
                    ["chain", "chains (loyalty)"],
                    ["apartment", "apartment / airbnb"],
                    ["mixed", "mix it up"],
                  ]}
                />
                <SelectField
                  label="neighborhood"
                  value={draft.preferences?.area || "old"}
                  onChange={(v) => setField("preferences.area", v)}
                  options={[
                    ["old", "old quarters"],
                    ["central", "central / business"],
                    ["quiet", "quiet / residential"],
                    ["nightlife", "near nightlife"],
                  ]}
                />
              </Group>

              {/* food */}
              <Group icon={Utensils} label="food & drink">
                <Field
                  label="dietary"
                  value={draft.preferences?.diet || ""}
                  placeholder="vegetarian, no shellfish, gluten-free…"
                  onChange={(v) => setField("preferences.diet", v)}
                />
                <Field
                  label="don't suggest"
                  value={draft.preferences?.dislikes || ""}
                  placeholder="red wine, spicy food…"
                  hint="things to avoid in restaurant suggestions"
                  onChange={(v) => setField("preferences.dislikes", v)}
                />
              </Group>

              {/* budget */}
              <Group icon={Wallet} label="budget">
                <Field
                  label="default trip budget"
                  value={draft.preferences?.default_budget || ""}
                  placeholder="£1500"
                  onChange={(v) => setField("preferences.default_budget", v)}
                />
                <Field
                  label="flag items over"
                  value={draft.preferences?.flag_threshold || ""}
                  placeholder="£500"
                  hint="via warns when a single item exceeds this"
                  onChange={(v) => setField("preferences.flag_threshold", v)}
                />
              </Group>

              {/* notifications */}
              <Group icon={Bell} label="notifications">
                <ToggleField
                  label="3am reroutes"
                  hint="email + push when via reroutes you mid-trip"
                  value={draft.preferences?.notify_reroutes ?? true}
                  onChange={(v) => setField("preferences.notify_reroutes", v)}
                />
                <ToggleField
                  label="trip reminders"
                  hint="check-in time, document expiry, departures"
                  value={draft.preferences?.notify_reminders ?? true}
                  onChange={(v) => setField("preferences.notify_reminders", v)}
                />
                <ToggleField
                  label="memory updates"
                  hint="tell me when via learns something new about me"
                  value={draft.preferences?.notify_memory ?? false}
                  onChange={(v) => setField("preferences.notify_memory", v)}
                />
              </Group>

              {/* privacy */}
              <Group icon={Shield} label="privacy">
                <p className="settings__note">
                  via stores trip data, conversation history, and learned facts
                  about you. you can clear memory or delete trips at any time.
                </p>
                <button className="settings__danger-btn">clear all memory facts</button>
                <button className="settings__danger-btn">delete this trip</button>
              </Group>

              {/* demo controls */}
              <Group icon={Sparkles} label="demo">
                <div className="settings__demo-row">
                  <button
                    type="button"
                    className="settings__reset-btn"
                    onClick={handleResetDemo}
                  >
                    <RotateCcw size={13} />
                    reset demo
                  </button>
                  <span className="settings__field-hint">
                    Clears the chat, agents, and travel plan.
                  </span>
                </div>
              </Group>
            </div>

            <footer className="settings__footer">
              <button className="settings__cancel" onClick={onClose}>cancel</button>
              <button className="settings__save btn-primary" onClick={handleSave}>save changes</button>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------- form atoms ---------- */

function Group({ icon: Icon, label, children }) {
  return (
    <section className="settings__group">
      <header className="settings__group-header">
        <Icon size={13} />
        <span>{label}</span>
      </header>
      <div className="settings__group-body">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, placeholder, hint }) {
  return (
    <label className="settings__field">
      <span className="settings__field-label">{label}</span>
      <input
        className="settings__input"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="settings__field-hint">{hint}</span>}
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="settings__field">
      <span className="settings__field-label">{label}</span>
      <select
        className="settings__input settings__select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({ label, hint, value, onChange }) {
  return (
    <div className="settings__toggle-row">
      <div className="settings__toggle-text">
        <span className="settings__field-label">{label}</span>
        {hint && <span className="settings__field-hint">{hint}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        className={`settings__toggle ${value ? "settings__toggle--on" : ""}`}
        onClick={() => onChange(!value)}
      >
        <span className="settings__toggle-thumb" />
      </button>
    </div>
  );
}
