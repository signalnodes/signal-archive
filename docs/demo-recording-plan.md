# Signal Archive - Demo Recording Plan
## Hedera Apex Hackathon Submission

---

## Your Role

You are driving a browser through a clean, intentional screen-recorded product demo for a hackathon submission. This recording will have voiceover narration added afterward in post-production. Your job is the visual walkthrough only.

Act like a careful product demo director, not a QA tester. Every movement should be purposeful. Every pause should give judges time to read and absorb. Do not rush. Do not improvise.

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
   - Tab 5: https://hashscan.io (search for topic 0.0.10301350 and find this tweet's message, or navigate directly to the HCS message if you have the sequence number)
4. Copy this hash to clipboard before recording starts:
   `fca9ba30370c6c97f32383624435ea1fc691aa6518eea1f37fe5b2147e41199d`
5. Start on Tab 1 (homepage) before starting OBS

---

## The Demo Path

### Step 1 - Homepage
**URL:** https://signalarchive.org
**Goal:** Establish what Signal Archive is before the judge has to ask
**What to show:**
- Let the hero sit: "Deleted. Documented. Permanent."
- Slow scroll down to the stats bar (3,995 statements archived, 1 deletion detected, 41 accounts tracked)
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
**Do not:** Click "View Proof" here yet. Pause first. Save the proof reveal for Step 4.

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

### Step 5 - HashScan
**URL:** HashScan HCS message for this tweet (Tab 5, pre-loaded)
**Goal:** Show the proof lives on Hedera, not on our servers
**What to show:**
- The HCS topic message on hashscan.io: topic 0.0.10301350, consensus timestamp, the hash value
- Hedera branding and the immutable record visible together
**Pause:** 5-6 seconds. This is the second-highest impact view. The record is on a public ledger. No one can alter it.
**Do not:** Navigate around HashScan. Land on the record and let it sit.

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
- Cold page loads (all tabs must be pre-loaded before recording starts)
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
| 0:42 | Switch to Tab 5: HashScan HCS record | — |
| 0:45 | Hedera record on screen | 5-6s |
| 0:53 | Switch back to Tab 1: homepage hero | 5s |
| ~1:00 | Recording ends (visual only) | — |

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
| HashScan explorer | https://hashscan.io |
