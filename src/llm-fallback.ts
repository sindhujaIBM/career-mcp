// Only used by the standalone CLI (src/cli.ts). The MCP server itself never
// calls an LLM — it relies on the host (Claude Code/Desktop, etc.) to reason
// over the data these tools return. This file exists for people running
// career-mcp without an MCP-capable client. It always uses YOUR OWN API key —
// career-mcp never calls a shared/hosted key, so there's no cost or liability
// on the maintainer's side.

type Provider = "groq" | "gemini";

function getProvider(): Provider {
  const provider = (process.env.CAREER_MCP_LLM_PROVIDER || "groq").toLowerCase();
  if (provider !== "groq" && provider !== "gemini") {
    throw new Error(`Unknown CAREER_MCP_LLM_PROVIDER: ${provider}. Use "groq" or "gemini".`);
  }
  return provider;
}

function getApiKey(): string {
  const key = process.env.CAREER_MCP_API_KEY;
  if (!key) {
    throw new Error(
      "CAREER_MCP_API_KEY is not set. The standalone CLI needs your own API key " +
      "(a free-tier Groq or Gemini key both work) — see .env.example."
    );
  }
  return key;
}

async function callGroq(systemPrompt: string, userPrompt: string): Promise<string> {
  const model = process.env.CAREER_MCP_LLM_MODEL || "llama-3.3-70b-versatile";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Groq API error (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const model = process.env.CAREER_MCP_LLM_MODEL || "gemini-2.0-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${getApiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Gemini API error (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const provider = getProvider();
  return provider === "groq" ? callGroq(systemPrompt, userPrompt) : callGemini(systemPrompt, userPrompt);
}
