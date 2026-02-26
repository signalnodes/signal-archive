import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#09090b",
          padding: "80px",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: "#ef4444",
            }}
          />
          <span
            style={{ color: "#71717a", fontSize: "20px", fontWeight: 600 }}
          >
            Signal Archive
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            color: "#ffffff",
            fontSize: "56px",
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: "24px",
          }}
        >
          <span>Public statements.</span>
          <span>Permanent record.</span>
        </div>

        {/* Subline */}
        <div
          style={{
            color: "#71717a",
            fontSize: "24px",
            lineHeight: 1.5,
            maxWidth: "800px",
          }}
        >
          Cryptographic proof of every tweet, anchored to the Hedera Consensus
          Service. Deletion is never the last word.
        </div>
      </div>
    ),
    { ...size }
  );
}
