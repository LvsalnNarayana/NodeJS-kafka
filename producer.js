import "dotenv/config";
import express from "express";
import { Kafka, logLevel, Partitioners } from "kafkajs";
import { Worker } from "worker_threads";

const app = express();
app.use(express.json());

const kafka = new Kafka({
  clientId: "node-kafka-client",
  brokers: [
    "nodejs_kafka_1:9092",
    "nodejs_kafka_2:9093",
    "nodejs_kafka_3:9094",
  ],
  logLevel: logLevel.INFO,
});
const topic = "test-topic";
const producer = kafka.producer({
  allowAutoTopicCreation: true,
  createPartitioner: Partitioners.LegacyPartitioner,
});
const admin = kafka.admin();
const createTopicWithPartitions = async () => {
  try {
    await admin.connect();
    const existingTopics = await admin.listTopics();

    if (!existingTopics.includes(topic)) {
      console.log(`[Kafka Admin] Topic "${topic}" does not exist, creating...`);
      await admin.createTopics({
        topics: [
          {
            topic,
            numPartitions: 3,
            replicationFactor: 3,
          },
        ],
      });
      console.log(`[Kafka Admin] Topic "${topic}" created with 3 partitions.`);
    } else {
      console.log(`[Kafka Admin] Topic "${topic}" already exists.`);
    }
  } catch (error) {
    console.error(`[Kafka Admin] Error creating topic: ${error.message}`);
  } finally {
    await admin.disconnect();
  }
};

const sendMessage = async ({ message, partition }) => {
  try {
    await producer.send({
      topic,
      messages: [
        {
          // partition,
          // key: "test-2",
          value: message.toString(),
        },
      ],
      acks: -1,
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

const startWorker = () => {
  const worker = new Worker("./loadTestWorker.js");
  worker.postMessage("startLoadTest");
  worker.on("message", (msg) => console.log("[Main] Worker Response:", msg));
  worker.on("error", (err) => console.error("[Main] Worker Error:", err));
  worker.on("exit", (code) =>
    console.log(`[Main] Worker exited with code ${code}`)
  );
};

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to the Kafka Producer!",
  });
});

app.post("/start-test", async (req, res) => {
  try {
    console.log("[Main] Received request to start load test.");

    startWorker();

    res.json({ message: "Load test started successfully!" });
  } catch (error) {
    console.error("[Main] Error starting load test:", error);
    res.status(500).json({ error: "Failed to start load test" });
  }
});

app.post("/send", async (req, res) => {
  try {
    console.log("Request Received");
    await producer.connect();
    await sendMessage({
      message: req.body.message,
      partition: req.body.partition,
    });
    await producer.disconnect();
    res.send("Message sent to Kafka!");
  } catch (e) {
    res.status(500).send(`Failed to send message: ${e.message}`);
  }
});

app.listen(3001, async () => {
  console.log(`[Express Server] Listening on port ${3001}`);
  await createTopicWithPartitions();
});
