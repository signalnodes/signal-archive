# Signal Archive - Pitch Deck Draft

---

## SLIDE 1 - Hook

**Deleted. Documented. Permanent.**

Signal Archive monitors public figures, captures their statements, and creates cryptographic proof anchored to the Hedera Consensus Service. Deletion is never the last word.

*Hedera Mainnet · Live*

---

## SLIDE 2 - Problem

**Public figures delete statements. Until now, deletion worked.**

Cabinet officials, the President, and market-moving crypto figures have posted and quietly deleted statements with legal, financial, and political consequences.

The problem: there is no proof.

- Screenshots can be faked, edited, and dismissed in court
- Platform archives are private, inaccessible, and controlled by one company
- Journalists get stonewalled. Lawyers cannot use them. Regulators ignore them.
- The delete button has been a tool of accountability avoidance. Until now.

---

## SLIDE 3 - Solution

**Signal Archive makes every statement permanently provable.**

We monitor high-value public figures on X/Twitter. Every tweet is archived, cryptographically hashed, and attested to the Hedera Consensus Service before anyone hits delete.

When a tweet is deleted, we know. The deletion itself is attested on-chain.

The result: an immutable, independently verifiable public record that no one, not the politician, not the platform, not us, can alter or erase.

*Public Statements. Permanent Record.*

---

## SLIDE 4 - How It Works

**Four steps. Permanent proof.**

1. **Continuous Monitoring**
   Our worker monitors 40 high-value accounts. Every new tweet is archived to our database within the hour of posting.

2. **Cryptographic Hashing**
   A SHA-256 hash is computed from a canonical representation of the tweet: content, author, timestamp, media. Deterministic. Reproducible by anyone.

3. **Hedera Attestation**
   The hash is submitted to a public HCS topic (0.0.10301350). Hedera reaches consensus in seconds. The attestation is permanent, public, and timestamped forever.

4. **Deletion Detection**
   When a deletion is detected, a second attestation is submitted confirming the statement existed and is now gone. The deletion is never the last word.

---

## SLIDE 5 - Why Hedera

**Hedera's HCS is uniquely suited for this problem.**

Other blockchains are overkill, expensive, or slow. HCS is exactly right:

| Property | Why it matters |
|---|---|
| ~3 second finality | Attestation confirmed before a trending tweet disappears |
| $0.0008 per message | Economically viable to attest every statement, not just notable ones |
| Permanent public record | Anyone can read topic 0.0.10301350 on HashScan. No trust required. |
| No smart contract needed | Pure consensus layer. Simpler, cheaper, more robust. |
| Independent verifiability | Any third party can verify a hash against HCS without going through us |
| HCS-2 Topic Registry | Archive structure published through the HCS-2 standard — machine-readable and discoverable by third parties without relying on this website |

Live today: 3,000+ attestations on Hedera mainnet. Growing every hour.

---

## SLIDE 6 - AI Severity Scoring

**Not all deletions are equal. Our AI knows the difference.**

When a statement is deleted, Claude AI automatically scores it on a 1-10 public interest severity scale.

- Score 1-3: Mundane corrections, typos, duplicate posts
- Score 4-6: Potentially significant. Policy reversals, financial statements.
- Score 7-10: Critical. Legal obligations, market-moving disclosures, direct contradictions of public record.

This separates signal from noise. Journalists and watchdogs surface to what matters instead of wading through dozens of daily posts from 40 accounts.

Heuristic fallback ensures scoring works even without API access.

---

## SLIDE 7 - Traction

**Live in production. Right now.**

- signalarchive.org: public, live, no login required
- 3,000+ attestations on Hedera mainnet topic 0.0.10301350
- 40 tracked accounts: Trump family, cabinet officials, White House, federal agencies, key crypto figures
- Independent verification: any attestation verifiable on HashScan in seconds
- Supporter tier: donors receive an NFT badge (SIGBADGE, token 0.0.10314265) minted via HIP-551 atomic batch transaction
- HCS-2 topic registry live on mainnet (0.0.10388911): archive structure independently discoverable and standards-compliant

Try it: go to signalarchive.org, open any archived statement, click Verify, confirm the hash on HashScan yourself.

No trust required. That is the point.

---

## SLIDE 8 - Market

**The audience that needs this already exists.**

Immediate:
- Investigative journalists and newsrooms
- Government watchdog organizations (CREW, FOIA advocates, OpenSecrets)
- Legal teams in cases involving public officials
- Regulatory and compliance teams

Growing:
- Congressional oversight staff
- Academic researchers studying political communication
- The general public during high-stakes political moments

Competitive landscape: Politwoops (OCCRP/ProPublica) tracked politician deletions but was shut down by Twitter and had no cryptographic proof layer. Signal Archive is the only public-interest archive with independently verifiable, immutable proof. That is the moat.

---

## SLIDE 9 - Roadmap

**Phase 1 is live. The opportunity scales.**

**Now (Phase 1 - Complete)**
40 priority accounts. Full archive, deletion detection, HCS attestation, AI severity scoring.

**Phase 2 - Government Accountability**
All 535 US Congress members, agency heads, and press secretaries. 700-1,000 accounts. Bulk onboarding scripts ready.

**Phase 3 - Research API**
Paid API access for journalists, researchers, and legal teams. Deletion feed, HCS proof endpoints, bulk export. Key management and rate limiting via Unkey.

**Phase 4 - Media Archival**
Images and video archived to Cloudflare R2. Currently irrecoverable when tweets are deleted.

**Phase 5 - Public Nominations**
Anyone can request an account be tracked. Community-curated, moderated list.

---

## SLIDE 10 - CTA

**The record exists. It cannot be erased.**

Signal Archive is an independent, non-commercial public-interest archive. No ads, no subscriptions, no corporate backing. Every attested statement lives permanently on Hedera.

Live today at signalarchive.org.

Verify it yourself:
1. Go to signalarchive.org
2. Open any archived statement
3. Click Verify
4. Confirm the hash on HashScan

In an era where public officials treat the delete button as a tool of accountability avoidance, this is the infrastructure that makes that impossible.

*Public Statements. Permanent Record.*
