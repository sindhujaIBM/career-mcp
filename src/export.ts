import * as storage from "./storage.js";
import { renderMarkdownToPdf, type RenderResult } from "./render/pdf.js";
import { PAGE_SIZES, type PageSize } from "./render/markdown.js";
import { THEME_NAMES, type ThemeName } from "./render/themes.js";

export type ExportDocument = "tailored_resume" | "cover_letter" | "base_resume";
export const EXPORT_DOCUMENTS: ExportDocument[] = ["tailored_resume", "cover_letter", "base_resume"];

export interface ExportOptions {
  document?: ExportDocument;
  applicationSlug?: string;
  theme?: string;
  pageSize?: string;
}

function resolveTheme(theme?: string): ThemeName {
  const value = (theme || process.env.CAREER_MCP_PDF_THEME || "navy").toLowerCase();
  if (!THEME_NAMES.includes(value as ThemeName)) {
    throw new Error(`Unknown theme "${value}". Choose one of: ${THEME_NAMES.join(", ")}.`);
  }
  return value as ThemeName;
}

function resolvePageSize(pageSize?: string): PageSize {
  const value = (pageSize || process.env.CAREER_MCP_PAGE_SIZE || "letter").toLowerCase();
  if (!PAGE_SIZES.includes(value as PageSize)) {
    throw new Error(`Unknown page size "${value}". Choose one of: ${PAGE_SIZES.join(", ")}.`);
  }
  return value as PageSize;
}

export async function exportPdf(options: ExportOptions = {}): Promise<RenderResult> {
  const document = options.document ?? "tailored_resume";
  if (!EXPORT_DOCUMENTS.includes(document)) {
    throw new Error(`Unknown document "${document}". Choose one of: ${EXPORT_DOCUMENTS.join(", ")}.`);
  }
  const renderOptions = { theme: resolveTheme(options.theme), pageSize: resolvePageSize(options.pageSize) };

  if (document === "base_resume") {
    const resume = await storage.getResume();
    if (!resume?.rawText) throw new Error("No resume stored yet. Use save_resume first.");
    return renderMarkdownToPdf(resume.rawText, storage.baseResumeOutputBasePath(), { ...renderOptions, title: "Resume", kind: "resume" });
  }

  let slug = options.applicationSlug;
  if (!slug) {
    const active = await storage.getActiveApplication();
    if (!active) throw new Error("No active application and no application_slug provided.");
    slug = active.slug;
  }
  const application = await storage.getApplication(slug);
  if (!application) throw new Error(`No application found with slug "${slug}".`);

  const markdown = await storage.getOutput(slug, document);
  if (!markdown) {
    throw new Error(`No ${document} saved for ${application.company} — ${application.role} yet. Generate it and save it with save_output first.`);
  }
  const isLetter = document === "cover_letter";
  return renderMarkdownToPdf(markdown, storage.outputBasePath(slug, document), {
    ...renderOptions,
    title: `${isLetter ? "Cover Letter" : "Resume"} — ${application.company}`,
    kind: isLetter ? "letter" : "resume",
  });
}

export function describeResult(result: RenderResult): string {
  return result.ok ? `PDF saved to ${result.pdfPath}` : `Could not create the PDF. ${result.reason}`;
}
