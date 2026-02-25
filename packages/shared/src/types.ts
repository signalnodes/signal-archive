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

export interface HcsAttestationMessage {
  version: "1.0";
  type: "tweet_attestation" | "deletion_detected";
  tweet_id: string;
  author_id: string;
  content_hash: string;
  captured_at: string; // ISO 8601
  posted_at: string; // ISO 8601
}

export interface HcsDeletionMessage {
  version: "1.0";
  type: "deletion_detected";
  tweet_id: string;
  original_hash: string;
  detected_at: string; // ISO 8601
  tweet_age_hours: number;
}
