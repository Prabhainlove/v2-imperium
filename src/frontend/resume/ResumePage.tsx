import "./resume.css";
import { useResumePage } from "./resume.logic";

export function ResumePage() {
  const { title } = useResumePage();
  return (
    <div className="resume-root min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="resume-title text-3xl font-semibold">{title}</h1>
      <p className="resume-subtitle mt-3 text-sm text-muted-foreground">
        This page is part of the new architecture skeleton. UI coming soon.
      </p>
    </div>
  );
}

export default ResumePage;
