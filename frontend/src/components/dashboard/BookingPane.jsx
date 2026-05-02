import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink,
  X,
  CheckCircle2,
  Plane,
  Building2,
  Utensils,
  FileText,
  ShieldCheck,
  Receipt,
  ListChecks,
} from "lucide-react";
import "./BookingPane.css";

const KIND_META = {
  flight: { icon: Plane, name: "flight" },
  stay: { icon: Building2, name: "stay" },
  itinerary: { icon: Utensils, name: "reservation" },
};

const DOC_ICONS = {
  visa: ShieldCheck,
  insurance: Receipt,
  confirmation: FileText,
  checklist: ListChecks,
};

/**
 * Booking pane — right column.
 *
 * Layout (top → bottom):
 *   1. Bookings header
 *   2. Pending booking frame (mock browser) OR empty state
 *   3. Confirmed bookings list
 *   4. Trip documents (visas, insurance, confirmations)
 *
 * When the user clicks "open booking" on a plan row, the booking item
 * shows in a mock browser frame here. After they confirm "I booked it,"
 * the booking moves to the confirmed list below.
 */
export default function BookingPane({
  pendingBooking,
  confirmedBookings,
  tripDocuments = [],
  onConfirm,
  onClose,
}) {
  return (
    <div className="bp">
      <header className="bp__header">
        <h2 className="bp__title">bookings</h2>
        <span className="bp__count">
          {pendingBooking ? "1 pending" : `${confirmedBookings.length} confirmed`}
        </span>
      </header>

      {/* Top 80% — pending booking frame, empty state, and confirmed list */}
      <div className="bp__top">
        <AnimatePresence mode="wait">
          {pendingBooking ? (
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="bp__pending"
            >
              <PendingBookingFrame
                booking={pendingBooking}
                onConfirm={onConfirm}
                onClose={onClose}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bp__empty"
            >
              <div className="bp__empty-icon">
                <ExternalLink size={20} />
              </div>
              <h3 className="bp__empty-title">no booking open</h3>
              <p className="bp__empty-body">
                click any item in your travel plan and the booking page loads
                here. via won't pay — your card pays the airline, hotel, or
                restaurant directly.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* confirmed bookings */}
        {confirmedBookings.length > 0 && (
          <section className="bp__confirmed">
            <span className="label">confirmed</span>
            <div className="bp__confirmed-list">
              {confirmedBookings.map((b) => {
                const Meta = KIND_META[b.kind] || KIND_META.itinerary;
                const Icon = Meta.icon;
                const title = b.title || b.name || `${b.from} → ${b.to}`;
                return (
                  <div key={b._id} className="bp__confirmed-item">
                    <span className="bp__confirmed-icon"><Icon size={13} /></span>
                    <div className="bp__confirmed-body">
                      <div className="bp__confirmed-title">{title}</div>
                      <div className="bp__confirmed-meta">
                        <CheckCircle2 size={11} /> booked · £{b.price ?? 0}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Bottom 20% — trip documents as compact bubbles */}
      {tripDocuments.length > 0 && (
        <section className="bp__docs">
          <header className="bp__docs-header">
            <span className="label">trip documents</span>
            <span className="bp__count">{tripDocuments.length}</span>
          </header>
          <div className="bp__docs-bubbles">
            {tripDocuments.map((doc) => {
              const Icon = DOC_ICONS[doc.category] || FileText;
              return (
                <button
                  key={doc._id}
                  className={`bp-bubble bp-bubble--${doc.source}`}
                  title={doc.summary}
                >
                  <span className="bp-bubble__icon"><Icon size={11} /></span>
                  <span className="bp-bubble__title">{doc.title}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function PendingBookingFrame({ booking, onConfirm, onClose }) {
  const Meta = KIND_META[booking.kind] || KIND_META.itinerary;
  const Icon = Meta.icon;
  const title = booking.title || booking.name || `${booking.from} → ${booking.to}`;
  const subtitle =
    booking.kind === "flight"
      ? `${booking.carrier} ${booking.flight_no}`
      : booking.kind === "stay"
      ? `${booking.area} · ${booking.nights} nights`
      : `${booking.day} · ${booking.time}`;

  // Pretty up the URL for display
  const url = booking.booking_url || "https://example.com";
  const displayUrl = url.replace(/^https?:\/\//, "");

  const handleOpenInNewTab = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="bp-frame">
      <div className="bp-frame__chrome">
        <div className="bp-frame__chrome-dots">
          <span style={{ background: "#e16a4e" }} onClick={onClose} role="button" />
          <span style={{ background: "#e6b94c" }} />
          <span style={{ background: "var(--accent)" }} />
        </div>
        <div className="bp-frame__url">
          <span className="bp-frame__lock">🔒</span>
          <span>{displayUrl}</span>
        </div>
        <button className="bp-frame__close" onClick={onClose} aria-label="close">
          <X size={14} />
        </button>
      </div>

      <div className="bp-frame__body">
        <div className="bp-frame__kind">
          <Icon size={13} /> {Meta.name}
        </div>

        <h3 className="bp-frame__title">{title}</h3>
        <p className="bp-frame__subtitle">{subtitle}</p>

        <div className="bp-frame__price">
          £{booking.price || 0}
          <span className="bp-frame__price-cadence">total</span>
        </div>

        <div className="bp-frame__divider" />

        <p className="bp-frame__instruction">
          via has prepared this booking. clicking below opens the airline,
          hotel, or restaurant's site in a new tab — finish the checkout
          there and come back here.
        </p>

        <button className="bp-frame__cta btn-primary" onClick={handleOpenInNewTab}>
          open in new tab
          <ExternalLink size={14} />
        </button>

        <button className="bp-frame__confirm" onClick={() => onConfirm(booking)}>
          <CheckCircle2 size={14} /> i booked it
        </button>

        <p className="bp-frame__note">
          via never sees your card. payment is made directly to the provider.
        </p>
      </div>
    </div>
  );
}
