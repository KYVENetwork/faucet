// Configure the enviroment.
import { config } from "dotenv";
config();

// Import dependencies.
import Arweave from "arweave";
import { JWKInterface } from "arweave/node/lib/wallet";
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

const governance = "C_1uo08qRuQAeDi9Y1I8fkaWYUC9IWkOrKDNe9EphJo";

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
          const transaction = await interactWrite(inst, wallet, governance, {
            function: "transfer",
            target: item.address,
            qty: 1000,
          });

          // Reply to the tweet.
          const id = await postTweet(
            `https://viewblock.io/arweave/tx/${transaction}`,
            item.tweetID
          );

          await collection.updateOne(
            { _id: item._id },
            {
              $set: {
                transaction,
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
