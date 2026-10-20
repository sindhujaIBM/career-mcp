import { randomUUID } from "node:crypto";
import { saveStory, type Story } from "./storage.js";

interface Question {
  key: string;
  prompt: string;
}

const QUESTIONS: Question[] = [
  {
    key: "scene",
    prompt: "What's a specific moment you're thinking of? Set the scene — your role, the team, roughly when this was.",
  },
  {
    key: "situation",
    prompt: "What was the problem or goal, and why did it actually matter?",
  },
  {
    key: "action",
    prompt: "What did you specifically do? Walk through your own actions, not the team's.",
  },
  {
    key: "result",
    prompt: "What happened as a result? Include real numbers or concrete outcomes if you have them.",
  },
  {
    key: "reflection",
    prompt: "Looking back, what's the honest tradeoff, or the thing you'd do differently?",
  },
  {
    key: "tags",
    prompt: "What would you tag this story as? (comma-separated, e.g. leadership, conflict, technical-deep-dive, failure-recovery)",
  },
  {
    key: "title",
    prompt: "Give this story a short title (3-6 words) so you can find it again later.",
  },
];

interface Session {
  index: number;
  answers: Record<string, string>;
}

const sessions = new Map<string, Session>();

export interface InterviewStep {
  session_id: string;
  status: "in_progress" | "complete";
  question?: string;
  question_number?: number;
  total_questions?: number;
  story?: Story;
}

export function startStoryInterview(): InterviewStep {
  const session_id = randomUUID();
  sessions.set(session_id, { index: 0, answers: {} });
  return {
    session_id,
    status: "in_progress",
    question: QUESTIONS[0].prompt,
    question_number: 1,
    total_questions: QUESTIONS.length,
  };
}

export async function answerStoryQuestion(session_id: string, answer: string): Promise<InterviewStep> {
  const session = sessions.get(session_id);
  if (!session) {
    throw new Error(`No interview session found for session_id: ${session_id}. Start a new one with start_story_interview.`);
  }

  const current = QUESTIONS[session.index];
  session.answers[current.key] = answer;
  session.index += 1;

  if (session.index < QUESTIONS.length) {
    const next = QUESTIONS[session.index];
    return {
      session_id,
      status: "in_progress",
      question: next.prompt,
      question_number: session.index + 1,
      total_questions: QUESTIONS.length,
    };
  }

  const { scene, situation, action, result, reflection, tags, title } = session.answers;
  const content = [
    `**Scene:** ${scene}`,
    "",
    `**Situation:** ${situation}`,
    "",
    `**Action:** ${action}`,
    "",
    `**Result:** ${result}`,
    "",
    `**Reflection:** ${reflection}`,
  ].join("\n");
  const storyTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
  const story = await saveStory(title, storyTags, content);

  sessions.delete(session_id);

  return { session_id, status: "complete", story };
}
