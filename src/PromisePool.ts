export type PromisePoolOptions = {
  concurrency?: number;
  tickTimeout?: number;
};

export class PromisePool<T> {
  private _concurrency: number = 1;
  private _tickTimeout: number = Infinity;
  private _waitingPool: Array<() => Promise<T>> = [];
  private _runningPool: Map<number, Promise<T>> = new Map();

  private _hasStarted: boolean = false;
  private _nextKey: number = 0;
  private _currentTick: Promise<void> | null = null;
  private _currentRun: Promise<void> | null = null;

  /**
   * Creates a new PromisePool. A PromisePool is a queue of promises that can be
   * run concurrently. The number of promises that can run concurrently can be
   * set with the `concurrency` option.
   *
   * @param options.concurrency - The number of promises to run concurrently - Defaults to 1
   * @param options.tickTimeout - The maximum time a tick can run - Defaults to Infinity
   */
  constructor({ concurrency, tickTimeout }: PromisePoolOptions = {}) {
    this._concurrency = concurrency ?? this._concurrency;
    this._tickTimeout = tickTimeout ?? this._tickTimeout;
  }

  /**
   * Returns true if the pool has been started with `start()`
   */
  get hasStarted() {
    return this._hasStarted;
  }

  /**
   * Returns true if the pool has a tick timeout set
   */
  get hasTickTimeout() {
    return this._tickTimeout > 0 && this._tickTimeout !== Infinity;
  }

  /**
   * Returns true if the pool is currently running
   */
  get isRunning() {
    return !!this._currentRun;
  }

  /**
   * Returns true if the pool is not currently running and has no promises
   * waiting to run
   */
  get isEmpty() {
    return this._waitingPool.length === 0 && this._runningPool.size === 0;
  }

  /**
   * Returns true if the pool is empty and is not running
   */
  get isDone() {
    return !this.isRunning && this.isEmpty;
  }

  /**
   * Returns the current stats for the pool. This includes the concurrency, the
   * number of promises waiting to run, and the number of promises currently
   * running
   */
  get stats() {
    return {
      concurrency: this._concurrency,
      waiting: this._waitingPool.length,
      running: this._runningPool.size,
    };
  }

  /**
   * Sets the concurrency of the pool. This will only have effect after the
   * current tick if the pool is currently running
   */
  set concurrency(value: number) {
    this._concurrency = value;
  }

  /**
   * Sets the tick timeout of the pool. This will only have effect after the
   * current tick if the pool is currently running
   */
  set tickTimeout(value: number) {
    this._tickTimeout = value;
  }

  /**
   * Adds a promise to the pool. If the pool has already started, it will be
   * processed without having to `start()` again
   *
   * @param promise - The promise to add to the pool
   */
  add(newPromises: (() => Promise<T>) | Array<() => Promise<T>>) {
    if (Array.isArray(newPromises)) {
      for (const newPromise of newPromises) {
        this._waitingPool.push(newPromise);
      }
    } else {
      this._waitingPool.push(newPromises);
    }
    if (this._hasStarted) {
      this.start();
    }
  }

  /**
   * Starts the pool. This will process any promises that have been added to the
   * pool
   *
   * @returns A promise that resolves when the pool is done processing
   */
  async start() {
    if (this._currentRun) {
      return this._currentRun;
    }

    this._currentRun = this._start().finally(() => {
      this._currentRun = null;
    });

    return this._currentRun;
  }

  /**
   * Waits for the pool to finish processing the current tick. This is useful
   * for testing
   *
   * @returns A promise that resolves when the pool has at least one currently
   * running promise resolved
   */
  async waitForTick() {
    if (!this._currentTick) {
      return;
    }

    await this._currentTick;
  }

  private async _start() {
    this._hasStarted = true;
    while (this._waitingPool.length > 0 || this._runningPool.size > 0) {
      this._currentTick = this._tick();
      await this._currentTick;
    }
  }

  private async _tick() {
    if (
      this._runningPool.size < this._concurrency &&
      this._waitingPool.length > 0
    ) {
      for (const promise of this._waitingPool.splice(
        0,
        Math.max(this._concurrency - this._runningPool.size, 0)
      )) {
        this._nextKey += 1;

        const key = this._nextKey;
        this._runningPool.set(
          key,
          promise().finally(() => this._runningPool.delete(key))
        );
      }
    }

    await Promise.race(
      this.hasTickTimeout
        ? [...this._runningPool.values(), this._timeout()]
        : [...this._runningPool.values()]
    );
  }

  private async _timeout() {
    if (!this.hasTickTimeout) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, this._tickTimeout));
  }
}
