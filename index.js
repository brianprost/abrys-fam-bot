import { Client, GatewayIntentBits } from "discord.js";
// import { IgApiClient } from "instagram-private-api";
import * as dotenv from "dotenv";
dotenv.config();

function prettyLog(message) {
  console.log(`🤖 new message: ${message}`);
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
    // GatewayIntentBits.GuildMembers
  ]
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
  // echo any message sent in the "promote-it-on-abrys" channel. for some reason, `name` is not working
  prettyLog(message.content);
  // if there's an image attached, reply "nice pic, yo"
  if (message.attachments.size > 0) {
    message.reply("nice pic, yo");
    if (message.attachments.first().url) {
      const response = await fetch(message.attachments.first().url);
      const buffer = await response.buffer();
      await postInstagram(buffer);
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

// async function postInstagram(imageBuffer) {
//   const publishResult = await ig.publish.photo({
//     file: imageBuffer,
//     caption: "Posted by Discord bot",
//   });
//   prettyLog("Image posted to Instagram:", publishResult.media.code);
// }

async function postInstagram(imageBuffer) {
  // for testing purposes for now, just save the image to the local disk
  const fs = require("fs");
  fs.writeFile("test.jpg", imageBuffer, function (err) {
    if (err) return console.log(err);
    prettyLog("Image saved to disk");
  }
  );
}

discordClient.login(token);
