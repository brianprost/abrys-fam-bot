import { TextChannel } from "discord.js";

import { discordClient, discordToken } from "./discordClient";
import { wasAlreadyPromoted } from "./firebaseClient";
import { promoteItOnAbrys } from "./instagramPromoter";
import { getImageFileName, botLog } from "./utils";

const APPROVED_USERS = ["angular emoji", "luluwav", "SleepRides"];

process.on('uncaughtException', (err, origin) => {
  botLog(`Caught exception: ${err}\n` + `Exception origin: ${origin}`);
});

process.on('unhandledRejection', (reason, promise) => {
  botLog(`Unhandled Rejection at:, ${promise}, reason:, ${reason}`);
});

discordClient.on("ready", () => {
  botLog(`Logged in as ${discordClient.user?.tag}!`);
});

discordClient.on("messageReactionAdd", async (reaction, user) => {
  const attachment = reaction.message.attachments.first();
  const channelName = (reaction.message.channel as TextChannel).name;
  const messageAuthor = reaction.message.author!.username;
  const alreadyPromoted =
    attachment &&
    (await wasAlreadyPromoted(
      messageAuthor,
      getImageFileName(attachment!.url)
    ));
  if (alreadyPromoted) return;

  const isEligableToPromote =
    channelName.includes("abrystests") &&
    APPROVED_USERS.includes(user.username!) &&
    reaction.count! > 0;

  if (isEligableToPromote) {
    const reactors = await reaction.users.fetch();
    if (
      APPROVED_USERS.some((username) =>
        reactors.some((u) => u.username === username)
      )
    ) {
      if (attachment) {
        reaction.message.reply(
          "Summoning an abrys to promote this on @abrys_fam ..."
        );
        const didPromoteItOnAbrysFam = await promoteItOnAbrys(
          attachment.url,
          messageAuthor
        );
        try {
          // // TODO: delete originial response and replace with new one
          // reaction.message.channel.messages.fetch({ limit: 1 }).then((messages) => {
          //   const lastMessage = messages.first();
          //   if (lastMessage?.author.id === discordClient.user?.id) {
          //     lastMessage.delete();
          //   }
          // });
          reaction.message.reply(didPromoteItOnAbrysFam.response);
        } catch (error) {
          console.log("🤖" + error);
          reaction.message.reply(`⛔️ Uh oh, ${error}`);
        }
      }
    }
  }
});

discordClient.login(discordToken);
