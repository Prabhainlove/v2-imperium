import "./search.css";
import { useSearchPage } from "./search.logic";

export function SearchPage() {
  const { title } = useSearchPage();
  return (
    <div className="search-root min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="search-title text-3xl font-semibold">{title}</h1>
      <p className="search-subtitle mt-3 text-sm text-muted-foreground">
        This page is part of the new architecture skeleton. UI coming soon.
      </p>
    </div>
  );
}

export default SearchPage;
