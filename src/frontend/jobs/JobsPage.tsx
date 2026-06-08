import "./jobs.css";
import { useJobsPage } from "./jobs.logic";

export function JobsPage() {
  const { title } = useJobsPage();
  return (
    <div className="jobs-root min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="jobs-title text-3xl font-semibold">{title}</h1>
      <p className="jobs-subtitle mt-3 text-sm text-muted-foreground">
        This page is part of the new architecture skeleton. UI coming soon.
      </p>
    </div>
  );
}

export default JobsPage;
