import { DeferredPromise } from "../DeferredPromise";

describe("DeferredPromise", () => {
  it("resolves when expected", async () => {
    const promise = new DeferredPromise<void>();
    const thenRunner = jest.fn();
    const catchRunner = jest.fn();
    promise.then(thenRunner).catch(catchRunner);

    expect(thenRunner).not.toHaveBeenCalled();
    expect(catchRunner).not.toHaveBeenCalled();

    await promise.resolve();

    expect(thenRunner).toHaveBeenCalled();
    expect(catchRunner).not.toHaveBeenCalled();
  });

  it("rejects when expected", async () => {
    const promise = new DeferredPromise<void>();
    const thenRunner = jest.fn();
    const catchRunner = jest.fn();
    promise.then(thenRunner).catch(catchRunner);

    expect(thenRunner).not.toHaveBeenCalled();
    expect(catchRunner).not.toHaveBeenCalled();

    await promise.reject();
    await promise.catch(() => {});

    expect(thenRunner).not.toHaveBeenCalled();
    expect(catchRunner).toHaveBeenCalled();
  });
})
