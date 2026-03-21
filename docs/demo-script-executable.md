# Demo Video - Machine-Executable Script

This script is designed to be followed by a Claude Code instance with browser control.
The human operator starts a screen recorder before execution and stops it after.
Voiceover is added in post-production using the cue notes below.

Total runtime target: 2:30 - 3:00

---

## Pre-flight

Before starting the screen recorder:
- Open Chrome with a clean profile (no bookmarks bar, no distracting extensions)
- Set browser window to 1920x1080 or as close as possible
- Close all other tabs
- Dark mode preferred (the site is dark themed)
- Make sure the browser is NOT logged into X/Twitter (we don't want personal data visible)

---

## Scene 1: Homepage (0:00 - 0:20)

**VO cue:** "Every day, public officials delete tweets they don't want you to see. Signal Archive catches them before they disappear, and writes cryptographic proof to Hedera that the content existed."

1. Navigate to `https://signalarchive.org`
2. Wait 3 seconds for page to fully load
3. Slowly scroll down to reveal the stats section and recent deletions on the homepage
4. Pause 3 seconds on the stats (let the numbers register — archived tweets, deletions detected, accounts tracked)
5. Continue scrolling slowly through the recent deletions feed
6. Pause 2 seconds on a deletion card to let it register
7. Scroll back to top

---

## Scene 2: Tracked Accounts (0:20 - 0:40)

**VO cue:** "We're tracking 40 high-value accounts. Trump family, cabinet officials, press secretaries, federal agencies, key crypto figures."

1. Click "Accounts" in the top navigation
2. Wait 2 seconds for the grid to load
3. Slowly scroll down through the accounts grid - let judges see the faces and names
4. Pause 2 seconds after scrolling through about half the grid
5. Scroll back to top of the accounts page

---

## Scene 3: Account Detail - Pick a high-profile account (0:40 - 1:05)

**VO cue:** "Let's look at a specific account. Every tweet we capture gets a cryptographic hash and a Hedera attestation."

1. Click on the account card for `DonaldJTrumpJr` (or whichever account has the most data/deletions)
2. Wait 2 seconds for the account page to load
3. Pause 3 seconds on the ReceiptCard at the top (shows tracking info)
4. The default tab should be "Activity" - pause 2 seconds to show recent activity
5. Click the "Statements" tab
6. Wait 2 seconds - scroll down slowly through a few archived tweets
7. Click the "Deletions" tab
8. Wait 3 seconds - if there are deletions, let them be visible. This is a key moment.
9. Click the "Attestations" tab
10. Wait 2 seconds - show the HCS attestation records

---

## Scene 4: Individual Tweet + Proof (1:05 - 1:35)

**VO cue:** "Every archived tweet has a proof page. The SHA-256 hash, the Hedera transaction ID, and a direct link to verify it on HashScan. You don't have to trust us."

1. Click the "Statements" tab to go back to tweets
2. Click on any individual tweet to open the tweet detail page (`/tweet/[id]`)
3. Wait 2 seconds for the page to load
4. Slowly scroll down to the HCS proof section
5. Pause 3 seconds on the proof panel (should show topic ID, sequence number, transaction ID, content hash)
6. Look for a "View on HashScan" or similar link - click it
7. This opens HashScan in a new tab - wait 3 seconds for it to load
8. Slowly scroll down on the HashScan page to show the HCS message details
9. Pause 4 seconds - let judges read the on-chain data
10. Close the HashScan tab (or switch back to the Signal Archive tab)

---

## Scene 5: Deletion Feed (1:35 - 1:55)

**VO cue:** "The deletion feed shows every deleted tweet we've caught, scored by public interest severity. Journalists and watchdogs get surfaced to what matters."

1. Click "Deletions" in the top navigation
2. Wait 2 seconds for the feed to load
3. If there are deletions visible, slowly scroll through them (2-3 items)
4. Pause 2 seconds on a deletion that has a severity score visible
5. If there's a category filter, click one to show filtering works, then click "All" to reset
6. Scroll back to top

---

## Scene 6: Verification Tool (1:55 - 2:15)

**VO cue:** "Anyone can verify an attestation independently. Enter a content hash, and we'll show you the matching Hedera record. No trust required."

1. Click "Verify" in the top navigation
2. Wait 2 seconds
3. Pause 2 seconds on the verify page showing the input field and explanation
4. Navigate back (click browser back or click the Signal Archive logo)

---

## Scene 7: About Page - Why Hedera (2:15 - 2:35)

**VO cue:** "Hedera's Consensus Service is uniquely suited for this. Three-second finality, fraction-of-a-cent cost per attestation, and a permanent public record that no one can alter."

1. Click "About" in the top navigation
2. Wait 2 seconds
3. Scroll down slowly to the "Why Hedera" section
4. Pause 3 seconds on the Hedera explanation
5. Continue scrolling to the "Transparency" section showing the HCS topic ID and HashScan link
6. Pause 3 seconds on the transparency box with the topic ID

---

## Scene 8: Closing - Homepage (2:35 - 2:50)

**VO cue:** "Signal Archive. Public statements. Permanent record. Accountability you can verify."

1. Click the Signal Archive logo to return to homepage
2. Wait 2 seconds
3. Pause 5 seconds on the homepage (gives time for closing title card in editing)

---

## End

Stop the screen recorder.

---

## Notes for the operator

- **If a page loads slowly**: just wait. Dead air can be cut in editing. Don't click away too fast.
- **If there are no deletions yet**: skip Scene 5 or keep it brief. The archived tweets and attestations are still impressive.
- **Mouse movement**: move the cursor slowly and deliberately. Avoid frantic movement. When pausing on content, move the cursor to the side or bottom so it doesn't cover text.
- **Scroll speed**: about 1 page-height per 3 seconds. Judges need time to read.
- **Tab order matters**: the flow goes homepage -> accounts grid -> account detail -> tweet proof -> HashScan -> deletions feed -> verify -> about -> homepage. This builds from "what" to "proof" to "why it matters."
- **Total click count**: roughly 12-15 clicks. Keep it simple.
- **Fallback if something breaks**: if a page 500s or loads empty, just click back and move to the next scene. Don't linger on errors.
