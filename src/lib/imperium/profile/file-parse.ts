/**
 * Client-side resume file → plain text extractor.
 * Supports PDF, DOCX, TXT/MD. PDFs use pdfjs-dist; DOCX uses mammoth.
 */

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const type = file.type;

  if (name.endsWith(".txt") || name.endsWith(".md") || type.startsWith("text/")) {
    return (await file.text()).trim();
  }

  if (name.endsWith(".pdf") || type === "application/pdf") {
    return extractPdfText(file);
  }

  if (
    name.endsWith(".docx") ||
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractDocxText(file);
  }

  if (name.endsWith(".doc")) {
    throw new Error("Legacy .doc files aren't supported. Save as .docx or .pdf and try again.");
  }

  throw new Error("Unsupported file type. Upload a PDF, DOCX, or TXT resume.");
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Vite-friendly worker URL.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => (typeof (it as { str?: string }).str === "string" ? (it as { str: string }).str : ""))
      .join(" ");
    parts.push(text);
  }
  return parts.join("\n\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

async function extractDocxText(file: File): Promise<string> {
  // @ts-expect-error - mammoth ships a browser bundle without a type declaration
  const mammoth = (await import("mammoth/mammoth.browser.js")) as {
    extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  };


  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return (result.value ?? "").trim();
}
