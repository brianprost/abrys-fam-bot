import { initializeApp } from "firebase/app";
import { IgApiClient } from "instagram-private-api";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
// import { getAuth, signInWithCustomToken } from "firebase/auth";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import sharp from "sharp";
import * as dotenv from "dotenv";
import * as admin from "firebase-admin";
import * as serviceAccount from "./firebase/fbAdminServiceKey.json" assert { type: "json" };

dotenv.config();
const APPROVED_USERS = ["angular emoji", "angularemoji", "angular emoji#6001", "luluwav", "lulu.wav", "luluwav#5414", "sleeprides"];

const discordToken = process.env.DISCORD_TOKEN;

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// const firebaseAdminServiceAccount = {
//   type: process.env.FIREBASE_ADMIN_TYPE!,
//   project_id: process.env.FIREBASE_ADMIN_PROJECT_ID!,
//   private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID!,
//   private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY!,
//   client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
//   client_id: process.env.FIREBASE_ADMIN_CLIENT_ID!,
//   auth_uri: process.env.FIREBASE_ADMIN_AUTH_URI!,
//   token_uri: process.env.FIREBASE_ADMIN_TOKEN_URI!,
//   auth_provider_x509_cert_url: process.env.FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL!,
//   client_x509_cert_url: process.env.FIREBASE_ADMIN_CLIENT_X509_CERT_URL!,
//   universe_domain: process.env.FIREBASE_ADMIN_UNIVERSE_DOMAIN!,
// } as admin.ServiceAccount;

// console.log(firebaseAdminServiceAccount)

const firebaseApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  databaseURL: "https://frost-children-default-rtdb.firebaseio.com"
});

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREABSE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

// const firebaseApp = initializeApp(firebaseConfig);
// const firestore = getFirestore(firebaseApp);
// const auth = getAuth();
// async function authenticateWithFirebase() {
//   const customToken = process.env.FIREBASE_CUSTOM_TOKEN;
//   try {
//     const userCredential = await signInWithCustomToken(auth, customToken!);
//     console.log("🔥 authenticated with Firebase");
//     return userCredential.user;
//   } catch (error) {
//     const errorCode = error.code;
//     const errorMessage = error.message;
//     console.error(
//       "Error authenticating with Firebase: ",
//       errorCode,
//       errorMessage
//     );
//     // tell discord channel that the bot is shutting down
//     discordClient.on("ready", () => {
//       const channel = discordClient.channels.cache.get(
//         "1102303082152460349"
//       ) as TextChannel;
//       channel.send(
//         `I'm dying. @SleepRides plz help: ${errorCode} ${errorMessage}`
//       );
//       process.exit(1);
//     });
//   }
// }

// authenticateWithFirebase();

const ig = new IgApiClient();
ig.state.generateDevice(process.env.IG_USERNAME!);
await ig.account.login(process.env.IG_USERNAME!, process.env.IG_PASSWORD!);

function botLog(message: string) {
  console.log(`🤖 ${message}`);
}

export async function promoteItOnAbrys(
  url: string,
  discordUser: string,
  postHash: string
): Promise<{ didPromote: boolean; response: string }> {
  botLog(
    `\nAttempting to post image url: ${url} from Discord user ${discordUser}`
  );

  if (url.match(/\.(jpe?g|png|gif|bmp|webp|tiff?|heic|heif)$/i) == null) {
    botLog(`${discordUser}'s image is not a valid image`);
    return { didPromote: false, response: "Not a valid image" };
  }
  try {
    const didPromoteToAbrysFamInstagram = await postToInstagram(
      url,
      discordUser
    );

    // await setDoc(
    //   doc(firestore, `promote-it-on-abrys-fam-bot/${postHash}`),
    //   {
    //     image_url: url,
    //     discord_user: discordUser,
    //     promoted_on_insta: didPromoteToAbrysFamInstagram.didPromote,
    //     ig_post_code:
    //       didPromoteToAbrysFamInstagram.didPromote &&
    //       `https://www.instagram.com/p/${didPromoteToAbrysFamInstagram.igPostCode}/`,
    //   },
    //   { merge: true }
    // );
    await firebaseApp.firestore().collection("promote-it-on-abrys-fam-bot").doc(postHash).set({
      image_url: url,
      discord_user: discordUser,
      promoted_on_insta: didPromoteToAbrysFamInstagram.didPromote,
      ig_post_code:
        didPromoteToAbrysFamInstagram.didPromote &&
        `https://www.instagram.com/p/${didPromoteToAbrysFamInstagram.igPostCode}/`,
    }, { merge: true });


    return {
      didPromote: didPromoteToAbrysFamInstagram.didPromote,
      response: didPromoteToAbrysFamInstagram.response,
    };
  } catch (error) {
    const timestamp = new Date();
    botLog(
      `${timestamp} Error promoting ${discordUser}'s ${getImageFileName(
        url
      )} to @abrys_fam: ${error}`
    );

    return {
      didPromote: false,
      response: `Error promoting. Tell @SleepRides to look at the logs around ${timestamp}`,
    };
  }
}

