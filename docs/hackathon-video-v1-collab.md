# Hackathon Demo Video - Version 1: Partner Collaboration (GIB)

## Opening (0:00 - 0:15)
- Screen recording: signalarchive.org homepage, slow scroll showing the account grid and live stats
- Voiceover: "Every day, public officials delete tweets they don't want you to see. Signal Archive catches them before they disappear, and writes cryptographic proof to Hedera that the content existed."

## The Setup (0:15 - 0:35)
- Cut to: the GIB Twitter/X account page on signalarchive.org showing their profile, tweet history, zero deletions
- Voiceover: "To show you how this works in real time, we partnered with GIB, one of the most active communities on Hedera. They're going to post a tweet, then delete it. Let's see what happens."
- Cut to: screenshot or screen recording of GIB's tweet going live on X. The tweet should be something fun and on-brand for them, maybe a fake "controversial" take about memecoins or a joke announcement. Something clearly playful so it doesn't look staged in a bad way.

## The Deletion (0:35 - 0:55)
- Voiceover: "The tweet is live. Signal Archive's ingestion daemon has already picked it up."
- Cut to: signalarchive.org showing the tweet archived on GIB's account page, timestamp visible
- Voiceover: "Now GIB deletes it."
- Cut to: X showing the tweet is gone (404, "this post was deleted", or just missing from the timeline)
- Brief pause. Let the absence register.

## The Catch (0:55 - 1:25)
- Voiceover: "Within the hour, Signal Archive's deletion detection worker identifies the missing tweet."
- Cut to: signalarchive.org deletions view showing the tweet flagged as deleted, with the full original content preserved
- Voiceover: "The original content, the timestamp, the deletion, all captured. But here's what makes this different from a screenshot."
- Cut to: the HCS attestation tab or detail view showing the Hedera transaction ID
- Voiceover: "Signal Archive wrote a cryptographic attestation to Hedera Consensus Service the moment this tweet was first archived. That transaction is immutable. No one can alter it, not us, not the person who deleted the tweet, not anyone. It's public, verifiable proof that this content existed exactly as shown."

## The Proof (1:25 - 1:50)
- Cut to: HashScan or another Hedera explorer showing the actual HCS transaction, topic ID 0.0.10301350, the message contents visible on-chain
- Voiceover: "You can verify this yourself. The attestation lives on Hedera topic 0.0.10301350. Every archived tweet gets one. The message contains a hash of the tweet content, the username, the tweet ID, and the archive timestamp."
- Zoom in on the transaction details so judges can see real data, not a mockup

## Why It Matters (1:50 - 2:15)
- Cut to: the about page or a simple text slide with key stats (accounts tracked, tweets archived, deletions caught)
- Voiceover: "Right now we're tracking 40 government officials and political figures. We've already caught real deletions. But this isn't about gotcha moments. Public officials speak on behalf of the public. When they delete those words, the public has a right to know what was said. Hedera makes that record permanent and trustless. No database we control, no server someone can pressure us to wipe. Just consensus."

## Close (2:15 - 2:30)
- Cut to: signalarchive.org homepage, maybe with the donation/support section visible briefly
- Voiceover: "Signal Archive. Accountability you can verify."
- End card: signalarchive.org, GitHub link, Hedera topic ID

## Production Notes
- Record all browser footage at 1080p minimum, clean browser with no distracting tabs or bookmarks
- If doing voiceover live, do a dry run first. Or record screen footage silent and add VO after for more control over pacing
- The deletion detection isn't instant (runs on a cycle), so either: (a) record ingestion and deletion parts separately and cut them together, or (b) speed up the waiting portion with a visible timeskip ("30 minutes later" text overlay)
- Coordinate with GIB on the exact tweet text ahead of time so you know what to expect on screen
- Keep the HashScan shot long enough for judges to read the transaction details. That's your proof of technical substance, don't rush past it
