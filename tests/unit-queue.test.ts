import { describe, it, expect } from "vitest";
import { UnitQueue } from "../src/exercises/unitQueue";
const tick = () => new Promise((r) => setTimeout(r, 0));
describe("ordered exercise receipts", () => {
  it("buffers fast repetitions while a slow receipt is pending", async () => {
    const sent: number[] = [],
      accepted: number[] = [];
    let resolve!: (v: boolean) => void;
    const q = new UnitQueue<number>((v) => {
      sent.push(v);
      return new Promise((r) => (resolve = r));
    });
    q.push(1, () => accepted.push(1));
    q.push(2, () => accepted.push(2));
    expect(sent).toEqual([1]);
    expect(q.size).toBe(2);
    resolve(true);
    await tick();
    expect(sent).toEqual([1, 2]);
    resolve(true);
    await tick();
    expect(accepted).toEqual([1, 2]);
    expect(q.size).toBe(0);
  });
  it("drops queued repetitions on rejection or session reset", async () => {
    const sent: number[] = [];
    let resolve!: (v: boolean) => void;
    const q = new UnitQueue<number>((v) => {
      sent.push(v);
      return new Promise((r) => (resolve = r));
    });
    q.push(1, () => {});
    q.push(2, () => {});
    resolve(false);
    await tick();
    expect(sent).toEqual([1]);
    expect(q.size).toBe(0);
    q.push(3, () => {
      throw Error("stale callback");
    });
    q.push(4, () => {});
    q.reset();
    resolve(true);
    await tick();
    expect(sent).toEqual([1, 3]);
  });
  it("bounds unsaved evidence", () => {
    const q = new UnitQueue(() => new Promise<boolean>(() => {}), 2);
    expect(q.push(1, () => {})).toBe(true);
    expect(q.push(2, () => {})).toBe(true);
    expect(q.push(3, () => {})).toBe(false);
  });
});

it("drains completed observations before a rest command", async () => {
  let settle!: (accepted: boolean) => void;
  const order: string[] = [];
  const queue = new UnitQueue<number>((value) => {
    order.push(`rep${value}`);
    return new Promise((resolve) => (settle = resolve));
  });
  queue.push(1, () => {});
  queue.push(2, () => {});
  const resting = queue.flush().then(() => order.push("rest"));
  settle(true);
  await tick();
  expect(order).toEqual(["rep1", "rep2"]);
  settle(true);
  await resting;
  expect(order).toEqual(["rep1", "rep2", "rest"]);
});
