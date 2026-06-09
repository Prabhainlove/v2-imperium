/**
 * DOCX export — schema-driven only. Generates a Word document directly from
 * ResumeJSON. Never HTML→DOCX. Mirrors the Classic template structure for
 * maximum ATS-safety.
 */
import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { ResumeJSON, ResumeExperience, ResumeProject } from "@frontend/resume/schema";

function fmt(start: string, end: string): string {
  const e = end || "Present";
  if (!start && !end) return "";
  return `${start ?? ""} – ${e}`;
}

function heading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, size: 22, characterSpacing: 30 }),
    ],
  });
}

function para(text: string, opts: { bold?: boolean; italic?: boolean; size?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text, bold: opts.bold, italics: opts.italic, size: opts.size ?? 22 }),
    ],
  });
}

function bulletPara(text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 40 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function expBlock(e: ResumeExperience): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({
      spacing: { after: 30 },
      children: [
        new TextRun({ text: `${e.title}${e.company ? ` — ${e.company}` : ""}`, bold: true, size: 22 }),
        new TextRun({ text: `   ${fmt(e.start, e.end)}`, italics: true, color: "555555", size: 20 }),
      ],
    }),
  ];
  if (e.location) out.push(para(e.location, { italic: true, size: 20 }));
  for (const b of e.bullets.filter(Boolean)) out.push(bulletPara(b));
  return out;
}

function projBlock(p: ResumeProject): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({
      spacing: { after: 30 },
      children: [
        new TextRun({ text: p.name, bold: true, size: 22 }),
        ...(p.url ? [new TextRun({ text: `   ${p.url}`, color: "1d4ed8", size: 20 })] : []),
      ],
    }),
  ];
  if (p.stack.length) out.push(para(p.stack.join(", "), { italic: true, size: 20 }));
  for (const b of p.bullets.filter(Boolean)) out.push(bulletPara(b));
  return out;
}

export async function exportResumeToDocx(resume: ResumeJSON): Promise<void> {
  const { personal, summary, skills, experience, projects, education, certifications } = resume;

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 80 },
      children: [new TextRun({ text: personal.name || "Your Name", bold: true, size: 36 })],
    }),
  ];

  if (personal.title) children.push(para(personal.title, { size: 22 }));

  const contactBits = [personal.email, personal.phone, personal.location].filter(Boolean);
  if (contactBits.length) {
    children.push(new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: contactBits.join("  •  "), size: 20, color: "555555" })],
    }));
  }
  if (personal.links.length) {
    children.push(new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: personal.links.map((l) => `${l.label}: ${l.url}`).join("  •  "),
          size: 20,
          color: "1d4ed8",
        }),
      ],
    }));
  }

  if (summary) {
    children.push(heading("Summary"));
    children.push(para(summary));
  }

  if (skills.length) {
    children.push(heading("Skills"));
    for (const g of skills) {
      children.push(new Paragraph({
        spacing: { after: 50 },
        children: [
          ...(skills.length > 1 ? [new TextRun({ text: `${g.category}: `, bold: true, size: 22 })] : []),
          new TextRun({ text: g.items.join(", "), size: 22 }),
        ],
      }));
    }
  }

  if (experience.length) {
    children.push(heading("Experience"));
    for (const e of experience) children.push(...expBlock(e));
  }

  if (projects.length) {
    children.push(heading("Projects"));
    for (const p of projects) children.push(...projBlock(p));
  }

  if (education.length) {
    children.push(heading("Education"));
    for (const ed of education) {
      children.push(new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: ed.school, bold: true, size: 22 }),
          new TextRun({ text: `   ${fmt(ed.start, ed.end)}`, italics: true, color: "555555", size: 20 }),
        ],
      }));
      if (ed.degree || ed.field) children.push(para([ed.degree, ed.field].filter(Boolean).join(", ")));
      if (ed.gpa) children.push(para(`GPA: ${ed.gpa}`, { size: 20 }));
    }
  }

  if (certifications.length) {
    children.push(heading("Certifications"));
    for (const c of certifications) {
      children.push(bulletPara(`${c.name}${c.issuer ? ` — ${c.issuer}` : ""}${c.date ? ` (${c.date})` : ""}`));
    }
  }

  const doc = new Document({
    creator: "Imperium Resume Studio",
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 240 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: resume.meta.paper === "A4"
              ? { width: 11906, height: 16838 }
              : { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${personal.name || "resume"}-${resume.meta.templateId}.docx`
    .toLowerCase()
    .replace(/\s+/g, "-");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
