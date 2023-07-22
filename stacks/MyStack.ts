import { StackContext, Api, EventBus, Table, Cron } from "sst/constructs";

export function PromoteItOnAbrysFamBot({ stack }: StackContext) {
  // const bus = new EventBus(stack, "bus", {
  //   defaults: {
  //     retries: 10,
  //   },
  // });

  const promotionTable = new Table(stack, "abrysPromotions", {
    fields: {
      userWhoPosted: "string",
      messageId: "string",
      attachmentUri: "string",
      instagramUrl: "string",
      datePosted: "string",
    },
    primaryIndex: { partitionKey: "userWhoPosted", sortKey: "messageId" },
  });

  const api = new Api(stack, "api", {
    defaults: {
      function: {
        bind: [promotionTable],
      },
    },
    routes: {
      "GET /": "packages/functions/src/lambda.handler",
      // "GET /todo": "packages/functions/src/todo.list",
      // "POST /todo": "packages/functions/src/todo.create",
      // "GET /channel-state": "packages/functions/src/channel-state.handler",
      // "GET /firebase-migration": "packages/functions/src/firebase-migration.handler",
    },
  });

  // bus.subscribe("todo.created", {
  //   handler: "packages/functions/src/events/todo-created.handler",
  // });
  new Cron(stack, "promoteIt", {
    schedule: "rate(1 minute)",
    job: "packages/functions/src/promote-it.handler",
  });

  stack.addOutputs({
    ApiEndpoint: api.url,
  });
}
