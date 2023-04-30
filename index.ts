import { Attachment, Client, GatewayIntentBits, TextChannel } from "discord.js";
import * as dotenv from "dotenv";
dotenv.config();

function prettyLog(message: string) {
  console.log(`🤖 new message: ${message}`);
}

async function promoteItOnAbrys(url: string, discordUser: string): Promise<string> {
  prettyLog(`image url: ${url} from ${discordUser}`);
  try {
    // Todo: this is a temp
    const response = await fetch("https://frostchildren-website.vercel.app/api/promote-it-on-abrys-fam", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, discordUser }),
    });
    const data = await response.json();
    const popstarStatus = data.popstarStatus as string;
    return popstarStatus;
  } catch (error) {
    return `error promoting to abrys: ${error}`;
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

discordClient.on("messageCreate", async (message) => {
  const channelName = message.channel as TextChannel;
  const messageAuthor = message.author.username;
  const canDoSomething =
    channelName.name === "abrys-fam" &&
    messageAuthor != "promote-it-on-abrys";
  if (canDoSomething) {
    if (message.attachments.size > 0) {
      prettyLog(`${messageAuthor} says: ${message.content}`);
      message.reply("Beep boop, summoning an abrys to post this on @abrys_fam...");
      const attachment = message.attachments.first() as Attachment;
      if (attachment.contentType?.startsWith("image/")) {
        const didPromoteToAbrys = await promoteItOnAbrys(attachment.url, messageAuthor)
        // TODO: get the reply to work
        // didPromoteToAbrys && message.reply("Promoted on @abrys_fam")
        
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

discordClient.login(token);
