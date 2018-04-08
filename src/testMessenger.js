export default class Messenger {
  constructor(id) {
    this.id = id;
  }

  async sendMessage({ recipient, content }) {
    recipient = recipient || this.id;
    const message = { recipient, content };
    console.log(message);
    return Promise.resolve(message);
  }
}
