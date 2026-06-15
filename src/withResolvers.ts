type Resolve<T> = Parameters<ConstructorParameters<typeof Promise<T>>[0]>[0];
type Reject = Parameters<ConstructorParameters<typeof Promise<never>>[0]>[1];

// A lite polyfill for Promise.withResolvers
const withResolvers = <T>() => {
  if (typeof Promise.withResolvers === "function") {
    return Promise.withResolvers<T>();
  } else {
    let resolve!: Resolve<T>;
    let reject!: Reject;

    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    return { promise, resolve, reject };
  }
};
export { withResolvers };
