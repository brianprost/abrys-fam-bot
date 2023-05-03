import { initializeApp } from "firebase/app";
import { IgApiClient, MediaRepositoryConfigureResponseRootObject } from "instagram-private-api";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import * as dotenv from "dotenv";

// 