import { Jarvis } from '../build';

async function sendMessage(recipient, message) {
  return Promise.resolve({ recipient, message });
}

async function botLogic(user, message, broker = { sendMessage }) {
  if (message === 'THROW') throw Error('Error on logic');
  else if (message === 'TIMEOUT') return new Promise(() => {});
  else if (message === 'MESSAGE_USER_2')
    return broker.sendMessage({ id: 2 }, 'Hi')
      .then(() => broker.sendMessage(user, 'Sent message to user 2'));


  const response = `User ${user.id} sent ${message}`;
  return broker.sendMessage(user, response)
    .then(() => broker.sendMessage(user, 'BOT LOGIC END'));
}

class FakeBroker extends Jarvis {
  botSends(recipient, expectedMessage) {
    const sentMessage = super.botSends(recipient.id);
    expect(sentMessage).toEqual(expectedMessage);
  }

  userSends(sender, message) {
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

  it('passes when requesting messages to two users regardless of the order', (done) => {
    const user2 = { id: 2 };
    const jarvis = new FakeBroker();

    jarvis.start(() => {
      jarvis.userSends(user, 'MESSAGE_USER_2');
      jarvis.botSends(user, 'Sent message to user 2');
      jarvis.botSends(user2, 'Hi');

      jarvis.end();
      done();
    });
  });

  it('fails when logic fails', (done) => {
    const jarvis = new FakeBroker();

    jarvis.start(() => {
      jarvis.userSends(user, 'THROW');
      expect(() => jarvis.end()).toThrowError('Error on logic');
      done();
    });
  });

  it('fails when entered an incorrect message', (done) => {
    const jarvis = new FakeBroker();

    jarvis.start(() => {
      jarvis.userSends(user, 'Hi');
      const spy = spyOn(jarvis, 'botSends');
      spy.and.callFake((recipient, expectedMessage) => {
        const sentMessage = Jarvis.prototype.botSends.call(jarvis, recipient.id);
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

  it('fails when bot logic promise does not resolve', (done) => {
    const jarvis = new FakeBroker();

    jarvis.start(() => {
      jarvis.userSends(user, 'TIMEOUT');
      expect(() => jarvis.userSends(user, '')).toThrowError('Timeout: Bot logic did not resolve on 100 ms');
      done();
    });
  });

  it('fails when expecting a message from bot but the logic finishes', (done) => {
    const jarvis = new FakeBroker();

    jarvis.start(() => {
      jarvis.userSends(user, 'Hi');
      jarvis.botSends(user, 'User 1 sent Hi');
      jarvis.botSends(user, 'BOT LOGIC END');
      expect(() => jarvis.botSends(user, 'NOT SENT MESSAGE')).toThrowError('Expecting a message but bot logic finished');
      done();
    });
  });
});
