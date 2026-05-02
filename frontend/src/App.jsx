import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import HowItWorks from "./pages/HowItWorks.jsx";
import Pricing from "./pages/Pricing.jsx";
import Dashboard from "./pages/Dashboard.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
}
