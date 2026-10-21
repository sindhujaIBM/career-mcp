#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as storage from "./storage.js";
import { startStoryInterview, answerStoryQuestion } from "./interview.js";

const server = new Server(
  { name: "career-mcp", version: "1.0.0" },
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
          resume_text: { type: "string", description: "The full resume content" },
          resume_path: { type: "string", description: "Absolute path to a .txt or .md resume file to read instead of passing raw text" },
        },
      },
    },
    {
      name: "get_resume",
      description: "Retrieve the stored base resume.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "save_voice_profile",
      description: "Store a description of the user's writing voice/tone (e.g. tone attributes, phrases to avoid, sample posts). Used to keep generated cover letters and LinkedIn About sections sounding like the user, not generic AI copy.",
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
      description: "Retrieve the stored voice profile, if one has been saved.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "save_jd",
      description: "Store a job description for a company/role and mark it as the active application. Creates a new application record. Provide exactly one of jd_text or jd_path.",
      inputSchema: {
        type: "object",
        properties: {
          company: { type: "string" },
          role: { type: "string" },
          jd_text: { type: "string", description: "The full job description text" },
          jd_path: { type: "string", description: "Absolute path to a .txt or .md job description file to read instead of passing raw text" },
        },
        required: ["company", "role"],
      },
    },
    {
      name: "get_active_application",
      description: "Returns the stored resume, voice profile, and the active job description together, as context for match analysis or content generation. Use this to: (1) run match analysis — identify genuine overlaps and honest gaps between the resume and JD, not keyword stuffing; (2) draft a tailored resume by reordering/reframing existing resume content for relevance, never fabricating experience; (3) draft a cover letter; (4) draft a LinkedIn About section. Match the voice profile's tone if one is set. Save any generated output with save_output.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_applications",
      description: "List all stored applications (company, role, created date).",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "save_output",
      description: "Persist generated content (match analysis, tailored resume, cover letter, or LinkedIn About draft) for an application. Defaults to the active application if application_slug is omitted.",
      inputSchema: {
        type: "object",
        properties: {
          output_type: {
            type: "string",
            enum: ["match_analysis", "tailored_resume", "cover_letter", "linkedin_about"],
          },
          content: { type: "string" },
          application_slug: { type: "string", description: "Optional — defaults to the active application" },
        },
        required: ["output_type", "content"],
      },
    },
    {
      name: "save_story",
      description: "Save a career story directly (title, tags, content) without running the interview flow. Prefer start_story_interview for a guided capture.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          content: { type: "string" },
        },
        required: ["title", "tags", "content"],
      },
    },
    {
      name: "query_stories",
      description: "Retrieve saved career stories, optionally filtered by tag (e.g. leadership, conflict, failure-recovery, technical-deep-dive). Use to find a story relevant to a JD requirement, an interview-prep question, or a LinkedIn post idea.",
      inputSchema: {
        type: "object",
        properties: {
          tags: { type: "array", items: { type: "string" }, description: "Optional tag filter" },
        },
      },
    },
    {
      name: "start_story_interview",
      description: "Begin a structured interview to capture one new career story. Returns the first question and a session_id. Keep calling answer_story_question with that session_id, relaying each returned question to the user verbatim, until status is 'complete' — the story is then auto-saved.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "answer_story_question",
      description: "Submit the user's answer to the current interview question and get the next one (or the completed, saved story).",
      inputSchema: {
        type: "object",
        properties: {
          session_id: { type: "string" },
          answer: { type: "string" },
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
        return textResult(resume ? resume.rawText : "No resume stored yet. Use save_resume first.");
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
          resume ? resume.rawText : "(none stored)",
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
