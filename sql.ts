import pg from 'pg';
import { config } from 'dotenv';
import commands from "./commands.json" assert { type: "json" };
import { drizzle } from "drizzle-orm/node-postgres";
import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { InferModel, isNull } from "drizzle-orm";

config();

export type Promotion = InferModel<typeof promotions_demo>;

const { Pool } = pg;

const pool = new Pool({
	connectionString: process.env.PG_DATABASE_CONNECTION_STRING
});

export const promotions_demo = pgTable("promotions_demo", {
	id: serial("id").primaryKey(),
	discordUser: text("discord_user"),
	imageUrl: text("image_url"),
	igPostCode: text("ig_post_code"),
	messageId: text("message_id"),
	promotedOnInsta: boolean("promoted_on_insta"),
});


// create the promotions_demo table if not exists
await pool.query('CREATE TABLE IF NOT EXISTS "public"."promotions_demo" ("id" SERIAL PRIMARY KEY, "discord_user" TEXT, "image_url" TEXT, "ig_post_code" TEXT, "message_id" TEXT, "promoted_on_insta" BOOLEAN);').then((res) => {
	console.log(res);
});

commands.forEach(async (c) => {
	console.log(c);
	await pool.query(c).then((res) => {
		console.log(res);
	});
});

export function convertPythonBooleanToJsBoolean(pythonBoolean: string): boolean {
	if (pythonBoolean === "True") {
		return true;
	} else {
		return false;
	}
}