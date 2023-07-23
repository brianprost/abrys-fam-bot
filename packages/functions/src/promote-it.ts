import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { InferModel, isNull } from "drizzle-orm";
import pg from "pg";
// TEMP
import { initializeApp } from "firebase/app";
import { doc, getFirestore, setDoc } from "firebase/firestore";
import { IgApiClient } from "instagram-private-api";
import sharp from "sharp";
// END TEMP
const { Pool } = pg;

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
		promotedOnInsta: boolean("promoted_on_insta"),
	});

	const db = drizzle(pool);

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

		const allMessages = await channel!.messages.fetch({ limit: 100 });

		const recentMessages = allMessages.filter((message) => {
			const inPrevious360Days =
				new Date(message.createdTimestamp) >
				new Date(new Date().setDate(new Date().getDate() - 500));
			return inPrevious360Days && message.attachments.size > 0;
		});

		// get a list of of any/all rows in DB that have a messageId
		const previousPromotionsIds = (
			await db.select().from(promotions).where(isNull(promotions.igPostCode))
		).map((promotion) => promotion.messageId);
        console.log("previousPromotionsIds: ", previousPromotionsIds)

		const newMessageIds = recentMessages
			.map((message) => message.id)
			.filter((id) => !previousPromotionsIds.includes(id));
		const newMessages = recentMessages.filter((message) =>
			newMessageIds.includes(message.id)
		);
		const newMessagesForPossiblePromotion = newMessages.filter((message) => {
			const hasAttachment = message.attachments.size > 0;
			const hasReaction = message.reactions.cache.size > 0;
			return hasAttachment && hasReaction;
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
				const messageDate = new Date(actualMessage.createdTimestamp);
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
					const note = `${userWhoPosted} promoted it on @abrys_fam. at ${messageDate}.`;
					const newDbRecord = {
						discordUser: userWhoPosted,
						messageId: messageId,
						imageUrl: attachmentUrl,
						igPostCode: "lol just a test",
						promotedOnInsta: true,
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

		// responseBody.newMessagesForPossiblePromotion = Number(
		// 	newMessagesForPossiblePromotion.size
		// );
		// responseBody.nonPromotedPromotions = Number(nonPromotedPromotions.length);
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
