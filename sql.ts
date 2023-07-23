import pg from "pg";
import { config } from "dotenv";
import commands from "./commands.json" assert { type: "json" };
import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { InferModel } from "drizzle-orm";

config();

export type Promotion = InferModel<typeof promotions>;

const { Pool } = pg;

const pool = new Pool({
	connectionString: process.env.POSTGRES_URL + "?sslmode=require",
	// connectionString: process.env.PG_DATABASE_CONNECTION_STRING,
});

export const promotions = pgTable("promotions", {
	id: serial("id").primaryKey(),
	discordUser: text("discord_user"),
	imageUrl: text("image_url"),
	igPostCode: text("ig_post_code"),
	messageId: text("message_id"),
	promotedOnInsta: boolean("promoted_on_insta"),
});

await pool
	.query(
		'CREATE TABLE IF NOT EXISTS "public"."promotions" ("id" SERIAL PRIMARY KEY, "discord_user" TEXT, "image_url" TEXT, "ig_post_code" TEXT, "message_id" TEXT, "promoted_on_insta" BOOLEAN);'
	)
	.then((res) => {
		console.log(res);
	});

commands.forEach(async (c) => {
	console.log(c);
	await pool.query(c).then((res) => {
		console.log(res);
	});
});