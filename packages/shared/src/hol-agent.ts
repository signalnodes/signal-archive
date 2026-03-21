/**
 * Signal Archive — HOL Registry Broker agent profile constants.
 * Plain data only, no SDK imports (safe for worker bundle).
 *
 * HCS11 profile type values:
 *   type 1 = AI_AGENT
 *   aiAgent.type 0 = MANUAL
 *
 * AIAgentCapability numeric values used here:
 *   6  = SUMMARIZATION_EXTRACTION
 *   7  = KNOWLEDGE_RETRIEVAL
 *   8  = DATA_INTEGRATION
 *   13 = SECURITY_MONITORING
 *   14 = COMPLIANCE_ANALYSIS
 */

export const HOL_AGENT_PROFILE = {
  version: "1.0" as const,
  type: 1, // AI_AGENT
  display_name: "Signal Archive",
  alias: "signal-archive",
  bio: "Monitors public officials on X/Twitter for deleted content. Every deletion is cryptographically attested on the Hedera Consensus Service — permanent, tamper-proof public record.",
  socials: {
    twitter: "@signalarchives",
  },
  properties: {
    tags: [
      "tweet-deletion-monitoring",
      "hcs-attestation",
      "political-accountability",
      "public-record",
      "hedera",
    ],
  },
  aiAgent: {
    type: 0, // MANUAL — responds to queries, not autonomous
    capabilities: [6, 7, 8, 13, 14],
    model: "claude-haiku-3-5",
    creator: "Signal Archive",
  },
} as const;

export const HOL_AGENT_ENDPOINT =
  "https://signalarchive.org/api/agent/chat" as const;

export const HOL_COMMUNICATION_PROTOCOL = "custom" as const;
