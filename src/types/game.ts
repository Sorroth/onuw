export type RoleType = 
    | 'DOPPELGANGER'
    | 'WEREWOLF'
    | 'MINION'
    | 'MASON'
    | 'SEER'
    | 'ROBBER'
    | 'TROUBLEMAKER'
    | 'DRUNK'
    | 'INSOMNIAC'
    | 'VILLAGER'
    | 'HUNTER'
    | 'TANNER';

export type GameState = 
    | 'WAITING'
    | 'NIGHT'
    | 'DISCUSSION'
    | 'VOTING'
    | 'COMPLETE';

export interface Player {
    id: string;
    name: string;
    role: RoleType;
    original: RoleType;
    ready: boolean;
    hasVoted: boolean;
    vote?: string;
}

export interface NightAction {
    role: RoleType;
    playerId: string;
    action: string;
    targets: string[];
    result?: {
        success: boolean;
        message: string;
        data?: any;
    };
}

export interface Game {
    id: string;
    players: Record<string, Player>;
    state: GameState;
    centerCards: RoleType[];
    currentAction: string;
    round: number;
    nightActions: NightAction[];
    votes: Record<string, string>;
}

export interface VoteState {
    hasVoted: boolean;
    votedFor: string | null;
}

export interface GameResults {
    killedPlayers: string[];
    winners: string[];
} 