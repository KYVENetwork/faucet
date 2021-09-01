const { config } = require("dotenv");
config();

const Arweave = require("arweave");
const axios = require("axios");
const fs = require("fs");
const { MongoClient } = require("mongodb");
const { interactWrite } = require("smartweave");

const inst = new Arweave({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

const wallet = JSON.parse(process.env.WALLET.toString());

(async () => {
  const { data: accounts } = await axios.get(
    "http://localhost:4242/accounts"
  );

  const client = new MongoClient(process.env.MONGO.toString(), {
    useUnifiedTopology: true,
  });
  await client.connect();
  const db = client.db("cache");
  const collection = db.collection("faucet");
  const items = await collection.find({}).toArray();

  for (const item of items) {
    if (accounts.find((account) => account.address === item.address)) {
      // Account is already processed.
    } else {
      const id = await interactWrite(
        inst,
        wallet,
        "LkfzZvdl_vfjRXZOPjnov18cGnnK3aDKj0qSQCgkCX8",
        {
          function: "transfer",
          target: item.address,
          qty: 1000,
        }
      );

      console.log(`address = ${item.address}\nid      = ${id}\n`);
    }
  }

  await client.close();
})();
