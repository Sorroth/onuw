/**
 * Interface for generating unique IDs
 */
export interface IdGenerator {
  /**
   * Generate a unique ID
   */
  generate(): string;
} 