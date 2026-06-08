import "./applications.css";
import { useApplicationsPage } from "./applications.logic";

export function ApplicationsPage() {
  const { title } = useApplicationsPage();
  return (
    <div className="applications-root min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="applications-title text-3xl font-semibold">{title}</h1>
      <p className="applications-subtitle mt-3 text-sm text-muted-foreground">
        This page is part of the new architecture skeleton. UI coming soon.
      </p>
    </div>
  );
}

export default ApplicationsPage;
