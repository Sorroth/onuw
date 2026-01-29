/**
 * @fileoverview REST API handler for authentication and data access.
 * @module server/ApiHandler
 *
 * @description
 * Provides HTTP REST endpoints for operations that don't fit the
 * real-time WebSocket model: authentication flows, data queries,
 * statistics, and game replay retrieval.
 *
 * @pattern Facade Pattern - Simplifies access to complex subsystems
 * @pattern Repository Pattern - Uses repository interfaces for data access
 * @pattern Dependency Inversion - Depends on abstractions, not concretions
 */

import { IncomingMessage, ServerResponse } from 'http';
import { AuthService, getAuthService, IOAuthService, OAuthService, getOAuthService, OAuthProvider } from '../services';
import {
  IUserRepository,
  IStatisticsRepository,
  IReplayRepository,
  IGameRepository,
  UserRepository,
  StatisticsRepository,
  ReplayRepository,
  GameRepository
} from '../database/repositories';
import { verifyToken } from '../utils/password';

// =============================================================================
// TYPES
// =============================================================================

/**
 * @summary Parsed request body.
 */
interface RequestBody {
  [key: string]: unknown;
}

/**
 * @summary API response structure.
 */
interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// =============================================================================
// API HANDLER CLASS
// =============================================================================

/**
 * @summary REST API handler for ONUW.
 *
 * @description
 * Handles HTTP requests for authentication and data retrieval.
 * All game logic remains in WebSocket handlers; this provides
 * REST endpoints for:
 * - User authentication (register, login, logout)
 * - Player statistics
 * - Game replay data
 * - Leaderboards
 *
 * @pattern Facade Pattern - Single entry point for REST API
 * @pattern Dependency Inversion - Constructor accepts interfaces
 */
export class ApiHandler {
  private readonly authService: AuthService;
  private readonly oauthService: IOAuthService;
  private readonly userRepo: IUserRepository;
  private readonly statsRepo: IStatisticsRepository;
  private readonly replayRepo: IReplayRepository;
  private readonly gameRepo: IGameRepository;

  /** OAuth state storage for CSRF protection (state -> { provider, expiresAt }) */
  private readonly oauthStates: Map<string, { provider: OAuthProvider; expiresAt: number }> = new Map();

  /**
   * @summary Creates a new ApiHandler.
   *
   * @description
   * Initializes with repository interfaces for testability.
   * Uses default implementations if none provided.
   *
   * @param {object} [deps] - Optional dependency injection
   * @param {AuthService} [deps.authService] - Auth service instance
   * @param {IOAuthService} [deps.oauthService] - OAuth service instance
   * @param {IUserRepository} [deps.userRepo] - User repository
   * @param {IStatisticsRepository} [deps.statsRepo] - Statistics repository
   * @param {IReplayRepository} [deps.replayRepo] - Replay repository
   * @param {IGameRepository} [deps.gameRepo] - Game repository
   *
   * @pattern Dependency Injection - Accepts dependencies via constructor
   */
  constructor(deps?: {
    authService?: AuthService;
    oauthService?: IOAuthService;
    userRepo?: IUserRepository;
    statsRepo?: IStatisticsRepository;
    replayRepo?: IReplayRepository;
    gameRepo?: IGameRepository;
  }) {
    this.authService = deps?.authService ?? getAuthService();
    this.oauthService = deps?.oauthService ?? getOAuthService();
    this.userRepo = deps?.userRepo ?? new UserRepository();
    this.statsRepo = deps?.statsRepo ?? new StatisticsRepository();
    this.replayRepo = deps?.replayRepo ?? new ReplayRepository();
    this.gameRepo = deps?.gameRepo ?? new GameRepository();

    // Clean up expired OAuth states periodically (every 5 minutes)
    setInterval(() => this.cleanupOAuthStates(), 5 * 60 * 1000);
  }

  // ===========================================================================
  // MAIN REQUEST HANDLER
  // ===========================================================================

