import "./dashboard.css";
import { useDashboardPage } from "./dashboard.logic";

export function DashboardPage() {
  const { title } = useDashboardPage();
  return (
    <div className="dashboard-root min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="dashboard-title text-3xl font-semibold">{title}</h1>
      <p className="dashboard-subtitle mt-3 text-sm text-muted-foreground">
        This page is part of the new architecture skeleton. UI coming soon.
      </p>
    </div>
  );
}

export default DashboardPage;
