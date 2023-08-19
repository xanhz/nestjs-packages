export class InvalidPublishOptions extends Error {
  constructor() {
    super(`Publish options must contain 'exchange' or 'queue'`);
  }
}
