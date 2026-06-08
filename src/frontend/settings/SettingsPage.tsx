import "./settings.css";
import { useSettingsPage } from "./settings.logic";

export function SettingsPage() {
  const { title } = useSettingsPage();
  return (
    <div className="settings-root min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="settings-title text-3xl font-semibold">{title}</h1>
      <p className="settings-subtitle mt-3 text-sm text-muted-foreground">
        This page is part of the new architecture skeleton. UI coming soon.
      </p>
    </div>
  );
}

export default SettingsPage;
