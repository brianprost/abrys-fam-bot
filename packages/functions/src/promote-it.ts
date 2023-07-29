import { Client, Collection, GatewayIntentBits, TextChannel } from "discord.js";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, text } from "drizzle-orm/pg-core";
import { InferModel, isNull, eq } from "drizzle-orm";
import pg from "pg";
import sharp from "sharp";
import { IgApiClient } from "instagram-private-api";
import { config } from "dotenv";

config();

type Submission = {
	messageId: string;
	discordUser: string;
	imageUrl: string;
};

const isDevMode = process.argv.includes("--dev");
console.log(`Running in ${isDevMode ? "dev" : "prod"} mode.`);

// POSTGRES //

const { Pool } = pg;

const dbConnectionString = isDevMode
	? process.env.PG_DATABASE_CONNECTION_STRING
	: process.env.POSTGRES_URL + "?sslmode=require";

const pool = new Pool({
	connectionString: dbConnectionString,
});

type Promotion = InferModel<typeof promotions>;
const promotions = pgTable("promotions", {
	messageId: text("message_id").primaryKey(),
	discordUser: text("discord_user"),
	imageUrl: text("image_url"),
	igPostCode: text("ig_post_code"),
});

const db = drizzle(pool);

export async function handler() {
	const client = new Client({
		intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent],
	});
	try {
		await new Promise<void>((resolve, reject) => {
			client.login(process.env.DISCORD_TOKEN);
			client.once("ready", async () => {
				try {
					await getNewSubmissions(client);
					const approvedSubmissions = await getApprovedSubmissions(client);
					if (approvedSubmissions.length < 1) {
						console.log("No submissions to promote.");
						resolve();
						return;
					}

					const igClient = new IgApiClient();
					igClient.state.generateDevice(process.env.IG_USERNAME!);
					await igClient.account.login(
						process.env.IG_USERNAME!,
						process.env.IG_PASSWORD!
					);

					const channel: TextChannel = client.channels.cache.get(
						process.env.DISCORD_CHANNEL_ID!
					) as TextChannel;
					const promises = approvedSubmissions.map(async (submission) => {
						const { messageId, discordUser, imageUrl } = submission;

						const imageResponse = await fetch(imageUrl);
						let imageBuffer = await imageResponse.arrayBuffer();

						const caption = `${discordUser} promoted it on @abrys_fam.`;
						const { didPromote, response, igPostCode } = await postToInstagram(
							caption,
							imageBuffer,
							igClient,
							isDevMode
						);
						console.log("from Instagram: ", response);

						if (didPromote) {
							await db
								.update(promotions)
								.set({ igPostCode: igPostCode })
								.where(eq(promotions.messageId, messageId));
							console.log(
								`Updated DB record for ${messageId} with igPostCode ${igPostCode}`
							);
							// respond to message
							const message = await channel.messages.fetch(messageId);
							await message.reply(
								`Promoted to https://www.instagram.com/p/${igPostCode}/`
							);
							console.log(`Replied to ${messageId}`);
							resolve();
						} else {
							const message = await channel.messages.fetch(messageId);
							await message.reply(
								`Failed to promote to Instagram because: ${response}`
							);
							console.log(`Failed to promote ${messageId}`);
							reject();
						}
					});
					await Promise.all(promises);
					client.destroy();
					console.log("bye!");
				} catch (err) {
					client.destroy();
					console.log(err);
					reject();
				}
			});
		});
	} catch (err) {
		console.log(err);
	}
	client.destroy();
}

async function fetchMore(channel: TextChannel, limit: number) {
	if (!channel) {
		throw new Error(`Expected channel, got ${typeof channel}.`);
	}
	if (limit <= 100) {
		return channel.messages.fetch({ limit });
	}

	let collection = new Collection();
	let lastId = null;
	let options: { limit: number; before?: string } = { limit: 100 };
	let remaining = limit;

	while (remaining > 0) {
		options.limit = remaining > 100 ? 100 : remaining;
		remaining = remaining > 100 ? remaining - 100 : 0;

		if (lastId) {
			options.before = lastId;
		}

		let messages = await channel.messages.fetch(options);

		if (!messages.last()) {
			break;
		}

		collection = collection.concat(messages);
		lastId = messages.last()!.id;
	}

	return collection;
}

