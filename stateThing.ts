import { Client, Collection, GatewayIntentBits, Message, TextChannel } from "discord.js";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { DiscordMessage } from "./types/DiscordMessage";
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent],
});

client.once("ready", () => {
  console.log("Client is ready");
  // create (and overwrite) the log.json file
  // fs.writeFile(path.join(__dirname, "log.json"), "[]", (err) => {
  //   if (err) console.error(`Error writing to log: ${err.message}`);
  // });
});

// Replace with your channel ID
const channelId = process.env.DISCORD_CHANNEL_ID;
const dateToCheck = new Date().toISOString().slice(0, 10);

async function loadLog() {
  // load the log from the file
  fs.readFile(path.join(__dirname, "log.json"), (err, data) => {
    if (err) console.error(`Error reading log: ${err.message}`);
    return JSON.parse(data as unknown as string);
  });
}

async function writeToLog(state: Collection<string, Message<true>>) {
  fs.writeFile(
    path.join(__dirname, "log.json"),
    JSON.stringify(state),
    (err) => {
      if (err) console.error(`Error writing to log: ${err.message}`);
    }
  );
}

client.once("ready", () => {
  setInterval(async () => {
    console.log("Checking for messages")
    const channel: TextChannel = client.channels.cache.get(channelId!) as TextChannel;
    const allMessages = await channel!.messages.fetch();
    const filteredMessages = allMessages.filter((message) => {
      const messageDate = message.createdAt.toISOString().slice(0, 10);
      return messageDate === dateToCheck && message.attachments.size > 0;
    });
    await writeToLog(filteredMessages);
  }, 1000);
});

// async function getHash(string) {
//   const encoder = new TextEncoder();
//   const data = encoder.encode(string);
//   const hash = await crypto.subtle.digest("SHA-256", data);
//   return hash;
// }

//   // log the content of the messages from the specified date
//   messagesOnDate.forEach((message) => {
//     console.log(`${message.author.username}: ${message.content}`);
//   });
// console.log(await stateOfTheChannel);

client.login(process.env.DISCORD_TOKEN);
