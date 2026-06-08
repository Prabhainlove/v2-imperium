import "./interviews.css";
import { useInterviewsPage } from "./interviews.logic";

export function InterviewsPage() {
  const { title } = useInterviewsPage();
  return (
    <div className="interviews-root min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="interviews-title text-3xl font-semibold">{title}</h1>
      <p className="interviews-subtitle mt-3 text-sm text-muted-foreground">
        This page is part of the new architecture skeleton. UI coming soon.
      </p>
    </div>
  );
}

export default InterviewsPage;
