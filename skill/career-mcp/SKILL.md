---
name: career-mcp
description: Job-application workflow on top of the free, open-source career-mcp MCP server. Use when the user wants to match their resume against a job description, tailor a resume for a specific role, export a resume or cover letter to PDF, write a cover letter, draft a LinkedIn About section, or capture career stories for interviews. Everything is stored locally on the user's machine.
---

# career-mcp: resume tailoring, PDF export, and career stories

This skill tells you when and how to use the **career-mcp** MCP server's tools. The server stores the user's data and returns it as context. You do the analysis and the writing.

The server is free and MIT-licensed: https://github.com/sindhujaIBM/career-mcp

## Setup (one time, done by the user)

Check whether the career-mcp tools (`save_resume`, `save_jd`, `get_active_application`, and the rest) are available. If they aren't, explain that this skill needs the career-mcp server, and ask the user to:

1. Install it: `npm install -g @sindhujaks/career-mcp`
2. Add it to their agent's MCP config. For example, in Claude Code: `claude mcp add career-mcp -- career-mcp`
3. Restart the agent.

Do not install it for them unless they ask you to. Do not continue the workflows below until the tools are available.

Data lives in `~/.career-mcp` on the user's machine. Nothing is uploaded by the server.

## Ground rules

- **Never invent experience.** Tailoring means reordering, reframing, and choosing what to emphasize from the user's real resume and stories. If the job description asks for something the user doesn't have, say so plainly. Don't paper over it.
- **Be honest in match analysis.** Name real overlaps and real gaps. No keyword stuffing.
- **Use the user's voice.** If a voice profile is saved, follow it. If not, write clearly and directly, with no buzzwords and no AI-sounding phrases.
- **Ask before overwriting.** `save_resume` replaces the stored base resume. Confirm with the user first if one already exists.
- **Cover letters are opt-in.** Write or export one only when the user asks.

## Workflow 1: first-time profile

1. Ask for the user's resume. They can give a file path (PDF, .txt, or .md) or paste the text. Call `save_resume` with `resume_path` or `resume_text`.
2. Offer to save a voice profile: how they like to sound, words or phrases to avoid, a sample of their writing. Save it with `save_voice_profile`.
3. Optionally, offer to capture a career story (Workflow 4). Stories make tailored resumes and cover letters much stronger.

## Workflow 2: apply to a job

1. **Save the job.** Get the company, role, and job description (file path or pasted text). Call `save_jd`. It becomes the active application.
2. **Load the context.** Call `get_active_application`. It returns the resume, job description, voice profile, any relevant stories, and the markdown format resumes must follow.
3. **Match analysis first.** Before writing anything, tell the user:
   - which required qualifications they meet, partly meet, or don't meet, each with evidence from their resume
   - which preferred qualifications match
   - an honest verdict: is this worth applying to, and what should the resume lead with?

   Save it with `save_output` (`output_type: "match_analysis"`). Then ask whether they want to go ahead.
4. **Tailored resume.** Write it in exactly the markdown shape `get_active_application` describes: `# Name`, a tagline line, a contact line, then `##` sections and `### Title — Company` with an italic date line. Output only the resume, with no commentary. Save it with `save_output` (`output_type: "tailored_resume"`).
5. **Export to PDF.** Call `export_pdf`. Ask which look they prefer if they haven't said:
   - `navy` (default): modern sans-serif with navy accents
   - `minimal`: monochrome and compact
   - `classic`: serif with a centered header

   Use `page_size: "a4"` for users outside North America. Tell the user where the PDF was saved.

   If the tool reports that no browser was found, pass on its message: they can install Chrome, Edge, Chromium, or Brave, or open the saved HTML file and use Print → Save as PDF.
6. **Cover letter (only if asked).** Write it in the user's voice, then save it with `save_output` (`output_type: "cover_letter"`). Export it with `export_pdf` and `document: "cover_letter"` if they want a PDF.

To edit later, the user can change the saved markdown and you call `export_pdf` again. The markdown is the source of truth. `save_output` overwrites the earlier output of the same type for that application, so mention this before regenerating something the user has edited.

Use `list_applications` to see past applications. Pass `application_slug` to `save_output` or `export_pdf` to work on one that isn't active.

## Workflow 3: LinkedIn About section

1. Call `get_resume`, `get_voice_profile`, and `query_stories`.
2. Draft an About section that sounds like the user: first person, concrete, built on real stories. Keep it to a few short paragraphs.
3. Save it with `save_output` (`output_type: "linkedin_about"`). It needs an active application; if there isn't one, show the draft without saving it.
4. The user pastes it into LinkedIn themselves. This skill doesn't edit LinkedIn profiles.

## Workflow 4: capture a career story

1. Call `start_story_interview`. It returns the first question and a `session_id`.
2. Ask the user each question **exactly as returned**. Don't rephrase it, merge questions, or answer for the user.
3. Pass each answer to `answer_story_question` with the same `session_id` until the status is `complete`. The story is saved automatically.
4. Later, use `query_stories` with tags (for example `leadership`, `conflict`, `failure-recovery`, `technical-deep-dive`) to find stories for a job requirement, an interview question, or a post idea.

If the user already has a story written up, save it directly with `save_story`.

## Tool reference

| Tool | Use it to |
|---|---|
| `save_resume` / `get_resume` | Store or read the base resume |
| `save_voice_profile` / `get_voice_profile` | Store or read the user's tone and style |
| `save_jd` | Store a job description and make it the active application |
| `get_active_application` | Get resume + JD + voice + relevant stories + resume format |
| `list_applications` | List stored applications |
| `save_output` | Save a match analysis, tailored resume, cover letter, or LinkedIn About |
| `export_pdf` | Render a tailored resume, cover letter, or base resume to PDF |
| `save_story` / `query_stories` | Save or find career stories |
| `start_story_interview` / `answer_story_question` | Guided story capture |
