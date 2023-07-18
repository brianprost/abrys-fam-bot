import { ApiHandler } from "sst/node/api";
import { initializeApp } from "firebase/app";
import { collection, doc, getDocs, getFirestore, setDoc } from "firebase/firestore";
import { config } from "dotenv";
import { writeFileSync } from "fs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
config();

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
const firestore = getFirestore(firebaseApp);

// type Promotion = {
//     userWhoPosted: string;
//     messageId: string;
//     attachmentUrl: string;
//     instagramUrl: string;
// };


// dynamo format
/**
 * @typedef {Object} DynamoPromotion
 * @property {string} userWhoPosted: string;
 * @property {string} messageId: string;
 * @property {string} attachmentUrl: string;
 * @property {string} instagramUri: string;
 * @property {Date} datePosted: Date;
 */

// firebase format
/**
 * @typedef {Object} FirebasePromotion
 * @property {string} discord_user The Discord user who posted the promotion.
 * @property {string} ig_post_code The Instagram post code for the promotion.
 * @property {string} image_url The URL of the promotion image.
 * @property {boolean} promoted_on_insta Whether the promotion has been promoted on Instagram.
 * @property {string} id The ID of the document in the format "<date>_<username>_<attachment_name>".
 */

export const handler = ApiHandler(async (_evt) => {
    const promotions = await getDocs(collection(firestore, "promote-it-on-abrys-fam-bot"));
    console.log(`🔥 got all ${promotions.docs.length} documents from Firebase.`);

    await writeFileSync("./promotions.json", JSON.stringify(promotions.docs.map(doc => doc.data())));

    // upload to dynamoDb table
    const client = new DynamoDBClient({ region: "us-east-1" });
    const docClient = DynamoDBDocumentClient.from(client);

    // for (const promotion of promotions.docs.map(doc => doc.data())) {
        const dynamoPromotion = {
            userWhoPosted: 'lolol', // promotion.discord_user,
            messageId: 'lolol', // "oh no",
            attachmentUrl: 'lolol', // promotion.image_url,
            instagramUrl: 'lolol', // promotion.ig_post_code ?? "oh no again. no insta!",
            datePosted: 'lolol', // "df"
        };

        console.log(dynamoPromotion);

        const params = {
            TableName: "abrysPromotions",
            Item: dynamoPromotion,
        };

        const command = new PutCommand(params);
        const response = await docClient.send(command);
        console.log(response);
    // }
    return {
        statusCode: 200,
        body: JSON.stringify(response),
    }
});