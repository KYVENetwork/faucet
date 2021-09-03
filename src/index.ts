// Configure the enviroment.
import { config } from "dotenv";
config();

// Import dependencies.
import Arweave from "arweave";
import { JWKInterface } from "arweave/node/lib/wallet";
import fs from "fs";
import { MongoClient } from "mongodb";
import needle from "needle";
import { interactWrite } from "smartweave";
import Twitter from "twitter-lite";

// Define constants.
const inst = new Arweave({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

const wallet: JWKInterface = JSON.parse(process.env.WALLET?.toString()!);

const governance = "LkfzZvdl_vfjRXZOPjnov18cGnnK3aDKj0qSQCgkCX8";

// Define helpers.
const fetchTweet = async (id: string): Promise<string | undefined> => {
  const endpoint = `https://api.twitter.com/2/tweets/${id}`;

  const { body } = await needle("get", endpoint, {
    headers: {
      Authorization: `Bearer ${process.env.TOKEN}`,
    },
  });

  if (body) {
    if (body.data) {
      return body.data.text;
    }
  }
};

const selectGifAndUpload = async (): Promise<string> => {
  const files = fs.readdirSync("gifs");
  const file = files[Math.floor(Math.random() * files.length)];

  const user = new Twitter({
    subdomain: "upload",
    consumer_key: process.env.CONSUMER_KEY?.toString()!,
    consumer_secret: process.env.CONSUMER_SECRET?.toString()!,
    access_token_key: process.env.ACCESS_KEY?.toString()!,
    access_token_secret: process.env.ACCESS_SECRET?.toString()!,
  });

  const { media_id_string } = await user.post("media/upload", {
    command: "INIT",
    total_bytes: fs.statSync(`gifs/${file}`).size,
    media_type: "image/gif",
  });
  await user.post("media/upload", {
    command: "APPEND",
    media_id: media_id_string,
    media_data: Buffer.from(fs.readFileSync(`gifs/${file}`)).toString("base64"),
    segment_index: 0,
  });
  await user.post("media/upload", {
    command: "FINALIZE",
    media_id: media_id_string,
  });

  return media_id_string;
};

const postTweet = async (text: string, id: string): Promise<string> => {
  const user = new Twitter({
    consumer_key: process.env.CONSUMER_KEY?.toString()!,
    consumer_secret: process.env.CONSUMER_SECRET?.toString()!,
    access_token_key: process.env.ACCESS_KEY?.toString()!,
    access_token_secret: process.env.ACCESS_SECRET?.toString()!,
  });

  const res = await user.post("statuses/update", {
    status: text,
    in_reply_to_status_id: id,
    auto_populate_reply_metadata: true,
    media_ids: await selectGifAndUpload(),
  });

  return res.id_str;
};

// Main program.
(async () => {
  // Connect to the database.
  const client = new MongoClient(
    process.env.MONGO?.toString()!,
    // @ts-ignore
    { useUnifiedTopology: true }
  );
  await client.connect();
  const db = client.db("cache");
  const collection = db.collection("faucet");

  // Listen to the database.
  const listener = collection.watch();
  listener.on("change", async (event) => {
    if (event.fullDocument) {
      // @ts-ignore
      const item: { _id: any; address: string; tweetID: string } =
        event.fullDocument;
      const text = await fetchTweet(item.tweetID);

      // I'm claiming my free tokens for the @KYVENetwork testnet. 🚀
      //
      // [ADDRESS]
      if (text) {
        if (
          text.includes(
            "I'm claiming my free tokens for the @KYVENetwork testnet. 🚀"
          ) &&
          text.includes(item.address)
        ) {
          // Send the tokens to the user.
          const transaction = await inst.createTransaction({
            data: Math.random().toString().slice(-4),
          });

          transaction.addTag("App-Name", "SmartWeaveAction");
          transaction.addTag("App-Version", "0.3.0");
          transaction.addTag("Contract", governance);
          transaction.addTag(
            "Input",
            JSON.stringify({
              function: "transfer",
              target: item.address,
              qty: 1000,
            })
          );

          // Bump the reward for higher chance of mining.
          transaction.reward = (+transaction.reward * 2).toString();

          await inst.transactions.sign(transaction, wallet);
          await inst.transactions.post(transaction);

          // Reply to the tweet.
          const id = await postTweet(
            `https://viewblock.io/arweave/tx/${transaction.id}`,
            item.tweetID
          );

          await collection.updateOne(
            { _id: item._id },
            {
              $set: {
                transaction: transaction.id,
                replyID: id,
              },
            }
          );
          console.log(`Sent a tweet.\n${id}`);
        }
      }
    }
  });
})();
