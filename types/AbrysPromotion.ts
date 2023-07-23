// export type AbrysPromotion = InferModel<typeof abrysPromotions>;
// export const abrysPromotions = pgTable("abrys_promotions", {
//     id: serial("id").primaryKey(),
//     discordUser: text("discord_user"),
//     imageUrl: text("image_url"),
//     igPostCode: text("ig_post_code"),
//     messageId: text("message_id"),
//     promotedOnInsta: text("promoted_on_insta"),
//     createdAt: timestamp("created_at").defaultNow().notNull(),
// });

export type AbrysPromotion = {
    id: number,
    discordUser: string,
    imageUrl: string,
    igPostCode: string,
    messageId: string,
    promotedOnInsta: boolean,
}