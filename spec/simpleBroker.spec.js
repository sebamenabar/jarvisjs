import { Jabric } from '../build';

async function sendMessage(recipient, message) {
  console.log(`Message for user ${recipient.id}:`);
  console.log(message);
  return Promise.resolve({ recipient, message });
}

async function botLogic(user, message, broker = { sendMessage }) {
  if (message === 'THROW') throw Error('Error on backend');

  const response = `User ${user.id} sent ${message}`;
  return broker.sendMessage(user, response)
    .then(() => broker.sendMessage(user, 'BOT LOGIC END'));
}

class FakeBroker extends Jabric {
  botSends(recipient, expectedMessage) {
    const sentMessage = super.botSends(recipient.id);
    expect(sentMessage).toEqual(expectedMessage);
  }

  userSends(sender, message) {
    botLogic(sender, message, this);
  }

  sendMessage(recipient, message) {
    return super.sendMessage(recipient.id, message, message);
  }

}

const user = { id: 1 };
describe('Simple example', () => {
  fit('passes when expecting the correct response', (done) => {
    const jarvis = new FakeBroker();

    jarvis.start(() => {
      const message = 'Hi';
      jarvis.userSends(user, message);

      const response = `User ${user.id} sent ${message}`;
      jarvis.botSends(user, response);
      jarvis.botSends(user, 'BOT LOGIC END');
      done();
    });
  });

  it('fails when entered an incorrect message', (done) => {
    const jarvis = new FakeBroker();

    return jarvis.start(() => {
      jarvis.userSends(user, 'Hi');
      jarvis.botSends(user, '');
      jarvis.botSends(user, 'BOT LOGIC END');
      done();
    });
  });

  it('fails when backend fails', (done) => {
    const jarvis = new FakeBroker();

    return jarvis.start(() => {
      jarvis.userSends(user, 'THROW');
      done();
    });
  });
});
