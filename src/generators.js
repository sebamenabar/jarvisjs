import Future from 'fibers/future';

function asyncFunction() {
  const future = new Future();
  setTimeout(() => future.return('done'), 1000);
  return future.wait();
}

function asyncWrapper() {
  console.log(1);
  console.log(asyncFunction());
  throw (new Error('fuck'));
  console.log(2);
}

function main() {
  const f = Future.task(() => {
    Future.wrap(asyncWrapper)();
  });
  f.detach();
}

main();
