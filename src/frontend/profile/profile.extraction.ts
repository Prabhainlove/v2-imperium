/** Local-first profile extraction helpers. Resume parses via existing client
 *  PDF/DOCX parser; LinkedIn import is a placeholder until Ollama wiring lands. */
import { extractTextFromFile } from "@backend/profile/ResumeFileParser";

export async function extractFromResume(file: File): Promise<{ text: string; chars: number }> {
  const text = await extractTextFromFile(file);
  return { text, chars: text.length };
}

export async function importFromLinkedIn(_url: string): Promise<{ ok: boolean; message: string }> {
  return { ok: false, message: "Local LinkedIn import will activate when Ollama integration is enabled." };
}
