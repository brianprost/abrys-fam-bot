import { IgApiClient } from "instagram-private-api";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import sharp from "sharp";
import * as dotenv from "dotenv";
import pg from "pg";
import { InferModel } from "drizzle-orm";
import { boolean, pgTable, serial, text } from "drizzle-orm/pg-core";


/////////////
// CONFIGS //
/////////////

dotenv.config();

const isDevMode = process.argv.includes("--dev");

// DISCORD //

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

// POSTGRES //

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
});

// INSTAGRAM //

const ig = new IgApiClient();
ig.state.generateDevice(process.env.IG_USERNAME!);
await ig.account.login(process.env.IG_USERNAME!, process.env.IG_PASSWORD!);

export async function promoteItOnAbrys(
	url: string,
	discordUser: string,
	messageId: string
): Promise<{ didPromote: boolean; response: string }> {
	console.log(
		`\nAttempting to post image url: ${url} from Discord user ${discordUser}`
	);

	if (url.match(/\.(jpe?g|png|gif|bmp|webp|tiff?|heic|heif)$/i) == null) {
		console.log(`${discordUser}'s image is not a valid image`);
		return { didPromote: false, response: "Not a valid image" };
	}
	try {
		const response = await fetch(url);
		let imageBuffer = await response.arrayBuffer();

		const caption = `${discordUser} promoted it on @abrys_fam`;

		const didPromoteToAbrysFamInstagram = await postToInstagram(
			caption,
			imageBuffer
		);
		console.log(didPromoteToAbrysFamInstagram.response);
		// const didPromoteToAbrysFamInstagram = {
		// 	// for dev purposes
		// 	didPromote: true,
		// 	response: "[DEV MODE] Promoted to https://www.instagram.com/p/COZ3ZJ5nZ7Q/",
		// 	igPostCode: "COZ3ZJ5nZ7Q",
		// };

		await pool.query(
			`INSERT INTO promotions (discord_user, image_url, ig_post_code, message_id) VALUES ('${discordUser}', '${url}', '${didPromoteToAbrysFamInstagram.igPostCode}', '${messageId}')`
		);

		return {
			didPromote: didPromoteToAbrysFamInstagram.didPromote,
			response: didPromoteToAbrysFamInstagram.response,
		};
	} catch (error) {
		const timestamp = formatDate(new Date());
		console.log(
			`Error promoting ${discordUser}'s ${getImageFileName(
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
	caption: string,
	image: ArrayBuffer
): Promise<{ didPromote: boolean; response: string; igPostCode?: string }> {
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
	console.log("🤖 I'm connected to Discord!");
});

discordClient.on("messageReactionAdd", async (reaction, user) => {
	const messageId = reaction.message.id;
	const attachment = reaction.message.attachments.first();
	const channelName = (reaction.message.channel as TextChannel).name;
	const messageAuthor = reaction.message.author!.username;
	console.log(
		`🙀 Noticed a reaction from ${user.username} on one of ${messageAuthor}'s messages`
	);

	// TODO orm this
	const dbRecord = await pool.query(
		`SELECT * FROM promotions WHERE message_id = '${messageId}'`
	);
	if (dbRecord.rows[0]?.promoted_on_insta) {
		console.log(
			`Skipping because ${attachment?.url} was already promoted on Instagram`
		);
		return;
	} else {
		console.log(
			`${attachment?.url} was not previously promoted on Instagram, so we're going to try to promote it now.`
		);
	}

	if (
		channelName.includes(process.env.DISCORD_CHANNEL_NAME!) &&
		reaction.count! > 0
	) {
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
					console.log(error);
					reaction.message.reply(`⛔️ Uh oh, ${error}`);
				}
			}
		} else {
			console.log(
				`Not promoting because ${user.username} is not an approved reactor.`
			);
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
