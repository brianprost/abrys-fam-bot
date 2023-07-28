const { Client, GatewayIntentBits, TextChannel } = await import("discord.js")
const { config } = await import("dotenv")
const { drizzle } = await import("drizzle-orm/node-postgres")
const { pgTable, serial, text, timestamp, boolean } = await import("drizzle-orm/pg-core")
const { InferModel, isNull } = await import("drizzle-orm")
const pg = await import("pg");
