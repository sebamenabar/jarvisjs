import { EventEmitter } from 'events';
import * as Future from 'fibers/future';

const MORE_MESSAGES_THAN_EXPECTED = 'MORE_MESSAGES_THAN_EXPECTED';
const BOTLOGIC_FINISHED = 'BOT_LOGIC_FINSHED';
const BOTLOGIC_TIMEOUT = 'BOTLOGIC_TIMEOUT';

const SECOND = 1000;
class JarvisError extends Error {
  code: string;
  params: Object;
  constructor(message: string, code: string, options?: {params: {}}) {
    super(message);
    this.code = code;
    Object.assign(this, options);
  }
}

const promiseTimeout = (ms: number, promise: Promise<any>, error: Error): Promise<any> => {
  // Create a promise that rejects in <ms> milliseconds
  const timeout = new Promise((resolve: Function, reject: Function) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(error);
    }, ms);
  });

  // Returns a race between our timeout and the passed in promise
  return Promise.race([
    promise,
    timeout,
  ]);
};


export class Jarvis {
  botLogic: any;
  logicTimoutError: Error;
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
  constructor(timeout: number = 1000) {
    // The received messages will be serially saved in the queue
    this.queue = {};
    // To know when the bot sends a new messages, or finishes the logic
    // we use and EventEmitter
    this.emitter = new EventEmitter();
    // A logic promise to know when the
    // bot is running
    this.logicPromise = null;

    // The timeout tells you how long to wait
    // for the botlogic to end after
    // receiving all the messages
    this.timeout = timeout;

    this.logicTimoutError = new Error('Timeout on waiting logic to finish on end');
  }

  async start(fn: Function) {
    const promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });

    const future = Future.task(() => fn());
    future.detach();
    this.future = future;
    return promise;
  }

  // This method will override the bot logic's send message method
  // async sendMessage <string | number, any, any> (recipient, message, resolveValue) {
  async sendMessage(recipient: string | number, message: any, resolveValue?: any) {
    recipient = recipient.toString();
    // Create the queue for the user messages if it does not exist
    if (!this.queue[recipient]) this.queue[recipient] = [];
    // We create a promise so that we can await
    // before continuing the bot's logic
    const receiveMessagePromise = new Promise((resolve) => {
      // We add the message tu the user's queue
      this.queue[recipient].push({
        // We store the resolve method, so we can
        // remote resolve the promise, and the
        // message and the recipient, that'll be used
        // for verification
        resolve, message, recipient,
      });

      // We notifiy the broker that a new message has been added to
      // the queue in case it is waiting in the receiveMessage method
      this.emitter.emit('sentMessage', recipient, resolve);
    });

    // And we wait for the resolution in the receiveMessage method
    await receiveMessagePromise;

    // Finally, we resolve with whatever value the bot's logic does
    return Promise.resolve(resolveValue);
  }

  userSends(logicPromise: Promise<any>) {
    // In case the logic finishes while we are waiting for a message
    // we add a an event emission on finish
    logicPromise.then((result: any) => {
      this.emitter.emit('logicDone', result);
    });

    logicPromise.catch((err: Error) => {
      this.future.throw(err);
      this.reject(err);
    });

    this.logicPromise = logicPromise;
  }

  // This method tries to fetch the next message that
  // recipient will receive
  receiveMessage(recipient: number | string) {
    const future = new Future();

    recipient = recipient.toString();
    let message;
    if (this.queue[recipient] && this.queue[recipient].length) {
      message = this.queue[recipient].shift();
      // And we resolve the message, so the await in sendMessage
      // is resolved and the bot's logic continues
      (message!.resolve)();
      // Finally we resolve the message
      return message;
    }

    const messagePromise = new Promise((resolve, reject) => {
      // If recipient does not have enqueued messages then we continue
      // the bot's logic until we receive one, or the logic finished
      this.emitter.once('logicDone', (result) => {
        // If the logic finished we reject, because we were
        // expecting a message
        const error = new JarvisError(
          `Expecting message for ${recipient} but the logic finished`,
          BOTLOGIC_FINISHED);
        error.params.result = result;
        reject(error);
      }).addListener('sentMessage', (newMessageRecipient: string | number, resolveNewMessage: Function) => {
        newMessageRecipient = newMessageRecipient.toString();
        // If we receive a message we check if it is for
        // the user that we are expecting
        if (newMessageRecipient === recipient) {
          // If it is retrieve the message from the user's queue
          message = this.queue[recipient].shift();
          // We stop listening for new messages or
          // end of bot's logic
          this.emitter.removeAllListeners();
          resolve(message);
        }
        // And we resume the bot's logic
        resolveNewMessage();
      });
    });

    messagePromise.then((resolvedMessage) => {
      future.return(resolvedMessage);
    }).catch((err) => {
      this.reject(err);
      future.throw(err);
      this.future.throw(err);
      throw err;
    });
    return future.wait();
  }

  async _end() {
    let res;
    if (this.botLogic) res = await promiseTimeout(SECOND, this.botLogic, this.logicTimoutError);

    Object.keys(this.queue).map(key => this.queue[key]).forEach((queue: {}[]) => {
      if (queue.length > 0) {
        const error = new JarvisError(
          'Bot logic ended but still some messages in queue', MORE_MESSAGES_THAN_EXPECTED,
          { params: { queue: this.queue } });
        this.reject(error);
        this.future.throw(error);
        throw error;
      }
    });
    this.resolve();
    return res;
  }

}


export class Jabric {
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
  currentResolve: Function;
  currentRecipient: string | number;
  constructor(timeout: number = 1000) {
    this.queue = {};
    this.emitter = new EventEmitter();
    this.logicPromise = null;
    this.timeout = timeout;
    this.logicTimeoutError = new JarvisError('Timeout on logic end', BOTLOGIC_TIMEOUT);
  }

  start(fn: Function) {
    const future = Future.task(() => fn());
    future.detach();
    this.future = future;
  }

  sendMessage(recipient: string | number, message: any, resolveValue?: any) {
    recipient = recipient.toString();
    console.log('Jabric sending message to ' + recipient);
    if (!this.queue[recipient]) this.queue[recipient] = [];
    const receiveMessagePromise = new Promise((resolve) => {
      this.queue[recipient].push({
        resolve, message, recipient,
      });

      this.emitter.emit('sentMessage', recipient, resolve);

      this.currentRecipient = recipient;
      this.currentResolve = resolve;

    });

    return receiveMessagePromise.then(() => Promise.resolve(resolveValue));
  }

  botSends(recipient: string | number) {
    recipient = recipient.toString();
    console.log('Retrieving message for ' + recipient);
    const future = new Future();
    if(this.currentRecipient === recipient) {
      const message = this.queue[recipient].shift();
      (message!.resolve)();
      future.return(message!.message);
      console.log('Jabric found message for ' + recipient);
    }

    return future.wait();
  }

  userSends(logicPromise: Promise<any>) {
    this.logicPromise = logicPromise;
  }
}
