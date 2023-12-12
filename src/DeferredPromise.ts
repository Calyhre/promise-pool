export class DeferredPromise<T> extends Promise<T> {
  public resolve: (value: T) => void = () => {};
  public reject: (reason?: unknown) => void = () => {};

  constructor(
    runner?: (
      resolve: (value: T) => void,
      reject: (reason?: unknown) => void
    ) => void
  ) {
    let resolve: (value: T) => void = () => {};
    let reject: (reason?: unknown) => void = () => {};
    super((res, rej) => {
      resolve = res;
      reject = rej;

      runner?.(res, rej);
    });

    this.resolve = resolve;
    this.reject = reject;
  }
}
