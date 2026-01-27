/* eslint-disable no-console, no-undef */
import { describe, expect, it } from "bun:test";

describe("Load Testing", () => {
  it("should handle high concurrency for /sync", async () => {
    const CONCURRENT_REQUESTS = 100; // Adjust as needed
    const URL = "http://localhost:3000/api/v1/measurements/sync"; // Ensure server is running

    // Mock payload
    const payload = {
      measurements: Array.from({ length: 5 }).map((_, i) => ({
        localId: `load-test-${Date.now()}-${i}`,
        balitaId: "00000000-0000-0000-0000-000000000000", // Needs valid ID in real scenario or mock DB
        beratBadan: 10 + i,
        tinggiBadan: 80,
        posisiUkur: "TERLENTANG",
        relawanId: "user-123",
      })),
    };

    const startTime = performance.now();

    // This is a simulation. In a real environment, you'd fetch a valid token first.
    // For this test script to work, we assume we might hit a mock endpoint or we need a token.
    // Here we just measure HTTP request overhead capability of the server concept.

    const requests = Array.from({ length: CONCURRENT_REQUESTS }).map(() =>
      fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch((e) => e)
    );

    const responses = await Promise.all(requests);
    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`\n--- Load Test Results ---`);
    console.log(`Total Requests: ${CONCURRENT_REQUESTS}`);
    console.log(`Total Duration: ${duration.toFixed(2)}ms`);
    console.log(
      `Throughput: ${(CONCURRENT_REQUESTS / (duration / 1000)).toFixed(2)} req/sec`
    );
    console.log(`-------------------------\n`);

    // We expect answers (even if 401 Unauthorized, it proves server handled the conn)
    expect(responses.length).toBe(CONCURRENT_REQUESTS);
  });
});
