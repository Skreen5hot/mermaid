import { createEventBus } from '../../src/utils/eventBus.js';
import { describe, it } from '../test-helpers.js';
import assert from '../../src/assert.js';

describe('Event Bus', () => {
  it('should create an event bus with subscribe and notify methods', () => {
    const bus = createEventBus();
    assert.ok(bus.subscribe, 'Bus should have a subscribe method');
    assert.ok(bus.notify, 'Bus should have a notify method');
  });

  it('should allow a subscriber to receive a notification', () => {
    const bus = createEventBus();
    let receivedEvent = null;
    let receivedPayload = null;

    bus.subscribe((event, payload) => {
      receivedEvent = event;
      receivedPayload = payload;
    });

    bus.notify('testEvent', { data: 'hello' });

    assert.strictEqual(receivedEvent, 'testEvent', 'Should receive the correct event name');
    assert.strictEqual(receivedPayload.data, 'hello', 'Should receive the correct payload');
  });

  it('should notify all subscribers', () => {
    const bus = createEventBus();
    let sub1Called = false;
    let sub2Called = false;

    bus.subscribe(() => (sub1Called = true));
    bus.subscribe(() => (sub2Called = true));

    bus.notify('someEvent');

    assert.ok(sub1Called, 'First subscriber should be called');
    assert.ok(sub2Called, 'Second subscriber should be called');
  });

  it('should isolate events between different bus instances', () => {
    const bus1 = createEventBus();
    const bus2 = createEventBus();
    let bus2SubscriberCalled = false;

    bus2.subscribe(() => (bus2SubscriberCalled = true));
    bus1.notify('eventForBus1');
    assert.strictEqual(bus2SubscriberCalled, false, 'Subscriber on bus2 should not be called by bus1');
  });
});