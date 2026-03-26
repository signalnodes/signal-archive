---
marp: true
theme: default
paginate: true
style: |
  section {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: #0a0a0a;
    color: #f0f0f0;
    padding: 48px 56px;
  }
  h1 {
    color: #ffffff;
    font-size: 2.4em;
    margin-bottom: 0.2em;
  }
  h2 {
    color: #a0a0a0;
    font-size: 0.85em;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 1.2em;
    border: none;
  }
  strong {
    color: #ffffff;
  }
  em {
    color: #888;
    font-style: normal;
  }
  ul {
    margin-top: 0.5em;
  }
  li {
    margin-bottom: 0.4em;
    color: #d0d0d0;
  }
  blockquote {
    border-left: 3px solid #444;
    padding-left: 1em;
    color: #aaa;
    font-size: 0.85em;
    margin: 1em 0;
  }
  table {
    font-size: 0.78em;
    width: 100%;
  }
  th {
    background: #1a1a1a;
    color: #888;
    font-weight: 500;
  }
  td {
    color: #d0d0d0;
    border-color: #2a2a2a;
  }
  .tag {
    color: #6ee7b7;
  }
  section.cover {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  section.cover h1 {
    font-size: 3em;
  }
---

<!-- _class: cover -->

# Deleted. Documented. Permanent.

Signal Archive monitors public figures, captures their statements, and creates cryptographic proof anchored to the Hedera Consensus Service.

**Deletion is never the last word.**

*Hedera Mainnet · Live · signalarchive.org*

---

## The Problem

# Public figures delete statements.
# Until now, deletion worked.

Cabinet officials, the President, and market-moving crypto figures have posted and quietly deleted statements with legal, financial, and political consequences.

- Screenshots can be faked, edited, and dismissed in court
- Platform archives are private, inaccessible, controlled by one company
- Journalists get stonewalled. Lawyers cannot use them. Regulators ignore them.
- **The delete button has been a tool of accountability avoidance. Until now.**

---

## The Solution

# Signal Archive makes every statement permanently provable.

We monitor high-value public figures on X/Twitter. Every tweet is archived, cryptographically hashed, and attested to the Hedera Consensus Service before anyone hits delete.

When a tweet is deleted, we know. The deletion itself is attested on-chain.

The result: an immutable, independently verifiable public record that no one — not the politician, not the platform, not us — can alter or erase.

*Public Statements. Permanent Record.*

---

## How It Works

# Four steps. Permanent proof.

1. **Continuous Monitoring** — 40 high-value accounts watched. Every tweet archived within the hour.

2. **Cryptographic Hashing** — SHA-256 hash of canonical tweet content: text, author, timestamp, media. Deterministic. Reproducible by anyone.

3. **Hedera Attestation** — Hash submitted to public HCS topic 0.0.10301350. Consensus in seconds. Permanent, timestamped forever.

4. **Deletion Detection** — Second attestation filed when deletion is detected. The record outlives the delete button.

---

## Why Hedera

# HCS is uniquely suited for this problem.

| Property | Why it matters |
|---|---|
| ~3 second finality | Attestation confirmed before a trending post disappears |
| $0.0008 per message | Viable to attest every statement, not just notable ones |
| Permanent public record | Topic 0.0.10301350 readable on HashScan by anyone |
| No smart contract needed | Pure consensus layer — simpler, cheaper, more robust |
| Independent verifiability | Any third party can verify without going through us |
| HCS-2 Topic Registry | Archive structure machine-readable, standards-compliant |

**Live today: 3,000+ attestations on Hedera mainnet. Growing every hour.**

---

## AI Severity Scoring

# Not all deletions are equal.
# Our AI knows the difference.

When a statement is deleted, **Claude Opus** automatically scores it on a 1–10 public interest severity scale.

- **Score 1–3:** Mundane corrections, typos, duplicate posts
- **Score 4–6:** Potentially significant — policy reversals, financial statements
- **Score 7–10:** Critical — legal obligations, market-moving disclosures, direct contradictions of public record

This separates signal from noise. Journalists and watchdogs go straight to what matters.

---

## Traction

# Live in production. Right now.

> **Real deletion caught — @WhiteHouse, March 20, 2026**
> Official White House account deleted a statement on TSA officers. Preserved, attested on-chain. AI severity: **7/10**. Publicly verifiable at signalarchive.org.

- 3,000+ attestations on Hedera mainnet · 40 tracked accounts
- Independent verification: any attestation verifiable on HashScan in seconds
- Supporter NFT badge (SIGBADGE) minted via **HIP-551 atomic batch transaction**
- HCS-2 topic registry live (0.0.10388911) — independently discoverable
- Signal Archive registered as AI agent on **HOL Registry** (HCS-11)

---

## Market

# The audience that needs this already exists.

**Immediate**
- Investigative journalists and newsrooms
- Government watchdog organizations (CREW, OpenSecrets, FOIA advocates)
- Legal teams in cases involving public officials
- Regulatory and compliance teams

**Growing**
- Congressional oversight staff · Academic researchers · General public

**Competitive landscape:** Politwoops (OCCRP/ProPublica) tracked deletions but was shut down by Twitter and had no cryptographic proof layer.

**Signal Archive is the only public-interest archive with independently verifiable, immutable proof. That is the moat.**

---

## Roadmap

# Phase 1 is live. The opportunity scales.

**Now — Complete**
40 accounts · HCS attestation · AI scoring · HIP-551 donations · HCS-2 registry · HOL agent registration

**Phase 2 — Government Accountability**
All 535 Congress members, agency heads, press secretaries. Bulk onboarding scripts ready.

**Phase 3 — Research API**
Paid access for journalists, researchers, legal teams. HCS proof endpoints, bulk export via Unkey.

**Phase 4 — Media Archival**
Images and video to Cloudflare R2. Currently irrecoverable when tweets are deleted.

**Phase 5 — Public Nominations**
Community-curated account tracking.

---

<!-- _class: cover -->

# The record exists.
# It cannot be erased.

Signal Archive is an independent, non-commercial public-interest archive. No ads, no subscriptions, no corporate backing. Every attested statement lives permanently on Hedera.

**Verify it yourself:**
Go to signalarchive.org · Open any archived statement · Click Verify · Confirm the hash on HashScan

*Public Statements. Permanent Record.*
