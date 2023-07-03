export type DiscordMessage = {
    channelId: string,
    guildId: string,
    id: string,
    createdTimestamp: number,
    type: number,
    system: boolean,
    content: string,
    authorId: string,
    pinned: boolean,
    tts: boolean,
    nonce: any, // i'm inferring
    embeds: [],
    components: [],
    attachments: any[], // i'm inferring
    stickers: [],
    position: any, // i'm inferring
    roleSubscriptionData: any, // i'm inferring
    editedTimestamp: any, // i'm inferring
    mentions: {
        everyone: boolean,
        users: [],
        roles: [],
        crosspostedChannels: [],
        repliedUser: any, // i'm inferring
        members: [],
        channels: []
    },
    webhookId: any, // i'm inferring
    groupActivityApplicationId: any, // i'm inferring
    applicationId: any, // i'm inferring
    activity: any, // i'm inferring
    flags: number,
    reference: any, // i'm inferring
    interaction: any, // i'm inferring
    cleanContent: string,
}