import pg from "pg";
import { config } from "dotenv";
import { pgTable, text } from "drizzle-orm/pg-core";
import { InferModel } from "drizzle-orm";

const isDevMode = process.argv.includes("--dev");
console.log(`isDevMode: ${isDevMode}`);

config();

export type Promotion = InferModel<typeof promotions>;

const { Pool } = pg;

const dbConnectionString = isDevMode
	? process.env.PG_DATABASE_CONNECTION_STRING
	: process.env.POSTGRES_URL + "?sslmode=require";

const pool = new Pool({
	connectionString: dbConnectionString,
});

// type Promotion = InferModel<typeof promotions>;
const promotions = pgTable("promotions", {
  messageId: text("message_id").primaryKey(),
  discordUser: text("discord_user"),
  imageUrl: text("image_url"),
  igPostCode: text("ig_post_code"),
});

// drop old table
await pool.query('DROP TABLE IF EXISTS "public"."promotions"');

await pool
	.query(
		'CREATE TABLE IF NOT EXISTS "public"."promotions" ("message_id" TEXT PRIMARY KEY, "discord_user" TEXT, "image_url" TEXT, "ig_post_code" TEXT);'
	)
	.then((res: any) => {
		console.log(res);
	});
