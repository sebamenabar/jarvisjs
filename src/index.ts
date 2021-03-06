import { EventEmitter } from 'events';
import * as Future from 'fibers/future';

const MORE_MESSAGES_THAN_EXPECTED = 'MORE_MESSAGES_THAN_EXPECTED';
const BOTLOGIC_FINISHED = 'BOT_LOGIC_FINSHED';
const BOTLOGIC_TIMEOUT = 'BOTLOGIC_TIMEOUT';

const DEFAULT_TIMEOUT = 100;
const SEC = 1000;

class JarvisError extends Error {
  code: string;
  params: Object;
  constructor(message: string, code: string, options?: {params: {}}) {
    super(message);
    this.code = code;
    Object.assign(this, options);
  }
}

/**
 * Rejects if the promises does not resolve under ms miliseconds
 */
function promiseTimeout (ms: number, promise: Promise<any>, error: Error): Promise<any> {
  // Create a promise that rejects in <ms> milliseconds
  const timeout = new Promise((resolve: Function, reject: Function) => {
    setTimeout(() => {
      reject(error);
    }, ms);
  });

  // Returns a race between our timeout and the passed in promise
  return Promise.race([
    promise,
    timeout,
  ]);
}
export class Jarvis {
  botLogic: any;
  logicTimeoutError: JarvisError;
  timeout: number;
  logicPromise: Promise<any> | null;
  emitter: EventEmitter;
  queue: {
    [key: string]: {
      resolve: Function,
      message: any,
      recipient: any,
    }[],
  };
  resolve: Function;
  reject: Function;
  future: any;
  currentResolve: Function | undefined;
  currentRecipient: string | number | undefined;
  constructor(timeout: number = DEFAULT_TIMEOUT) {
    this.queue = {};
    this.emitter = new EventEmitter();
    this.logicPromise = null;
    this.timeout = timeout;
    this.logicTimeoutError = new JarvisError('Timeout on logic end', BOTLOGIC_TIMEOUT);
  }
  /**
   * Runs the test under a fiber
   */
  start(fn: Function) {
    const future = Future.task(() => fn());
    future.detach();
  }

  /**
   * Overrides the sendMessage function on botlogic
   */
  sendMessage(recipient: string | number, message: any, resolveValue?: any) {
    // The queue key
    recipient = recipient.toString();
    // Enqueue a message for recipient
    if (!this.queue[recipient]) this.queue[recipient] = [];
    const receiveMessagePromise = new Promise((resolve) => {
      this.queue[recipient].push({
        resolve, message, recipient,
      });

      // Tell Jarvis a message was enqueued
      this.emitter.emit('sentMessage', recipient, resolve);

      // We use this in case 
      // the logic sends a message
      // to another user, so it
      // can be unfrozen
      this.currentRecipient = recipient;
      this.currentResolve = resolve;

    });

    // And with this, the botLogic freezes until it is 
    // received by Jarvis
    return receiveMessagePromise.then(() => Promise.resolve(resolveValue));
  }

  /**
   * Retrieve a message sent to recipient
   */
  botSends(recipient: string | number) {
    recipient = recipient.toString();
    let message;
    // Check if there is an enqueue message
    if(this.currentRecipient === recipient) {
      message = this.queue[recipient].shift();
      (message!.resolve)();
      this.currentRecipient = undefined;
      this.currentResolve = undefined;
      return message!.message;
    }

    // The future will allow us to return the message
    const future = new Future();

    // If the message wasn't enqueued 
    // we listen for new messages
    this.emitter.addListener('sentMessage', (newMessageRecipient: string | number, resolveNewMessage: Function) => {
      // Return the message if it was for the recipient
      if (newMessageRecipient === recipient) {
        message = this.queue[recipient].shift();
        this.emitter.removeAllListeners();
        future.return(message!.message);
      }

      // And always unfreeze the logic
      resolveNewMessage();
      this.currentRecipient = undefined;
      this.currentResolve = undefined;
    }).once('BOT_LOGIC_FINSHED', () => {
      // If the logic finished without getting 
      // a message for recipient,
      // then we throw an error
      future.throw(new JarvisError(
        'Expecting a message but bot logic finished',
        'BOT_LOGIC_FINSHED',
      ));
      this.emitter.removeAllListeners();
    });

    // If there wasn't a message for recipient
    // and the logic was frozen, we must 
    // unfreeze it
    if (this.currentResolve) this.currentResolve();
    // Return the found message
    // Will throw and error if we use future.throw
    return future.wait();
  }

  userSends(logicFn: () => Promise<any>, timeout = this.timeout) {
    // Boolean wether we should
    // wait for the previous logic to finish
    let wait = false;
    // The future that tells us if the previous logic
    // finished
    const prevFuture = this.future;
    // The future for the new logic
    const newFuture = new Future();
    // And a future to assure everything in the timeout 
    // will be executed before return
    const freezeFuture = new Future();

    // We use a promise timeout in case
    // the previous logic never resolves
    promiseTimeout(timeout, new Promise(async (resolve) => {
      // First we check there 
      // are no remaining messages from the
      // previous logic in the queue
      this.verifyQueue();
      if (prevFuture) {
        // And if a logic was run before
        // we must wait for it to resolve 
        // before executing the new logic
        wait = true;
        this.logicPromise!.then(() => resolve());
      } else resolve();
    }), new JarvisError(`Timeout: Bot logic did not resolve on ${timeout} ms`, BOTLOGIC_TIMEOUT))
      .then(() => {
        // When the previous logic resolves
        // we begin running the new one
        this.logicPromise = logicFn();
        this.future = newFuture;
        this.logicPromise
        .then(() => {
          // And attach and emitter
          // for when it finishes
          this.emitter.emit('BOT_LOGIC_FINSHED');
          this.future.return();
        })
        // If the logic fails then we propagate the error
        .catch(err => this.future.throw(err));
      // If we got a timeout we throw the error
      }).catch(err => prevFuture.throw(err))
      // After setting up all the promises
      // and emitters we unfreeze these method
      // and let the test continue
      .then(() => freezeFuture.return());

    freezeFuture.wait();
    if (wait) return prevFuture.wait();
    return newFuture;
  }

  end() {
    // When we finish the test we must verify
    // the queue is empty 
    // and the botlogic is not running
    this.verifyQueue();
    return this.future.wait();
  }

  verifyQueue() {
    // Verify that there are no messages for any user
    Object.keys(this.queue).map(key => this.queue[key]).forEach((queue: {}[]) => {
      if (queue.length > 0) {
        const error = new JarvisError(
          'Bot logic ended but still some messages in queue', MORE_MESSAGES_THAN_EXPECTED,
          { params: { queue: this.queue } });
        throw error;
      }
    });
  }
}
