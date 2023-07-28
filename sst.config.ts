import { SSTConfig } from "sst";
import { PromoteItOnAbrysFamBot } from "./stacks/PromoteItOnAbrysFamBot";

export default {
	config(_input) {
		return {
			name: "promote-it-on-abrys-fam-bot",
			region: "us-east-1",
		};
	},
	stacks(app) {
		if (app.stage !== "prod") {
			app.setDefaultRemovalPolicy("destroy");
		}
		app.stack(PromoteItOnAbrysFamBot);
	},
} satisfies SSTConfig;
