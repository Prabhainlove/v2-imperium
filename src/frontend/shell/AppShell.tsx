import "./shell.css";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell-root min-h-screen flex">
      <Sidebar />
      <div className="shell-main flex-1 flex flex-col">
        <Topbar />
        <main className="shell-content flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
