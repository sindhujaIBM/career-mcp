import { mkdir, readFile, writeFile, readdir, access } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const DATA_DIR = process.env.CAREER_MCP_DATA_DIR || path.join(os.homedir(), ".career-mcp");
const STORIES_DIR = path.join(DATA_DIR, "stories");
const APPLICATIONS_DIR = path.join(DATA_DIR, "applications");
const RESUME_PATH = path.join(DATA_DIR, "resume.json");
const VOICE_PROFILE_PATH = path.join(DATA_DIR, "voice_profile.md");
const ACTIVE_APPLICATION_PATH = path.join(DATA_DIR, "active_application.json");

export interface Resume {
  rawText: string;
  updatedAt: string;
}

export interface Story {
  slug: string;
  title: string;
  tags: string[];
  content: string;
  createdAt: string;
}

export interface Application {
  slug: string;
  company: string;
  role: string;
  jdText: string;
  createdAt: string;
}

export type OutputType = "match_analysis" | "tailored_resume" | "cover_letter" | "linkedin_about";

async function ensureDirs(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(STORIES_DIR, { recursive: true });
  await mkdir(APPLICATIONS_DIR, { recursive: true });
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function readTextFile(filePath: string): Promise<string> {
  const expanded = filePath.startsWith("~") ? path.join(os.homedir(), filePath.slice(1)) : filePath;
  const resolved = path.resolve(expanded);
  if (resolved.toLowerCase().endsWith(".pdf")) {
    throw new Error(`Cannot read PDF files directly (${resolved}). Export it to .txt or .md first.`);
  }
  return readFile(resolved, "utf8");
}

export async function saveResume(rawText: string): Promise<Resume> {
  await ensureDirs();
  const resume: Resume = { rawText, updatedAt: new Date().toISOString() };
  await writeFile(RESUME_PATH, JSON.stringify(resume, null, 2), "utf8");
  return resume;
}

export async function getResume(): Promise<Resume | null> {
  if (!(await exists(RESUME_PATH))) return null;
  return JSON.parse(await readFile(RESUME_PATH, "utf8"));
}

export async function saveVoiceProfile(text: string): Promise<void> {
  await ensureDirs();
  await writeFile(VOICE_PROFILE_PATH, text, "utf8");
}

export async function getVoiceProfile(): Promise<string | null> {
  if (!(await exists(VOICE_PROFILE_PATH))) return null;
  return readFile(VOICE_PROFILE_PATH, "utf8");
}

export async function saveStory(title: string, tags: string[], content: string): Promise<Story> {
  await ensureDirs();
  const slug = `${slugify(title)}-${Date.now().toString(36)}`;
  const story: Story = { slug, title, tags, content, createdAt: new Date().toISOString() };
  const frontmatter = [
    "---",
    `title: ${title}`,
    `tags: ${tags.join(", ")}`,
    `createdAt: ${story.createdAt}`,
    "---",
    "",
    content,
  ].join("\n");
  await writeFile(path.join(STORIES_DIR, `${slug}.md`), frontmatter, "utf8");
  return story;
}

export async function queryStories(tags?: string[]): Promise<Story[]> {
  await ensureDirs();
  const files = (await readdir(STORIES_DIR)).filter((f) => f.endsWith(".md"));
  const stories: Story[] = [];
  for (const file of files) {
    const raw = await readFile(path.join(STORIES_DIR, file), "utf8");
    const match = raw.match(/^---\ntitle: (.*)\ntags: (.*)\ncreatedAt: (.*)\n---\n\n([\s\S]*)$/);
    if (!match) continue;
    const [, title, tagsLine, createdAt, content] = match;
    const storyTags = tagsLine.split(",").map((t) => t.trim()).filter(Boolean);
    stories.push({ slug: file.replace(/\.md$/, ""), title, tags: storyTags, content, createdAt });
  }
  if (!tags || tags.length === 0) return stories;
  const wanted = tags.map((t) => t.toLowerCase());
  return stories.filter((s) => s.tags.some((t) => wanted.includes(t.toLowerCase())));
}

export async function saveJD(company: string, role: string, jdText: string): Promise<Application> {
  await ensureDirs();
  const slug = slugify(`${company}-${role}`);
  const appDir = path.join(APPLICATIONS_DIR, slug);
  await mkdir(path.join(appDir, "outputs"), { recursive: true });
  const application: Application = { slug, company, role, jdText, createdAt: new Date().toISOString() };
  await writeFile(path.join(appDir, "jd.json"), JSON.stringify(application, null, 2), "utf8");
  await writeFile(ACTIVE_APPLICATION_PATH, JSON.stringify({ slug }, null, 2), "utf8");
  return application;
}

export async function getApplication(slug: string): Promise<Application | null> {
  const p = path.join(APPLICATIONS_DIR, slug, "jd.json");
  if (!(await exists(p))) return null;
  return JSON.parse(await readFile(p, "utf8"));
}

export async function getActiveApplication(): Promise<Application | null> {
  if (!(await exists(ACTIVE_APPLICATION_PATH))) return null;
  const { slug } = JSON.parse(await readFile(ACTIVE_APPLICATION_PATH, "utf8"));
  return getApplication(slug);
}

export async function listApplications(): Promise<Application[]> {
  await ensureDirs();
  const dirs = await readdir(APPLICATIONS_DIR);
  const applications: Application[] = [];
  for (const dir of dirs) {
    const application = await getApplication(dir);
    if (application) applications.push(application);
  }
  return applications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveOutput(slug: string, type: OutputType, content: string): Promise<string> {
  const appDir = path.join(APPLICATIONS_DIR, slug, "outputs");
  await mkdir(appDir, { recursive: true });
  const filePath = path.join(appDir, `${type}.md`);
  await writeFile(filePath, content, "utf8");
  return filePath;
}

export async function getOutput(slug: string, type: OutputType): Promise<string | null> {
  const filePath = path.join(APPLICATIONS_DIR, slug, "outputs", `${type}.md`);
  if (!(await exists(filePath))) return null;
  return readFile(filePath, "utf8");
}
