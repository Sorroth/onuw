/**
 * @fileoverview Database module exports.
 * @module database
 *
 * @description
 * Central export point for all database-related functionality including
 * the database service, repositories, and types.
 */

// Database Service
export { DatabaseService, getDatabase } from './DatabaseService';

// Write Queue
export {
  DatabaseWriteQueue,
  getWriteQueue,
  WriteCommand,
  RetryStrategy,
  QueueStats
} from './DatabaseWriteQueue';

// Repositories
export {
  UserRepository,
  SessionRepository,
  GameRepository,
  ReplayRepository,
  StatisticsRepository,
  CreateUserParams,
  OAuthLinkParams,
  CreateSessionParams,
  SessionWithUser,
  CreateGameParams,
  AddPlayerParams,
  SaveNightActionParams,
  SaveStatementParams,
  SaveVoteParams,
  SaveGameResultParams
} from './repositories';

// Types
export * from './types';
