import { StackContext, Cron } from "sst/constructs";

export function PromoteItOnAbrysFamBot({ stack }: StackContext) {
	const promoteItCron = new Cron(stack, "Cron-Promote-It-On-Abrys-Fam", {
		schedule: "rate(10 minutes)",
		job: {
			function: {
				handler: "packages/functions/src/promote-it.handler",
				architecture: "arm_64",
				runtime: "nodejs18.x",
				url: {
					cors: {
						allowMethods: ["POST"],
						allowOrigins: ["*"],
					},
				},
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
					POSTGRES_DATABASE: process.env.POSTGRES_DATABASE!,
				},
			},
		},
	});

	stack.addOutputs({
		PromoteItOnAbrysFamUrl: promoteItCron.jobFunction.url,
	});
}
