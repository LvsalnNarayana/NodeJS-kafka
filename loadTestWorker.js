import { parentPort } from "worker_threads";
import { exec } from "child_process";

// Listen for messages from the main thread
parentPort.on("message", (message) => {
  if (message === "startLoadTest") {
    console.log("[Worker] Running Artillery Load Test...");

    exec("artillery run artillery-config.json", (error, stdout, stderr) => {
      if (error) {
        console.error(`[Worker Error] ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`[Worker Stderr] ${stderr}`);
      }
      console.log(`[Worker Output] ${stdout}`);
    });
  }
});
