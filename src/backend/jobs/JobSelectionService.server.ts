/**
 * JobSelectionService — records which job the user picked for Resume Studio.
 * The only handoff between the Jobs page and Resume Studio.
 * No resume generation, no application creation here.
 */
type Db = { from: (t: string) => any };

export async function selectJob(db: Db, userId: string, jobId: string) {
  await db.from("selected_jobs").delete().eq("user_id", userId);
  const { data, error } = await db
    .from("selected_jobs")
    .insert({ user_id: userId, job_id: jobId })
    .select("id, job_id, selected_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getCurrentSelection(db: Db, userId: string) {
  const { data } = await db
    .from("selected_jobs")
    .select("id, job_id, selected_at")
    .eq("user_id", userId)
    .order("selected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}
