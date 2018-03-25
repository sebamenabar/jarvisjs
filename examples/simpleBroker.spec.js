// I like using bluebird's promises
import Promise from 'bluebird';
import Jarvis from '../lib';

// An example of a simple send message method
async function sendMessage(recipient, message) {
  console.log(`Message for user ${recipient}:`);
  console.log(message);
  return Promise.resolve({ recipient, message });
}

// An example of an entry point, in this case the broker
// contains the sendMessage method by default
async function botLogic(user, message, broker = { sendMessage }) {
  const response = `User ${user.id} sent ${message}`;
  return broker.sendMessage(user.id, response);
}

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
      resolveValue: message,
    });
  }

  // Define a method that simulates the user sending a message
  userSends(user, message) {
    // In this case, my logic function receives the broker as
    // a parameter and returns a promise
    const logicPromise = botLogic(user, message, this);

    // We notify Jarvis that an user sent a message
    super.userSends(logicPromise);

    return logicPromise;
  }

  // Define a method that simulates the bot sending a message
  async botSends(recipient, message) {
    // We tell Jarvis we are expecting a message for the recipient
    super.receiveMessage(recipient.id)
      .then((response) => {
        // Here use your favorite Unit Testing library,
        // here I'm just using Jasmine's syntax because
        // I'm familiar with it
        // Received message has the form:
        // {resolve, message, recipient}
        expect(response.message).toEqual(message);
        return Promise.resolve();
      })
      // Currently the promise is only rejected when the bot
      // finishes it's logic
      .catch((logicResult) => {
        const error = new Error(`Expecting message '${message}' for user ${recipient}, but the bot finished with result ${logicResult}`);
        error.name = 'botLogicDoneWithoutMessage';
        return Promise.reject(error);
      });
  }
}

const user = { id: 1 };
describe('Simple example', () => {
  it('passes when expecting the correct response', (done) => {
    // I use a different jarvis each time
    // because it mantains a queue
    const jarvis = new MessageBroker();

    const message = 'Hi';
    const logicPromise = jarvis.userSends(user, message);

    const response = `User ${user.id} sent ${message}`;
    jarvis.botSends(user, response)
      .then(() => {
        // We wait for everything to finish correctly
        logicPromise.then(() => done());
      }).catch(fail);
  });

  it('fails when entered an incorrect message', (done) => {
    const jarvis = new MessageBroker();

    const message = 'Hi';
    const logicPromise = jarvis.userSends(user, message);

    const correctResponse = `User ${user.id} sent ${message}`;
    const wrongResponse = '';
    jarvis.botSends(user, wrongResponse)
      .then(() => {
        fail(new Error('Shouldn\'t resolve when expecting a wrong response'));
      })
      .catch((error) => {
        // logicPromise must be resolved
        logicPromise.then((result) => {
          console.log(result);
          expect(error.name).toEqual('botLogicDoneWithoutMessage');
          done();
        });
      });
  });
});
