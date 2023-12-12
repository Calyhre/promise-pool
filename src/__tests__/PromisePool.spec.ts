import { PromisePool } from "../PromisePool";
import { DeferredPromise } from "../DeferredPromise";

describe("PromisePool", () => {
  it("runs promise when expected", async () => {
    const pool = new PromisePool({ concurrency: 2 });

    const promise = new DeferredPromise<void>();
    const promiseRunner = jest.fn();
    promise.then(promiseRunner);

    expect(promiseRunner).not.toHaveBeenCalled();

    pool.add(() => promise);

    const runPromise = pool.start();

    expect(promiseRunner).not.toHaveBeenCalled();

    await promise.resolve();

    expect(promiseRunner).toHaveBeenCalled();
  });

  it("runs promises in order with concurrency", async () => {
    const pool = new PromisePool({ concurrency: 1 });

    const promise1 = new DeferredPromise<void>();
    const promise2 = new DeferredPromise<void>();
    const promise3 = new DeferredPromise<void>();

    const promise1Before = jest.fn();
    const promise1After = jest.fn();
    const promise2Before = jest.fn();
    const promise2After = jest.fn();
    const promise3Before = jest.fn();
    const promise3After = jest.fn();

    expect(promise1After).not.toHaveBeenCalled();
    expect(promise2After).not.toHaveBeenCalled();
    expect(promise3After).not.toHaveBeenCalled();

    pool.add([
      async () => {
        promise3Before();
        await promise3;
        promise3After();
      },
      async () => {
        promise2Before();
        await promise2;
        promise2After();
      },
      async () => {
        promise1Before();
        await promise1;
        promise1After();
      },
    ]);
    pool.start();

    expect(promise1Before).not.toHaveBeenCalled();
    expect(promise1After).not.toHaveBeenCalled();
    expect(promise2Before).not.toHaveBeenCalled();
    expect(promise2After).not.toHaveBeenCalled();
    expect(promise3Before).toHaveBeenCalled();
    expect(promise3After).not.toHaveBeenCalled();

    await promise3.resolve();

    expect(promise1Before).not.toHaveBeenCalled();
    expect(promise1After).not.toHaveBeenCalled();
    expect(promise2Before).not.toHaveBeenCalled();
    expect(promise2After).not.toHaveBeenCalled();
    expect(promise3After).toHaveBeenCalled();

    await pool.waitForTick();

    expect(promise1Before).not.toHaveBeenCalled();
    expect(promise1After).not.toHaveBeenCalled();
    expect(promise2Before).toHaveBeenCalled();
    expect(promise2After).not.toHaveBeenCalled();

    await promise2.resolve();

    expect(promise1Before).not.toHaveBeenCalled();
    expect(promise1After).not.toHaveBeenCalled();
    expect(promise2After).toHaveBeenCalled();

    await pool.waitForTick();

    expect(promise1Before).toHaveBeenCalled();
    expect(promise1After).not.toHaveBeenCalled();

    await promise1.resolve();

    expect(promise1After).toHaveBeenCalled();

    return pool.waitForTick();
  });

  it("runs new promises added after calling start", async () => {
    const pool = new PromisePool({ concurrency: 1 });

    const promise1 = new DeferredPromise<void>();
    const promise2 = new DeferredPromise<void>();

    const promise1Runner = jest.fn();
    const promise2Runner = jest.fn();

    expect(promise1Runner).not.toHaveBeenCalled();
    expect(promise2Runner).not.toHaveBeenCalled();

    pool.add(() => promise1.then(promise1Runner));

    await promise1.resolve();
    await pool.start();

    expect(promise1Runner).toHaveBeenCalled();
    expect(promise2Runner).not.toHaveBeenCalled();

    pool.add(() => promise2.then(promise2Runner));

    await promise2.resolve();
    await pool.waitForTick();

    expect(promise2Runner).toHaveBeenCalled();
  });

  it("runs new promises added while running", async () => {
    const pool = new PromisePool({ concurrency: 1 });

    const promise1 = new DeferredPromise<void>();
    const promise2 = new DeferredPromise<void>();

    const promise1Runner = jest.fn();
    const promise2Runner = jest.fn();

    expect(promise1Runner).not.toHaveBeenCalled();
    expect(promise2Runner).not.toHaveBeenCalled();

    pool.add(() => promise1.then(promise1Runner));
    pool.start();

    expect(promise1Runner).not.toHaveBeenCalled();
    expect(promise2Runner).not.toHaveBeenCalled();

    pool.add(() => promise2.then(promise2Runner));

    await promise1.resolve();
    await pool.waitForTick();

    expect(promise1Runner).toHaveBeenCalled();
    expect(promise2Runner).not.toHaveBeenCalled();

    await promise2.resolve();
    await pool.waitForTick();

    expect(promise2Runner).toHaveBeenCalled();
  });

  it("limits running promises based on concurrency", async () => {
    const pool = new PromisePool({ concurrency: 3 });

    const promises = Array.from({ length: 10 }, () => {
      const promise = new DeferredPromise<void>();
      const promiseRunner = jest.fn();
      pool.add(() => promise.then(promiseRunner));
      return [promise, promiseRunner] as const;
    });

    pool.start();

    expect(pool.stats).toEqual({ concurrency: 3, waiting: 7, running: 3 });
    await promises[0][0].resolve();
    await pool.waitForTick();
    expect(pool.stats).toEqual({ concurrency: 3, waiting: 6, running: 3 });
  });

  it("limits running promises based on decreasing concurrency", async () => {
    const pool = new PromisePool({ concurrency: 3 });

    const promises = Array.from({ length: 10 }, () => {
      const promise = new DeferredPromise<void>();
      const promiseRunner = jest.fn();
      pool.add(() => promise.then(promiseRunner));
      return [promise, promiseRunner] as const;
    });

    pool.start();

    expect(pool.stats).toEqual({ concurrency: 3, waiting: 7, running: 3 });
    await promises[0][0].resolve();
    await pool.waitForTick();
    expect(pool.stats).toEqual({ concurrency: 3, waiting: 6, running: 3 });

    pool.concurrency = 2;

    expect(pool.stats).toEqual({ concurrency: 2, waiting: 6, running: 3 });
    await promises[1][0].resolve();
    await pool.waitForTick();
    expect(pool.stats).toEqual({ concurrency: 2, waiting: 6, running: 2 });
  });

  it("limits running promises based on increasing concurrency", async () => {
    const pool = new PromisePool({ concurrency: 2 });

    const promises = Array.from({ length: 10 }, () => {
      const promise = new DeferredPromise<void>();
      const promiseRunner = jest.fn();
      pool.add(() => promise.then(promiseRunner));
      return [promise, promiseRunner] as const;
    });

    pool.start();

    expect(pool.stats).toEqual({ concurrency: 2, waiting: 8, running: 2 });
    await promises[0][0].resolve();
    await pool.waitForTick();
    expect(pool.stats).toEqual({ concurrency: 2, waiting: 7, running: 2 });

    pool.concurrency = 3;

    expect(pool.stats).toEqual({ concurrency: 3, waiting: 7, running: 2 });
    await promises[1][0].resolve();
    await pool.waitForTick();
    expect(pool.stats).toEqual({ concurrency: 3, waiting: 5, running: 3 });
  });

  it("times out ticks based on tickTimeout", async () => {
    const pool = new PromisePool({ concurrency: 1, tickTimeout: 50 });

    const promise = new DeferredPromise<void>();
    const promiseRunner = jest.fn();

    expect(promiseRunner).not.toHaveBeenCalled();

    pool.add(() => promise.then(promiseRunner));
    const start = Date.now();
    pool.start();

    expect(promiseRunner).not.toHaveBeenCalled();

    await pool.waitForTick();
    const end = Date.now();

    expect(promiseRunner).not.toHaveBeenCalled();
    // At least 50ms should have passed
    expect(end - start).toBeGreaterThanOrEqual(50);

    await promise.resolve();
    await pool.waitForTick();

    expect(promiseRunner).toHaveBeenCalled();
  });
});
