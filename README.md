🛁 PromisePool
===

A PromisePool is a queue of promise running concurrently, limited by a defined concurrency. NodeJS is a Single Thread Event loop, which means that truly parallel execution does not exists by default. So the purpose of this library is not to save CPU or times, but rather limit the number of running promises in memory.

So main goals of this library:
- [x] Have a pool of promises that limits the number of them running in parallel
- [x] It is possible to add promises to it *while* the pool is running
- [x] Concurrency can be updated while the pool is running
- [x] The number of running promises should be as full as permitted by the set `concurrency`
- [x] The pool can be started at any given point
- [ ] The pool can be stopped at any given point


## Why may I need this?

Take this example:

```ts
function memoryExpensiveFunction() {
  // This function will uses at least 1mo of memory...
  const a = Buffer.alloc(1e6)

  // ...and continue with some async work for 10s
  await new Promise(r => setTimeout(r, 10e3))
}

Promise.all([
  memoryExpensiveFunction(),
  memoryExpensiveFunction(),
  // ... repeat 48 more times
])
```

Right after the `Promise.all` call you will end up with at least 50mo of memory being used for at least 10 seconds.

If you use a `PromisePool` with a defined concurrency:

```ts
const pool = new PromisePool({ concurrency: 10 })

pool.add([
  memoryExpensiveFunction,
  memoryExpensiveFunction,
  // ... repeat 48 more times
])

pool.start()
```

This time, right after the `pool.start()` call you will end up with at least 10mo of memory being used because of the concurrency of `10`. Granted, now the whole work will take at least 50 seconds.

The memory saving is done at the expense of the speed of execution. Running unbounded `Promise.all` can result in a lot of memory issues in production. Using a `PromisePool` will allow you to restrict while keeping a somewhat parallel work.


## Usage


#### 1. Create a pool

```ts
const pool = new PromisePool({ concurrency: 2 })
```

Concurrency here will be the maximum number of `Promise` allowed to run concurrently.

#### 2. Adding promises

```ts
// It can be a single item
pool.add(getPromise)

// Or it can be an array
pool.add([getPromise, getPromise])
```

> 🟠 PromisePool __*will starts the promise for you*__. Do not pass directly promises to it, but rather a function that returns a promise. This is the crucial mechanism that will limit the running amount of concurrent code.

```ts
// 👍 Do
pool.add(() => promise)

// 👎 Do not
pool.add(promise)
```

#### 3. Starts the pool

```ts
pool.start()
```

This `pool.start()` method will return a promise that resolved once the current running batch is done.

A `PromisePool` also allows you to add jobs *while* the pool is running:

```ts
pool.start()
pool.add(getOtherPromise)
// Your other promise will also eventually get executed
```
