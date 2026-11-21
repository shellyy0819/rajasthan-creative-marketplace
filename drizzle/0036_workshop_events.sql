CREATE TABLE "workshop_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workshop_id" text NOT NULL,
	"type" text NOT NULL,
	"actor" text NOT NULL,
	"day" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workshop_events_type_valid" CHECK ("workshop_events"."type" in ('view', 'contact', 'contact_whatsapp', 'contact_call', 'contact_instagram', 'contact_website'))
);
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD CONSTRAINT "workshop_events_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workshop_events_unique_idx" ON "workshop_events" USING btree ("workshop_id","type","actor","day");--> statement-breakpoint
CREATE INDEX "workshop_events_day_idx" ON "workshop_events" USING btree ("day");