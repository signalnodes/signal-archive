# Signal Archive - Demo Recording Plan
## Hedera Apex Hackathon Submission

---

## Your Role

You are driving a browser through a clean, intentional screen-recorded product demo for a hackathon submission. This recording will have voiceover narration added afterward in post-production. Your job is the visual walkthrough only.

Act like a careful product demo director, not a QA tester. Every movement should be purposeful. Every pause should give judges time to read and absorb. Do not rush. Do not improvise.

**On pause length:** Always hold longer than feels natural. When in doubt, add 2-3 extra seconds to any pause. Extra time on a hold frame is trivial to cut in post-production. A hold that is too short may require a re-record. Err on the side of too long every time.

---

## Operating Rules

- Before interacting with any page, inspect it and decide the cleanest next action
- Move the cursor smoothly and minimally
- Pause briefly after every navigation event to let the page settle
- Scroll slowly and deliberately
- Prefer fewer interactions with higher clarity
- Do not hover around indecisively
- Do not open devtools, extra tabs, menus, or settings
- Do not expose bookmarks, extensions, or personal browser information
- If something looks broken or visually weak, route around it
- Assume the screen is being recorded at all times

---

## Pre-Recording Setup (Complete Before Starting OBS)

Do these steps before the recording begins. None of them should appear on camera.

1. Open Chrome to a clean window with no visible bookmarks bar
2. Set zoom to 100% (Ctrl+0 to reset)
3. Pre-load these tabs in order (do not close them between steps):
   - Tab 1: https://signalarchive.org
   - Tab 2: https://signalarchive.org/deletions?sort=severity
   - Tab 3: https://signalarchive.org/tweet/14c98cd6-4c31-4a84-bc0f-aaf493493dd3
   - Tab 4: https://signalarchive.org/verify/fca9ba30370c6c97f32383624435ea1fc691aa6518eea1f37fe5b2147e41199d
4. Start on Tab 1 (homepage) before starting OBS

---

## The Demo Path

### Step 1 - Homepage
**URL:** https://signalarchive.org
**Goal:** Establish what Signal Archive is before the judge has to ask
**What to show:**
- Let the hero sit: "Deleted. Documented. Permanent."
- Slow scroll down to the stats bar (stats are live — expect ~40 accounts tracked, 1 deletion detected)
- Brief pause on stats, then stop scrolling
**Pause:** 4-5 seconds on hero. 3 seconds on stats.
**Do not:** Scroll past the stats into the lower page content. Keep it clean.

---

### Step 2 - Deletions Feed
**URL:** https://signalarchive.org/deletions?sort=severity (switch to Tab 2)
**Goal:** Show real evidence of monitoring in action
**What to show:**
- The page loads on Severity sort
- The White House deletion card is at or near the top with its 7/10 severity badge
- Let the card sit on screen: account name (@WhiteHouse), severity score, detection timestamp
- Do not click yet. Let the judge absorb that this is a real government account deletion with an AI severity score.
**Pause:** 5-6 seconds. This is the highest-impact single view in the demo.
**Do not:** Switch sort modes on camera. It should already be on Severity.

---

### Step 3 - Deletion Detail
**URL:** https://signalarchive.org/tweet/14c98cd6-4c31-4a84-bc0f-aaf493493dd3 (switch to Tab 3)
**Goal:** Show the actual archived content of the deleted statement
**What to show:**
- The archived tweet text: "Democrats holding TSA officers hostage for political purposes is irresponsible and dangerous. Their work is critical to protecting our homeland and national security."
- The account (@WhiteHouse), deletion detected timestamp (March 20, 2026), and severity score with rationale
- Slow scroll if the card is tall so all key metadata is visible
**Pause:** 4-5 seconds on the tweet content. Let the "deleted" status and timestamp register clearly.
**Do not:** Click anything here yet. Pause first. Save the proof reveal for Step 4.
**Note:** The "Hedera Consensus Service Proof" section with the Transaction ID link is further down this page. You will return to it in Step 5.

---

### Step 4 - Proof Verification
**URL:** https://signalarchive.org/verify/fca9ba30370c6c97f32383624435ea1fc691aa6518eea1f37fe5b2147e41199d (switch to Tab 4)
**Goal:** Demonstrate cryptographic proof that does not depend on trusting us
**What to show:**
- The verify page with the hash pre-loaded
- The returned proof record: SHA-256 hash, HCS topic ID (0.0.10301350), consensus timestamp, sequence number
- The "Hedera Mainnet" label
**Pause:** 3 seconds on the hash. 4-5 seconds on the full proof record.
**Note:** Hash is already in the URL so no typing needed. Page should load directly to the proof result.

---