async function postToInstagram(
  url: string,
  discordUser: string
): Promise<{ didPromote: boolean; response: string; igPostCode?: string }> {
  const response = await fetch(url);
  let imageBuffer = await response.arrayBuffer();

  const metadata = await sharp(imageBuffer).metadata();
  if (metadata.width! < 320 || metadata.height! < 320) {
    botLog(`${discordUser}'s image is too small`);
    return { didPromote: false, response: "Image is too small" };
  }

  const photoBuffer = await sharp(imageBuffer)
    .resize({ width: 1080, withoutEnlargement: true })
    .jpeg({ quality: 100 })
    .toBuffer();
  const photo = {
    file: photoBuffer,
    caption: `${discordUser} promoted it on @abrys_fam.`,
  };

  try {
    const res = await ig.publish.photo(photo);
    const igPostCode = res.media.code;
    botLog(`Promoted to Instagram: ${igPostCode}`);
    return {
      didPromote: true,
      response:
        res.status === "ok"
          ? `Promoted to https://www.instagram.com/p/${igPostCode}/`
          : "Weird-ass error. You should never be reading this message. Tell @SleepRides to look at the logs",
      igPostCode: igPostCode,
    };
  } catch (e) {
    botLog(e);
    return { didPromote: false, response: e };
  }
}

function getImageFileName(url: string): string {
  return (
    url
      .split("/")
      .pop()
      ?.split(".")[0]
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") ?? ""
  );
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

discordClient.once("ready", async () => {
  botLog("Bot is ready!");
});

discordClient.on("messageReactionAdd", async (reaction, user) => {
  console.log(`💁‍♂️ reactor: ${user.username}`);
  const attachment = reaction.message.attachments.first();
  const channelName = (reaction.message.channel as TextChannel).name;
  const messageAuthor = reaction.message.author!.username;
  const messageDate = formatDate(reaction.message.createdAt);
  const postHash = `${messageDate}_${messageAuthor}_${getImageFileName(
    attachment?.url ?? ""
  )}`;
  // const dbRecord = await getDoc(
  //   doc(firestore, `promote-it-on-abrys-fam-bot/${postHash}`)
  // );
  const dbRecord = await firebaseApp.firestore().collection("promote-it-on-abrys-fam-bot").doc(postHash).get();

  if (dbRecord.data()?.promoted_on_insta) {
    botLog(`Skipping because ${postHash} was already promoted on Instagram`);
    return;
  }

  if (isEligableToPromote(channelName, messageAuthor, reaction.count!)) {
    const reactors = await reaction.users.fetch();
    if (
      APPROVED_USERS.some((username) =>
        reactors.some((u) => u.username === username)
      )
    ) {
      if (attachment) {
        reaction.message.reply(
          "Summoning an abrys to promote this on @abrys_fam ..."
        );
        const didPromoteItOnAbrysFam = await promoteItOnAbrys(
          attachment.url,
          messageAuthor,
          postHash
        );
        try {
          reaction.message.reply(didPromoteItOnAbrysFam.response);
        } catch (error) {
          botLog(error);
          reaction.message.reply(`⛔️ Uh oh, ${error}`);
        }
      }
    }
  }
});

discordClient.login(discordToken);

export function isEligableToPromote(
  channelName: string,
  discordUser: string,
  reactionCount: number
): boolean {
  return (
    channelName.includes(process.env.DISCORD_CHANNEL_NAME!) &&
    APPROVED_USERS.includes(discordUser) &&
    reactionCount > 0
  );
}
