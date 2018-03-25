**This framework tries to be as little opinionated as possible. The assumptions are that you'll have a message broker with a method to send messages, you'll have an entry function I'll call `botLogic`, that returns a promise that is resolved when everything is done.**

### How to use

```javascript

// I like using bluebird's promises
import Promise from 'bluebird';
import Jarvis from './index';

// An example of a simple send message method
async function sendMessage(recipient, message) {
  console.log('Message for user ' + recipient + ':');
  console.log(message);
  return Promise.resolve({recipient, message});
}

// An example of an entry point, in this case the broker
// contains the sendMessage method by default
async function botLogic(user, message, broker={sendMessage}) {
  let response = `User ${user.id} sent ${message}`;
  return broker.sendMessage(user.id, response);
};

// Create a class that inherits from Jarvis
class MessageBroker extends Jarvis {
  // Define whatever method you want to send messages, but
  // it MUST be used as the send message method inside
  // your bot's logic
  async sendMessage(recipient, message) {
    // Do the stuff you want

    // Call Jarvis sendMessage method with the
    // following parameters
    return super.sendMessage({
      recipient,
      message,
      // This is what the send message
      // method would normally return
      // (Whatever you want)
      resolveValue: message
    });
  }

  // Define a method that simulates the user sending a message
  userSends(user, message) {
    // In this case, my logic function receives the broker as
    // a parameter and returns a promise
    let logicPromise = botLogic(user, message, this);

    // We notify Jarvis that an user sent a message
    super.userSends(logicPromise);
  }

  // Define a method that simulates the bot sending a message
  async botSends(recipient, message) {
    // We tell Jarvis we are expecting a message for the recipient
    super.receiveMessage(recipient)
      .then((message) => {
        // Here use your favorite Unit Testing library,
        // here I'm just using Jasmine's syntax because
        // I'm familiar with it
        expect(message).toEqual(message);
        return Promise.resolve();
      })
      // Currently the promise is only rejected when the bot
      // finishes it's logic
      .catch((logicResult) => {
        throw Error(`Expecting message '${message}' for user ${recipient}, but the bot finished with result ${logicResult}`);
      });
  }
}
```
