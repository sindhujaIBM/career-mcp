#!/usr/bin/env node
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import "dotenv/config";
import * as storage from "./storage.js";
import { startStoryInterview, answerStoryQuestion } from "./interview.js";
import { callLLM } from "./llm-fallback.js";
import { exportPdf, describeResult, type ExportDocument } from "./export.js";
import { RESUME_MARKDOWN_GUIDE } from "./render/markdown.js";

const SYSTEM_PROMPT =
  "You are a career writing assistant. Write in a clear, direct, honest voice — " +
  "no buzzwords, no AI-sounding phrases ('in today's fast-paced world', 'as we navigate'), " +
  "no fake inspiration. Prefer specific, grounded claims over impressive-sounding generalities. " +
  "Never fabricate experience that isn't in the provided resume or stories.";

async function readArgFile(flagValue: string | undefined): Promise<string | undefined> {
  if (!flagValue) return undefined;
  return storage.readTextFile(flagValue);
}

function parseFlags(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      flags[key] = value;
    }
  }
  return flags;
}

async function buildContext() {
  const [resume, voice, application] = await Promise.all([
    storage.getResume(),
    storage.getVoiceProfile(),
    storage.getActiveApplication(),
  ]);
  if (!application) throw new Error("No active application. Run `career-mcp-cli set-jd` first.");
  const stories = await storage.queryStories();
  return { resume, voice, application, stories };
}

function contextToPrompt(ctx: Awaited<ReturnType<typeof buildContext>>): string {
  return [
    `Job description (${ctx.application.company} — ${ctx.application.role}):`,
    ctx.application.jdText,
    "",
    "Resume:",
    ctx.resume?.rawText ?? "(none provided)",
    "",
    "Voice profile:",
    ctx.voice ?? "(none provided — default to clear, direct, honest)",
    ctx.stories.length > 0 ? `\nCareer stories (use if relevant):\n${ctx.stories.map((s) => `${s.title}: ${s.content}`).join("\n\n")}` : "",
  ].join("\n");
}

async function cmdSetResume(flags: Record<string, string>) {
  const text = await readArgFile(flags.file);
  if (!text) throw new Error("Usage: career-mcp-cli set-resume --file <path>");
  await storage.saveResume(text);
  console.log("Resume saved.");
}

async function cmdSetJD(flags: Record<string, string>) {
  const text = await readArgFile(flags.file);
  if (!text || !flags.company || !flags.role) {
    throw new Error("Usage: career-mcp-cli set-jd --company <name> --role <title> --file <path>");
  }
  const application = await storage.saveJD(flags.company, flags.role, text);
  console.log(`Saved JD for ${flags.company} — ${flags.role} (${application.slug}), set as active.`);
}

async function cmdGenerate(outputType: storage.OutputType, instruction: string) {
  const ctx = await buildContext();
  const prompt = `${instruction}\n\n${contextToPrompt(ctx)}`;
  const result = await callLLM(SYSTEM_PROMPT, prompt);
  console.log(result);
  await storage.saveOutput(ctx.application.slug, outputType, result);
  console.log(`\n(saved to ~/.career-mcp/applications/${ctx.application.slug}/outputs/${outputType}.md)`);
}

async function cmdPdf(flags: Record<string, string>, document?: ExportDocument) {
  const result = await exportPdf({
    document: document ?? (flags.document as ExportDocument | undefined),
    applicationSlug: flags.application,
    theme: flags.theme,
    pageSize: flags["page-size"],
  });
  console.log(describeResult(result));
}

async function cmdInterview() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  let step = startStoryInterview();
  console.log(`Let's capture a story. ${step.total_questions} quick questions.\n`);
  while (step.status === "in_progress") {
    const answer = await rl.question(`${step.question}\n> `);
    step = await answerStoryQuestion(step.session_id, answer);
    console.log("");
  }
  console.log(`Saved: "${step.story?.title}" [${step.story?.tags.join(", ")}]`);
  rl.close();
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  switch (command) {
    case "set-resume":
      return cmdSetResume(flags);
    case "set-jd":
      return cmdSetJD(flags);
    case "interview":
      return cmdInterview();
    case "analyze":
      return cmdGenerate("match_analysis", "Analyze how well this resume matches this job description. Call out genuine overlaps and honest gaps — no keyword stuffing.");
    case "resume":
      await cmdGenerate("tailored_resume", `Produce a tailored version of this resume for this job description, reordering and reframing existing content for relevance. Do not invent experience.\n\n${RESUME_MARKDOWN_GUIDE}`);
      return cmdPdf(flags, "tailored_resume");
    case "cover-letter":
      await cmdGenerate("cover_letter", "Write a cover letter for this job description, in the voice profile's tone. A real letter: date, Dear Hiring Team, body, Sincerely + name. Output only the letter, as markdown.");
      if (flags.pdf) return cmdPdf(flags, "cover_letter");
      return;
    case "pdf":
      return cmdPdf(flags);
    case "about":
      return cmdGenerate("linkedin_about", "Write a LinkedIn About section based on this resume and these stories, in the voice profile's tone.");
    default:
      console.log(
        [
          "career-mcp-cli — standalone mode (no MCP client needed)",
          "Requires CAREER_MCP_API_KEY in your environment (Groq or Gemini free tier). See .env.example.",
          "",
          "Commands:",
          "  set-resume --file <path>",
          "  set-jd --company <name> --role <title> --file <path>",
          "  interview",
          "  analyze",
          "  resume                 (also writes a PDF)",
          "  cover-letter [--pdf]",
          "  about",
          "  pdf [--document tailored_resume|cover_letter|base_resume] [--theme navy|minimal|classic]",
          "      [--page-size letter|a4] [--application <slug>]",
          "",
          "  resume and cover-letter --pdf also accept --theme and --page-size.",
        ].join("\n")
      );
  }
}

main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
