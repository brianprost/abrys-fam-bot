import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { foreignKey, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { InferModel } from "drizzle-orm";
import pg from "pg";
const { Pool } = pg;
config();

export type Promotion = InferModel<typeof promotions>;

const pool = new Pool({
  connectionString: process.env.PG_DATABASE_CONNECTION_STRING
})

export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  userWhoPosted: text("user_who_posted").notNull(),
  messageId: text("message_id").notNull(),
  attachmentUrl: text("attachment_url"),
  attachmentName: text("attachment_name"),
  instagramUrl: text("instagram_url"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const reactions = pgTable("reactions", {
  id: serial("id").primaryKey(),
  reactorUsername: text("reactor_username").notNull(),
  messageId: text("message_id").notNull(),
  promotionId: integer("promotion_id").notNull(),
}, (reactions) => {
  return {
    promotionIdFk: foreignKey({
      columns: [reactions.promotionId],
      foreignColumns: [promotions.id],
    })
  }
});

const db = drizzle(pool)

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent],
});

client.once("ready", () => {
  console.log("🧽 I'm ready!");
});

const channelId = process.env.DISCORD_CHANNEL_ID;

client.once("ready", async () => {
  console.log("Checking for messages");

  const channel: TextChannel = client.channels.cache.get(
    channelId!
  ) as TextChannel;

  const allMessages = await channel!.messages.fetch();
  const filteredMessages = allMessages.filter((message) => {
    const inPrevious360Days =
      new Date(message.createdTimestamp) >
      new Date(new Date().setDate(new Date().getDate() - 500));
    return inPrevious360Days && message.attachments.size > 0;
  });

  allMessages.map(async (message) => {
    const { id } = message;
    try {
      const actualMessage = await channel.messages.fetch(id);
      const userWhoPosted = actualMessage.author.username;
      const attachmentUrl = actualMessage.attachments.first()?.url;
      const attachmentName = actualMessage.attachments.first()?.name;
      const reactors = await Promise.all(actualMessage.reactions.cache.map(async (reaction) => {
        const reactorsTmp = await reaction.users.fetch();
        return reactorsTmp.map((user) => user.username);
      }))
      if (reactors.length > 0) {
        // first let's add the promotion to the promotions table
        const messageId = actualMessage.id;
        const newDbRecord = {
          userWhoPosted,
          messageId,
          attachmentUrl,
          attachmentName
        }
        const promotionInsertion = await db.insert(promotions).values(newDbRecord).returning();
        const promotionId = promotionInsertion[0].id;
        for (const reactorList of reactors) {
          for (const reactor of reactorList) {
            const newReactionRecord = {
              reactorUsername: reactor,
              messageId,
              promotionId
            };
            await db.insert(reactions).values(newReactionRecord).returning();
          }
        }
      }
    } catch (err) {
      console.log(err);
    }
  });
  const allPromotions = await db.select().from(promotions);
  console.log(allPromotions);
});

client.login(process.env.DISCORD_TOKEN);
