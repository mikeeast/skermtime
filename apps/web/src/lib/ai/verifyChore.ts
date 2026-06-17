import Anthropic from "@anthropic-ai/sdk";

export type ChoreVerdict = {
  done: boolean;
  confidence: number; // 0..1
  reason: string;
};

/** Whether AI verification is configured (ANTHROPIC_API_KEY present). */
export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Pure: turn an AI verdict into an approval decision. Unit-tested. */
export function decideFromVerdict(
  verdict: ChoreVerdict,
  threshold = 0.8,
): "ai_approved" | "parent" {
  return verdict.done && verdict.confidence >= threshold ? "ai_approved" : "parent";
}

// Default to Opus; set ANTHROPIC_MODEL=claude-haiku-4-5 for cheaper checks.
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    done: {
      type: "boolean",
      description: "True if the photos genuinely show the chore completed.",
    },
    confidence: { type: "number", description: "Confidence between 0 and 1." },
    reason: { type: "string", description: "Short explanation (Swedish) for the parent." },
  },
  required: ["done", "confidence", "reason"],
  additionalProperties: false,
} as const;

/**
 * Ask Claude (vision) whether before/after photos show the chore done.
 * Uses structured outputs so the response is a clean verdict object.
 */
export async function verifyChorePhotos(input: {
  choreName: string;
  beforeUrl?: string | null;
  afterUrl: string;
}): Promise<ChoreVerdict> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text:
        `En syssla ska verifieras: "${input.choreName}". ` +
        (input.beforeUrl
          ? "Första bilden är FÖRE, andra är EFTER. Bedöm om sysslan faktiskt är gjord."
          : "Bilden visar resultatet. Bedöm om sysslan faktiskt är gjord."),
    },
  ];
  if (input.beforeUrl) {
    content.push({ type: "image", source: { type: "url", url: input.beforeUrl } });
  }
  content.push({ type: "image", source: { type: "url", url: input.afterUrl } });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: VERDICT_SCHEMA } },
  } as unknown as Anthropic.MessageCreateParamsNonStreaming);

  const text =
    response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";
  return JSON.parse(text) as ChoreVerdict;
}
