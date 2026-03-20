# Signal Archive - Pitch Deck Draft

---

## SLIDE 1 - Hook

**The delete button is no longer a get out of jail free card.**

Subhead: Signal Archive - cryptographic proof of public statements on Hedera

---

## SLIDE 2 - Problem

**Public figures say things. Then they delete them.**

In the past 90 days alone, cabinet officials, the President, and market-moving crypto figures have posted - and quietly deleted - statements with legal, financial, and political consequences.

The problem: there's no proof.

- Screenshots can be faked, edited, and dismissed in court
- Platform archives are private, inaccessible, and controlled by one company
- Journalists get stonewalled. Lawyers can't use them. Regulators ignore them.
- The delete button has been a get out of jail free card. Until now.

---

## SLIDE 3 - Solution

**Signal Archive makes every tweet permanently provable.**

We monitor high-value public figures on X/Twitter. Every tweet is archived, cryptographically hashed, and attested to the Hedera Consensus Service - before anyone hits delete.

When a tweet is deleted, we know. The deletion itself is attested on-chain.

The result: an immutable, independently verifiable public record that no one - not the politician, not the platform, not us - can alter or erase.

---

## SLIDE 4 - How It Works

**Three steps. Permanent proof.**

1. **Capture**
   Our worker continuously monitors 40 high-value accounts. Every new tweet is archived to our database within the hour of posting.

2. **Hash**
   A SHA-256 hash is computed from a canonical representation of the tweet - content, author, timestamp, media. Deterministic. Reproducible by anyone.

3. **Attest**
   The hash is submitted to a public Hedera HCS topic (0.0.10301350). Hedera reaches consensus in seconds. The attestation is permanent, public, and timestamped - forever.

When a deletion is detected, a second attestation is submitted confirming the tweet existed and is now gone.

---

## SLIDE 5 - Why Hedera

**Hedera's HCS is uniquely suited for this problem.**

Other blockchains are overkill, expensive, or slow. HCS is exactly right:

| Property | Why it matters |
|---|---|
| ~3 second finality | Attestation confirmed before a trending tweet disappears |
| $0.0008 per message | Economically viable to attest every tweet, not just notable ones |
| Permanent public record | Anyone can read topic 0.0.10301350 on HashScan - no trust required |
| No smart contract needed | Pure consensus layer - simpler, cheaper, more robust |
| Independent verifiability | Any third party can verify a hash against HCS without going through us |

Live today: 3,000+ attestations on Hedera mainnet. Growing every hour.

---

## SLIDE 6 - AI Layer

**Not all deletions are equal. Our AI knows the difference.**

When a tweet is deleted, Claude AI automatically scores it on a 1-10 public interest severity scale.

- Score 1-3: Mundane corrections, typos, duplicate posts
- Score 4-6: Potentially significant - policy reversals, financial statements
- Score 7-10: Critical - legal obligations, market-moving disclosures, direct contradictions of public record

This separates signal from noise - journalists and watchdogs get surfaced to what matters, not buried in noise from 40 accounts tweeting dozens of times a day.

Heuristic fallback ensures scoring works even without API access.

---

## SLIDE 7 - Traction

**Live in production. Right now.**

- signalarchive.org - public, live, no login required
- 3,000+ attestations on Hedera mainnet topic 0.0.10301350
- 40 tracked accounts - Trump family, cabinet officials, White House, federal agencies, key crypto figures
- Independent verification - any attestation can be verified on HashScan in seconds
- Supporter tier - donors receive an NFT badge (SIGBADGE, token 0.0.10314265) minted via HIP-551 atomic batch

Try it: go to signalarchive.org, open any tweet, click "View Proof", verify the hash on HashScan yourself.

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

Competitive landscape: Politwoops (OCCRP/ProPublica) tracked politician deletions but was shut down by Twitter and had no cryptographic proof layer. Signal Archive is the only public interest archive with independently verifiable, immutable proof. That's the moat.

---

## SLIDE 9 - Roadmap

**Phase 1 is live. The opportunity scales dramatically.**

**Now (Phase 1 - Complete)**
40 priority accounts. Full archive + deletion detection + HCS attestation + AI scoring.

**Phase 2 - Government Accountability**
All 535 US Congress members + agency heads + press secretaries. ~700-1,000 accounts. Bulk onboarding scripts ready.

**Phase 3 - Research API**
Paid API access for journalists, researchers, and legal teams. Deletion feed, HCS proof endpoints, bulk export. Unkey for key management and rate limiting.

**Phase 4 - Media Archival**
Images and video archived to Cloudflare R2 - currently irrecoverable when tweets delete.

**Phase 5 - Public Nominations**
Anyone can request an account be tracked. Community-curated, moderated list.

---

## SLIDE 10 - CTA

**The record exists. It can't be erased.**

Signal Archive is live today at signalarchive.org.

Every tweet we've archived is permanently attested on Hedera. Open. Public. Verifiable by anyone.

In an era where public officials treat the delete button as a tool of accountability avoidance - this is the infrastructure that makes that impossible.

Try it yourself:
1. Go to signalarchive.org
2. Open any archived tweet
3. Click "View Proof"
4. Verify the hash on HashScan

No trust required. That's the point.
