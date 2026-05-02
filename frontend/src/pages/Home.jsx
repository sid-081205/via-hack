import { Link } from "react-router-dom";
import MarketingNav from "../components/MarketingNav.jsx";
import Footer from "../components/Footer.jsx";
import HeroChatPreview from "../components/HeroChatPreview.jsx";
import "./Home.css";

export default function Home() {
  return (
    <main>
      <svg className="home-hero-plane" viewBox="0 0 320 220" aria-hidden="true">
        <path d="M20 180 Q 90 190, 160 140 T 290 50" stroke="var(--accent)" strokeWidth="1.5" fill="none" strokeDasharray="3 5" opacity="0.55"/>
        <g transform="translate(170, 30) rotate(-18)">
          <path d="M0 40 L120 6 L66 40 Z" fill="var(--soft-green)" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M0 40 L66 40 L120 74 Z" fill="#a8cc68" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M0 40 L66 40" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round"/>
        </g>
      </svg>

      <div className="container">
        <MarketingNav />

        {/* hero */}
        <section className="home-hero">
          <div className="home-hero__left">
            <span className="home-beta reveal" style={{ animationDelay: "0.05s" }}>
              <span className="home-beta__dot" />
              now in private beta
            </span>

            <h1 className="home-headline reveal" style={{ animationDelay: "0.15s" }}>
              <em>Where</em> to?<br />
              That's all we<br />
              need to know.
            </h1>

            <p className="home-subhead reveal" style={{ animationDelay: "0.3s" }}>
              via is a personal travel agent in a chat. Ask for a weekend in Lisbon,
              a honeymoon in Patagonia, or a last-minute reroute at 3am — it
              handles the rest.
            </p>

            <div className="home-hero__ctas reveal" style={{ animationDelay: "0.45s" }}>
              <Link to="/dashboard" className="btn-primary">try the dashboard →</Link>
              <Link to="/how-it-works" className="btn-ghost">see how it works</Link>
            </div>
          </div>

          <div className="home-hero__right reveal" style={{ animationDelay: "0.35s" }}>
            <HeroChatPreview />
          </div>
        </section>

        {/* what via does */}
        <section className="home-what">
          <span className="label">what via does</span>
          <h2 className="home-section-title">One <em>message</em>, the whole trip.</h2>

          <div className="home-features">
            <Feature
              tag="plan"
              title="from a sentence"
              body="A weekend, a honeymoon, a last-minute escape. Tell via the shape of the trip and it figures out the rest — comparing flights, ranking hotels, picking restaurants you'll actually like."
              accent
            />
            <Feature
              tag="book"
              title="one tab, not twenty"
              body="No more side-by-side flight comparisons or copy-pasting trip details into hotel forms. Via hands you the one link to click. Your card, your booking."
            />
            <Feature
              tag="carry"
              title="every doc, in one place"
              body="Tickets, reservations, visa rules, insurance numbers. All on you, always. Search by trip, not by inbox."
            />
            <Feature
              tag="recover"
              title="3am reroutes, sorted"
              body="Flight cancelled? Train missed? Via answers a message — or a phone call — and rebooks you before you're done explaining."
              wide
            />
          </div>
        </section>

        {/* difference */}
        <section className="home-difference">
          <div className="home-difference__inner">
            <span className="label">the difference</span>
            <h2 className="home-difference__title">
              Booking sites <em>find you</em> options.<br />
              via <em>plans</em> the trip.
            </h2>
            <p className="home-difference__body">
              Booking aggregators show you 200 flights and walk away. via reads your
              preferences, your budget, the way you like to travel — and hands you
              the one option that actually fits. Then it does the same for the
              hotel, the restaurants, the transfers, and the reservations.
              The whole trip, planned by something that remembers what you like.
            </p>
          </div>
        </section>

        {/* closing CTA */}
        <section className="home-closing">
          <h2 className="home-closing__title">
            Plan your next trip in <em>one message.</em>
          </h2>
          <p className="home-closing__body">
            Open the dashboard, tell via where you're going, watch the trip come together.
          </p>
          <Link to="/dashboard" className="btn-primary">open the dashboard →</Link>
        </section>
      </div>

      <Footer />
    </main>
  );
}

function Feature({ tag, title, body, accent = false, wide = false }) {
  return (
    <div className={`home-feature ${accent ? "home-feature--accent" : ""} ${wide ? "home-feature--wide" : ""}`}>
      <span className="home-feature__tag">{tag}</span>
      <h3 className="home-feature__title">{title}</h3>
      <p className="home-feature__body">{body}</p>
    </div>
  );
}
