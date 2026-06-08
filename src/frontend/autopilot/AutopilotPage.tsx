import "./autopilot.css";
import { useAutopilotPage } from "./autopilot.logic";

export function AutopilotPage() {
  const { title } = useAutopilotPage();
  return (
    <div className="autopilot-root min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="autopilot-title text-3xl font-semibold">{title}</h1>
      <p className="autopilot-subtitle mt-3 text-sm text-muted-foreground">
        This page is part of the new architecture skeleton. UI coming soon.
      </p>
    </div>
  );
}

export default AutopilotPage;
