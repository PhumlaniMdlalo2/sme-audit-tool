import Anthropic from "@anthropic-ai/sdk";
import type { Finding } from "./types";

interface Explanation {
  id: string;
  plainEnglish: string;
  howToFix: string;
}

/**
 * Turns raw technical findings into plain-English explanations a non-technical
 * SME owner can act on. Degrades gracefully to the raw findings (no plain-English
 * fields) if no API key is configured or the call fails — the scan still works
 * without this, it's just less friendly.
 */
export async function explainFindings(findings: Finding[]): Promise<Finding[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || findings.length === 0) return findings;

  const client = new Anthropic({ apiKey });
  const input = findings.map((f) => ({ id: f.id, title: f.title, severity: f.severity, category: f.category, detail: f.detail }));

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `You are writing a website audit report for a small business owner with no technical background.

For each finding below, write:
- "plainEnglish": 1-2 plain sentences explaining what it means and why it matters to their business. No jargon. For "good" severity findings, briefly say why it's fine.
- "howToFix": 1-3 short numbered steps to fix it. Empty string for "good" severity findings.

Findings (JSON):
${JSON.stringify(input, null, 2)}

Respond with ONLY a JSON array, no other text: [{"id": "...", "plainEnglish": "...", "howToFix": "..."}]`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return findings;

    const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return findings;

    const explanations: Explanation[] = JSON.parse(jsonMatch[0]);
    const byId = new Map(explanations.map((e) => [e.id, e]));

    return findings.map((f) => {
      const e = byId.get(f.id);
      return e ? { ...f, plainEnglish: e.plainEnglish, howToFix: e.howToFix } : f;
    });
  } catch {
    return findings;
  }
}
