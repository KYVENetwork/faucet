// Configure the enviroment.
const { config } = require("dotenv");
config();

// Import dependencies.
const Arweave = require("arweave");

// Define constants.
const inst = new Arweave({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

const wallet = JSON.parse(process.env.WALLET.toString());

const governance = "LkfzZvdl_vfjRXZOPjnov18cGnnK3aDKj0qSQCgkCX8";

(async () => {
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
      target: "DF_aN8QxYS5AH8wqXXgGFcFqT0JTMauCyOg80KJvtmE",
      qty: 1000,
    })
  );

  // Bump the reward for higher chance of mining.
  transaction.reward = (+transaction.reward * 2).toString();

  await inst.transactions.sign(transaction, wallet);
  await inst.transactions.post(transaction);

  console.log(transaction.id);
})();
