import { SSTConfig } from "sst";
import { PromoteItOnAbrysFamBot } from "./stacks/MyStack";

export default {
  config(_input) {
    return {
      name: "promote-it-on-abrys-fam-bot",
      region: "us-east-1",
    };
  },
  stacks(app) {
    app.stack(PromoteItOnAbrysFamBot);
  }
} satisfies SSTConfig;
