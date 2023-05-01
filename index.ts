import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import * as dotenv from "dotenv";
dotenv.config();

const approvedUsers = ["angular emoji", "luluwav"]

function prettyLog(message: string) {
  console.log(`🤖 ${message}`);
}

async function promoteItOnAbrys(url: string, discordUser: string): Promise<string> {
  prettyLog(`Attempting to post image url: ${url} from Discord user: ${discordUser}`);
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

discordClient.on("messageReactionAdd", async (reaction, user) => {
  const channelName = (reaction.message.channel as TextChannel).name;
  const messageAuthor = reaction.message.author!.username;
  if (
    channelName === "abrys-fam" &&
    approvedUsers.includes(user.username!) &&
    reaction.count && reaction.count > 0
  ) {
    console.log(`${messageAuthor} reacted with ${reaction.emoji.name}`);
    const reactors = await reaction.users.fetch();
    if (
      approvedUsers.every((username) =>
        reactors.some((u) => u.username === username)
      )
    ) {
      const attachment = reaction.message.attachments.first();
      if (attachment) {
        await promoteItOnAbrys(attachment.url, messageAuthor);
        reaction.message.reply("Beep boop, Summoning an abrys to promote this on @abrys_fam");
      }
    }
  }
});

discordClient.login(token);
