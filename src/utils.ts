// Configure the enviroment.
import { config } from "dotenv";
config();

// Import dependencies.
import fs from "fs";
import needle from "needle";
import Twitter from "twitter-lite";

// Helper to fetch tweet text.
export const fetchTweet = async (id: string): Promise<string | undefined> => {
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

// Helper for uploading a random gif.
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

// Helper to post a tweet.
export const postTweet = async (text: string, id: string): Promise<string> => {
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
