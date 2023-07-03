import { Client, Collection, GatewayIntentBits, Message, TextChannel } from "discord.js";
import { getDatabase, ref, get, set } from "firebase/database";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { initializeApp } from "firebase/app";
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const database = getDatabase(firebaseApp);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent],
});

client.once("ready", () => {
  console.log("🧽 I'm ready!");
});

const channelId = process.env.DISCORD_CHANNEL_ID;

client.once("ready", async () => {
  setInterval(async () => {

    console.log("Checking for messages")

    const channel: TextChannel = client.channels.cache.get(channelId!) as TextChannel;

    const allMessages = await channel!.messages.fetch();
    const filteredMessages = allMessages.filter((message) => {
      const inPrevious360Days = new Date(message.createdTimestamp) > new Date(new Date().setDate(new Date().getDate() - 500));
      return inPrevious360Days && message.attachments.size > 0;
    });

    const previousStateRef = ref(database, `discordState/${process.env.DISCORD_CHANNEL_NAME}`);
    const previousStateSnapshot = await get(previousStateRef);
    const previousState = previousStateSnapshot.val();
    const previousStateIDs = Object.keys(previousState);

    const newMessages = filteredMessages.filter((message) => !previousStateIDs.includes(message.id));
    if (newMessages.size > 0) {
      console.log("New messages found")
      const newMessagesJSON = newMessages.map((message) => {
        return {
          [message.id]: message.toJSON(),
        };
      });
      newMessagesJSON.forEach((message) => {
        set(ref(database, `discordState/${process.env.DISCORD_CHANNEL_NAME}/${Object.keys(message)[0]}`), message[Object.keys(message)[0]]);
      });
    }
  }, 1000);
});

client.login(process.env.DISCORD_TOKEN);
