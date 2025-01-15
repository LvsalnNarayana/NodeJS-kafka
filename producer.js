import "dotenv/config";
import express from "express";
import { Kafka, CompressionTypes, logLevel } from "kafkajs";

const app = express();
const port = process.env.PRODUCER_PORT;
app.use(express.json());

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID,
  brokers: ["localhost:9092"],
  logLevel: logLevel.INFO,
});

const topic = process.env.KAFKA_TOPIC;
const producer = kafka.producer();

const getRandomNumber = () => Math.round(Math.random() * 1000);

const sendMessage = async (userMessage) => {
  try {
    await producer.send({
      topic,
      compression: CompressionTypes.GZIP,
      messages: [
        {
          key: userMessage?.key || `key-${getRandomNumber()}`,
          value: userMessage?.message || "hello from server",
        },
      ],
    });
  } catch (e) {
    console.error(`[Kafka Producer] Error sending messages: ${e.message}`, e);
  }
};

const errorTypes = ["unhandledRejection", "uncaughtException"];
errorTypes.forEach((type) => {
  process.on(type, async (err) => {
    console.error(`[Process Error] ${type}:`, err);
    try {
      await producer.disconnect();
    } catch (_) {}
    process.exit(1);
  });
});

const signalTraps = ["SIGTERM", "SIGINT", "SIGUSR2"];
signalTraps.forEach((type) => {
  process.once(type, async () => {
    console.log(`[Signal Received] ${type}`);
    try {
      await producer.disconnect();
    } finally {
      process.exit(0);
    }
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to the Kafka Producer!",
  });
});

app.post("/send", async (req, res) => {
  try {
    await producer.connect();
    await sendMessage({
      message: req.body.message,
    });
    res.send("Message sent to Kafka!");
  } catch (e) {
    res.status(500).send(`Failed to send message: ${e.message}`);
  }
});

app.listen(port, async () => {
  console.log(`[Express Server] Listening on port ${port}`);
});
