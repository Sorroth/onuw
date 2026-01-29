/**
 * @fileoverview PostgreSQL database service with connection pooling.
 * @module database/DatabaseService
 *
 * @description
 * Provides a centralized database connection pool and query execution
 * utilities for the ONUW application. Implements the Singleton pattern
 * to ensure a single connection pool across the application.
 *
 * @pattern Singleton Pattern - Single database instance
 * @pattern Repository Pattern - Data access abstraction
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

/**
 * Database configuration from environment variables.
 */
interface DatabaseConfig {
  connectionString: string;
  poolSize: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
}

/**
 * Transaction callback function type.
 */
type TransactionCallback<T> = (client: PoolClient) => Promise<T>;

/**
 * @summary Singleton database service for PostgreSQL.
 *
 * @description
 * Manages the connection pool and provides methods for:
 * - Executing queries with automatic connection management
 * - Running transactions with automatic rollback on error
 * - Health checks for monitoring
 * - Graceful shutdown
 *
 * @example
 * ```typescript
 * const db = DatabaseService.getInstance();
 * await db.connect();
 *
 * // Simple query
 * const users = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
 *
 * // Transaction
 * await db.transaction(async (client) => {
 *   await client.query('UPDATE users SET name = $1 WHERE id = $2', ['New Name', id]);
 *   await client.query('INSERT INTO audit_log (action) VALUES ($1)', ['name_changed']);
 * });
 *
 * // Graceful shutdown
 * await db.disconnect();
 * ```
 */
export class DatabaseService {
  private static instance: DatabaseService | null = null;
  private pool: Pool | null = null;
  private config: DatabaseConfig;
  private _isConnected: boolean = false;

  /**
   * @summary Gets whether the database is connected.
   *
   * @returns {boolean} True if connected
   */
  public isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Private constructor for Singleton pattern.
   */
  private constructor() {
    this.config = {
      connectionString: process.env.DATABASE_URL || 'postgresql://onuw:onuw_secret_password@localhost:5432/onuw',
      poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
      connectionTimeoutMs: 30000,
      idleTimeoutMs: 10000
    };
  }

  /**
   * @summary Gets the singleton instance.
   *
   * @returns {DatabaseService} The database service instance
   */
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * @summary Initializes the connection pool.
   *
   * @description
   * Creates a new PostgreSQL connection pool with the configured settings.
   * Should be called once during application startup.
   *
   * @throws {Error} If connection fails
   */
  public async connect(): Promise<void> {
    if (this._isConnected) {
      console.log('Database already connected');
      return;
    }

    try {
      this.pool = new Pool({
        connectionString: this.config.connectionString,
        max: this.config.poolSize,
        connectionTimeoutMillis: this.config.connectionTimeoutMs,
        idleTimeoutMillis: this.config.idleTimeoutMs
      });

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this._isConnected = true;
      console.log('Database connected successfully');

      // Handle pool errors
      this.pool.on('error', (err) => {
        console.error('Unexpected database pool error:', err);
      });
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * @summary Closes all pool connections.
   *
   * @description
   * Gracefully closes all connections in the pool.
   * Should be called during application shutdown.
   */
  public async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this._isConnected = false;
      console.log('Database disconnected');
    }
  }

  /**
   * @summary Executes a SQL query.
   *
   * @description
   * Acquires a connection from the pool, executes the query,
   * and releases the connection automatically.
   *
   * @param {string} text - SQL query text with $1, $2, etc. placeholders
   * @param {unknown[]} [params] - Query parameters
   *
   * @returns {Promise<QueryResult<T>>} Query result
   *
   * @throws {Error} If not connected or query fails
   *
   * @example
   * ```typescript
   * const result = await db.query<User>(
   *   'SELECT * FROM users WHERE email = $1',
   *   ['user@example.com']
   * );
   * const user = result.rows[0];
   * ```
   */
  public async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      // Log slow queries (> 100ms)
      if (duration > 100) {
        console.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
      }

      return result;
    } catch (error) {
      console.error('Query error:', { text: text.substring(0, 100), error });
      throw error;
    }
  }

  /**
   * @summary Executes a query and returns a single row.
   *
   * @param {string} text - SQL query text
   * @param {unknown[]} [params] - Query parameters
   *
   * @returns {Promise<T | null>} Single row or null if not found
   */
  public async queryOne<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] || null;
  }

  /**
   * @summary Executes a query and returns all rows.
   *
   * @param {string} text - SQL query text
   * @param {unknown[]} [params] - Query parameters
   *
   * @returns {Promise<T[]>} Array of rows
   */
  public async queryAll<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<T[]> {
    const result = await this.query<T>(text, params);
    return result.rows;
  }

  /**
   * @summary Executes multiple queries in a transaction.
   *
   * @description
   * Acquires a connection, begins a transaction, executes the callback,
   * and either commits on success or rolls back on error.
   *
   * @param {TransactionCallback<T>} callback - Function receiving the client
   *
   * @returns {Promise<T>} Result of the callback
   *
   * @throws {Error} If transaction fails (will be rolled back)
   *
   * @example
   * ```typescript
   * const result = await db.transaction(async (client) => {
   *   const user = await client.query('INSERT INTO users ... RETURNING *');
   *   await client.query('INSERT INTO profiles ...', [user.rows[0].id]);
   *   return user.rows[0];
   * });
   * ```
   */
  public async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * @summary Checks database connectivity.
   *
   * @returns {Promise<boolean>} True if connected and responsive
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.pool) {
        return false;
      }
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @summary Gets pool statistics.
   *
   * @returns {object} Pool statistics including total, idle, and waiting counts
   */
  public getPoolStats(): { total: number; idle: number; waiting: number } {
    if (!this.pool) {
      return { total: 0, idle: 0, waiting: 0 };
    }
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount
    };
  }

  /**
   * @summary Runs database migrations.
   *
   * @description
   * Executes SQL migration files in order. Tracks which migrations
   * have been run to avoid re-running them.
   *
   * @param {string[]} migrationFiles - Array of migration SQL strings
   */
  public async runMigrations(migrationFiles: string[]): Promise<void> {
    // Create migrations tracking table if it doesn't exist
    await this.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (let i = 0; i < migrationFiles.length; i++) {
      const migrationName = `migration_${String(i + 1).padStart(3, '0')}`;

      // Check if already executed
      const existing = await this.queryOne(
        'SELECT id FROM _migrations WHERE name = $1',
        [migrationName]
      );

      if (existing) {
        console.log(`Migration ${migrationName} already executed, skipping`);
        continue;
      }

      // Execute migration in a transaction
      await this.transaction(async (client) => {
        await client.query(migrationFiles[i]);
        await client.query(
          'INSERT INTO _migrations (name) VALUES ($1)',
          [migrationName]
        );
      });

      console.log(`Migration ${migrationName} executed successfully`);
    }
  }
}

// Export singleton instance getter for convenience
export const getDatabase = (): DatabaseService => DatabaseService.getInstance();
