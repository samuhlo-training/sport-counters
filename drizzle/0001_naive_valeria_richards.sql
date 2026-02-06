CREATE TABLE "match_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"points_won" integer DEFAULT 0 NOT NULL,
	"winners" integer DEFAULT 0 NOT NULL,
	"unforced_errors" integer DEFAULT 0 NOT NULL,
	"total_points_played" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"country" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" RENAME COLUMN "home_team" TO "home_team_name";--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "sport" SET DEFAULT 'padel';--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "status" SET DEFAULT 'scheduled';--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "start_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" RENAME COLUMN "away_team" TO "away_team_name";--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "player1_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "player2_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "player3_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "player4_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "match_state" jsonb DEFAULT '{"sets":[],"current_set":{"a":0,"b":0},"current_game":{"a":"0","b":"0"},"is_tie_break":false}'::jsonb;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "current_server_id" integer;--> statement-breakpoint
ALTER TABLE "match_stats" ADD CONSTRAINT "match_stats_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_stats" ADD CONSTRAINT "match_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player1_id_players_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player2_id_players_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player3_id_players_id_fk" FOREIGN KEY ("player3_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player4_id_players_id_fk" FOREIGN KEY ("player4_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_current_server_id_players_id_fk" FOREIGN KEY ("current_server_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "matches" DROP COLUMN "home_score";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "away_score";