import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ImperiumNavbar } from "./ImperiumNavbar";

/** App shell used by the _authenticated layout.
 *  - On /dashboard: render children only (RPG command center owns the chrome).
 *  - Everywhere else: floating Imperium navbar + animated route transitions. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isDashboard = pathname === "/dashboard";

  if (isDashboard) return <>{children}</>;

  return (
    <>
      <ImperiumNavbar />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={pathname}
          className="imp-page"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {children}
        </motion.main>
      </AnimatePresence>
    </>
  );
}
