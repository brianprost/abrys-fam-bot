import { Client, GatewayIntentBits } from "discord.js";
// import { IgApiClient } from "instagram-private-api";
// fs
import fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();

function prettyLog(message) {
  console.log(`🤖 new message: ${message}`);
}

async function promoteItOnAbrys(url) {
  prettyLog(`image url: ${url}`);
  try {
    const writeStream = fs.createWriteStream("image.png");
    const response = await fetch(url);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeStream.write(buffer);
  } catch (error) {
    return `error promoting to abrys: ${error}`;
  }
  return "promoted to abrys";
}

const token = process.env.DISCORD_TOKEN;
const [igUsername, igPassword] = [
  process.env.igUsername,
  process.env.igPassword,
];

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// const ig = new IgApiClient();

// async function loginInstagram() {
//   ig.state.generateDevice(igUsername);
//   await ig.simulate.preLoginFlow();
//   await ig.account.login(igUsername, igPassword);
//   await ig.simulate.postLoginFlow();
// }

discordClient.once("ready", async () => {
  prettyLog("Bot is ready!");
  // await loginInstagram();
});

discordClient.on("messageCreate", async (message) => {
  const canDoSomething =
    message.channel.name === "promote-it-on-abrys" &&
    message.author.username != "promote-it-on-abrys";
  if (canDoSomething) {
    prettyLog(`${message.author.username} says: ${message.content}`);
    if (message.attachments.size > 0) {
      message.reply("Beep boop, promoting image on abrys!");
      const attachment = message.attachments.first();
      if (attachment.contentType.startsWith("image/")) {
        const didPromotToAbrys = await promoteItOnAbrys(attachment.url);
        message.reply(didPromotToAbrys);
      }
    }
  }
});

discordClient.on("messageReactionAdd", async (reaction, user) => {
  // if (
  //   reaction.message.channel.name === "abrys" &&
  //   reaction.emoji.name === "👍" &&
  //   reaction.count >= 2
  // ) {
  //   const approvedUsers = ["angular emoji", "lulu.wav"];
  //   const reactors = await reaction.users.fetch();
  //   if (
  //     approvedUsers.every((username) =>
  //       reactors.some((u) => u.username === username)
  //     )
  //   ) {
  //     const attachment = reaction.message.attachments.first();
  //     if (attachment) {
  //       const response = await fetch(attachment.url);
  //       const buffer = await response.buffer();
  //       await postInstagram(buffer);
  //     }
  //   }
  // }
});

async function postInstagram(imageBuffer) {
  const publishResult = await ig.publish.photo({
    file: imageBuffer,
    caption: "Posted by Discord bot",
  });
  prettyLog("Image posted to Instagram:", publishResult.media.code);
}

discordClient.login(token);
