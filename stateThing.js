import { Client, GatewayIntentBits, ChannelType } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent],
});

client.once("ready", () => {
  console.log("Client is ready");
  // create (and overwrite) the log.json file
  fs.writeFile(path.join(__dirname, "log.json"), "[]", (err) => {
    if (err) console.error(`Error writing to log: ${err.message}`);
  });
});

// Replace with your channel ID
const channelId = process.env.DISCORD_CHANNEL_ID;

async function writeToLog(state) {
  // write the state to the log
  // fs.readFile(path.join(__dirname, "log.json"), (err, data) => {
  //   if (err) console.error(`Error reading log: ${err.message}`);

  //   const log = JSON.parse(data);
  //   log.push(state);

  fs.writeFile(
    path.join(__dirname, "log.json"),
    JSON.stringify(state),
    (err) => {
      if (err) console.error(`Error writing to log: ${err.message}`);
    }
  );
}

client.once("ready", async () => {
  const channel = client.channels.cache.get(channelId);
  const dateToCheck = new Date().toISOString().slice(0, 10);
  const allMessages = await channel.messages.fetch();
  const filteredMessages = allMessages.filter((message) => {
    const messageDate = message.createdAt.toISOString().slice(0, 10);
    return messageDate === dateToCheck;
  });
  await writeToLog(filteredMessages);
});

//   // log the content of the messages from the specified date
//   messagesOnDate.forEach((message) => {
//     console.log(`${message.author.username}: ${message.content}`);
//   });
// console.log(await stateOfTheChannel);

client.login(process.env.DISCORD_TOKEN);
