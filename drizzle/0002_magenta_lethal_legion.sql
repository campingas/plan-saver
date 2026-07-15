DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "document" AS d
    INNER JOIN "project" AS p ON p."id" = d."project_id"
    WHERE d."user_id" <> p."user_id"
  ) THEN
    RAISE EXCEPTION 'document ownership disagrees with project ownership';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "document" DROP CONSTRAINT "document_user_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "api_token_user_idx";--> statement-breakpoint
DROP INDEX "document_user_idx";--> statement-breakpoint
CREATE INDEX "api_token_user_created_idx" ON "api_token" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_kind_check" CHECK ("document"."kind" in ('plan', 'report'));--> statement-breakpoint
ALTER TABLE "version" ADD CONSTRAINT "version_number_positive" CHECK ("version"."number" > 0);
