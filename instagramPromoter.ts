import { IgApiClient } from "instagram-private-api";
import sharp from "sharp";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { botLog, getImageFileName } from "./utils";
import { firestore } from "./firebaseClient";

export async function postToInstagram(
    url: string,
    discordUser: string
): Promise<{ didPromote: boolean; response: string; igPostCode?: string }> {
    const ig = new IgApiClient();
    ig.state.generateDevice(process.env.IG_USERNAME!);
    await ig.account.login(process.env.IG_USERNAME!, process.env.IG_PASSWORD!);

    const response = await fetch(url);
    let imageBuffer = await response.arrayBuffer();
    const isPng = await response.headers.get("content-type")?.includes("png");
    console.log(`🤖 isPng: ${isPng}`)
    if (isPng) {
        console.log("🤖 Converting to jpeg")
        imageBuffer = await sharp(imageBuffer).jpeg().toBuffer();
    }
    const metadata = await sharp(imageBuffer).metadata();
    if (metadata.width! < 320 || metadata.height! < 320) {
        botLog(`${discordUser}'s image is too small`);
        return { didPromote: false, response: "Image is too small" };
    }

    const photoBuffer = await sharp(imageBuffer)
        .resize({ width: 1080, withoutEnlargement: true })
        .toBuffer();
    const photo = {
        file: photoBuffer,
        caption: `${discordUser} promoted it on @abrys_fam.`,
    };

    try {
        const res = await ig.publish.photo(photo);
        const igPostCode = res.media.code;
        console.log(`🤖 Posted to Instagram: ${igPostCode}`)
        return {
            didPromote: true,
            response:
                res.status === "ok"
                    ? `Promoted to https://www.instagram.com/p/${igPostCode}/`
                    : "Weird-ass error. You should never be reading this message. Tell @SleepRides to look at the logs",
            igPostCode: igPostCode,
        };
    } catch (e) {
        console.log("🤖" + e);
        return { didPromote: false, response: e };
    }
}

export async function promoteItOnAbrys(
    url: string,
    discordUser: string
): Promise<{ didPromote: boolean; response: string }> {
    botLog(
        `\nAttempting to post image url: ${url} from Discord user ${discordUser}`
    );

    if (url.match(/\.(jpe?g|png|gif|bmp|webp|tiff?|heic|heif)$/i) == null) {
        botLog(`${discordUser}'s image is not a valid image`);
        return { didPromote: false, response: "Not a valid image" };
    }
    const imageFileName = getImageFileName(url);

    const firestoreRecord = await getDoc(
        doc(
            firestore,
            `discord/bots/promote-it-on-abrys-fam/${discordUser}_${imageFileName}`
        )
    );

    const hasBeenPromoted =
        firestoreRecord.exists() &&
        Boolean(firestoreRecord.data().promoted_on_abrys_fam);

    if (hasBeenPromoted) {
        // TODO: does this even get hit?
        botLog(`${discordUser}'s ${imageFileName} has already been promoted`);
        return {
            didPromote: false,
            response: "I GET IT. You like this photo, but you already promoted it.",
        };
    }
    try {
        await setDoc(
            doc(
                firestore,
                `discord/bots/promote-it-on-abrys-fam/${discordUser}_${imageFileName}`
            ),
            {
                image_url: url,
                discord_user: discordUser,
            }
        );

        const didPromoteToAbrysFamInstagram = await postToInstagram(
            url,
            discordUser
        );

        await setDoc(
            doc(
                firestore,
                `discord/bots/promote-it-on-abrys-fam/${discordUser}_${imageFileName}`
            ),
            {
                promoted_on_abrys_fam: didPromoteToAbrysFamInstagram.didPromote,
                ig_post_code:
                    didPromoteToAbrysFamInstagram.didPromote &&
                    `https://www.instagram.com/p/${didPromoteToAbrysFamInstagram.igPostCode}/`,
            },
            { merge: true }
        );

        return {
            didPromote: didPromoteToAbrysFamInstagram.didPromote,
            response: didPromoteToAbrysFamInstagram.response,
        };
    } catch (error) {
        const timestamp = new Date();
        botLog(
            `${timestamp} Error promoting ${discordUser}'s ${imageFileName} to @abrys_fam: ${error}`
        );

        return {
            didPromote: false,
            response: `Error promoting. Tell @SleepRides to look at the logs around ${timestamp}`,
        };
    }
}