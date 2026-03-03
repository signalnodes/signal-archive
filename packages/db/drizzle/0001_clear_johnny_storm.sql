CREATE TABLE "donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"transaction_id" text NOT NULL,
	"asset" text NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"amount_usd" numeric(12, 2),
	"status" text DEFAULT 'pending' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donations_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "supporters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"total_donated_usd" numeric(12, 2) DEFAULT '0' NOT NULL,
	"first_donation_at" timestamp with time zone NOT NULL,
	"last_donation_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supporters_wallet_address_unique" UNIQUE("wallet_address")
);
