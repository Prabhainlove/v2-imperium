import "./imperium-navbar.css";
import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  IconBriefcase, IconDoc, IconCheck, IconChat, IconBubble,
  IconHat, IconSparkle, IconScan, IconNetwork, IconChart, IconCore,
} from "@frontend/dashboard/components/icons";

const NAV = [
  { to: "/dashboard",    label: "Dashboard",   icon: IconCore },
  { to: "/jobs",         label: "Jobs",        icon: IconBriefcase },
  { to: "/resume",       label: "Resume",      icon: IconDoc },
  { to: "/ats",          label: "ATS",         icon: IconCheck },
  { to: "/applications", label: "Tracker",     icon: IconChat },
  { to: "/interviews",   label: "Interviews",  icon: IconBubble },
  { to: "/skills",       label: "Skills",      icon: IconHat },
  { to: "/assistant",    label: "Assistant",   icon: IconSparkle },
  { to: "/recruiters",   label: "Recruiters",  icon: IconScan },
  { to: "/networking",   label: "Network",     icon: IconNetwork },
  { to: "/salary",       label: "Salary",      icon: IconChart },
] as const;

export function ImperiumNavbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="imp-nav-wrap">
      <nav className="imp-nav" aria-label="Imperium navigation">
        {NAV.map((n) => {
          const active = pathname === n.to;
          const Icon = n.icon;
          return (
            <Link key={n.to} to={n.to} className="imp-nav-link" data-active={active}>
              {active && (
                <motion.span
                  layoutId="imp-nav-pill"
                  className="imp-nav-pill"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon />
              <span className="imp-nav-text">{n.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
