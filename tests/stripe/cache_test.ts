import { assertEquals } from "@std/assert";
import { FakeTime } from "@std/testing/time";
import { createTtlCache } from "../../src/stripe/cache.ts";

Deno.test("TtlCache - get returns value within TTL", () => {
  using _time = new FakeTime();
  const cache = createTtlCache<string>();
  cache.set("key", "value", 1000);
  assertEquals(cache.get("key"), "value");
});

Deno.test("TtlCache - get returns undefined after TTL expires", () => {
  using time = new FakeTime();
  const cache = createTtlCache<string>();
  cache.set("key", "value", 1000);
  time.tick(1001);
  assertEquals(cache.get("key"), undefined);
});

Deno.test("TtlCache - getStale returns value even after TTL expires", () => {
  using time = new FakeTime();
  const cache = createTtlCache<string>();
  cache.set("key", "value", 1000);
  time.tick(1001);
  assertEquals(cache.getStale("key"), "value");
});

Deno.test("TtlCache - get returns undefined for missing key", () => {
  const cache = createTtlCache<string>();
  assertEquals(cache.get("missing"), undefined);
});

Deno.test("TtlCache - getStale returns undefined for missing key", () => {
  const cache = createTtlCache<string>();
  assertEquals(cache.getStale("missing"), undefined);
});

Deno.test("TtlCache - invalidate removes entry", () => {
  using _time = new FakeTime();
  const cache = createTtlCache<string>();
  cache.set("key", "value", 10_000);
  cache.invalidate("key");
  assertEquals(cache.get("key"), undefined);
  assertEquals(cache.getStale("key"), undefined);
});

Deno.test("TtlCache - set overwrites existing entry and resets TTL", () => {
  using time = new FakeTime();
  const cache = createTtlCache<string>();
  cache.set("key", "first", 1000);
  time.tick(500);
  cache.set("key", "second", 2000);
  time.tick(1000);
  assertEquals(cache.get("key"), "second");
  time.tick(1001);
  assertEquals(cache.get("key"), undefined);
});
