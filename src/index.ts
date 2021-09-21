// Configure the enviroment.
import { config } from "dotenv";
config();

// Import dependencies.
import { ethers, ContractTransaction } from "ethers";
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
  "0x843C7378309DD8CD82C5013FAb63B6Ea86770433",
  ["function mint(address to) public"],
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
          // Mint 1,000 $KYVE to the user.
          const transaction: ContractTransaction = await contract.mint(
            item.address
          );

          // Check if less than 20,000 users have claimed.
          if ((await collection.find().toArray()).length < 20000) {
            // Send 0.01 $DEV to the user.
            await wallet.sendTransaction({
              to: item.address,
              value: ethers.utils.parseEther("0.01"),
            });
          }

          // Reply to the tweet.
          const id = await postTweet(
            `https://moonbase-blockscout.testnet.moonbeam.network/tx/${transaction.hash}`,
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
