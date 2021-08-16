const { config } = require("dotenv");
config();

const Arweave = require("arweave");
const fs = require("fs");
const { MongoClient } = require("mongodb");

const inst = new Arweave({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

const wallet = JSON.parse(process.env.WALLET.toString());

(async () => {
  const address = await inst.wallets.getAddress(wallet);

  const client = new MongoClient(process.env.MONGO.toString(), {
    useUnifiedTopology: true,
  });
  await client.connect();
  const db = client.db("cache");
  const collection = db.collection("faucet");

  const items = await collection.find({}).toArray();
  const balances = {
    [address]: 1000000 - items.length * 1000,
  };

  for (const item of items) {
    balances[item.address] = 1000;
  }

  fs.writeFileSync("balances.json", JSON.stringify(balances, undefined, 2));

  await client.close();
})();