### Step 5 - HashScan (live click from deletion detail)
**Source:** Switch back to Tab 3 (deletion detail). Scroll down to the "Hedera Consensus Service Proof" section.
**Goal:** Show that the Transaction ID link goes directly to the immutable ledger record — not our servers
**What to show:**
- The HCS proof section with Transaction ID `0.0.10301284@1774030633.952798320` visible on screen
- Pause briefly so the judge can see the link. Then click it.
- Wait for HashScan to load. Hold on the transaction record: consensus timestamp and attestation data visible. Hedera branding on screen.
**Pause:** 2-3 seconds on the Transaction ID before clicking. 5-6 seconds on HashScan after it loads.
**Do not:** Navigate around HashScan. Land on the record and let it sit.
**Note:** HashScan shows the transaction record (consensus timestamp, hash) — not the tweet text. This is correct. The tweet content was already shown in Step 3. This step proves the record exists on-chain independent of Signal Archive.
**Post-production note:** Beat 5 narration begins "This is Hash-Scan..." — do NOT start this narration while Tab 3 is still on screen. Hold the Tab 3 frame silently during the scroll and click. Start Beat 5 narration only after HashScan has loaded and the record is visible.

---

### Step 6 - Close on Homepage
**URL:** https://signalarchive.org (switch back to Tab 1)
**Goal:** Land on a clean, confident closing frame for the narration to close over
**What to show:**
- The hero: "Deleted. Documented. Permanent."
- Do not scroll. Let it sit.
**Pause:** 5 seconds.

---

## Avoid During Recording

- The Research or Support pages (wallet-gated, outside hackathon scope)
- Any account page with zero deletions
- The RSS feed, sitemap, or any /api route
- Typing the hash manually on camera
- Opening devtools, extra browser tabs, or extensions
- Cold page loads (all four tabs must be pre-loaded before recording starts)
- Closing the HashScan tab that opens from the Transaction ID click — let it load naturally
- Scrolling past useful content into empty or low-signal sections
- The Accounts grid (skip unless there is leftover time and it loads cleanly)

---

## Final Recording Run (Timestamp Reference)

| Approx time | Action | Hold |
|---|---|---|
| 0:00 | Tab 1: homepage loads, hero visible | 4-5s |
| 0:06 | Slow scroll to stats bar | 3s |
| 0:12 | Switch to Tab 2: deletions feed (severity sorted) | — |
| 0:15 | White House 7/10 card visible | 5-6s |
| 0:22 | Switch to Tab 3: deletion detail page | — |
| 0:25 | Archived tweet content visible, slow scroll if needed | 4-5s |
| 0:32 | Switch to Tab 4: verify page (proof pre-loaded) | — |
| 0:35 | Hash and proof record visible | 4-5s |
| 0:42 | Switch back to Tab 3: scroll to HCS proof section | — |
| 0:45 | Transaction ID visible on screen | 2-3s |
| 0:48 | Click Transaction ID link → HashScan loads | — |
| 0:51 | HashScan transaction record on screen | 5-6s |
| 0:59 | Switch back to Tab 1: homepage hero | 5s |
| ~1:05 | Recording ends (visual only) | — |

**Note:** This is the visual-only runtime. With deliberate pauses this sits around 55-65 seconds of screen time. Narration and pacing in post-production will bring the final video to the 2:30-3:00 target.

---

## Narration Alignment Notes
*(For ElevenLabs voiceover in post-production)*

| Screen moment | Narration beat |
|---|---|
| Homepage hero | Introduce the problem: public figures delete statements with real consequences |
| Stats bar | Signal Archive is live, in production, monitoring right now |
| Deletions feed / White House card | A real example: White House account, real deletion, AI scored 7 out of 10 |
| Deletion detail / tweet content | Read or paraphrase the deleted statement. It existed. It was deleted. We have it. |
| Verify page / proof record | The SHA-256 hash was submitted to Hedera HCS at the moment of archival. No trust required. |
| HashScan | The record lives on a public ledger. We cannot alter it. The platform cannot alter it. |
| Homepage close | "Deletion is never the last word." |

---

## Key Reference Data

| Item | Value |
|---|---|
| Live site | https://signalarchive.org |
| Demo deletion | @WhiteHouse, March 20 2026, severity 7/10 |
| Tweet detail URL | /tweet/14c98cd6-4c31-4a84-bc0f-aaf493493dd3 |
| Content hash (SHA-256) | fca9ba30370c6c97f32383624435ea1fc691aa6518eea1f37fe5b2147e41199d |
| Verify URL | /verify/fca9ba30370c6c97f32383624435ea1fc691aa6518eea1f37fe5b2147e41199d |
| HCS topic (mainnet) | 0.0.10301350 |
| HCS transaction ID | 0.0.10301284@1774030633.952798320 |
| HashScan explorer | https://hashscan.io |
