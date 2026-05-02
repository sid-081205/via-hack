import { NavLink, Link } from "react-router-dom";
import Logo from "./Logo.jsx";
import "./MarketingNav.css";

export default function MarketingNav() {
  return (
    <nav className="m-nav">
      <Link to="/" className="m-nav__brand" aria-label="via — home">
        <Logo size={32} />
      </Link>

      <div className="m-nav__links">
        <NavLink to="/" end className="m-nav__link">home</NavLink>
        <NavLink to="/how-it-works" className="m-nav__link">how it works</NavLink>
        <NavLink to="/pricing" className="m-nav__link">pricing</NavLink>
      </div>

      <Link to="/dashboard" className="m-nav__cta">
        open dashboard
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M3 3 L11 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </nav>
  );
}
