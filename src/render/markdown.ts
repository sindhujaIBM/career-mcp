import { marked } from "marked";
import { THEMES, SHARED_CSS, type ThemeName } from "./themes.js";
import { fontFaceCss } from "./fonts.js";

export type PageSize = "letter" | "a4";
export const PAGE_SIZES: PageSize[] = ["letter", "a4"];

export type DocumentKind = "resume" | "letter";

// Handed to the MCP client (and the CLI's LLM) so generated resumes match what the themes style.
export const RESUME_MARKDOWN_GUIDE = [
  "Write the tailored resume as markdown in this exact shape so it renders cleanly to PDF:",
  "  # Full Name",
  "  One-line tagline (target title / positioning)",
  "  Contact line: City · email · phone · linkedin.com/in/... (one paragraph)",
  "  ## Summary  (then a short paragraph)",
  "  ## Experience",
  "  ### Job Title — Company",
  "  *Start – End | Location*",
  "  - achievement bullets",
  "  ## Skills  (bullets, or a two-column table: | Area | Skills |)",
  "  ## Education",
  "Output only the resume itself — no commentary before or after it.",
].join("\n");

// LLM output often arrives fenced (```markdown ... ```) or with a chatty preamble,
// and resume files may carry private notes. Strip all of that before rendering.
export function cleanMarkdown(markdown: string): string {
  let text = markdown.trim();

  const fenced = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  if (fenced) text = fenced[1].trim();

  const lines = text.split("\n");
  const firstH1 = lines.findIndex((line) => /^# /.test(line));
  const start = firstH1 === -1 ? 0 : firstH1;
  const notes = lines.findIndex((line, i) => i > start && /^## Notes for Customization/i.test(line));
  const end = notes === -1 ? lines.length : notes;

  return separateStructuralLines(lines.slice(start, end)).join("\n").trim();
}

// The themes style lines by position (h1 + p + p is the contact line, h3 + p the dates),
// but markdown folds consecutive lines into one paragraph. Give each plain line its own
// paragraph in the header block (between # Name and the first ##) and right after a ###/####.
function separateStructuralLines(lines: string[]): string[] {
  const isPlain = (line: string) => line.trim() !== "" && !/^\s*([-+]\s|\*\s|\d+\.\s|[|>#]|```)/.test(line);
  const out: string[] = [];
  let inHeaderBlock = false;
  let afterSubheading = false;

  for (const line of lines) {
    if (/^# /.test(line)) inHeaderBlock = true;
    else if (/^## /.test(line)) inHeaderBlock = false;

    // A ###/#### opens a run of plain lines (dates, role description); bullets, tables, etc. end it.
    if (/^#{3,4} /.test(line)) afterSubheading = true;
    else if (line.trim() !== "" && !isPlain(line)) afterSubheading = false;

    out.push(line);
    if ((inHeaderBlock || afterSubheading) && isPlain(line)) out.push("");
  }
  return out;
}

export async function markdownToHtml(
  markdown: string,
  options: { theme: ThemeName; pageSize: PageSize; title: string; kind: DocumentKind }
): Promise<string> {
  const theme = THEMES[options.theme];
  // Letters keep single line breaks ("Sincerely,\nName"); resumes use standard markdown paragraphs.
  const body = await marked.parse(cleanMarkdown(markdown), { breaks: options.kind === "letter" });
  const fonts = await fontFaceCss(theme.font);
  const pageSize = options.pageSize === "a4" ? "A4" : "letter";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(options.title)}</title>
  <style>
${fonts}
@page {
  size: ${pageSize};
  margin: 0.6in 0.75in;
}
${SHARED_CSS}
${theme.css}
  </style>
</head>
<body class="${options.kind}">
${body}
</body>
</html>
`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
