export function createEventBus() {
  const subscribers = [];

  function subscribe(callback) {
    subscribers.push(callback);
  }

  function notify(event, payload) {
    for (const subscriber of subscribers) {
      subscriber(event, payload);
    }
  }

  return { subscribe, notify };
}