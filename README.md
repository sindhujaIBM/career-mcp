# career-mcp

An MCP server for the job-search loop: store a resume, drop in a job description, get a real match analysis, a tailored resume, a cover letter, a LinkedIn About section — plus a structured interview that captures your career stories so they're ready to reuse.

Local-first. Your resume and stories live in a folder on your machine (`~/.career-mcp` by default) — nothing is uploaded anywhere.

## How it works

The MCP server itself doesn't call any LLM. It's a data layer: it stores your resume, job descriptions, voice profile, and stories, and hands them back as context. The actual reasoning — match analysis, tailoring, writing — is done by whatever MCP-capable client you're using (Claude Code, Claude Desktop, etc.), the same way any tool-using conversation works.

If you don't have an MCP client, the bundled CLI (`career-mcp-cli`) does the same job standalone, using your own Groq or Gemini API key (both have usable free tiers) to do the reasoning itself.

## Install

```bash
npm install -g @sindhujaks/career-mcp
```

## Use with an MCP client (recommended)

Add to your client's MCP config (e.g. `.mcp.json` for Claude Code):

```json
{
  "mcpServers": {
    "career-mcp": {
      "command": "career-mcp"
    }
  }
}
```

Then, in conversation: save your resume, save a JD, and ask your client to run a match analysis, draft a tailored resume, write a cover letter, or draft a LinkedIn About. Say "let's capture a career story" to run the guided interview.

### Tools

| Tool | Purpose |
|---|---|
| `save_resume` / `get_resume` | Store/retrieve your base resume |
| `save_voice_profile` / `get_voice_profile` | Store tone/style guidance so generated content sounds like you |
| `save_jd` | Store a job description, sets it as the active application |
| `get_active_application` | Bundles resume + JD + voice profile + relevant stories as context |
| `list_applications` | List all stored applications |
| `save_output` | Persist a generated match analysis / resume / cover letter / About section |
| `save_story` / `query_stories` | Save/retrieve career stories, filterable by tag |
| `start_story_interview` / `answer_story_question` | Guided, protocol-driven interview to capture one new story |

## Use standalone (no MCP client)

```bash
cp .env.example .env   # fill in CAREER_MCP_API_KEY (free Groq or Gemini key)

career-mcp-cli set-resume --file resume.txt
career-mcp-cli set-jd --company Acme --role "Senior Engineer" --file jd.txt
career-mcp-cli analyze
career-mcp-cli resume
career-mcp-cli cover-letter
career-mcp-cli about
career-mcp-cli interview   # guided story capture
```

## Data layout

```
~/.career-mcp/
├── resume.json
├── voice_profile.md
├── stories/<slug>.md
└── applications/<company-role>/
    ├── jd.json
    └── outputs/{match_analysis,tailored_resume,cover_letter,linkedin_about}.md
```

Override the location with `CAREER_MCP_DATA_DIR`.

## License

MIT
