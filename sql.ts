import pg from 'pg';
import { config } from 'dotenv';
import commands from "./commands.json" assert { type: "json" };
import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { InferModel, isNull } from "drizzle-orm";

config();

export type Promotion = InferModel<typeof promotions_demo>;

const { Pool } = pg;

const pool = new Pool({
	connectionString: process.env.POSTGRES_URL,
	ssl: {
		rejectUnauthorized: false,
	}
});

export const promotions_demo = pgTable("promotions_demo", {
	id: serial("id").primaryKey(),
	discordUser: text("discord_user"),
	imageUrl: text("image_url"),
	igPostCode: text("ig_post_code"),
	messageId: text("message_id"),
	promotedOnInsta: text("promoted_on_insta"),
});


// create the promotions_demo table if not exists
await pool.query('CREATE TABLE IF NOT EXISTS "public"."promotions_demo" ("id" serial NOT NULL, "discord_user" text, "image_url" text, "ig_post_code" text, "message_id" text, "promoted_on_insta" text, PRIMARY KEY ("id")) WITH (OIDS=FALSE);').then((res) => {
	console.log(res);
});

commands.forEach(async (command) => {
	// console.log(command)
    await pool.query(command);
    // console.log(command);
});
