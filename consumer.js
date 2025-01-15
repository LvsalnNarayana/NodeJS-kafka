import "dotenv/config";
import express from "express";
import { Kafka, logLevel } from "kafkajs";
import fs from "fs/promises";

const app = express();
const port = process.env.CONSUMER_PORT;

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID,
  brokers: ["localhost:9092"],
  logLevel: logLevel.INFO,
});

const topic = process.env.KAFKA_TOPIC;
const consumer = kafka.consumer({ groupId: "test-group" });
const MAX_RETRIES = 3;
const MESSAGE_PROCESS_DELAY = 10000;

const processMessage = async (message, retries = 0) => {
  try {
    const content = message.value.toString();
    await fs.appendFile("messages.txt", content + "\n");
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await processMessage(message, retries + 1);
    } else {
      await handleDeadLetter(message);
    }
  }
};

const handleDeadLetter = async (message) => {
  const content = message.value.toString();
  await fs.appendFile("dead-letter-queue.txt", content + "\n");
};

const runConsumer = async () => {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: true });
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        await processMessage(message);
        await new Promise((resolve) =>
          setTimeout(resolve, MESSAGE_PROCESS_DELAY)
        );
      },
    });
  } catch (error) {
    console.error(`[Kafka Consumer] Error: ${error.message}`, error);
    process.exit(1);
  }
};

process.on("SIGTERM", async () => {
  console.log("[Kafka Consumer] SIGTERM received. Shutting down gracefully...");
  await consumer.disconnect();
  process.exit(0);
});
process.on("uncaughtException", async (error) => {
  console.error(`[Error] Uncaught exception: ${error.message}`);
  await consumer.disconnect();
  process.exit(1);
});

app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Kafka Consumer API" });
});

app.listen(port, async () => {
  console.log(`[Express] Server running on port ${port}`);
  await runConsumer();
});
