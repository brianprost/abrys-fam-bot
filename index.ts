import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import * as dotenv from "dotenv";

dotenv.config();

const APPROVED_USERS = ["angular emoji", "luluwav", "SleepRides"]

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


function prettyLog(message: string) {
  console.log(`🤖 ${message}`);
}

async function promoteItOnAbrys(url: string, discordUser: string): Promise<boolean> {
  prettyLog(`Attempting to post image url: ${url} from Discord user ${discordUser}`);
  const imageFileName = url.split("/").pop()?.split(".")[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  try {
    await setDoc(doc(firestore, `discord/bots/promote-it-on-abrys-fam/${discordUser}_${imageFileName}`), {
      image_url: url,
      discord_user: discordUser,
    });

    // Todo: this is a temp
    const response = await fetch("https://frostchildren-website.vercel.app/api/promote-it-on-abrys-fam", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, discordUser }),
    });
    const data = await response.json();
    const promotionStatus = data.success as boolean;
    await setDoc(doc(firestore, `discord/bots/promote-it-on-abrys-fam/${discordUser}_${imageFileName}`), {
      sent_to_promotion_api: promotionStatus,
    }, { merge: true });
    return promotionStatus;
  } catch (error) {
    console.log(error);
    return false;
  }
}

const token = process.env.DISCORD_TOKEN;

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

discordClient.once("ready", async () => {
  prettyLog("Bot is ready!");
});

discordClient.on("messageReactionAdd", async (reaction, user) => {
  const channelName = (reaction.message.channel as TextChannel).name;
  const messageAuthor = reaction.message.author!.username;
  const hasAlreadyBeenPromoted = false;

  if (
    channelName === "abrys-fam" &&
    APPROVED_USERS.includes(user.username!) &&
    reaction.count && reaction.count > 0 &&
    hasAlreadyBeenPromoted
  ) {
    console.log(`${messageAuthor} reacted with ${reaction.emoji.name}`);
    const reactors = await reaction.users.fetch();
    if (
      APPROVED_USERS.every((username) =>
        reactors.some((u) => u.username === username)
      )
    ) {
      const attachment = reaction.message.attachments.first();
      if (attachment) {
        const didPromoteItOnAbrysFam = await promoteItOnAbrys(attachment.url, messageAuthor);
        didPromoteItOnAbrysFam ? reaction.message.reply("Beep boop. Summoning an abrys to promote this on @abrys_fam") : reaction.message.reply("Beep boop. There was an error 😢🤖. Did not promote to @abrys_fam");
      }
    }
  }
});

discordClient.login(token);
