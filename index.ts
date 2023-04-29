import { Client, GatewayIntentBits } from "@discordjs/core";
import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import { IgApiClient } from "instagram-private-api";

const token = process.env.DISCORD_TOKEN!;
const [igUsername, igPassword] = [
  process.env.igUsername!,
  process.env.igPassword!,
];

const rest = new REST({ version: "10" }).setToken(token);

const gateway = new WebSocketManager({
  token,
  intents: GatewayIntentBits.GuildMessages | GatewayIntentBits.MessageContent,
  rest,
});

const discordClient = new Client({ rest, gateway });

const ig = new IgApiClient();

async function loginInstagram() {
  ig.state.generateDevice(igUsername);
  await ig.simulate.preLoginFlow();
  await ig.account.login(igUsername, igPassword);
  await ig.simulate.postLoginFlow();
}

discordClient.once("ready", async () => {
  console.log("Bot is ready!");
  await loginInstagram();
});

discordClient.on("messageCreate", async (message) => {
  if (message.channel.name === "abrys" && message.attachments.size > 0) {
    await message.react("👍");
  }
});

discordClient.on("messageReactionAdd", async (reaction, user) => {
  if (
    reaction.message.channel.name === "abrys" &&
    reaction.emoji.name === "👍" &&
    reaction.count >= 2
  ) {
    const approvedUsers = ["angular emoji", "lulu.wav"];
    const reactors = await reaction.users.fetch();
    if (
      approvedUsers.every((username) =>
        reactors.some((u) => u.username === username)
      )
    ) {
      const attachment = reaction.message.attachments.first();
      if (attachment) {
        const response = await fetch(attachment.url);
        const buffer = await response.buffer();
        await postInstagram(buffer);
      }
    }
  }
});

async function postInstagram(imageBuffer) {
  const publishResult = await ig.publish.photo({
    file: imageBuffer,
    caption: "Posted by Discord bot",
  });
  console.log("Image posted to Instagram:", publishResult.media.code);
}

discordClient.login(token);
