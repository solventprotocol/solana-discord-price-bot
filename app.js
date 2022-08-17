import dotenv from "dotenv";
import { Client } from "discord.js";
import { Connection, PublicKey } from "@solana/web3.js";
import { Market } from "@project-serum/serum";
import { readFileSync } from "fs";

const config = JSON.parse(readFileSync("./config.json"));

const serumV3ContractAddress = new PublicKey(
  "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"
); // Serum program v3

dotenv.config();

const getCurrentPrice = async (connection, marketAddress) => {
  try {
    const market = await Market.load(
      connection,
      new PublicKey(marketAddress),
      {},
      serumV3ContractAddress
    );
    const bids = await market.loadBids(connection);
    return Number(bids.getL2(1)[0][0]).toFixed(2);
  } catch (error) {
    console.log(error);
  }
};

const getApp = (client, guildId) => {
  try {
    const app = client.api.applications(client.user.id);
    if (guildId) {
      app.guilds(guildId);
    }
    return app;
  } catch (error) {
    console.log(error);
  }
};

const getClient = async (token) => {
  try {
    const client = new Client();
    await client.login(token);
    return client;
  } catch (error) {
    console.log(error);
  }
};

const createDiscordInterface = () =>
  // eslint-disable-next-line implicit-arrow-linebreak
  Promise.all(
    config.botMetadata.map(async (metadata) => {
      const client = await getClient(metadata.botToken);
      const app = getApp(client, metadata.guildId);

      return { client, app, metadata };
    })
  );

const setUpBot = (connection, bot) => {
  try {
    bot.client.on("ready", () => {
      console.log(`BOT LIVE: Logged in as ${bot.client.user.tag}!`);

      bot.app.commands.post({
        data: {
          name: bot.metadata.tokenName.toLowerCase().replaceAll(" ", "-"),
          description: `${bot.metadata.tokenName} (${bot.metadata.tokenSymbol}) price bot `,
          options: [
            {
              name: "price",
              description: `Get the current ${bot.metadata.tokenName} (${bot.metadata.tokenSymbol}) price`,
              type: 1,
            },
            {
              name: "moon",
              description: "Indicate when moonings",
              type: 1,
            },
          ],
        },
      });

      bot.client.ws.on("INTERACTION_CREATE", async (interaction) => {
        try {
          if (
            !interaction.data.options ||
            (bot.metadata.preferredChannelId &&
              bot.metadata.preferredChannelId !== interaction.channel_id)
          ) {
            return false;
          }

          console.log({
            botName: interaction.data.name,
            command: interaction.data.options[0].name,
          });

          const command = interaction.data.options[0].name;
          console.log({ command });
          if (command === "price") {
            return bot.client.api
              .interactions(interaction.id, interaction.token)
              .callback.post({
                data: {
                  type: 4,
                  data: {
                    content: `${
                      bot.metadata.tokenSymbol
                    }: $${await getCurrentPrice(
                      connection,
                      bot.metadata.marketAddress
                    )}`,
                  },
                },
              });
          }
          if (command === "moon") {
            return bot.client.api
              .interactions(interaction.id, interaction.token)
              .callback.post({
                data: {
                  type: 4,
                  data: {
                    content:
                      "Soon https://tenor.com/view/stonks-up-stongs-meme-stocks-gif-15715298",
                  },
                },
              });
          }
          return false;
        } catch (error) {
          console.log(error);
        }
      });
    });
  } catch (error) {
    console.log(error);
  }
};

const updateBotUsername = async (connection, bot) => {
  try {
    // Update bot name with price
    const datetime = new Date();
    const newName = `${bot.metadata.tokenSymbol} (${
      bot.metadata.quoteTokenSymbol
    }${await getCurrentPrice(connection, bot.metadata.marketAddress)})`;

    bot.client.user.setUsername(newName);
    console.log(`update on: ${datetime}`);
  } catch (error) {
    console.log(error);
  }
};

const setBotPresence = async (bot) => {
  try {
    bot.client.user.setPresence({
      status: "online",
      activity: {
        name: bot.metadata.tokenName,
        type: "WATCHING",
      },
    });
    console.log(`setting presence on: ${new Date()}`);
  } catch (error) {
    console.log(error);
  }
};

const main = async () => {
  try {
    const discordInterface = await createDiscordInterface();
    const connection = new Connection("https://api.mainnet-beta.solana.com/");

    discordInterface.forEach((bot) => {
      setUpBot(connection, bot);
      setInterval(() => setBotPresence(bot), 5 * 1000);
      setInterval(() => updateBotUsername(connection, bot), 5 * 60 * 1000);
    });
  } catch (error) {
    console.log(error);
  }
};

main();
