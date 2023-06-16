import dotenv from "dotenv";
dotenv.config();

import * as Discord from "discord.js";

const commands = [
  {
    name: "ping",
    description: "Replies with Pong!",
    // options: [
    //     {
    //         name: "image-url",
    //         description: "Image URL",
    //         type: Discord.ApplicationCommandOptionType.String,
    //         required: true
    //     }
    // ]
  },
];

const rest = new Discord.REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(
      Discord.Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.DISCORD_GUILD_ID
      ),
      { body: commands }
    );
    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();
