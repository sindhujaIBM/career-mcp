#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as storage from "./storage.js";
import { startStoryInterview, answerStoryQuestion } from "./interview.js";
import { exportPdf, describeResult, EXPORT_DOCUMENTS, type ExportDocument } from "./export.js";
import { RESUME_MARKDOWN_GUIDE, PAGE_SIZES } from "./render/markdown.js";
import { THEME_NAMES } from "./render/themes.js";

const server = new Server(
  { name: "career-mcp", version: "1.0.1" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "save_resume",
      description: "Store the user's base resume, either as raw text or by reading a local file. Overwrites any previously stored resume. Provide exactly one of resume_text or resume_path.",
      inputSchema: {
        type: "object",
        properties: {
          resume_text: { type: "string", description: "The full resume content as plain text or markdown. Use this or resume_path, not both." },
          resume_path: { type: "string", description: "Absolute path to a .pdf, .txt, or .md resume file to read instead of passing raw text" },
        },
      },
    },
    {
      name: "get_resume",
      description: "Retrieve the stored base resume as plain text, exactly as it was saved. Read-only. Use it to review or quote the resume on its own; for match analysis or tailoring, call get_active_application instead, which bundles the resume with the job description and voice profile. Returns a message asking for save_resume if no resume is stored yet.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "save_voice_profile",
      description: "Store a description of the user's writing voice/tone (e.g. tone attributes, phrases to avoid, sample posts). Used to keep generated cover letters and LinkedIn About sections sounding like the user, not generic AI copy. Overwrites any previously stored voice profile. Returns a short confirmation.",
      inputSchema: {
        type: "object",
        properties: {
          voice_text: { type: "string", description: "Description of tone, style, and things to avoid" },
        },
        required: ["voice_text"],
      },
    },
    {
      name: "get_voice_profile",
      description: "Retrieve the stored voice profile (tone, style, phrases to avoid) as plain text. Read-only. Use it to check or edit the voice guidance before calling save_voice_profile again; get_active_application already includes it when generating content. Returns \"No voice profile stored yet.\" if none has been saved.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "save_jd",
      description: "Store a job description for a company/role and mark it as the active application. Creates a new application record, or replaces the existing one if the same company and role were saved before. Provide exactly one of jd_text or jd_path. Returns the application slug, which save_output and export_pdf accept as application_slug.",
      inputSchema: {
        type: "object",
        properties: {
          company: { type: "string", description: "Company name, e.g. \"Acme\". Combined with role to form the application slug." },
          role: { type: "string", description: "Job title as written in the posting, e.g. \"Senior Engineer\"" },
          jd_text: { type: "string", description: "The full job description text" },
          jd_path: { type: "string", description: "Absolute path to a .pdf, .txt, or .md job description file to read instead of passing raw text" },
        },
        required: ["company", "role"],
      },
    },
    {
      name: "get_active_application",
      description: `Returns the stored resume, voice profile, and the active job description together, as context for match analysis or content generation. Use this to: (1) run match analysis — identify genuine overlaps and honest gaps between the resume and JD, not keyword stuffing; (2) draft a tailored resume by reordering/reframing existing resume content for relevance, never fabricating experience; (3) draft a cover letter; (4) draft a LinkedIn About section. Match the voice profile's tone if one is set. Save any generated output with save_output.\n\n${RESUME_MARKDOWN_GUIDE}`,
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_applications",
      description: "List every stored application, one per line, as company, role, slug and created date. Read-only. Use it to find the application_slug for save_output or export_pdf when working on an application that is not the active one. Returns \"No applications stored yet.\" if save_jd has never been called.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "save_output",
      description: "Persist generated content (match analysis, tailored resume, cover letter, or LinkedIn About draft) for an application. Defaults to the active application if application_slug is omitted. Overwrites any earlier output of the same type for that application. Returns the path of the saved markdown file. After saving a tailored resume, offer to export it with export_pdf.",
      inputSchema: {
        type: "object",
        properties: {
          output_type: {
            type: "string",
            enum: ["match_analysis", "tailored_resume", "cover_letter", "linkedin_about"],
            description: "Which kind of output this is; also sets the saved file name",
          },
          content: { type: "string", description: "The full generated content, in markdown" },
          application_slug: { type: "string", description: "Optional — defaults to the active application" },
        },
        required: ["output_type", "content"],
      },
    },
    {
      name: "export_pdf",
      description: "Render a saved markdown document to a PDF that ATS systems can read, using the user's installed Chrome/Edge/Chromium/Brave. Defaults to the active application's tailored resume. Only export a cover letter when the user asks for one. If no browser is found, an HTML file is written instead and the reason is returned — relay it to the user.",
      inputSchema: {
        type: "object",
        properties: {
          document: {
            type: "string",
            enum: EXPORT_DOCUMENTS,
            description: "tailored_resume (default), cover_letter, or base_resume (the stored base resume)",
          },
          application_slug: { type: "string", description: "Optional — defaults to the active application. Ignored for base_resume." },
          theme: { type: "string", enum: THEME_NAMES, description: "navy (default: modern sans, navy accents), minimal (monochrome, compact), classic (serif, centered header)" },
          page_size: { type: "string", enum: PAGE_SIZES, description: "letter (default) or a4" },
        },
      },
    },
    {
      name: "save_story",
      description: "Save a finished career story directly, when the user already has it written out. If the story still needs drawing out, use start_story_interview instead, which asks the questions and saves the result itself. Always creates a new story, never overwrites one. Returns the story's title and slug.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short title, 3-6 words, used to find the story later" },
          tags: { type: "array", items: { type: "string" }, description: "Lowercase tags used by query_stories, e.g. leadership, conflict, technical-deep-dive" },
          content: { type: "string", description: "The story itself, in markdown" },
        },
        required: ["title", "tags", "content"],
      },
    },
    {
      name: "query_stories",
      description: "Retrieve saved career stories, optionally filtered by tag (e.g. leadership, conflict, failure-recovery, technical-deep-dive). Use to find a story relevant to a JD requirement, an interview-prep question, or a LinkedIn post idea. Read-only. A story matches if it has any of the given tags (case-insensitive); with no tags, every story is returned. Each result includes the title, tags and full content.",
      inputSchema: {
        type: "object",
        properties: {
          tags: { type: "array", items: { type: "string" }, description: "Optional. Return stories with any of these tags; omit to return all stories" },
        },
      },
    },
    {
      name: "start_story_interview",
      description: "Begin a structured interview to capture one new career story. Returns the first question and a session_id. Keep calling answer_story_question with that session_id, relaying each returned question to the user verbatim, until status is 'complete' — the story is then auto-saved. The interview has 7 questions: scene, problem, your actions, result, reflection, tags and title. Sessions are held in memory, so an unfinished interview is lost if the server restarts.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "answer_story_question",
      description: "Submit the user's answer to the current question of an interview started with start_story_interview. Returns the next question as \"Question N of 7\", or, after the last answer, confirms the story was saved with its title and tags. Pass the user's own words; do not rewrite them. Returns an error if the session_id is unknown or expired, in which case start a new interview.",
      inputSchema: {
        type: "object",
        properties: {
          session_id: { type: "string", description: "The session_id returned by start_story_interview" },
          answer: { type: "string", description: "The user's answer to the current question" },
        },
        required: ["session_id", "answer"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "save_resume": {
        const { resume_text, resume_path } = args as { resume_text?: string; resume_path?: string };
        const text = resume_text ?? (resume_path ? await storage.readTextFile(resume_path) : undefined);
        if (!text) throw new Error("Provide either resume_text or resume_path.");
        await storage.saveResume(text);
        return textResult("Resume saved.");
      }

      case "get_resume": {
        const resume = await storage.getResume();
        return textResult(resume?.rawText ? resume.rawText : "No resume stored yet. Use save_resume first.");
      }

      case "save_voice_profile": {
        const { voice_text } = args as { voice_text: string };
        await storage.saveVoiceProfile(voice_text);
        return textResult("Voice profile saved.");
      }

      case "get_voice_profile": {
        const voice = await storage.getVoiceProfile();
        return textResult(voice ?? "No voice profile stored yet.");
      }

      case "save_jd": {
        const { company, role, jd_text, jd_path } = args as {
          company: string;
          role: string;
          jd_text?: string;
          jd_path?: string;
        };
        const text = jd_text ?? (jd_path ? await storage.readTextFile(jd_path) : undefined);
        if (!text) throw new Error("Provide either jd_text or jd_path.");
        const application = await storage.saveJD(company, role, text);
        return textResult(`Saved job description for ${company} — ${role}. Set as the active application (slug: ${application.slug}).`);
      }

      case "get_active_application": {
        const application = await storage.getActiveApplication();
        if (!application) return textResult("No active application. Use save_jd first.");
        const [resume, voice, stories] = await Promise.all([
          storage.getResume(),
          storage.getVoiceProfile(),
          storage.queryStories(),
        ]);
        const relevantStories = stories.filter((s) =>
          application.jdText.toLowerCase().split(/\W+/).some((word) => word.length > 4 && s.content.toLowerCase().includes(word))
        );
        const sections = [
          `## Active application: ${application.company} — ${application.role}`,
          "",
          "### Job description",
          application.jdText,
          "",
          "### Resume",
          resume?.rawText ? resume.rawText : "(none stored)",
          "",
          "### Voice profile",
          voice ?? "(none stored — write in a clear, direct, honest tone; avoid buzzwords and AI-sounding phrases)",
        ];
        if (relevantStories.length > 0) {
          sections.push("", "### Potentially relevant stories", ...relevantStories.map((s) => `**${s.title}** [${s.tags.join(", ")}]\n${s.content}`));
        }
        return textResult(sections.join("\n"));
      }

      case "list_applications": {
        const applications = await storage.listApplications();
        if (applications.length === 0) return textResult("No applications stored yet.");
        return textResult(
          applications.map((a) => `- ${a.company} — ${a.role} (${a.slug}, created ${a.createdAt})`).join("\n")
        );
      }

      case "save_output": {
        const { output_type, content, application_slug } = args as {
          output_type: storage.OutputType;
          content: string;
          application_slug?: string;
        };
        let slug = application_slug;
        if (!slug) {
          const active = await storage.getActiveApplication();
          if (!active) throw new Error("No active application and no application_slug provided.");
          slug = active.slug;
        }
        const filePath = await storage.saveOutput(slug, output_type, content);
        return textResult(`Saved ${output_type} to ${filePath}`);
      }

      case "export_pdf": {
        const { document, application_slug, theme, page_size } = args as {
          document?: ExportDocument;
          application_slug?: string;
          theme?: string;
          page_size?: string;
        };
        const result = await exportPdf({ document, applicationSlug: application_slug, theme, pageSize: page_size });
        return result.ok ? textResult(describeResult(result)) : { ...textResult(describeResult(result)), isError: true };
      }

      case "save_story": {
        const { title, tags, content } = args as { title: string; tags: string[]; content: string };
        const story = await storage.saveStory(title, tags, content);
        return textResult(`Story saved: ${story.title} (${story.slug})`);
      }

      case "query_stories": {
        const { tags } = args as { tags?: string[] };
        const stories = await storage.queryStories(tags);
        if (stories.length === 0) return textResult("No matching stories found.");
        return textResult(
          stories.map((s) => `**${s.title}** [${s.tags.join(", ")}]\n${s.content}`).join("\n\n---\n\n")
        );
      }

      case "start_story_interview": {
        const step = startStoryInterview();
        return textResult(`Question 1 of ${step.total_questions}:\n${step.question}\n\n(session_id: ${step.session_id})`);
      }

      case "answer_story_question": {
        const { session_id, answer } = args as { session_id: string; answer: string };
        const step = await answerStoryQuestion(session_id, answer);
        if (step.status === "complete") {
          return textResult(`Story complete and saved: "${step.story?.title}" (tags: ${step.story?.tags.join(", ")})`);
        }
        return textResult(`Question ${step.question_number} of ${step.total_questions}:\n${step.question}\n\n(session_id: ${step.session_id})`);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
  }
});

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("career-mcp server error:", err);
  process.exit(1);
});
