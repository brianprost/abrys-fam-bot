import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { InferModel, isNull, eq, isNotNull } from "drizzle-orm";
import pg from "pg";

type TResponseBody = {
	newMessagesForPossiblePromotion?: number;
	nonPromotedPromotions?: number;
};

export async function getChannelState(): Promise<TResponseBody> {
	let responseBody: TResponseBody;

	config();

	const APPROVED_USERS = [
		"angular emoji",
		"angularemoji",
		"angular emoji#6001",
		"luluwav",
		"lulu.wav",
		"luluwav#5414",
		"sleeprides",
	];

	const isDevMode = process.argv.includes("--dev");
	console.log(`isDevMode: ${isDevMode}`);

	// POSTGRES //

	const { Pool } = pg;

	const dbConnectionString = process.env.PG_DATABASE_CONNECTION_STRING;

	const pool = new Pool({
		connectionString: dbConnectionString,
	});

	console.log("dbConnStr: ", dbConnectionString);

	type Promotion = InferModel<typeof promotions>;
	const promotions = pgTable("promotions", {
		id: serial("id").primaryKey(),
		discordUser: text("discord_user"),
		messageId: text("message_id"),
		imageUrl: text("image_url"),
		igPostCode: text("ig_post_code"),
	});

	type Config = InferModel<typeof configTable>;
	const configTable = pgTable("config", {
		id: serial("id").primaryKey(),
		key: text("key"),
		value: text("value"),
	});

	const db = drizzle(pool);

	const knownLastMsgIdFromDb = await db
		.select()
		.from(configTable)
		.where(eq(configTable.key, "most_recent_message_id"));
	const knownLastMsgId = knownLastMsgIdFromDb[0].value;

	const client = new Client({
		intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent],
	});

	client.login(process.env.DISCORD_TOKEN);

	client.once("ready", () => {
		console.log("🧽 I'm ready!");
	});

	const channelId = process.env.DISCORD_CHANNEL_ID;

	client.once("ready", async () => {
		console.log("👀 Checking for messages");

		const channel: TextChannel = client.channels.cache.get(
			channelId!
		) as TextChannel;

		// const doWeNeedToFetchMore = knownLastMsgId !== channel.lastMessageId;

		// if (!doWeNeedToFetchMore) {
		// 	console.log("👀 No new messages to check.");
		// 	return;
		// }

		const previouslyPromoted = (
			await db.select().from(promotions).where(isNotNull(promotions.igPostCode))
		).map((p) => p.messageId);

		const allChannelMessages = await channel!.messages.fetch({ limit: 100 });
		const newMessages = allChannelMessages.filter((message) => message.id);
		const newMessagesForPossiblePromotion = newMessages.filter((message) => {
			return (
				message.attachments.size > 0 &&
				message.reactions.cache.size > 0 &&
				!previouslyPromoted.includes(message.id)
			);
		});

		console.log(
			newMessagesForPossiblePromotion.size,
			" new submission(s) to promote."
		);

		newMessagesForPossiblePromotion.map(async (message) => {
			const { id } = message;
			try {
				const actualMessage = await channel.messages.fetch(id);
				const userWhoPosted = actualMessage.author.username;
				const attachmentUrl = actualMessage.attachments.first()?.url;
				const reactors = await Promise.all(
					actualMessage.reactions.cache.map(async (reaction) => {
						const reactorsTmp = await reaction.users.fetch();
						return reactorsTmp.map((user) => user.username);
					})
				);
				const approvedReactors = reactors.map((reactor) => {
					return reactor.filter((reactor) => APPROVED_USERS.includes(reactor));
				});
				if (reactors.length > 0 && approvedReactors.length > 0) {
					const messageId = actualMessage.id;
					const newDbRecord = {
						discordUser: userWhoPosted,
						messageId: messageId,
						imageUrl: attachmentUrl,
						igPostCode: "lol just a test",
					};
					await db.insert(promotions).values(newDbRecord).returning();
					// promoteItOnAbrys(attachmentUrl!, userWhoPosted, messageId);
				}
			} catch (err) {
				console.log(err);
			}
		});
		const nonPromotedPromotions = await db
			.select()
			.from(promotions)
			.where(isNull(promotions.igPostCode));
		console.log(nonPromotedPromotions.length, " submissions not approved yet.");

		// // update the most_recent_message_id in the db
		// await db
		// 	.update(configTable)
		// 	.set({ value: channel.lastMessageId })
		// 	.where(eq(configTable.key, "most_recent_message_id"));
		// console.log(`Updated last message id to ${channel.lastMessageId}`);
	});
	return responseBody!;
}

export async function handler() {
	try {
		const channelState = await getChannelState();
		return {
			statusCode: 200,
			body: JSON.stringify(channelState),
		};
	} catch (e) {
		return {
			statusCode: 500,
			body: JSON.stringify(e),
		};
	}
}
