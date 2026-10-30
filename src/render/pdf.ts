import { access, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { markdownToHtml, type DocumentKind, type PageSize } from "./markdown.js";
import type { ThemeName } from "./themes.js";

// puppeteer-core drives a browser the user already has installed — it never
// downloads one. Set CAREER_MCP_CHROME_PATH to point at a browser we don't find.

function candidateBrowserPaths(): string[] {
  const home = os.homedir();
  switch (process.platform) {
    case "darwin":
      return [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        path.join(home, "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
      ];
    case "win32": {
      const roots = [process.env["PROGRAMFILES"], process.env["PROGRAMFILES(X86)"], process.env["LOCALAPPDATA"]].filter(
        (root): root is string => Boolean(root)
      );
      return roots.flatMap((root) => [
        path.join(root, "Google", "Chrome", "Application", "chrome.exe"),
        path.join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
        path.join(root, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
      ]);
    }
    default:
      return [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/microsoft-edge",
        "/usr/bin/brave-browser",
        "/snap/bin/chromium",
      ];
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function findBrowser(): Promise<string | null> {
  const override = process.env.CAREER_MCP_CHROME_PATH;
  if (override) {
    if (await exists(override)) return override;
    throw new Error(`CAREER_MCP_CHROME_PATH is set to ${override}, but no file exists there.`);
  }
  for (const candidate of candidateBrowserPaths()) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}

export interface RenderOptions {
  theme: ThemeName;
  pageSize: PageSize;
  title: string;
  kind: DocumentKind;
}

export type RenderResult =
  | { ok: true; pdfPath: string }
  | { ok: false; htmlPath: string; reason: string };

// Writes <outBase>.pdf. If no browser is available, writes <outBase>.html instead
// so the user can open it and Print → Save as PDF themselves.
export async function renderMarkdownToPdf(markdown: string, outBase: string, options: RenderOptions): Promise<RenderResult> {
  const html = await markdownToHtml(markdown, options);
  const browserPath = await findBrowser();

  if (!browserPath) {
    const htmlPath = `${outBase}.html`;
    await writeFile(htmlPath, html, "utf8");
    return {
      ok: false,
      htmlPath,
      reason:
        "No Chrome, Edge, Chromium, or Brave install was found. Install one, or set CAREER_MCP_CHROME_PATH to your browser's executable. " +
        `In the meantime, open ${htmlPath} in any browser and use Print → Save as PDF.`,
    };
  }

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    // Chrome refuses to start as root (common in containers/CI) without --no-sandbox.
    args: process.getuid?.() === 0 ? ["--no-sandbox", "--disable-dev-shm-usage"] : [],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluateHandle("document.fonts.ready");
    const pdfPath = `${outBase}.pdf`;
    await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true });
    return { ok: true, pdfPath };
  } finally {
    await browser.close();
  }
}