export async function getNewSubmissions(client: Client) {
	console.log(
		`👀 Checking for messages from ${process.env.DISCORD_CHANNEL_NAME}`
	);

	const channel: TextChannel = client.channels.cache.get(
		process.env.DISCORD_CHANNEL_ID!
	) as TextChannel;
	const allChannelMessages = await fetchMore(channel, 20);

	const submissionMessages = allChannelMessages.filter((message: any) => {
		return message.attachments.size > 0 && message.reactions.cache.size > 0;
	});
	console.log(`💬 ${submissionMessages.size} messages are submissions.`);
	/**
	 * a list of messages that I, @abrys_fam_bot, have already responded to.
	 */
	const iPromotedPreviously = submissionMessages.filter((message: any) => {
		if (message.reference === null) {
			return false;
		}
		const repliedToMessageId = message.reference.messageId;
		const textSignalingAPromotion = "Promoted to https://www.instagram.com/p/";
		if (message.content.includes(textSignalingAPromotion)) {
			return true;
		}
		// console.log(message.content);
		// return repliedToMessageId;
	});
	console.log(
		`💬 ${iPromotedPreviously.size} messages are ones I've promoted previously.`
	);

	const dbRecords = (await db.select().from(promotions)).map(
		(p) => p.messageId
	);

	const newSubmissions = allChannelMessages.filter((message: any) => {
		return (
			message.attachments.size > 0 &&
			message.reactions.cache.size > 0 &&
			!dbRecords.includes(message.id) &&
			!iPromotedPreviously.has(message.id)
		);
	});
	console.log(`💬 ${newSubmissions.size} messages are new.`);

	// update db to include new messages
	const promises = newSubmissions.map(async (message: any) => {
		const promotion: Promotion = {
			messageId: message.id,
			discordUser: message.author.username,
			imageUrl: message.attachments.first()!.url,
			igPostCode: null,
		};
		return db.insert(promotions).values(promotion).returning();
	});

	const results = await Promise.allSettled(promises);
	results.forEach((result) => {
		if (result.status === "rejected") {
			console.error(result.reason);
		}
	});
}

/**
 * Retrieves all submissions that are not promotions.
 */
async function getApprovedSubmissions(client: Client) {
	console.log(`☑️ Checking for approved submissions.`);
	const approvedReactors = [
		"angular emoji",
		"angularemoji",
		"angular emoji#6001",
		"luluwav",
		"lulu.wav",
		"luluwav#5414",
		"sleeprides",
	];
	const submissionsFromDb = await db
		.select()
		.from(promotions)
		.where(isNull(promotions.igPostCode));
	console.log(`💬 ${submissionsFromDb.length} submissions not promoted yet.`);
	const channel: TextChannel = client.channels.cache.get(
		process.env.DISCORD_CHANNEL_ID!
	) as TextChannel;
	let submissions: Submission[] = [];
	if (channel) {
		for (const s of submissionsFromDb) {
			const discordMessage = await channel.messages.fetch(s.messageId);
			const reactions = discordMessage.reactions.cache;
			if (!reactions) {
				continue;
			}
			// get all users from all reactions (like all emojis) to the message
			const reactionUsers: string[] = await reactions.reduce(async (acc, reaction) => {
				const users = await acc;
				const usersWhoReacted = await reaction.users.fetch();
				return users.concat(usersWhoReacted.map((user) => user.username));
			}, Promise.resolve([] as string[]));
			const hasApprovedReactors = approvedReactors.some((approvedReactor) => {
				return reactionUsers?.some((user) => {
					return user === approvedReactor;
				});
			});

			if (hasApprovedReactors) {
				console.log(
					"going to promote",
					s.messageId,
					"on abrys fam. because this is the list of approved reactors: ",
					reactionUsers?.map((user) => user)
				);
				submissions.push({
					messageId: s.messageId,
					discordUser: s.discordUser!,
					imageUrl: s.imageUrl!,
				});
			} else {
				console.log("no approved users reacted to ", s.messageId);;
			}
		}
	}
	return submissions;
}

async function postToInstagram(
	caption: string,
	image: ArrayBuffer,
	ig: IgApiClient,
	devMode?: boolean
): Promise<{ didPromote: boolean; response: string; igPostCode?: string }> {
	if (devMode) {
		console.log("fake promoting to instagram...");
		return {
			didPromote: true,
			response: "fake promoting to instagram...",
			igPostCode: "fake",
		};
	}
	console.log("Promoting to Instagram...");
	const metadata = await sharp(image).metadata();
	if (metadata.width! < 320 || metadata.height! < 320) {
		console.log(`Image is too small`);
		return { didPromote: false, response: "Image is too small" };
	}

	const photoBuffer = await sharp(image)
		.resize({ width: 1080, withoutEnlargement: true })
		.jpeg({ quality: 100 })
		.toBuffer();
	const photo = {
		file: photoBuffer,
		caption: caption,
	};

	try {
		const res = await ig.publish.photo(photo);
		const igPostCode = res.media.code;
		console.log(`Promoted to Instagram: ${igPostCode}`);
		return {
			didPromote: true,
			response:
				res.status === "ok"
					? `Promoted to https://www.instagram.com/p/${igPostCode}/`
					: "Weird-ass error. You should never be reading this message. Tell @SleepRides to look at the logs",
			igPostCode: igPostCode,
		};
	} catch (e) {
		console.log(e);
		return { didPromote: false, response: String(e) };
	}
}
