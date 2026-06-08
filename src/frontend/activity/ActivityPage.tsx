import "./activity.css";
import { useActivityPage } from "./activity.logic";

export function ActivityPage() {
  const { title } = useActivityPage();
  return (
    <div className="activity-root min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="activity-title text-3xl font-semibold">{title}</h1>
      <p className="activity-subtitle mt-3 text-sm text-muted-foreground">
        This page is part of the new architecture skeleton. UI coming soon.
      </p>
    </div>
  );
}

export default ActivityPage;
