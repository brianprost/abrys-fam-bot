import { IgApiClient } from "instagram-private-api";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import sharp from "sharp";
import * as dotenv from "dotenv";
import pg from "pg";
import { InferModel } from "drizzle-orm";
import { boolean, pgTable, serial, text } from "drizzle-orm/pg-core";

dotenv.config();
const APPROVED_USERS = [
	"angular emoji",
	"angularemoji",
	"angular emoji#6001",
	"luluwav",
	"lulu.wav",
	"luluwav#5414",
	"sleeprides",
];

const discordToken = process.env.DISCORD_TOKEN;

const discordClient = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMessageReactions,
	],
});

const { Pool } = pg;

const pool = new Pool({
	connectionString: process.env.POSTGRES_URL + "?sslmode=require",
	// connectionString: process.env.PG_DATABASE_CONNECTION_STRING
});

export type Promotion = InferModel<typeof promotions_demo>;
export const promotions_demo = pgTable("promotions_demo", {
	id: serial("id").primaryKey(),
	discordUser: text("discord_user"),
	messageId: text("message_id"),
	imageUrl: text("image_url"),
	igPostCode: text("ig_post_code"),
	promotedOnInsta: boolean("promoted_on_insta"),
});

const ig = new IgApiClient();
ig.state.generateDevice(process.env.IG_USERNAME!);
await ig.account.login(process.env.IG_USERNAME!, process.env.IG_PASSWORD!);

function botLog(message: string) {
	console.log(`🤖 ${message}`);
}

export async function promoteItOnAbrys(
	url: string,
	discordUser: string,
	messageId: string
): Promise<{ didPromote: boolean; response: string }> {
	botLog(
		`\nAttempting to post image url: ${url} from Discord user ${discordUser}`
	);

	if (url.match(/\.(jpe?g|png|gif|bmp|webp|tiff?|heic|heif)$/i) == null) {
		botLog(`${discordUser}'s image is not a valid image`);
		return { didPromote: false, response: "Not a valid image" };
	}
	try {
		const didPromoteToAbrysFamInstagram = await postToInstagram(
			url,
			discordUser
		);

		await pool.query(
			`INSERT INTO promotions_demo (discord_user, image_url, ig_post_code, message_id, promoted_on_insta) VALUES ('${discordUser}', '${url}', '${didPromoteToAbrysFamInstagram.igPostCode}', '${messageId}', '${didPromoteToAbrysFamInstagram.didPromote}')`
		);

		return {
			didPromote: didPromoteToAbrysFamInstagram.didPromote,
			response: didPromoteToAbrysFamInstagram.response,
		};
	} catch (error) {
		const timestamp = new Date();
		botLog(
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
	const response = await fetch(url);
	let imageBuffer = await response.arrayBuffer();

	const metadata = await sharp(imageBuffer).metadata();
	if (metadata.width! < 320 || metadata.height! < 320) {
		botLog(`${discordUser}'s image is too small`);
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
		botLog(`Promoted to Instagram: ${igPostCode}`);
		return {
			didPromote: true,
			response:
				res.status === "ok"
					? `Promoted to https://www.instagram.com/p/${igPostCode}/`
					: "Weird-ass error. You should never be reading this message. Tell @SleepRides to look at the logs",
			igPostCode: igPostCode,
		};
	} catch (e) {
		botLog(e);
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

function formatDate(date: Date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hour = String(date.getHours()).padStart(2, "0");
	const minute = String(date.getMinutes()).padStart(2, "0");
	const second = String(date.getSeconds()).padStart(2, "0");
	return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

discordClient.once("ready", async () => {
	botLog("Bot is ready!");
});

discordClient.on("messageReactionAdd", async (reaction, user) => {
	console.log(`💁‍♂️ reactor: ${user.username}`);
	const messageId = reaction.message.id;
	const attachment = reaction.message.attachments.first();
	const channelName = (reaction.message.channel as TextChannel).name;
	const messageAuthor = reaction.message.author!.username;

	// TODO orm this
	const dbRecord = await pool.query(
		`SELECT * FROM promotions_demo WHERE message_id = '${messageId}'`
	);
	if (dbRecord.rows[0]?.promoted_on_insta) {
		botLog(
			`Skipping because ${attachment?.url} was already promoted on Instagram`
		);
		return;
	}

	if (isEligableToPromote(channelName, messageAuthor, reaction.count!)) {
		const reactors = await reaction.users.fetch();
		if (
			APPROVED_USERS.some((username) =>
				reactors.some((u) => u.username === username)
			)
		) {
			if (attachment) {
				reaction.message.reply(
					"Summoning an abrys to promote this on @abrys_fam ..."
				);
				const didPromoteItOnAbrysFam = await promoteItOnAbrys(
					attachment.url,
					messageAuthor,
					messageId
				);
				try {
					reaction.message.reply(didPromoteItOnAbrysFam.response);
				} catch (error) {
					botLog(error);
					reaction.message.reply(`⛔️ Uh oh, ${error}`);
				}
			}
		}
	}
});

discordClient.login(discordToken);

export function isEligableToPromote(
	channelName: string,
	discordUser: string,
	reactionCount: number
): boolean {
	return (
		channelName.includes(process.env.DISCORD_CHANNEL_NAME!) &&
		APPROVED_USERS.includes(discordUser) &&
		reactionCount > 0
	);
}
