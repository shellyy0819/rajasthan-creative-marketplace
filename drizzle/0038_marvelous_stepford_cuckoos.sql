CREATE TABLE "fair_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"detail" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fair_events_kind_valid" CHECK ("fair_events"."kind" in ('stall', 'shortlist', 'activity', 'quest'))
);
--> statement-breakpoint
CREATE TABLE "fair_play_days" (
	"code" text NOT NULL,
	"day" text NOT NULL,
	"seconds" integer DEFAULT 0 NOT NULL,
	"first_at" timestamp with time zone NOT NULL,
	"last_at" timestamp with time zone NOT NULL,
	CONSTRAINT "fair_play_days_code_day_pk" PRIMARY KEY("code","day")
);
--> statement-breakpoint
CREATE INDEX "fair_events_code_idx" ON "fair_events" USING btree ("code","at");--> statement-breakpoint
CREATE INDEX "fair_events_at_idx" ON "fair_events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "fair_play_days_day_idx" ON "fair_play_days" USING btree ("day");