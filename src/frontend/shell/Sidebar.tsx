import { Link } from "@tanstack/react-router";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/jobs", label: "Jobs" },
  { to: "/applications", label: "Applications" },
  { to: "/profile", label: "Profile" },
  { to: "/resume", label: "Resume" },
  { to: "/interviews", label: "Interviews" },
  { to: "/skills", label: "Skills" },
  { to: "/autopilot", label: "Autopilot" },
  { to: "/activity", label: "Activity" },
  { to: "/search", label: "Search" },
  { to: "/settings", label: "Settings" },
] as const;

export function Sidebar() {
  return (
    <aside className="shell-sidebar w-56 border-r bg-sidebar text-sidebar-foreground p-4">
      <div className="shell-brand mb-6 font-semibold tracking-tight">IMPERIUM</div>
      <nav className="shell-nav flex flex-col gap-1">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="shell-nav-link px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent"
            activeProps={{ className: "shell-nav-link shell-nav-link-active px-3 py-2 rounded-md text-sm bg-sidebar-accent" }}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
