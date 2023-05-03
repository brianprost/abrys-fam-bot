import { initializeApp } from "firebase/app";
import { IgApiClient, MediaRepositoryConfigureResponseRootObject } from "instagram-private-api";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import axios from "axios";
import sharp from "sharp";
import * as dotenv from "dotenv";
dotenv.config();

async function doTheThing() {

    
    const photoUrl = "https://cdn.discordapp.com/attachments/1102303082152460349/1103053296693940255/Capture_decran_20221217_143134.png";
    
    const doesUrlContainImage = photoUrl.match(/\.(jpe?g|png|gif|bmp|webp|tiff?|heic|heif)$/i) !== null;
    const ig = new IgApiClient();
    
    ig.state.generateDevice(process.env.IG_USERNAME!);
    await ig.account.login(process.env.IG_USERNAME!, process.env.IG_PASSWORD!);

    const { data: photoArrayBuffer, headers } = await axios.get<ArrayBuffer>(photoUrl, { responseType: "arraybuffer" });
    let photoBuffer = Buffer.from(photoArrayBuffer);

    if (headers["content-type"] !== "image/jpeg") {
        photoBuffer = await sharp(photoBuffer).jpeg().toBuffer();
    }
    const photo = {
        file: photoBuffer,
        caption: "Promoted on @abrys_fam by Discord user " + discordUser,
    }
    try {
        const publishResult: MediaRepositoryConfigureResponseRootObject = await ig.publish.photo(photo);
        console.log(`Photo uploaded: https://www.instagram.com/p/${publishResult.media.code}/`);
    
    } catch (e) {
        console.log("🤖" + e);
    }
}

await doTheThing();