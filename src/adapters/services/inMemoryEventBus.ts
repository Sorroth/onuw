import { EventBus } from '../../core/application/ports/services/eventBus';
import { GameEvent } from '../../core/domain/events/gameEvent';

/**
 * In-memory implementation of the EventBus interface
 * Used for testing and development
 */
export class InMemoryEventBus implements EventBus {
  private subscribers: Map<string, Array<(event: GameEvent) => void>> = new Map();

  /**
   * Publish an event to all subscribers
   */
  public async publish(event: GameEvent): Promise<void> {
    const eventType = event.type;
    const handlers = this.subscribers.get(eventType) || [];
    
    // Call all handlers for this event type
    handlers.forEach(handler => handler(event));
    
    // Also call handlers for '*' (all events)
    const allEventHandlers = this.subscribers.get('*') || [];
    allEventHandlers.forEach(handler => handler(event));
  }

  /**
   * Subscribe to events of a specific type
   */
  public subscribe(eventType: string, callback: (event: GameEvent) => void): void {
    const handlers = this.subscribers.get(eventType) || [];
    handlers.push(callback);
    this.subscribers.set(eventType, handlers);
  }

  /**
   * Unsubscribe from events
   */
  public unsubscribe(eventType: string, callback: (event: GameEvent) => void): void {
    const handlers = this.subscribers.get(eventType) || [];
    const index = handlers.indexOf(callback);
    
    if (index !== -1) {
      handlers.splice(index, 1);
      this.subscribers.set(eventType, handlers);
    }
  }
} 