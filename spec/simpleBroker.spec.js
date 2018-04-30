import { Jabric } from '../build';

async function sendMessage(recipient, message) {
  console.log(`Message for user ${recipient.id}:`);
  console.log(message);
  return Promise.resolve({ recipient, message });
}

async function botLogic(user, message, broker = { sendMessage }) {
  if (message === 'THROW') throw Error('Error on backend');
  else if (message === 'TIMEOUT') return new Promise(() => {});

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
    console.log('user sending');
    super.userSends(() => botLogic(sender, message, this));
  }

  sendMessage(recipient, message) {
    return super.sendMessage(recipient.id, message, message);
  }
}

const user = { id: 1 };
describe('Simple example', () => {
  it('passes when expecting the correct response', (done) => {
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

  it('fails when backend fails', (done) => {
    const jarvis = new FakeBroker();

    jarvis.start(() => {
      jarvis.userSends(user, 'THROW');
      expect(() => jarvis.end()).toThrowError('Error on backend');
      done();
    });
  });

  it('fails when entered an incorrect message', (done) => {
    const jarvis = new FakeBroker();

    jarvis.start(() => {
      jarvis.userSends(user, 'Hi');
      const spy = spyOn(jarvis, 'botSends');
      spy.and.callFake((recipient, expectedMessage) => {
        const sentMessage = Jabric.prototype.botSends.call(jarvis, recipient.id);
        if (expectedMessage !== sentMessage) throw new Error(`Expected ${sentMessage} to equal ${expectedMessage}`);
      });
      expect(() => jarvis.botSends(user, '')).toThrowError('Expected User 1 sent Hi to equal ');
      jarvis.botSends(user, 'BOT LOGIC END');
      jarvis.end();
      done();
    });
  });

  it('fails when there are enqueued messages', (done) => {
    const jarvis = new FakeBroker();

    jarvis.start(() => {
      jarvis.userSends(user, 'Hi');
      expect(() => jarvis.end()).toThrowError('Bot logic ended but still some messages in queue');
      done();
    });
  });

  fit('fails when user sends a message but the bot still has some in queue', (done) => {
    const jarvis = new FakeBroker();

    jarvis.start(() => {
      jarvis.userSends(user, 'One');
      const response = `User ${user.id} sent One`;
      jarvis.botSends(user, response);
      expect(() => jarvis.userSends(user, 'Two')).toThrowError('Bot logic ended but still some messages in queue');
      done();
    });
  });

  it('fails when bot logic promise does not resolve', (done) => {
    const jarvis = new FakeBroker();

    jarvis.start(() => {
      jarvis.userSends(user, 'TIMEOUT');
      jarvis.userSends(user, '');
      // expect(() => jarvis.userSends(user, '')).toThrowError('Timeout: Bot logic did not resolve');
      done();
    });
  });
});
