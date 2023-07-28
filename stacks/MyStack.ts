import { StackContext, Api, Cron } from "sst/constructs";
import { config } from "dotenv";

export function PromoteItOnAbrysFamBot({ stack }: StackContext) {
	const api = new Api(stack, "api", {
		defaults: {
			function: {
				bind: [],
        environment: {
          DISCORD_TOKEN: process.env.DISCORD_TOKEN!,
          DISCORD_CHANNEL_NAME: process.env.DISCORD_CHANNEL_NAME!,
          DISCORD_CHANNEL_ID: process.env.DISCORD_CHANNEL_ID!,
          DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID!,
          DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID!,
          IG_USERNAME: process.env.IG_USERNAME!,
          IG_PASSWORD: process.env.IG_PASSWORD!,
          POSTGRES_URL: process.env.POSTGRES_URL!,
          POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL!,
          POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING!,
          POSTGRES_USER: process.env.POSTGRES_USER!,
          POSTGRES_HOST: process.env.POSTGRES_HOST!,
          POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD!,
          POSTGRES_DATABASE: process.env.POSTGRES_DATABASE!
        }
			},
		},
		routes: {
			"POST /": "packages/functions/src/promote-it.handler",
		},
	});
	new Cron(stack, "promoteIt", {
		schedule: "rate(30 minutes)",
		job: "packages/functions/src/promote-it.handler",
	});

	stack.addOutputs({
		ApiEndpoint: api.url,
	});
}
