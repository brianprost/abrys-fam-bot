import { Client, GatewayIntentBits, Message, TextChannel } from "discord.js";
import { getDatabase, ref, get, set } from "firebase/database";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { initializeApp } from "firebase/app";
// import { collection, doc, getDoc, getDocs, getFirestore, query, setDoc, where } from "firebase/firestore";
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);
// const firestore = getFirestore(firebaseApp);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent],
});

client.once("ready", () => {
  console.log("🧽 I'm ready!");
});

const channelId = process.env.DISCORD_CHANNEL_ID;

client.once("ready", async () => {
  // set(ref(database, `discordState/${process.env.DISCORD_CHANNEL_NAME}`), {});
  // setInterval(async () => {
  console.log("Checking for messages");

  const channel: TextChannel = client.channels.cache.get(
    channelId!
  ) as TextChannel;

  const allMessages = await channel!.messages.fetch();
  const filteredMessages = allMessages.filter((message) => {
    const inPrevious360Days =
      new Date(message.createdTimestamp) >
      new Date(new Date().setDate(new Date().getDate() - 500));
    return inPrevious360Days && message.attachments.size > 0;
  });

  const previousStateRef = ref(
    database,
    `discordState/${process.env.DISCORD_CHANNEL_NAME}`
  );
  const previousStateSnapshot = await get(previousStateRef);
  const previousState = previousStateSnapshot.val();
  const previousStateIDs = Object.keys(previousState);

  const newMessages = filteredMessages.filter(
    (message) => !previousStateIDs.includes(message.id)
  );
  if (newMessages.size > 0) {
    newMessages.map(async (message) => {
      const { id } = message;
      try {
        const actualMessage = await channel.messages.fetch(id);
        const userWhoPosted = actualMessage.author.username;
        const attachmentUrl = actualMessage.attachments.first()?.url;
        const attachmentName = actualMessage.attachments.first()?.name;
        const reactors = actualMessage.reactions.cache.each(async (reaction) => {
          const reactors = await reaction.users.fetch();
          reactors.forEach((user) => console.log(user.username));
          return reactors.map(user => user.username);
        })
        await set(ref(database, `discordState/${process.env.DISCORD_CHANNEL_NAME}/${id}`), {
          userWhoPosted,
          attachmentUrl,
          attachmentName,
          reactors
        });
      } catch (err) {
        console.log(err);
      }
    });

  }
  // }, 1000);
});

client.login(process.env.DISCORD_TOKEN);

// function areAnyInFirestore(filteredMessages: Collection<string, Message<true>>) {
//   firebase
//   const channelStateRef = collection(firestore, `${process.env.DISCORD_CHANNEL_NAME}`);

//   console.log(`There are ${filteredMessages.size} messages to check`)

//   const nonDbMessages = filteredMessages.filter(async (message) => {
//     console.log(`Checking if ${message.id} is in firestore`)
//     const isInFirestore = query(channelStateRef, where("id", "==", message.id));
//     const isInFirestoreSnapshot = await getDocs(isInFirestore);
//     const isInFirestoreData = isInFirestoreSnapshot.docs.map((doc) => doc.data());
//     return isInFirestoreData.length !== 0;
//   });
//   console.log("size: ", nonDbMessages.size)

//   // add to firestore
//   nonDbMessages.forEach(async (message) => {
//     console.log("Adding message to firestore")
//     await setDoc(doc(channelStateRef, message.id), message.toJSON());
//   });
// }
