import { Role } from './role';

export interface Player {
  id: string;
  name: string;
  originalRole: Role;
  currentRole: Role;
  voteFor?: string;
}

export class PlayerEntity implements Player {
  public readonly id: string;
  public readonly name: string;
  public originalRole: Role;
  public currentRole: Role;
  public voteFor?: string;

  constructor(id: string, name: string, role: Role) {
    this.id = id;
    this.name = name;
    this.originalRole = role;
    this.currentRole = role;
  }

  public vote(targetPlayerId: string): void {
    this.voteFor = targetPlayerId;
  }

  public swapRole(newRole: Role): Role {
    const oldRole = this.currentRole;
    this.currentRole = newRole;
    return oldRole;
  }

  /**
   * Creates a plain object representation of the player
   */
  public toDTO(): Player {
    return {
      id: this.id,
      name: this.name,
      originalRole: this.originalRole,
      currentRole: this.currentRole,
      voteFor: this.voteFor
    };
  }
} 