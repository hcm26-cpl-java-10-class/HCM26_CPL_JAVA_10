import http from "http";

async function login() {
  const data = JSON.stringify({ email: "student@example.com", password: "password123" });
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "localhost",
      port: 8080,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          resolve(json.accessToken);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function sendRequest(token, path) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.request({
      hostname: "localhost",
      port: 8080,
      path: path,
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        const duration = Date.now() - start;
        resolve({ statusCode: res.statusCode, duration, success: res.statusCode >= 200 && res.statusCode < 400 });
      });
    });
    req.on("error", (err) => {
      const duration = Date.now() - start;
      resolve({ statusCode: 0, duration, success: false, error: err.message });
    });
    req.end();
  });
}

async function runScenario(token, concurrentUsers, totalRequestsPerUser, path) {
  console.log(`\n--- Running Load Test: ${concurrentUsers} Concurrent Users (${path}) ---`);
  const allDurations = [];
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  const userTasks = Array.from({ length: concurrentUsers }, async () => {
    for (let i = 0; i < totalRequestsPerUser; i++) {
      const res = await sendRequest(token, path);
      allDurations.push(res.duration);
      if (res.success) successCount++;
      else failCount++;
    }
  });

  await Promise.all(userTasks);
  const totalDuration = (Date.now() - startTime) / 1000;
  const totalRequests = concurrentUsers * totalRequestsPerUser;
  const throughput = (totalRequests / totalDuration).toFixed(2);

  allDurations.sort((a, b) => a - b);
  const min = allDurations[0];
  const max = allDurations[allDurations.length - 1];
  const avg = (allDurations.reduce((acc, v) => acc + v, 0) / allDurations.length).toFixed(2);
  const p90 = allDurations[Math.floor(allDurations.length * 0.90)];
  const p95 = allDurations[Math.floor(allDurations.length * 0.95)];
  const p99 = allDurations[Math.floor(allDurations.length * 0.99)];
  const errorRate = ((failCount / totalRequests) * 100).toFixed(2);

  const result = {
    concurrentUsers,
    totalRequests,
    totalDurationSec: totalDuration.toFixed(2),
    throughputRps: throughput,
    minMs: min,
    avgMs: avg,
    p90Ms: p90,
    p95Ms: p95,
    p99Ms: p99,
    maxMs: max,
    successCount,
    failCount,
    errorRate: `${errorRate}%`
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  const token = await login();
  console.log("Logged in successfully, token acquired.");

  const results = [];
  // 10 Concurrent Users (Normal load)
  results.push(await runScenario(token, 10, 10, "/api/exams/70"));
  // 50 Concurrent Users (Standard load)
  results.push(await runScenario(token, 50, 6, "/api/exams/70"));
  // 100 Concurrent Users (Peak load)
  results.push(await runScenario(token, 100, 3, "/api/exams/70"));

  console.log("\n=== ALL LOAD TEST PROFILES COMPLETED ===");
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
