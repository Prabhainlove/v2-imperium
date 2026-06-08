import "./skills.css";
import { useSkillsPage } from "./skills.logic";

export function SkillsPage() {
  const { title } = useSkillsPage();
  return (
    <div className="skills-root min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="skills-title text-3xl font-semibold">{title}</h1>
      <p className="skills-subtitle mt-3 text-sm text-muted-foreground">
        This page is part of the new architecture skeleton. UI coming soon.
      </p>
    </div>
  );
}

export default SkillsPage;
