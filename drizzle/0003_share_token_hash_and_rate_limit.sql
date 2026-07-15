CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "rate_limit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "share_link" RENAME COLUMN "token" TO "token_hash";--> statement-breakpoint
UPDATE "share_link"
SET "token_hash" = encode(sha256(convert_to("token_hash", 'UTF8')), 'hex');--> statement-breakpoint
ALTER TABLE "share_link" DROP CONSTRAINT "share_link_token_unique";--> statement-breakpoint
ALTER TABLE "share_link" ADD CONSTRAINT "share_link_token_hash_unique" UNIQUE("token_hash");
