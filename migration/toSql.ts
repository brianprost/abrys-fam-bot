import pg from "pg";
import { config } from "dotenv";
import { pgTable, text } from "drizzle-orm/pg-core";
import { InferModel, eq } from "drizzle-orm";
import fromFb from "./to_sql.json" assert { type: "json" };
import { drizzle } from "drizzle-orm/node-postgres";

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

const db = drizzle(pool);

// type Promotion = InferModel<typeof promotions>;
const promotions = pgTable("promotions", {
	messageId: text("message_id").primaryKey(),
	discordUser: text("discord_user"),
	imageUrl: text("image_url"),
	igPostCode: text("ig_post_code"),
});

for (const item of fromFb) {
	// we want to match the image_url
	const dbRecord = await db
		.select()
		.from(promotions)
		.where(eq(promotions.imageUrl, item.image_url));
	if (
		dbRecord.length === 1 &&
		item.ig_post_code !== "" &&
		item.ig_post_code !== "False"
	) {
		// extract the ig_post_code from the fb record
		const igPostCode = item.ig_post_code.substring(
			28,
			item.ig_post_code.length - 1
		);
		// update the db record to include the ig_post_code from the fb record
		await db
			.update(promotions)
			.set({
				igPostCode: igPostCode,
			})
			.where(eq(promotions.imageUrl, item.image_url));
	}
}