  /**
   * @summary Handles incoming HTTP request.
   *
   * @description
   * Routes requests to appropriate handlers based on path and method.
   * Returns true if the request was handled, false if it should be
   * passed to WebSocket upgrade.
   *
   * @param {IncomingMessage} req - HTTP request
   * @param {ServerResponse} res - HTTP response
   * @returns {Promise<boolean>} True if handled, false to pass through
   */
  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;
    const method = req.method || 'GET';

    // Only handle /api/* routes
    if (!path.startsWith('/api/')) {
      return false;
    }

    // Set CORS headers
    this.setCorsHeaders(res);

    // Handle preflight
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    try {
      await this.routeRequest(path, method, url, req, res);
    } catch (error) {
      console.error('API error:', error);
      this.sendJson(res, 500, { success: false, error: 'Internal server error' });
    }

    return true;
  }

  // ===========================================================================
  // ROUTING
  // ===========================================================================

  /**
   * @summary Routes request to appropriate handler.
   *
   * @param {string} path - Request path
   * @param {string} method - HTTP method
   * @param {URL} url - Parsed URL
   * @param {IncomingMessage} req - HTTP request
   * @param {ServerResponse} res - HTTP response
   *
   * @private
   */
  private async routeRequest(
    path: string,
    method: string,
    url: URL,
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    // Authentication routes
    if (path === '/api/auth/register' && method === 'POST') {
      await this.handleRegister(req, res);
      return;
    }

    if (path === '/api/auth/login' && method === 'POST') {
      await this.handleLogin(req, res);
      return;
    }

    if (path === '/api/auth/logout' && method === 'POST') {
      await this.handleLogout(req, res);
      return;
    }

    if (path === '/api/auth/me' && method === 'GET') {
      await this.handleGetMe(req, res);
      return;
    }

    // OAuth providers list
    if (path === '/api/auth/providers' && method === 'GET') {
      await this.handleGetOAuthProviders(res);
      return;
    }

    // OAuth initiation routes (GET /api/auth/{provider})
    const oauthInitMatch = path.match(/^\/api\/auth\/(google|discord|github)$/);
    if (oauthInitMatch && method === 'GET') {
      await this.handleOAuthInitiate(oauthInitMatch[1] as OAuthProvider, url, res);
      return;
    }

    // OAuth callback routes (GET /api/auth/{provider}/callback)
    const oauthCallbackMatch = path.match(/^\/api\/auth\/(google|discord|github)\/callback$/);
    if (oauthCallbackMatch && method === 'GET') {
      await this.handleOAuthCallback(oauthCallbackMatch[1] as OAuthProvider, url, res);
      return;
    }

    // Link OAuth to existing account (POST /api/auth/link/{provider})
    const oauthLinkMatch = path.match(/^\/api\/auth\/link\/(google|discord|github)$/);
    if (oauthLinkMatch && method === 'GET') {
      await this.handleOAuthLink(oauthLinkMatch[1] as OAuthProvider, url, req, res);
      return;
    }

    // User statistics route
    const userStatsMatch = path.match(/^\/api\/users\/([^/]+)\/stats$/);
    if (userStatsMatch && method === 'GET') {
      await this.handleGetUserStats(userStatsMatch[1], res);
      return;
    }

    // User games route
    const userGamesMatch = path.match(/^\/api\/users\/([^/]+)\/games$/);
    if (userGamesMatch && method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '10', 10);
      await this.handleGetUserGames(userGamesMatch[1], limit, res);
      return;
    }

    // Game details route
    const gameDetailsMatch = path.match(/^\/api\/games\/([^/]+)$/);
    if (gameDetailsMatch && method === 'GET') {
      await this.handleGetGame(gameDetailsMatch[1], res);
      return;
    }

    // Game replay route
    const gameReplayMatch = path.match(/^\/api\/games\/([^/]+)\/replay$/);
    if (gameReplayMatch && method === 'GET') {
      await this.handleGetGameReplay(gameReplayMatch[1], res);
      return;
    }

    // Leaderboard route
    if (path === '/api/leaderboard' && method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '100', 10);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      await this.handleGetLeaderboard(limit, offset, res);
      return;
    }

    // Global stats route
    if (path === '/api/stats' && method === 'GET') {
      await this.handleGetGlobalStats(res);
      return;
    }

    // Not found
    this.sendJson(res, 404, { success: false, error: 'Endpoint not found' });
  }

  // ===========================================================================
  // AUTHENTICATION HANDLERS
  // ===========================================================================

  /**
   * @summary Handles user registration.
   *
   * @description
   * Creates a new user account with email/password authentication.
   * Returns a session token on success.
   *
   * @param {IncomingMessage} req - HTTP request with email, password, displayName
   * @param {ServerResponse} res - HTTP response
   *
   * @private
   */
  private async handleRegister(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.parseBody(req);

    const email = body.email as string;
    const password = body.password as string;
    const displayName = body.displayName as string;

    if (!email || !password || !displayName) {
      this.sendJson(res, 400, {
        success: false,
        error: 'Missing required fields: email, password, displayName'
      });
      return;
    }

    try {
      const result = await this.authService.register({ email, password, displayName });
      this.sendJson(res, 201, {
        success: true,
        data: {
          token: result.token,
          user: {
            userId: result.user.userId,
            email: result.user.email,
            displayName: result.user.displayName
          }
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      this.sendJson(res, 400, { success: false, error: message });
    }
  }

  /**
   * @summary Handles user login.
   *
   * @description
   * Authenticates user with email/password and returns session token.
   *
   * @param {IncomingMessage} req - HTTP request with email, password
   * @param {ServerResponse} res - HTTP response
   *
   * @private
   */
  private async handleLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.parseBody(req);

    const email = body.email as string;
    const password = body.password as string;

    if (!email || !password) {
      this.sendJson(res, 400, {
        success: false,
        error: 'Missing required fields: email, password'
      });
      return;
    }

    try {
      const result = await this.authService.login({ email, password });
      this.sendJson(res, 200, {
        success: true,
        data: {
          token: result.token,
          user: {
            userId: result.user.userId,
            email: result.user.email,
            displayName: result.user.displayName
          }
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      this.sendJson(res, 401, { success: false, error: message });
    }
  }

  /**
   * @summary Handles user logout.
   *
   * @description
   * Invalidates the current session token.
   *
   * @param {IncomingMessage} req - HTTP request with Authorization header
   * @param {ServerResponse} res - HTTP response
   *
   * @private
   */
  private async handleLogout(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const token = this.extractToken(req);

    if (!token) {
      this.sendJson(res, 401, { success: false, error: 'No token provided' });
      return;
    }

    try {
      const payload = verifyToken(token);
      if (payload) {
        await this.authService.logout(payload.sessionId);
      }
      this.sendJson(res, 200, { success: true });
    } catch (error) {
      // Even if logout fails, return success (token may already be invalid)
      this.sendJson(res, 200, { success: true });
    }
  }

  /**
   * @summary Gets current authenticated user.
   *
   * @description
   * Returns user info for the authenticated session.
   *
   * @param {IncomingMessage} req - HTTP request with Authorization header
   * @param {ServerResponse} res - HTTP response
   *
   * @private
   */
  private async handleGetMe(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const token = this.extractToken(req);

    if (!token) {
      this.sendJson(res, 401, { success: false, error: 'No token provided' });
      return;
    }

    try {
      const user = await this.authService.validateToken(token);
      if (!user) {
        this.sendJson(res, 401, { success: false, error: 'Invalid or expired token' });
        return;
      }

      this.sendJson(res, 200, {
        success: true,
        data: {
          userId: user.userId,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl
        }
      });
    } catch (error) {
      this.sendJson(res, 401, { success: false, error: 'Invalid token' });
    }
  }

  // ===========================================================================
  // OAUTH HANDLERS
  // ===========================================================================

  /**
   * @summary Gets list of configured OAuth providers.
   *
   * @description
   * Returns which OAuth providers are available for login.
   *
   * @param {ServerResponse} res - HTTP response
   *
   * @private
   */
  private async handleGetOAuthProviders(res: ServerResponse): Promise<void> {
    const providers = this.oauthService.getConfiguredProviders();
    this.sendJson(res, 200, {
      success: true,
      data: {
        providers,
        endpoints: providers.map(p => ({
          provider: p,
          loginUrl: `/api/auth/${p}`,
          linkUrl: `/api/auth/link/${p}`
        }))
      }
    });
  }

  /**
   * @summary Initiates OAuth flow by redirecting to provider.
   *
   * @description
   * Generates a state parameter for CSRF protection and redirects
   * the user to the OAuth provider's authorization page.
   *
   * @param {OAuthProvider} provider - OAuth provider name
   * @param {URL} url - Request URL (for redirect_uri param)
   * @param {ServerResponse} res - HTTP response
   *
   * @private
   */
  private async handleOAuthInitiate(
    provider: OAuthProvider,
    url: URL,
    res: ServerResponse
  ): Promise<void> {
    // Check if provider is configured
    if (!this.oauthService.isProviderConfigured(provider)) {
      this.sendJson(res, 400, {
        success: false,
        error: `OAuth provider '${provider}' is not configured`
      });
      return;
    }

    // Generate state for CSRF protection
    const state = OAuthService.generateState();

    // Store state with expiration (10 minutes)
    this.oauthStates.set(state, {
      provider,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    // Get authorization URL
    const authUrl = this.oauthService.getAuthorizationUrl(provider, state);

    // Check if client wants JSON response instead of redirect
    const returnJson = url.searchParams.get('json') === 'true';
    if (returnJson) {
      this.sendJson(res, 200, {
        success: true,
        data: { authUrl, state }
      });
      return;
    }

    // Redirect to provider
    res.writeHead(302, { Location: authUrl });
    res.end();
  }

  /**
   * @summary Handles OAuth callback from provider.
   *
   * @description
   * Validates the state parameter, exchanges the authorization code
   * for tokens, fetches user profile, and creates/links the account.
   *
   * @param {OAuthProvider} provider - OAuth provider name
   * @param {URL} url - Request URL with code and state params
   * @param {ServerResponse} res - HTTP response
   *
   * @private
   */
  private async handleOAuthCallback(
    provider: OAuthProvider,
    url: URL,
    res: ServerResponse
  ): Promise<void> {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Check for OAuth error
    if (error) {
      this.sendOAuthError(res, `OAuth error: ${error}`);
      return;
    }

    // Validate required parameters
    if (!code || !state) {
      this.sendOAuthError(res, 'Missing code or state parameter');
      return;
    }

    // Validate state (CSRF protection)
    const storedState = this.oauthStates.get(state);
    if (!storedState) {
      this.sendOAuthError(res, 'Invalid or expired state parameter');
      return;
    }

    if (storedState.provider !== provider) {
      this.sendOAuthError(res, 'State provider mismatch');
      return;
    }

    if (storedState.expiresAt < Date.now()) {
      this.oauthStates.delete(state);
      this.sendOAuthError(res, 'State expired');
      return;
    }

    // Clean up used state
    this.oauthStates.delete(state);

    try {
      // Exchange code for tokens
      const tokens = await this.oauthService.exchangeCode(provider, code);

      // Get user profile
      const profile = await this.oauthService.getUserProfile(provider, tokens.accessToken);

      // Calculate token expiration
      const tokenExpiresAt = tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : undefined;

      // Login or create account
      const result = await this.authService.oauthLogin({
        providerCode: provider,
        externalId: profile.id,
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt
      });

      // Send success response with token
      // In production, you'd redirect to your frontend with the token
      this.sendOAuthSuccess(res, result.token, result.user.displayName);
    } catch (err) {
      console.error(`OAuth callback error for ${provider}:`, err);
      const message = err instanceof Error ? err.message : 'OAuth authentication failed';
      this.sendOAuthError(res, message);
    }
  }

  /**
   * @summary Links OAuth provider to existing authenticated account.
   *
   * @description
   * Allows users who logged in with email/password to link their
   * account to an OAuth provider for future logins.
   *
   * @param {OAuthProvider} provider - OAuth provider name
   * @param {URL} url - Request URL
   * @param {IncomingMessage} req - HTTP request (for auth token)
   * @param {ServerResponse} res - HTTP response
   *
   * @private
   */
  private async handleOAuthLink(
    provider: OAuthProvider,
    url: URL,
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    // Check if provider is configured
    if (!this.oauthService.isProviderConfigured(provider)) {
      this.sendJson(res, 400, {
        success: false,
        error: `OAuth provider '${provider}' is not configured`
      });
      return;
    }

    // Verify user is authenticated
    const token = this.extractToken(req);
    if (!token) {
      this.sendJson(res, 401, {
        success: false,
        error: 'Authentication required to link OAuth account'
      });
      return;
    }

    const user = await this.authService.validateToken(token);
    if (!user) {
      this.sendJson(res, 401, { success: false, error: 'Invalid or expired token' });
      return;
    }

    // Generate state that includes user ID for linking
    const state = OAuthService.generateState();

    // Store state with user ID for linking
    this.oauthStates.set(state, {
      provider,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    // Get authorization URL
    const authUrl = this.oauthService.getAuthorizationUrl(provider, state);

    // Check if client wants JSON response
    const returnJson = url.searchParams.get('json') === 'true';
    if (returnJson) {
      this.sendJson(res, 200, {
        success: true,
        data: { authUrl, state }
      });
      return;
    }

    // Redirect to provider
    res.writeHead(302, { Location: authUrl });
    res.end();
  }

  /**
   * @summary Sends OAuth success response.
   *
   * @description
   * Returns an HTML page that can pass the token to the parent window
   * or redirect to the frontend application.
   *
   * @param {ServerResponse} res - HTTP response
   * @param {string} token - JWT token
   * @param {string} displayName - User's display name
   *
   * @private
   */
  private sendOAuthSuccess(res: ServerResponse, token: string, displayName: string): void {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Login Successful</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #eee; }
    .container { text-align: center; padding: 2rem; background: #16213e; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
    h1 { color: #4ecca3; margin-bottom: 1rem; }
    p { margin-bottom: 1rem; }
    .token { font-family: monospace; background: #0f0f23; padding: 1rem; border-radius: 4px; word-break: break-all; font-size: 0.75rem; max-width: 400px; }
    button { background: #4ecca3; color: #1a1a2e; border: none; padding: 0.75rem 1.5rem; border-radius: 4px; cursor: pointer; font-size: 1rem; margin-top: 1rem; }
    button:hover { background: #3db892; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome, ${displayName}!</h1>
    <p>You have successfully logged in.</p>
    <p>Your authentication token:</p>
    <div class="token">${token}</div>
    <button onclick="copyToken()">Copy Token</button>
    <p style="margin-top: 1rem; font-size: 0.875rem; color: #888;">
      Use this token in the Authorization header:<br>
      <code>Authorization: Bearer &lt;token&gt;</code>
    </p>
  </div>
  <script>
    function copyToken() {
      navigator.clipboard.writeText('${token}');
      alert('Token copied to clipboard!');
    }
    // If opened in popup, send token to parent
    if (window.opener) {
      window.opener.postMessage({ type: 'oauth_success', token: '${token}' }, '*');
    }
  </script>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  /**
   * @summary Sends OAuth error response.
   *
   * @param {ServerResponse} res - HTTP response
   * @param {string} error - Error message
   *
   * @private
   */
  private sendOAuthError(res: ServerResponse, error: string): void {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Login Failed</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #eee; }
    .container { text-align: center; padding: 2rem; background: #16213e; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
    h1 { color: #e74c3c; margin-bottom: 1rem; }
    p { margin-bottom: 1rem; }
    .error { background: #2c1810; padding: 1rem; border-radius: 4px; color: #e74c3c; }
    a { color: #4ecca3; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Login Failed</h1>
    <div class="error">${error}</div>
    <p style="margin-top: 1rem;"><a href="/">Return to Home</a></p>
  </div>
  <script>
    // If opened in popup, send error to parent
    if (window.opener) {
      window.opener.postMessage({ type: 'oauth_error', error: '${error}' }, '*');
    }
  </script>
</body>
</html>`;

    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  /**
   * @summary Cleans up expired OAuth states.
   *
   * @private
   */
  private cleanupOAuthStates(): void {
    const now = Date.now();
    for (const [state, data] of this.oauthStates.entries()) {
      if (data.expiresAt < now) {
        this.oauthStates.delete(state);
      }
    }
  }

  // ===========================================================================
  // USER DATA HANDLERS
  // ===========================================================================

  /**
   * @summary Gets player statistics.
   *
   * @description
   * Returns comprehensive statistics for a player including
   * win rates by role and team.
   *
   * @param {string} userId - User ID
   * @param {ServerResponse} res - HTTP response
   *
   * @private
   */
  private async handleGetUserStats(userId: string, res: ServerResponse): Promise<void> {
    try {
      const stats = await this.statsRepo.getPlayerStats(userId);

      if (!stats) {
        this.sendJson(res, 404, { success: false, error: 'Player not found' });
        return;
      }

      this.sendJson(res, 200, { success: true, data: stats });
    } catch (error) {
      console.error('Error getting user stats:', error);
      this.sendJson(res, 500, { success: false, error: 'Failed to get statistics' });
    }
  }

  /**
   * @summary Gets player's recent games.
   *
   * @description
   * Returns a list of recent games for the player.
   *
   * @param {string} userId - User ID
   * @param {number} limit - Maximum games to return
   * @param {ServerResponse} res - HTTP response
   *
   * @private
   */
  private async handleGetUserGames(
    userId: string,
    limit: number,
    res: ServerResponse
  ): Promise<void> {
    try {
      const games = await this.gameRepo.getRecentGames(userId, limit);
      this.sendJson(res, 200, {
        success: true,
        data: {
          userId,
          games
        }
      });
    } catch (error) {
      console.error('Error getting user games:', error);
      this.sendJson(res, 500, { success: false, error: 'Failed to get games' });
    }
  }

  // ===========================================================================
  // GAME DATA HANDLERS
  // ===========================================================================

  /**
   * @summary Gets game details.
   *
   * @description
   * Returns metadata about a game.
   *
   * @param {string} gameId - Game ID
   * @param {ServerResponse} res - HTTP response
   *
   * @private
   */
  private async handleGetGame(gameId: string, res: ServerResponse): Promise<void> {
    try {
      const game = await this.gameRepo.findById(gameId);

      if (!game) {
        this.sendJson(res, 404, { success: false, error: 'Game not found' });
        return;
      }

      this.sendJson(res, 200, {
        success: true,
        data: {
          gameId: game.game_id,
          roomCode: game.room_code,
          status: game.status,
          createdAt: game.created_at,
          startedAt: game.started_at,
          endedAt: game.ended_at
        }
      });
    } catch (error) {
      console.error('Error getting game:', error);
      this.sendJson(res, 500, { success: false, error: 'Failed to get game' });
    }
  }

  /**
   * @summary Gets full game replay.
   *
   * @description
   * Returns complete game history including all night actions,
   * statements, and votes for replay functionality.
   * Data is stored in 6NF-compliant tables and reconstructed here.
   *
   * @param {string} gameId - Game ID
   * @param {ServerResponse} res - HTTP response
   *
   * @pattern 6NF Compliance - Reconstructs data from normalized tables
   *
   * @private
   */
  private async handleGetGameReplay(gameId: string, res: ServerResponse): Promise<void> {
    try {
      const replay = await this.replayRepo.getFullReplay(gameId);

      this.sendJson(res, 200, {
        success: true,
        data: {
          gameId,
          replay
        }
      });
    } catch (error) {
      console.error('Error getting game replay:', error);
      this.sendJson(res, 500, { success: false, error: 'Failed to get replay' });
    }
  }

  // ===========================================================================
  // LEADERBOARD HANDLERS
  // ===========================================================================

  /**
   * @summary Gets leaderboard.
   *
   * @description
   * Returns top players sorted by wins with pagination support.
   *
   * @param {number} limit - Maximum entries to return
   * @param {number} offset - Number of entries to skip
   * @param {ServerResponse} res - HTTP response
   *
   * @private
   */
  private async handleGetLeaderboard(
    limit: number,
    offset: number,
    res: ServerResponse
  ): Promise<void> {
    try {
      // Clamp limit to reasonable bounds
      const clampedLimit = Math.min(Math.max(limit, 1), 100);
      const clampedOffset = Math.max(offset, 0);

      const entries = await this.statsRepo.getLeaderboard(clampedLimit, clampedOffset);

      this.sendJson(res, 200, {
        success: true,
        data: {
          entries,
          pagination: {
            limit: clampedLimit,
            offset: clampedOffset
          }
        }
      });
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      this.sendJson(res, 500, { success: false, error: 'Failed to get leaderboard' });
    }
  }

  /**
   * @summary Gets global statistics.
   *
   * @description
   * Returns aggregate statistics across all games.
   *
   * @param {ServerResponse} res - HTTP response
   *
   * @private
   */
  private async handleGetGlobalStats(res: ServerResponse): Promise<void> {
    try {
      const stats = await this.statsRepo.getGlobalStats();

      this.sendJson(res, 200, { success: true, data: stats });
    } catch (error) {
      console.error('Error getting global stats:', error);
      this.sendJson(res, 500, { success: false, error: 'Failed to get statistics' });
    }
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * @summary Sets CORS headers.
   *
   * @param {ServerResponse} res - HTTP response
   *
   * @private
   */
  private setCorsHeaders(res: ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  /**
   * @summary Sends JSON response.
   *
   * @param {ServerResponse} res - HTTP response
   * @param {number} status - HTTP status code
   * @param {ApiResponse} data - Response data
   *
   * @private
   */
  private sendJson(res: ServerResponse, status: number, data: ApiResponse): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  /**
   * @summary Parses request body as JSON.
   *
   * @param {IncomingMessage} req - HTTP request
   * @returns {Promise<RequestBody>} Parsed body
   *
   * @private
   */
  private parseBody(req: IncomingMessage): Promise<RequestBody> {
    return new Promise((resolve, reject) => {
      let body = '';

      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
        // Limit body size to 1MB
        if (body.length > 1024 * 1024) {
          reject(new Error('Request body too large'));
        }
      });

      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          reject(new Error('Invalid JSON'));
        }
      });

      req.on('error', reject);
    });
  }

  /**
   * @summary Extracts Bearer token from Authorization header.
   *
   * @param {IncomingMessage} req - HTTP request
   * @returns {string | null} Token or null
   *
   * @private
   */
  private extractToken(req: IncomingMessage): string | null {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return null;
    }
    return auth.slice(7);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let apiHandlerInstance: ApiHandler | null = null;

/**
 * @summary Gets the singleton ApiHandler instance.
 *
 * @returns {ApiHandler} The API handler instance
 */
export function getApiHandler(): ApiHandler {
  if (!apiHandlerInstance) {
    apiHandlerInstance = new ApiHandler();
  }
  return apiHandlerInstance;
}
