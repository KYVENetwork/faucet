// Configure the enviroment.
import { config } from "dotenv";
config();

// Import dependencies.
import Arweave from "arweave";
import { JWKInterface } from "arweave/node/lib/wallet";
import { MongoClient } from "mongodb";
import needle from "needle";

// Define constants.
const inst = new Arweave({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

const wallet: JWKInterface = JSON.parse(process.env.WALLET?.toString()!);

const governance = "C_1uo08qRuQAeDi9Y1I8fkaWYUC9IWkOrKDNe9EphJo";

// Define helpers.
const fetchTweet = async (id: number): Promise<string> => {
  const endpoint = "https://api.twitter.com/2/tweets?ids=";
  const params = {
    ids: `${id}`,
  };

  const res = await needle("get", endpoint, params, {
    headers: {
      Authorization: `Bearer ${process.env.TOKEN}`,
    },
  });

  return res.body[0].text;
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
      const item: { address: string; tweetID: number } = event.fullDocument;
      const text = await fetchTweet(item.tweetID);

      // TODO: Check the text of the tweet.
      // TODO: Send the tokens to the user.
      // TODO: Reply to the tweet.
    }
  });
})();
