import { Link } from "react-router-dom";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="m-footer">
      <div className="container">
        <div className="m-footer__inner">
          <div className="m-footer__left">
            <span className="m-footer__brand">via</span>
            <span className="m-footer__tagline">a personal travel agent</span>
          </div>

          <div className="m-footer__links">
            <Link to="/how-it-works">how it works</Link>
            <Link to="/pricing">pricing</Link>
            <Link to="/dashboard">dashboard</Link>
          </div>

          <span className="m-footer__copy">© 2026 · in private beta</span>
        </div>
      </div>
    </footer>
  );
}
