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
  return broker.sendMessage(user.id, response)
    .then(() => broker.sendMessage(user.id, 'BOT LOGIC END'));
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
    // Tell jarvis that the
    // bot logic should finish with no more
    // messages on stack
    super.end();

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
    const response = super.receiveMessage(recipient.id);
    // Here use your favorite Unit Testing library,
    // here I'm just using Jasmine's syntax because
    // I'm familiar with it
    // Received message has the form:
    // {resolve, message, recipient}
    expect(response.message).toEqual(message);
  }

  end() {
    super.end();
  }
}

const user = { id: 1 };
describe('Simple example', () => {
  it('passes when expecting the correct response', (done) => {
    // I use a different jarvis each time
    // because it mantains a queue
    const jarvis = new MessageBroker();

    const message = 'Hi';
    jarvis.userSends(user, message);

    const response = `User ${user.id} sent ${message}`;
    jarvis.botSends(user, response);
    jarvis.botSends(user, 'BOT LOGIC END');
    jarvis.end();

    done();
  });

  xit('fails when entered an incorrect message', (done) => {
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
