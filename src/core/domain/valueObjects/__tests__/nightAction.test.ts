import { NightActionEntity, NightActionType } from '../nightAction';
import { Role } from '../../entities/role';

describe('NightActionEntity', () => {
  it('should create a night action with the correct properties', () => {
    // Arrange
    const role = Role.Werewolf;
    const performerId = 'player-1';
    const actionType = NightActionType.View;
    const options = {
      targetId: 'player-2',
      targetCardIndices: [0, 1]
    };

    // Act
    const nightAction = new NightActionEntity(role, performerId, actionType, options);

    // Assert
    expect(nightAction.role).toBe(role);
    expect(nightAction.performerId).toBe(performerId);
    expect(nightAction.actionType).toBe(actionType);
    expect(nightAction.targetId).toBe(options.targetId);
    expect(nightAction.targetCardIndices).toEqual(options.targetCardIndices);
    expect(nightAction.revealedRoles).toBeUndefined();
    expect(nightAction.swappedCards).toBeUndefined();
  });

  it('should add revealed roles correctly', () => {
    // Arrange
    const nightAction = new NightActionEntity(Role.Seer, 'player-1', NightActionType.View);
    const roles = {
      'player-2': Role.Werewolf,
      'player-3': Role.Villager
    };

    // Act
    nightAction.addRevealedRoles(roles);

    // Assert
    expect(nightAction.revealedRoles).toEqual(roles);
  });

  it('should merge revealed roles when adding more', () => {
    // Arrange
    const nightAction = new NightActionEntity(Role.Seer, 'player-1', NightActionType.View);
    const roles1 = { 'player-2': Role.Werewolf };
    const roles2 = { 'player-3': Role.Villager };

    // Act
    nightAction.addRevealedRoles(roles1);
    nightAction.addRevealedRoles(roles2);

    // Assert
    expect(nightAction.revealedRoles).toEqual({
      'player-2': Role.Werewolf,
      'player-3': Role.Villager
    });
  });

  it('should add swapped cards correctly', () => {
    // Arrange
    const nightAction = new NightActionEntity(Role.Troublemaker, 'player-1', NightActionType.Swap);
    const from = 'player-2';
    const to = 'player-3';

    // Act
    nightAction.addSwappedCards(from, to);

    // Assert
    expect(nightAction.swappedCards).toEqual({ from, to });
  });

  it('should convert to DTO correctly', () => {
    // Arrange
    const nightAction = new NightActionEntity(
      Role.Robber, 
      'player-1', 
      NightActionType.Swap, 
      { targetId: 'player-2' }
    );
    nightAction.addRevealedRoles({ 'player-1': Role.Werewolf });
    nightAction.addSwappedCards('player-1', 'player-2');

    // Act
    const dto = nightAction.toDTO();

    // Assert
    expect(dto).toEqual({
      role: Role.Robber,
      performerId: 'player-1',
      actionType: NightActionType.Swap,
      targetId: 'player-2',
      targetCardIndices: undefined,
      revealedRoles: { 'player-1': Role.Werewolf },
      swappedCards: { from: 'player-1', to: 'player-2' }
    });
  });
}); 