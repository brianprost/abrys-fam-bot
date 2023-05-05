import { initializeApp } from "firebase/app";
import { IgApiClient } from "instagram-private-api";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import axios from "axios";
import sharp from "sharp";
import * as dotenv from "dotenv";

dotenv.config();
const APPROVED_USERS = ["angular emoji", "luluwav", "SleepRides"]

const discordToken = process.env.DISCORD_TOKEN;

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
}

const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp);

function botLog(message: string) {
  console.log(`🤖 ${message}`);
}

async function promoteItOnAbrys(url: string, discordUser: string): Promise<{ didPromote: boolean, response: string }> {
  botLog(`Attempting to post image url: ${url} from Discord user ${discordUser}`);

  if (url.match(/\.(jpe?g|png|gif|bmp|webp|tiff?|heic|heif)$/i) == null) {
    botLog(`${discordUser}'s image is not a valid image`);
    return { didPromote: false, response: "Not a valid image" };
  }
  const imageFileName = getImageFileName(url);

  const firestoreRecord = await getDoc(doc(firestore, `discord/bots/promote-it-on-abrys-fam/${discordUser}_${imageFileName}`));

  const hasBeenPromoted = firestoreRecord.exists() && Boolean(firestoreRecord.data().promoted_on_abrys_fam);

  if (hasBeenPromoted) {
    // TODO: does this even get hit?
    botLog(`${discordUser}'s ${imageFileName} has already been promoted`);
    return { didPromote: false, response: "I GET IT. You like this photo, but you already promoted it." };
  }
  try {
    await setDoc(doc(firestore, `discord/bots/promote-it-on-abrys-fam/${discordUser}_${imageFileName}`), {
      image_url: url,
      discord_user: discordUser,
    });

    const didPromoteToAbrysFamInstagram = await postToInstagram(url, discordUser);

    await setDoc(doc(firestore, `discord/bots/promote-it-on-abrys-fam/${discordUser}_${imageFileName}`), {
      promoted_on_abrys_fam: didPromoteToAbrysFamInstagram.didPromote,
      ig_post_code: didPromoteToAbrysFamInstagram.didPromote && `https://www.instagram.com/p/${didPromoteToAbrysFamInstagram.igPostCode}/`,
    }, { merge: true });

    return { didPromote: didPromoteToAbrysFamInstagram.didPromote, response: didPromoteToAbrysFamInstagram.response };

  } catch (error) {
    const timestamp = new Date();
    botLog(`${timestamp} Error promoting ${discordUser}'s ${imageFileName} to @abrys_fam: ${error}`);

    return { didPromote: false, response: `Error promoting. Tell @SleepRides to look at the logs around ${timestamp}` };
  }
}

async function postToInstagram(url: string, discordUser: string): Promise<{ didPromote: boolean, response: string, igPostCode?: string }> {

  const ig = new IgApiClient();
  ig.state.generateDevice(process.env.IG_USERNAME!);
  await ig.account.login(process.env.IG_USERNAME!, process.env.IG_PASSWORD!);

  const { data: photoArrayBuffer, headers } = await axios.get<ArrayBuffer>(url, { responseType: "arraybuffer" });
  let photoBuffer = Buffer.from(photoArrayBuffer);

  if (headers["content-type"] !== "image/jpeg") {
    photoBuffer = await sharp(photoBuffer).jpeg().toBuffer();
  }
  const photo = {
    file: photoBuffer,
    caption: "Promoted on @abrys_fam by Discord user " + discordUser,
  }
  try {
    const res = await ig.publish.photo(photo);
    const igPostCode = res.media.code;

    return { didPromote: true, response: res.status === "ok" ? `Promoted to https://www.instagram.com/p/${igPostCode}/` : "Weird-ass error. You should never be reading this message. Tell @SleepRides to look at the logs", igPostCode: igPostCode };
  } catch (e) {
    console.log("🤖" + e);

    return { didPromote: false, response: e };
  }
}

function getImageFileName(url: string): string {
  return url.split("/").pop()?.split(".")[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "") ?? "";
}

async function wasAlreadyPromoted(discordUser: string, imageFileName: string): Promise<boolean> {
  const firestoreRecord = await getDoc(doc(firestore, `discord/bots/promote-it-on-abrys-fam/${discordUser}_${imageFileName}`));
  return firestoreRecord.exists() && Boolean(firestoreRecord.data().promoted_on_abrys_fam);
}

discordClient.once("ready", async () => {
  botLog("Bot is ready!");
});

discordClient.on("messageReactionAdd", async (reaction, user) => {
  console.log(`Reaction ${reaction.emoji.name} from ${user.username}`);
  const attachment = reaction.message.attachments.first();
  if (!attachment) return;
  const channelName = (reaction.message.channel as TextChannel).name;
  const messageAuthor = reaction.message.author!.username;
  const alreadyPromoted = await wasAlreadyPromoted(messageAuthor, getImageFileName(attachment.url));
  if (alreadyPromoted) return

  const isEligableToPromote = channelName.includes("abrys-fam") && APPROVED_USERS.includes(user.username!) && reaction.count! > 0

  if (isEligableToPromote) {
    const reactors = await reaction.users.fetch();
    if (
      APPROVED_USERS.some((username) =>
        reactors.some((u) => u.username === username)
      )
    ) {
      if (attachment) {
        reaction.message.reply("Summoning an abrys to promote this on @abrys_fam ...")
        const didPromoteItOnAbrysFam = await promoteItOnAbrys(attachment.url, messageAuthor);
        try {
          reaction.message.reply(didPromoteItOnAbrysFam.response);
        } catch (error) {
          console.log("🤖" + error);
          reaction.message.reply(`⛔️ Uh oh, ${error}`)
        }
      }
    }
  }
});

discordClient.login(discordToken);
