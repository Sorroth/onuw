import { v4 as uuidv4 } from 'uuid';
import { IdGenerator } from '../../core/application/ports/services/idGenerator';

/**
 * UUID implementation of the IdGenerator interface
 */
export class UuidGenerator implements IdGenerator {
  /**
   * Generate a unique ID using UUID v4
   */
  public generate(): string {
    return uuidv4();
  }
} 