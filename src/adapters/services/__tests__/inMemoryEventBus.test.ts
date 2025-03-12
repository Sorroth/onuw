import { InMemoryEventBus } from '../inMemoryEventBus';
import { GameCreatedEvent } from '../../../core/domain/events/gameEvent';
import { Role } from '../../../core/domain/entities/role';

describe('InMemoryEventBus', () => {
  let eventBus: InMemoryEventBus;

  beforeEach(() => {
    eventBus = new InMemoryEventBus();
  });

  it('should publish events to subscribers', async () => {
    // Arrange
    const event = new GameCreatedEvent('game-1', [Role.Werewolf, Role.Seer]);
    let receivedEvent: GameCreatedEvent | null = null;
    
    eventBus.subscribe('GAME_CREATED', (e) => {
      receivedEvent = e as GameCreatedEvent;
    });

    // Act
    await eventBus.publish(event);

    // Assert
    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent!.gameId).toBe('game-1');
    expect(receivedEvent!.roles).toEqual([Role.Werewolf, Role.Seer]);
  });

  it('should publish events to wildcard subscribers', async () => {
    // Arrange
    const event = new GameCreatedEvent('game-1', [Role.Werewolf, Role.Seer]);
    let receivedEvent: GameCreatedEvent | null = null;
    
    eventBus.subscribe('*', (e) => {
      receivedEvent = e as GameCreatedEvent;
    });

    // Act
    await eventBus.publish(event);

    // Assert
    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent!.gameId).toBe('game-1');
  });

  it('should allow unsubscribing from events', async () => {
    // Arrange
    const event = new GameCreatedEvent('game-1', [Role.Werewolf, Role.Seer]);
    let callCount = 0;
    
    const callback = () => {
      callCount++;
    };
    
    eventBus.subscribe('GAME_CREATED', callback);

    // Act
    await eventBus.publish(event);
    eventBus.unsubscribe('GAME_CREATED', callback);
    await eventBus.publish(event);

    // Assert
    expect(callCount).toBe(1); // Should only be called once
  });

  it('should not call unsubscribed callbacks', async () => {
    // Arrange
    const event = new GameCreatedEvent('game-1', [Role.Werewolf, Role.Seer]);
    let callCount1 = 0;
    let callCount2 = 0;
    
    const callback1 = () => {
      callCount1++;
    };
    
    const callback2 = () => {
      callCount2++;
    };
    
    eventBus.subscribe('GAME_CREATED', callback1);
    eventBus.subscribe('GAME_CREATED', callback2);

    // Act
    await eventBus.publish(event);
    eventBus.unsubscribe('GAME_CREATED', callback1);
    await eventBus.publish(event);

    // Assert
    expect(callCount1).toBe(1); // Should only be called once
    expect(callCount2).toBe(2); // Should be called twice
  });
}); 