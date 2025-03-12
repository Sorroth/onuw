import { Role } from '../entities/role';

export enum NightActionType {
  View = 'view',
  Swap = 'swap',
  None = 'none'
}

export interface NightAction {
  role: Role;
  performerId: string;
  actionType: NightActionType;
  targetId?: string | string[];
  targetCardIndices?: number[];
  revealedRoles?: { [key: string]: Role };
  swappedCards?: { from: string | number, to: string | number };
}

export class NightActionEntity implements NightAction {
  public readonly role: Role;
  public readonly performerId: string;
  public readonly actionType: NightActionType;
  public readonly targetId?: string | string[];
  public readonly targetCardIndices?: number[];
  public revealedRoles?: { [key: string]: Role };
  public swappedCards?: { from: string | number, to: string | number };

  constructor(
    role: Role, 
    performerId: string, 
    actionType: NightActionType, 
    options: {
      targetId?: string | string[];
      targetCardIndices?: number[];
      revealedRoles?: { [key: string]: Role };
      swappedCards?: { from: string | number, to: string | number };
    } = {}
  ) {
    this.role = role;
    this.performerId = performerId;
    this.actionType = actionType;
    this.targetId = options.targetId;
    this.targetCardIndices = options.targetCardIndices;
    this.revealedRoles = options.revealedRoles;
    this.swappedCards = options.swappedCards;
  }

  /**
   * Add revealed roles information to the night action
   */
  public addRevealedRoles(roles: { [key: string]: Role }): void {
    this.revealedRoles = { ...this.revealedRoles, ...roles };
  }

  /**
   * Add card swap information to the night action
   */
  public addSwappedCards(from: string | number, to: string | number): void {
    this.swappedCards = { from, to };
  }

  /**
   * Creates a plain object representation of the night action
   */
  public toDTO(): NightAction {
    return {
      role: this.role,
      performerId: this.performerId,
      actionType: this.actionType,
      targetId: this.targetId,
      targetCardIndices: this.targetCardIndices,
      revealedRoles: this.revealedRoles,
      swappedCards: this.swappedCards
    };
  }
} 