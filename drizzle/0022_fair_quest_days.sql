CREATE TABLE "fair_quest_days" (
	"code" text NOT NULL,
	"day" text NOT NULL,
	"quests" jsonb NOT NULL,
	"progress" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fair_quest_days_code_day_pk" PRIMARY KEY("code","day")
);
