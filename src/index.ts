// Configure the enviroment.
import { config } from "dotenv";
config();

// Import dependencies.
import ethers, { ContractTransaction } from "ethers";
import { MongoClient } from "mongodb";
import { fetchTweet, postTweet } from "./utils";

// Setup contract instance.
const provider = new ethers.providers.StaticJsonRpcProvider(
  "https://rpc.testnet.moonbeam.network",
  {
    chainId: 1287,
    name: "moonbase-alphanet",
  }
);

const wallet = new ethers.Wallet(process.env.PK?.toString()!, provider);

const contract = new ethers.Contract(
  "",
  ["function mint(address to) public onlyRole(FAUCET_ROLE)"],
  wallet
);

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
          const transaction: ContractTransaction = await contract.mint(
            item.address
          );

          // Reply to the tweet.
          const id = await postTweet(
            `https://viewblock.io/arweave/tx/${transaction.hash}`,
            item.tweetID
          );

          await collection.updateOne(
            { _id: item._id },
            {
              $set: {
                transaction: transaction.hash,
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
