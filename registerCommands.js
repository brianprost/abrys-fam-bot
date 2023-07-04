import dotenv from "dotenv";
dotenv.config();

import * as Discord from "discord.js";

const promoteItCommand = new Discord.SlashCommandBuilder()
  .setName("promote-it")
  .setDescription("Promote it on @abrys_fam.")
  .addAttachmentOption((option) =>
    option.setName("image").setDescription("Image").setRequired(true)
  )
  .setDefaultMemberPermissions([Discord.PermissionFlagsBits.MANAGE_MESSAGES])

console.log(promoteItCommand.toJSON());

const rest = new Discord.REST({ version: "10" }).setToken(
  process.env.DISCORD_TOKEN
);

// (async () => {
//   try {
//     console.log("Started refreshing application (/) commands.");

//     await rest.put(
//       Discord.Routes.applicationGuildCommands(
//         process.env.DISCORD_CLIENT_ID,
//         process.env.DISCORD_GUILD_ID
//       ),
//       {
//         body: [promoteItCommand.toJSON()],
//       }
//     );
//     console.log("Successfully reloaded application (/) commands.");
//   } catch (error) {
//     console.error(error);
//   }
// })();
