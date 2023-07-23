import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { InferModel, isNull } from "drizzle-orm";
import pg from "pg";
// TEMP
// import { initializeApp } from "firebase/app";
// import { doc, getFirestore, setDoc } from "firebase/firestore";
// import { IgApiClient } from "instagram-private-api";
import sharp from "sharp";
// END TEMP

config();

const isDevMode = process.argv.includes("--dev");

const APPROVED_USERS = [
	"angular emoji",
	"angularemoji",
	"angular emoji#6001",
	"luluwav",
	"lulu.wav",
	"luluwav#5414",
	"sleeprides",
];

const { Pool } = pg;

const dbConnectionString = isDevMode
	? process.env.PG_DATABASE_CONNECTION_STRING
	: process.env.POSTGRES_URL + "?sslmode=require";

const pool = new Pool({
	connectionString: dbConnectionString,
});

export type Promotion = InferModel<typeof promotions>;
export const promotions = pgTable("promotions", {
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

	const previousPromotionsIds = (
		await db.select({ messageId: promotions.messageId }).from(promotions)
	).map((message) => message.messageId);

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
					userWhoPosted,
					messageId,
					attachmentUrl,
					notes: note,
					createdAt: messageDate,
				};
				await db.insert(promotions).values(newDbRecord).returning();
				promoteItOnAbrys(attachmentUrl!, userWhoPosted, messageId);
			}
		} catch (err) {
			console.log(err);
		}
	});
	const nonPromotedPromotions = await db
		.select()
		.from(promotions)
		.where(isNull(promotions.instagramUrl));
	console.log(nonPromotedPromotions.length, " submissions not approved yet.");
});

client.login(process.env.DISCORD_TOKEN);

// temp function inclusions:

export async function promoteItOnAbrys(
	url: string,
	discordUser: string,
	postHash: string
): Promise<{ didPromote: boolean; response: string }> {
	const firebaseConfig = {
		apiKey: process.env.FIREBASE_API_KEY,
		authDomain: process.env.FIREBASE_AUTH_DOMAIN,
		databaseURL: process.env.FIREABSE_DATABASE_URL,
		projectId: process.env.FIREBASE_PROJECT_ID,
		storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
		messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
		appId: process.env.FIREBASE_APP_ID,
		measurementId: process.env.FIREBASE_MEASUREMENT_ID,
	};

	const firebaseApp = initializeApp(firebaseConfig);
	const firestore = getFirestore(firebaseApp);
	console.log(
		`\nAttempting to post image url: ${url} from Discord user ${discordUser}`
	);

	if (url.match(/\.(jpe?g|png|gif|bmp|webp|tiff?|heic|heif)$/i) == null) {
		console.log(`${discordUser}'s image is not a valid image`);
		return { didPromote: false, response: "Not a valid image" };
	}
	try {
		const didPromoteToAbrysFamInstagram = await postToInstagram(
			url,
			discordUser
		);

		await setDoc(
			doc(firestore, `promote-it-on-abrys-fam-bot/${postHash}`),
			{
				image_url: url,
				discord_user: discordUser,
				promoted_on_insta: didPromoteToAbrysFamInstagram.didPromote,
				ig_post_code:
					didPromoteToAbrysFamInstagram.didPromote &&
					`https://www.instagram.com/p/${didPromoteToAbrysFamInstagram.igPostCode}/`,
			},
			{ merge: true }
		);

		return {
			didPromote: didPromoteToAbrysFamInstagram.didPromote,
			response: didPromoteToAbrysFamInstagram.response,
		};
	} catch (error) {
		const timestamp = new Date();
		console.log(
			`${timestamp} Error promoting ${discordUser}'s ${getImageFileName(
				url
			)} to @abrys_fam: ${error}`
		);

		return {
			didPromote: false,
			response: `Error promoting. Tell @SleepRides to look at the logs around ${timestamp}`,
		};
	}
}

async function postToInstagram(
	url: string,
	discordUser: string
): Promise<{ didPromote: boolean; response: string; igPostCode?: string }> {
	const ig = new IgApiClient();
	ig.state.generateDevice(process.env.IG_USERNAME!);
	await ig.account.login(process.env.IG_USERNAME!, process.env.IG_PASSWORD!);

	const response = await fetch(url);
	let imageBuffer = await response.arrayBuffer();

	const metadata = await sharp(imageBuffer).metadata();
	if (metadata.width! < 320 || metadata.height! < 320) {
		console.log(`${discordUser}'s image is too small`);
		return { didPromote: false, response: "Image is too small" };
	}

	const photoBuffer = await sharp(imageBuffer)
		.resize({ width: 1080, withoutEnlargement: true })
		.jpeg({ quality: 100 })
		.toBuffer();
	const photo = {
		file: photoBuffer,
		caption: `${discordUser} promoted it on @abrys_fam.`,
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
		return { didPromote: false, response: e };
	}
}

function getImageFileName(url: string): string {
	return (
		url
			.split("/")
			.pop()
			?.split(".")[0]
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "") ?? ""
	);
}
