import "dotenv/config";
import os from "os";
import express from "express";
import { Kafka, logLevel } from "kafkajs";

const app = express();
app.use(express.json());

const consumerId = `${os.hostname()}-${process.pid}`;

const kafka = new Kafka({
  clientId: `node-kafka-client-${consumerId}`,
  brokers: [
    "nodejs_kafka_1:9092",
    "nodejs_kafka_2:9093",
    "nodejs_kafka_3:9094",
  ],
  logLevel: logLevel.ERROR,
});

const topic = "test-topic";
const admin = kafka.admin();

const getKafkaMetadata = async () => {
  await admin.connect();
  const metadata = await admin.fetchTopicMetadata();
  const brokers = await admin.describeCluster();
  const topics =
    metadata.topics.length > 0 ? metadata.topics : await admin.listTopics();
  const filteredTopics = metadata.topics.filter(
    (t) => t.name !== "__consumer_offsets"
  );

  console.log(`[KAFKA INFO] Total Topics = ${topics.length}`);

  const kafkaInfo = {
    brokers: brokers.brokers.map((broker) => ({
      brokerId: broker.nodeId,
      host: broker.host,
      port: broker.port,
    })),
    topics: filteredTopics.map((t) => ({
      topic: t.name,
      partitions: t.partitions.map((p) => ({
        partition: p.partitionId,
        leader: p.leader,
        replicas: p.replicas,
        isr: p.isr,
      })),
    })),
  };

  console.log(JSON.stringify(kafkaInfo, null, 2));
  await admin.disconnect();
  return kafkaInfo;
};
getKafkaMetadata();

const consumer1 = kafka.consumer({
  groupId: `test-group`,
});
const consumer2 = kafka.consumer({
  groupId: `test-group`,
});

(async () => {
  await consumer1.connect();
  await consumer1.subscribe({
    topic,
    fromBeginning: true,
  });

  await consumer1.run({
    eachMessage: async ({ topic, partition, message }) => {
      let messageValue;
      try {
        messageValue = JSON.parse(message.value.toString());
      } catch (err) {
        messageValue = message.value.toString();
      }

      console.log(
        `[Kafka Consumer1] ${consumerId} processed message from Partition: ${partition}, Offset: ${
          message.offset
        }, Key: ${message.key ? message.key.toString() : "null"}, Value:`,
        messageValue
      );
    },
  });
  console.log(
    `[Kafka Consumer1] ${consumerId} is up and running for Partition: ${"test1"}`
  );
})();
(async () => {
  await consumer2.connect();
  await consumer2.subscribe({
    topic,
    fromBeginning: true,
  });

  await consumer2.run({
    eachMessage: async ({ topic, partition, message }) => {
      let messageValue;
      try {
        messageValue = JSON.parse(message.value.toString());
      } catch (err) {
        messageValue = message.value.toString();
      }

      console.log(
        `[Kafka Consumer2] ${consumerId} processed message from Partition: ${partition}, Offset: ${
          message.offset
        }, Key: ${message.key ? message.key.toString() : "null"}, Value:`,
        messageValue
      );
    },
  });
  console.log(
    `[Kafka Consumer2] ${consumerId} is up and running for Partition: ${"test2"}`
  );
})();

const shutdown = async (signal) => {
  console.log(
    `[Signal Received] ${signal}, shutting down ${consumerId} gracefully...`
  );
  try {
    await admin.disconnect();
  } finally {
    process.exit(0);
  }
};

["SIGTERM", "SIGINT", "SIGUSR2"].forEach((type) => {
  process.once(type, shutdown);
});

app.get("/metadata", async (req, res) => {
  const metadata = await getKafkaMetadata();
  res.json(metadata);
});

app.listen(3002, async () => {
  console.log(`[Express Server] Listening on port ${3002}`);
});
