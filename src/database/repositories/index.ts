/**
 * @fileoverview Repository module exports.
 * @module database/repositories
 *
 * @description
 * Central export point for all repository classes and interfaces.
 * Following the project's "program to interfaces" principle,
 * consumers should depend on the interfaces (IUserRepository, etc.)
 * rather than concrete implementations.
 */

// Interfaces (prefer using these for type declarations)
export {
  IUserRepository,
  ISessionRepository,
  IGameRepository,
  IReplayRepository,
  IStatisticsRepository,
  CreateUserParams,
  OAuthLinkParams,
  CreateSessionParams,
  SessionWithUser,
  CreateGameParams,
  AddPlayerParams,
  SaveNightActionParams,
  NightActionTarget,
  NightActionView,
  NightActionSwap,
  NightActionCopy,
  SaveStatementParams,
  SaveVoteParams,
  SaveGameResultParams
} from './interfaces';

// Concrete implementations
export { UserRepository } from './UserRepository';
export { SessionRepository } from './SessionRepository';
export { GameRepository } from './GameRepository';
export { ReplayRepository } from './ReplayRepository';
export { StatisticsRepository } from './StatisticsRepository';
