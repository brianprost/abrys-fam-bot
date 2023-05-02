import { initializeApp } from "firebase/app";
import { IgApiClient } from "instagram-private-api";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
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

  const imageFileName = url.split("/").pop()?.split(".")[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const firestoreRecord = await getDoc(doc(firestore, `discord/bots/promote-it-on-abrys-fam/${discordUser}_${imageFileName}`));
  const hasBeenPromoted = firestoreRecord.exists() && Boolean(firestoreRecord.data().promoted_on_abrys_fam);

  if (hasBeenPromoted) {
    botLog(`${discordUser}'s ${imageFileName} has already been promoted`);
    return { didPromote: false, response: "Already promoted" };
  }
  try {
    await setDoc(doc(firestore, `discord/bots/promote-it-on-abrys-fam/${discordUser}_${imageFileName}`), {
      image_url: url,
      discord_user: discordUser,
    });

    const didPromoteToAbrysFamInstagram = await postToInstagram(url, discordUser);

    await setDoc(doc(firestore, `discord/bots/promote-it-on-abrys-fam/${discordUser}_${imageFileName}`), {
      promoted_on_abrys_fam: didPromoteToAbrysFamInstagram,
    }, { merge: true });
    return { didPromote: true, response: "Successfully promoted" };
  } catch (error) {
    const timestamp = new Date();
    botLog(`${timestamp} Error promoting ${discordUser}'s ${imageFileName} to @abrys_fam: ${error}`);
    return { didPromote: false, response: `Error promoting. Tell @SleepRides to look at the logs around ${timestamp}` };
  }
}

async function postToInstagram(url: string, discordUser: string) {
  const ig = new IgApiClient();
  ig.state.generateDevice(process.env.IG_USERNAME!);
  await ig.account.login(process.env.IG_USERNAME!, process.env.IG_PASSWORD!);
  const response = await fetch(url);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  try {
    await ig.publish.photo({
      file: buffer,
      caption: "Promoted on @abrys_fam by Discord user " + discordUser,
    });
    return true;
  } catch (e) {
    console.log("🤖" + e);
    return false;
  }
}

discordClient.once("ready", async () => {
  botLog("Bot is ready!");
});

discordClient.on("messageReactionAdd", async (reaction, user) => {
  const channelName = (reaction.message.channel as TextChannel).name;
  const messageAuthor = reaction.message.author!.username;

  if (
    channelName === "abrys-fam" &&
    APPROVED_USERS.includes(user.username!) &&
    reaction.count && reaction.count > 0
  ) {
    console.log(`${messageAuthor} reacted with ${reaction.emoji.name}`);
    const reactors = await reaction.users.fetch();
    if (
      APPROVED_USERS.some((username) =>
        reactors.some((u) => u.username === username)
      )
    ) {
      const attachment = reaction.message.attachments.first();
      if (attachment) {
        reaction.message.reply("Beep boop. Summoning an abrys to promote this on @abrys_fam")
        const didPromoteItOnAbrysFam = await promoteItOnAbrys(attachment.url, messageAuthor);
        didPromoteItOnAbrysFam && reaction.message.reply(didPromoteItOnAbrysFam.response);
      }
    }
  }
});

discordClient.login(discordToken);
