import { Link } from "react-router-dom";
import MarketingNav from "../components/MarketingNav.jsx";
import Footer from "../components/Footer.jsx";
import "./HowItWorks.css";

export default function HowItWorks() {
  return (
    <main>
      <div className="container">
        <MarketingNav />

        <section className="hiw-header">
          <span className="label">how it works</span>
          <h1 className="hiw-title">From one <em>sentence</em><br />to a full trip.</h1>
          <p className="hiw-lede">
            via is a single chat that talks to a network of specialist agents on your behalf.
            You write a sentence; they do the legwork — comparing flights, ranking hotels,
            picking restaurants you'll actually like — and hand the whole trip back as
            something you can check, change, and click through.
          </p>
        </section>

        <section className="hiw-steps">
          <Step
            num="01"
            title="tell via the shape of the trip"
            body="A sentence is enough. 'Weekend in Lisbon, May 9–11, romantic Saturday dinner.' Add a budget, a vibe, dietary stuff — or don't. via asks if it needs to."
            note="No forms. No dropdowns. Just a chat."
          />

          <Step
            num="02"
            title="three specialists work in parallel"
            body="A flight specialist, a stay specialist, and an itinerary specialist run at the same time. You see them work — a live to-do list updates as each one searches, ranks, and finishes."
            note="What you'd do across twenty browser tabs, done in three at once."
            visual={<SpecialistsVisual />}
          />

          <Step
            num="03"
            title="via remembers what you like"
            body="Every conversation surfaces small facts — 'Alex prefers morning departures,' 'cutting back on red wine.' Those facts get saved and quietly retrieved on the next trip. via gets to know you over time."
            note="Memory you can read, edit, and delete."
          />

          <Step
            num="04"
            title="one link to click for each booking"
            body="via doesn't pretend to book on your card. It hands you the deep link — flight selection already loaded, hotel dates pre-filled, restaurant time slot picked. You confirm, your card pays, the confirmation lives back in the trip."
            note="The 90% you hated is gone; the 10% you cared about is yours."
          />

          <Step
            num="05"
            title="every doc lives with the trip"
            body="Boarding pass, hotel confirmation, visa rules, insurance number, restaurant reservation. All on the same page as the trip itself, searchable by destination, not by the date you got the email."
            note="No more 'which inbox is the boarding pass in.'"
          />

          <Step
            num="06"
            title="3am, the message still works"
            body="Flight cancelled in Doha at 3am? Send via a message — or call it on the phone. Same agent, same memory, real number. It rebooks while you brush your teeth."
            note="Voice + phone are how a real travel agent works."
          />
        </section>

        <section className="hiw-arch">
          <span className="label">under the hood</span>
          <h2 className="hiw-arch__title">A trip is a <em>document.</em></h2>
          <p className="hiw-arch__body">
            via stores each trip as a single rich document — flights, hotels, itinerary,
            documents, conversation history, all together. When you ask for a change,
            the agent reads the document, decides what needs to update, and writes the
            change back. Nothing is scattered across services. Nothing is lost when
            you switch device.
          </p>

          <div className="hiw-arch__grid">
            <ArchPill label="planner agent" desc="reads your message, writes the to-do list" />
            <ArchPill label="flight specialist" desc="searches, ranks, deep-links" accent />
            <ArchPill label="stay specialist" desc="boutique or chain, your call" accent />
            <ArchPill label="itinerary specialist" desc="restaurants, activities, vibes" accent />
            <ArchPill label="memory agent" desc="learns, indexes, retrieves" />
            <ArchPill label="documents" desc="visas, confirmations, insurance" />
          </div>
        </section>

        <section className="hiw-cta">
          <h2 className="hiw-cta__title">Ready to <em>see</em> it?</h2>
          <p className="hiw-cta__body">
            Open the dashboard. There's a sample trip waiting — Lisbon, May 9–11.
          </p>
          <Link to="/dashboard" className="btn-primary">open dashboard →</Link>
        </section>
      </div>

      <Footer />
    </main>
  );
}

function Step({ num, title, body, note, visual }) {
  return (
    <article className="hiw-step">
      <div className="hiw-step__left">
        <span className="hiw-step__num">{num}</span>
      </div>
      <div className="hiw-step__right">
        <h3 className="hiw-step__title">{title}</h3>
        <p className="hiw-step__body">{body}</p>
        {note && <p className="hiw-step__note">— {note}</p>}
        {visual && <div className="hiw-step__visual">{visual}</div>}
      </div>
    </article>
  );
}

function SpecialistsVisual() {
  const todos = [
    { tag: "flights", status: "done", text: "TAP TP203, 09:15 LHR → LIS · £187" },
    { tag: "stays", status: "running", text: "shortlisting boutique hotels in Alfama…" },
    { tag: "itinerary", status: "done", text: "Belcanto, Sat 8pm · 2-person tasting" },
  ];
  return (
    <div className="hiw-todos">
      {todos.map((t, i) => (
        <div key={i} className="hiw-todo">
          <span className={`hiw-todo__status hiw-todo__status--${t.status}`}>
            {t.status === "done" ? "✓" : "•"}
          </span>
          <span className="hiw-todo__tag">{t.tag}</span>
          <span className="hiw-todo__text">{t.text}</span>
        </div>
      ))}
    </div>
  );
}

function ArchPill({ label, desc, accent = false }) {
  return (
    <div className={`hiw-arch__pill ${accent ? "hiw-arch__pill--accent" : ""}`}>
      <span className="hiw-arch__label">{label}</span>
      <span className="hiw-arch__desc">{desc}</span>
    </div>
  );
}
