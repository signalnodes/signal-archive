export type TrackingTier = "priority" | "standard" | "low";

export type AccountCategory =
  | "trump_family"
  | "wlfi"
  | "political_appointee"
  | "white_house"
  | "federal_agency"
  | "congress"
  | "crypto_industry"
  | "crypto_caller";

export type TweetType = "tweet" | "reply" | "retweet" | "quote";

export type TrackingRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "active";

export interface CanonicalTweet {
  tweet_id: string;
  author_id: string;
  content: string;
  posted_at: string; // ISO 8601
  media_urls: string[]; // Sorted
  tweet_type: TweetType;
}

/** Payload written to HCS for both tweet attestations and deletion events. */
interface HcsBasePayload {
  type: "tweet_attestation" | "deletion_detected";
  tweetId: string;
  authorId: string;
  username: string;
  postedAt: string; // ISO 8601
  contentHash: string;
  topicId: string;
  submittedAt: string; // ISO 8601
}

export interface HcsTweetAttestationPayload extends HcsBasePayload {
  type: "tweet_attestation";
}

export interface HcsDeletionPayload extends HcsBasePayload {
  type: "deletion_detected";
}

export type HcsPayload = HcsTweetAttestationPayload | HcsDeletionPayload;
