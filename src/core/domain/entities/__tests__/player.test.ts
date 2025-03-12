import { PlayerEntity } from '../player';
import { Role } from '../role';

describe('PlayerEntity', () => {
  it('should create a player with the correct properties', () => {
    // Arrange
    const id = 'player-1';
    const name = 'Alice';
    const role = Role.Werewolf;

    // Act
    const player = new PlayerEntity(id, name, role);

    // Assert
    expect(player.id).toBe(id);
    expect(player.name).toBe(name);
    expect(player.originalRole).toBe(role);
    expect(player.currentRole).toBe(role);
    expect(player.voteFor).toBeUndefined();
  });

  it('should update vote correctly', () => {
    // Arrange
    const player = new PlayerEntity('player-1', 'Alice', Role.Werewolf);
    const targetPlayerId = 'player-2';

    // Act
    player.vote(targetPlayerId);

    // Assert
    expect(player.voteFor).toBe(targetPlayerId);
  });

  it('should swap role correctly and return the old role', () => {
    // Arrange
    const player = new PlayerEntity('player-1', 'Alice', Role.Werewolf);
    const newRole = Role.Villager;

    // Act
    const oldRole = player.swapRole(newRole);

    // Assert
    expect(oldRole).toBe(Role.Werewolf);
    expect(player.currentRole).toBe(newRole);
    expect(player.originalRole).toBe(Role.Werewolf); // Original role should not change
  });

  it('should convert to DTO correctly', () => {
    // Arrange
    const player = new PlayerEntity('player-1', 'Alice', Role.Werewolf);
    player.vote('player-2');

    // Act
    const dto = player.toDTO();

    // Assert
    expect(dto).toEqual({
      id: 'player-1',
      name: 'Alice',
      originalRole: Role.Werewolf,
      currentRole: Role.Werewolf,
      voteFor: 'player-2'
    });
  });
}); 