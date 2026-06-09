/**
 * SearchHistoryService — lightweight append-only log of user searches.
 * Stores only query + filters + result count + timestamp. No job records.
 */
type Db = { from: (t: string) => any };

export interface SearchFilters {
  title: string;
  skills: string;
  location: string;
  experience: string;
  workMode: string;
  salaryMin?: number | null;
}

export async function logSearch(db: Db, userId: string, filters: SearchFilters, resultCount: number) {
  await db.from("search_history").insert({
    user_id: userId,
    query: filters.title || filters.skills || "",
    filters,
    result_count: resultCount,
  });
}

export async function recentSearches(db: Db, userId: string, limit = 10) {
  const { data } = await db
    .from("search_history")
    .select("id, query, filters, result_count, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
