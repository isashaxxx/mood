CREATE TABLE IF NOT EXISTS "app_sessions" (
  "token_hash" text PRIMARY KEY NOT NULL,
  "user" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "app_sessions_expires_idx"
  ON "app_sessions" USING btree ("expires_at");
