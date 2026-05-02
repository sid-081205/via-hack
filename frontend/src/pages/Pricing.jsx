import { Link } from "react-router-dom";
import MarketingNav from "../components/MarketingNav.jsx";
import Footer from "../components/Footer.jsx";
import "./Pricing.css";

const TIERS = [
  {
    name: "weekend",
    price: "free",
    cadence: "while in beta",
    blurb: "Plan one trip a month. Everything via does, just slower per-month.",
    features: [
      "1 trip per month",
      "All planning, booking handoffs, documents",
      "Memory across your trips",
      "Chat-only · no voice",
    ],
    cta: "join waitlist",
    href: "/dashboard",
  },
  {
    name: "voyager",
    price: "£12",
    cadence: "/ month",
    blurb: "For people who travel often and want via to handle everything.",
    features: [
      "Unlimited trips",
      "Voice + chat (talk to via in the app)",
      "Priority replanning · 3am reroutes",
      "Family group · up to 4 travelers",
      "Receipt scanning + expense export",
    ],
    cta: "start with voyager",
    href: "/dashboard",
    featured: true,
  },
  {
    name: "concierge",
    price: "£42",
    cadence: "/ month",
    blurb: "Phone number for your trips. Real human escalations when you want one.",
    features: [
      "Everything in voyager",
      "Dedicated phone number for your trips",
      "Human-in-the-loop on request",
      "Insurance + visa monitoring",
      "Priority support, 24/7",
    ],
    cta: "talk to us",
    href: "/dashboard",
  },
];

export default function Pricing() {
  return (
    <main>
      <div className="container">
        <MarketingNav />

        <section className="pricing-header">
          <span className="label">pricing</span>
          <h1 className="pricing-title">
            One travel agent.<br />
            <em>Three</em> ways to keep one.
          </h1>
          <p className="pricing-lede">
            via is free while we're in private beta. The plans below are what we'll
            offer when we open up to everyone — sign up for the waitlist and you'll
            keep the beta tier price for life.
          </p>
        </section>

        <section className="pricing-tiers">
          {TIERS.map((tier) => (
            <Tier key={tier.name} tier={tier} />
          ))}
        </section>

        {/* FAQs */}
        <section className="pricing-faq">
          <span className="label">questions</span>
          <h2 className="pricing-faq__title">Things people ask.</h2>

          <div className="pricing-faq__grid">
            <Faq
              q="Do I pay for flights through via?"
              a="No. via doesn't book on your card. It hands you the deep link and you pay the airline, hotel, or restaurant directly. Your card, your booking, your loyalty points."
            />
            <Faq
              q="What happens if a flight gets cancelled?"
              a="Send via a message — or call it on the phone if you have voyager or concierge. Same agent that planned your trip rebooks it. The whole trip document updates live, and your old confirmation stays in the trip's history."
            />
            <Faq
              q="Does via have my credit card?"
              a="No. via never holds payment details. Bookings happen on the airline or hotel's own checkout — you stay in control."
            />
            <Faq
              q="Can I cancel anytime?"
              a="Yes. Monthly plans cancel at any time, no questions. You keep your trips and documents forever."
            />
            <Faq
              q="What's coming next?"
              a="Group trips with shared planning, integration with calendar and email so via can suggest trips when you're free, and an offline mode for when you land in a country with no signal."
            />
            <Faq
              q="Is via a real travel agency?"
              a="via is a software product that does what a travel agent does. We don't take commission from airlines or hotels — your subscription is what pays for via."
            />
          </div>
        </section>

        <section className="pricing-cta">
          <h2 className="pricing-cta__title">Ready when you are.</h2>
          <p className="pricing-cta__body">
            Join the private beta — it's free, and you'll keep that price after we launch.
          </p>
          <Link to="/dashboard" className="btn-primary">try the dashboard →</Link>
        </section>
      </div>

      <Footer />
    </main>
  );
}

function Tier({ tier }) {
  return (
    <div className={`pricing-tier ${tier.featured ? "pricing-tier--featured" : ""}`}>
      {tier.featured && <span className="pricing-tier__badge">most popular</span>}

      <span className="pricing-tier__name">{tier.name}</span>

      <div className="pricing-tier__price-row">
        <span className="pricing-tier__price">{tier.price}</span>
        <span className="pricing-tier__cadence">{tier.cadence}</span>
      </div>

      <p className="pricing-tier__blurb">{tier.blurb}</p>

      <ul className="pricing-tier__features">
        {tier.features.map((f) => (
          <li key={f}>
            <span className="pricing-tier__check">
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2.5 6.5 L5 9 L9.5 3.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            {f}
          </li>
        ))}
      </ul>

      <Link
        to={tier.href}
        className={tier.featured ? "btn-primary pricing-tier__cta" : "pricing-tier__cta-outline"}
      >
        {tier.cta} →
      </Link>
    </div>
  );
}

function Faq({ q, a }) {
  return (
    <div className="pricing-faq__item">
      <h4 className="pricing-faq__q">{q}</h4>
      <p className="pricing-faq__a">{a}</p>
    </div>
  );
}
