import { GameEvent } from '../../../domain/events/gameEvent';

/**
 * Event bus interface for publishing domain events
 */
export interface EventBus {
  /**
   * Publish an event to all subscribers
   */
  publish(event: GameEvent): Promise<void>;
  
  /**
   * Subscribe to events of a specific type
   */
  subscribe(eventType: string, callback: (event: GameEvent) => void): void;
  
  /**
   * Unsubscribe from events
   */
  unsubscribe(eventType: string, callback: (event: GameEvent) => void): void;
} 