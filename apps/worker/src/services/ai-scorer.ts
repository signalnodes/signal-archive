/**
 * AI Severity Scorer: evaluates deleted tweets for public interest significance.
 *
 * Uses Claude 3.5 Haiku for structured scoring (1-10 scale) with reasoning.
 * Falls back to a rules-based heuristic when the LLM is unavailable.
 *
 * Every scoring decision can be attested to HCS, making the AI itself accountable.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ScoringContext, ScoringResult } from "@taa/shared";
import {
  HIGH_ACCOUNTABILITY_CATEGORIES,
  SEVERITY_CATEGORY_TAGS,
} from "@taa/shared";

// ---------------------------------------------------------------------------
// LLM client (lazy-init)
// ---------------------------------------------------------------------------

let _client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

const MODEL = "claude-opus-4-6";
const TIMEOUT_MS = 8_000; // hard timeout, never blocks deletion detection

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an AI analyst for Signal Archive, a public accountability platform that monitors tweets from public figures and detects deletions.

You will be given a deleted tweet along with context about who posted it and when. Your job is to assess the PUBLIC INTEREST SIGNIFICANCE of this deletion on a scale of 1-10.

Scoring guide:
- 1-2: Mundane (typos, casual remarks, duplicate posts, routine social media behavior)
- 3-4: Mildly notable (opinion changes, minor walkbacks, broken links)
- 5-6: Moderately significant (policy hints, market-relevant statements, contradictions with public positions, deleted promises)
- 7-8: Highly significant (potential legal implications, evidence of coordination, broken promises to constituents, market manipulation signals)
- 9-10: Critical public interest (threats, admissions, obstruction signals, statements that may be legally required to preserve under the Presidential Records Act or Federal Records Act)

Consider these factors:
1. WHO deleted it: government officials with records preservation obligations score higher than private individuals
2. WHAT was said: content relating to policy, financial markets, legal matters, or public trust scores higher
3. WHEN it was deleted: rapid deletion (< 1 hour) suggests damage control; very late deletion (weeks/months) suggests history scrubbing
4. WHY it might have been deleted: infer likely motive from content and context

You MUST respond with valid JSON only, no markdown fences, no preamble:
{
  "severity": <integer 1-10>,
  "category_tags": ["<tag1>", "<tag2>"],
  "reasoning": "<2-3 sentence explanation>",
  "confidence": <float 0.0-1.0>
}

Allowed category tags: ${SEVERITY_CATEGORY_TAGS.filter((t) => t !== "heuristic_scored").join(", ")}`;

// ---------------------------------------------------------------------------
// User prompt builder
// ---------------------------------------------------------------------------

function buildUserPrompt(ctx: ScoringContext): string {
  return `DELETED TWEET:
- Author: @${ctx.username}${ctx.displayName ? ` (${ctx.displayName})` : ""}
- Account category: ${ctx.category}${ctx.subcategory ? ` / ${ctx.subcategory}` : ""}
- Content: "${ctx.content}"
- Originally posted: ${ctx.postedAt}
- Deleted after: ${ctx.tweetAgeHours} hours
- Tweet type: ${ctx.tweetType}
- Has media: ${ctx.hasMedia ? "yes" : "no"}`;
}

// ---------------------------------------------------------------------------
// LLM scoring
// ---------------------------------------------------------------------------

async function scoreDeletionWithLLM(
  client: Anthropic,
  ctx: ScoringContext
): Promise<ScoringResult> {
  const start = Date.now();

  const response = await Promise.race([
    client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(ctx) }],
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI scoring timeout")), TIMEOUT_MS)
    ),
  ]);

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Parse JSON, strip markdown fences if the model wraps it
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const parsed = JSON.parse(cleaned);

  // Validate + clamp
  const severity = Math.min(10, Math.max(1, Math.round(parsed.severity ?? 5)));
  const confidence = Math.min(1, Math.max(0, parsed.confidence ?? 0.5));
  const categoryTags: string[] = Array.isArray(parsed.category_tags)
    ? parsed.category_tags.filter((t: string) =>
        (SEVERITY_CATEGORY_TAGS as readonly string[]).includes(t)
      )
    : [];
  const reasoning =
    typeof parsed.reasoning === "string"
      ? parsed.reasoning.slice(0, 1500)
      : "";

  return {
    severity,
    categoryTags,
    reasoning,
    confidence,
    model: MODEL,
    scoredAt: new Date().toISOString(),
    latencyMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Heuristic fallback
// ---------------------------------------------------------------------------

export function heuristicScore(ctx: ScoringContext): ScoringResult {
  const start = Date.now();
  let score = 3; // baseline

  // Who factor
  if (
    (HIGH_ACCOUNTABILITY_CATEGORIES as readonly string[]).includes(ctx.category)
  ) {
    score += 2;
  } else if (["wlfi", "crypto_industry"].includes(ctx.category)) {
    score += 1;
  }

  // Speed of deletion
  if (ctx.tweetAgeHours < 1) score += 2; // deleted within an hour, likely damage control
  else if (ctx.tweetAgeHours < 6) score += 1;

  // Content signals
  const lower = ctx.content.toLowerCase();
  // Financial / ticker mentions
  if (/\$[A-Z]{2,}/.test(ctx.content)) score += 1;
  // Legal / investigation language
  if (
    /classified|subpoena|investigation|lawsuit|indictment|warrant|testimony/.test(
      lower
    )
  )
    score += 2;
  // Self-referential deletion language
  if (/delete|remove|never said|i didn't|that's fake/.test(lower)) score += 1;
  // Threats or coercion
  if (/threat|destroy|retaliate|consequences|you'll regret/.test(lower))
    score += 2;
  // Promise / commitment
  if (/i promise|i will|we will|i guarantee|committed to/.test(lower))
    score += 1;

  return {
    severity: Math.min(10, Math.max(1, score)),
    categoryTags: ["heuristic_scored"],
    reasoning:
      "AI scoring unavailable; heuristic score based on author category, deletion speed, and content keyword signals.",
    confidence: 0.3,
    model: "heuristic-v1",
    scoredAt: new Date().toISOString(),
    latencyMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score a deleted tweet's public interest significance.
 *
 * Attempts LLM-based scoring via Claude Haiku; falls back to heuristic
 * on any failure (API error, timeout, missing key, parse error).
 */
export async function scoreDeletion(
  ctx: ScoringContext
): Promise<ScoringResult> {
  // Feature flag, allow disabling AI scoring at runtime
  if (process.env.AI_SCORING_ENABLED === "false") {
    return heuristicScore(ctx);
  }

  const client = getClient();
  if (!client) {
    console.warn("[ai-scorer] No ANTHROPIC_API_KEY set, using heuristic");
    return heuristicScore(ctx);
  }

  try {
    return await scoreDeletionWithLLM(client, ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ai-scorer] LLM scoring failed (${msg}), using heuristic`);
    return heuristicScore(ctx);
  }
}
