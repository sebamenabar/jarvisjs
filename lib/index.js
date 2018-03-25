import Promise from 'bluebird';
import EventEmitter from 'events';

export default class MessageBroker {
  constructor() {
    // The received messages will be serially saved in the queue
    this.queue = {};
    // To know when the bot sends a new messages, or finishes the logic
    // we use and EventEmitter
    this.emitter = new EventEmitter();
  }

  // This method will override the bot logic's send message method
  async sendMessage({ recipient, message, resolveValue }) {
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

  userSends(logicPromise) {
    // In case the logic finishes while we are waiting for a message
    // we add a an event emission on finish
    logicPromise.then((result) => {
      this.emitter.emit('logicDone', result);
    });
  }

  // This method tries to fetch the next message that
  // recipient will receive
  async receiveMessage(recipient) {
    return new Promise((resolve, reject) => {
      // We check if the user has enqueued messages
      if (this.queue[recipient] && this.queue[recipient].length) {
        const message = this.queue[recipient].shift();
        // And we resolve the message, so the await in sendMessage
        // is resolved and the bot's logic continues
        (message.resolve)();
        // Finally we resolve the message
        resolve(message);
      }

      // If recipient does not have enqueued messages then we continue
      // the bot's logic until we receive one, or the logic finished
      this.emitter.once('logicDone', (result) => {
        // If the logic finished we reject, because we were
        // expecting a message
        reject(result);
      }).listen('sentMessage', (newMessageRecipient, resolveNewMessage) => {
        // If we receive a message we check if it is for
        // the user that we are expecting
        if (newMessageRecipient === recipient) {
          // If it is retrieve the message from the user's queue
          const message = this.queue[recipient].shift();
          // We stop listening for new messages or
          // end of bot's logic
          this.emitter.removeAllListeners();
          resolve(message);
        }
        // And we resume the bot's logic
        resolveNewMessage();
      });
    });
  }
}
