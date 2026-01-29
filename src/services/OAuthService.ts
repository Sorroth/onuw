/**
 * @fileoverview OAuth provider service for Google, Discord, and GitHub.
 * @module services/OAuthService
 *
 * @description
 * Handles OAuth 2.0 flow for multiple providers:
 * - Generates authorization URLs
 * - Exchanges authorization codes for tokens
 * - Fetches user profile information
 *
 * @pattern Strategy Pattern - Provider-specific logic encapsulated in config objects
 * @pattern Singleton Pattern - Single instance via getOAuthService()
 * @pattern Adapter Pattern - Normalizes different provider responses to common format
 *
 * @principle Program to Interfaces - IOAuthService interface for dependency injection
 * @principle Single Responsibility - Only handles OAuth flow, not session management
 * @principle Open-Closed - Add new providers via PROVIDER_CONFIGS without modifying methods
 */

/**
 * OAuth provider configuration.
 */
export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  callbackPath: string;
}

/**
 * OAuth token response.
 */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType: string;
}

/**
 * Normalized user profile from OAuth provider.
 */
export interface OAuthUserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

/**
 * Supported OAuth providers.
 */
export type OAuthProvider = 'google' | 'discord' | 'github';

/**
 * OAuth service interface.
 *
 * @description
 * Defines the contract for OAuth authentication services.
 * Enables dependency injection and testability.
 *
 * @pattern Program to Interfaces - Depend on this abstraction, not OAuthService directly
 */
export interface IOAuthService {
  /** Checks if a provider has credentials configured */
  isProviderConfigured(provider: OAuthProvider): boolean;

  /** Gets list of all configured providers */
  getConfiguredProviders(): OAuthProvider[];

  /** Generates authorization URL for redirecting user to provider */
  getAuthorizationUrl(provider: OAuthProvider, state: string): string;

  /** Exchanges authorization code for access/refresh tokens */
  exchangeCode(provider: OAuthProvider, code: string): Promise<OAuthTokens>;

  /** Fetches and normalizes user profile from provider */
  getUserProfile(provider: OAuthProvider, accessToken: string): Promise<OAuthUserProfile>;
}

/**
 * Provider configurations.
 */
const PROVIDER_CONFIGS: Record<OAuthProvider, Omit<OAuthProviderConfig, 'clientId' | 'clientSecret'>> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['openid', 'email', 'profile'],
    callbackPath: '/api/auth/google/callback'
  },
  discord: {
    authorizeUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userInfoUrl: 'https://discord.com/api/users/@me',
    scopes: ['identify', 'email'],
    callbackPath: '/api/auth/discord/callback'
  },
  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email'],
    callbackPath: '/api/auth/github/callback'
  }
};

/**
 * @summary OAuth service for handling provider authentication.
 *
 * @description
 * Provides methods for OAuth 2.0 authorization code flow:
 * 1. Generate authorization URL (redirect user to provider)
 * 2. Exchange authorization code for tokens
 * 3. Fetch user profile from provider
 *
 * @pattern Strategy Pattern - Each provider has specific URL/scope configuration
 * @pattern Singleton Pattern - Use getOAuthService() for single instance
 * @pattern Adapter Pattern - normalizeProfile() adapts provider responses to common format
 *
 * @implements {IOAuthService}
 *
 * @example
 * ```typescript
 * // Use singleton (recommended)
 * const oauth = getOAuthService();
 *
 * // Step 1: Redirect user to provider
 * const authUrl = oauth.getAuthorizationUrl('google', 'random-state');
 * res.redirect(authUrl);
 *
 * // Step 2: Handle callback (after user approves)
 * const tokens = await oauth.exchangeCode('google', code);
 *
 * // Step 3: Get user info
 * const profile = await oauth.getUserProfile('google', tokens.accessToken);
 * ```
 */
export class OAuthService implements IOAuthService {
  private baseUrl: string;

  /**
   * Creates a new OAuthService.
   *
   * @param {string} [baseUrl] - Base URL for callbacks (e.g., 'http://localhost:8080')
   */
  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.BASE_URL || 'http://localhost:8080';
  }

  /**
   * @summary Checks if a provider is configured.
   *
   * @param {OAuthProvider} provider - Provider name
   * @returns {boolean} True if provider has credentials configured
   */
  isProviderConfigured(provider: OAuthProvider): boolean {
    const config = this.getProviderConfig(provider);
    return !!(config.clientId && config.clientSecret);
  }

  /**
   * @summary Gets list of configured providers.
   *
   * @returns {OAuthProvider[]} Array of configured provider names
   */
  getConfiguredProviders(): OAuthProvider[] {
    const providers: OAuthProvider[] = ['google', 'discord', 'github'];
    return providers.filter(p => this.isProviderConfigured(p));
  }

  /**
   * @summary Gets full provider configuration.
   *
   * @param {OAuthProvider} provider - Provider name
   * @returns {OAuthProviderConfig} Full configuration with credentials
   */
  private getProviderConfig(provider: OAuthProvider): OAuthProviderConfig {
    const baseConfig = PROVIDER_CONFIGS[provider];
    const envPrefix = provider.toUpperCase();

    return {
      ...baseConfig,
      clientId: process.env[`${envPrefix}_CLIENT_ID`] || '',
      clientSecret: process.env[`${envPrefix}_CLIENT_SECRET`] || ''
    };
  }

  /**
   * @summary Generates the authorization URL for a provider.
   *
   * @description
   * Creates the URL to redirect users to for OAuth authorization.
   * Includes client ID, redirect URI, scopes, and state parameter.
   *
   * @param {OAuthProvider} provider - Provider name
   * @param {string} state - Random state for CSRF protection
   * @returns {string} Authorization URL
   *
   * @throws {Error} If provider is not configured
   */
  getAuthorizationUrl(provider: OAuthProvider, state: string): string {
    const config = this.getProviderConfig(provider);

    if (!config.clientId) {
      throw new Error(`OAuth provider '${provider}' is not configured`);
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: `${this.baseUrl}${config.callbackPath}`,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state
    });

    // Provider-specific parameters
    if (provider === 'google') {
      params.set('access_type', 'offline');
      params.set('prompt', 'consent');
    }

    if (provider === 'discord') {
      params.set('prompt', 'consent');
    }

    return `${config.authorizeUrl}?${params.toString()}`;
  }

  /**
   * @summary Exchanges authorization code for tokens.
   *
   * @description
   * After user approves, the provider redirects back with a code.
   * This method exchanges that code for access/refresh tokens.
   *
   * @param {OAuthProvider} provider - Provider name
   * @param {string} code - Authorization code from callback
   * @returns {Promise<OAuthTokens>} Access and refresh tokens
   *
   * @throws {Error} If token exchange fails
   */
  async exchangeCode(provider: OAuthProvider, code: string): Promise<OAuthTokens> {
    const config = this.getProviderConfig(provider);

    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: `${this.baseUrl}${config.callbackPath}`,
      grant_type: 'authorization_code'
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // GitHub requires Accept header for JSON response
    if (provider === 'github') {
      headers['Accept'] = 'application/json';
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers,
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`OAuth token exchange failed for ${provider}:`, error);
      throw new Error(`Failed to exchange authorization code: ${response.status}`);
    }

    const data = await response.json() as Record<string, unknown>;

    return {
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string | undefined,
      expiresIn: data.expires_in as number | undefined,
      tokenType: (data.token_type as string) || 'Bearer'
    };
  }

  /**
   * @summary Fetches user profile from OAuth provider.
   *
   * @description
   * Uses the access token to fetch the user's profile information
   * from the provider's API. Normalizes the response to a common format.
   *
   * @param {OAuthProvider} provider - Provider name
   * @param {string} accessToken - Access token from token exchange
   * @returns {Promise<OAuthUserProfile>} Normalized user profile
   *
   * @throws {Error} If profile fetch fails
   */
  async getUserProfile(provider: OAuthProvider, accessToken: string): Promise<OAuthUserProfile> {
    const config = this.getProviderConfig(provider);

    const response = await fetch(config.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user profile: ${response.status}`);
    }

    const data = await response.json() as Record<string, unknown>;

    // Normalize provider-specific response to common format
    return this.normalizeProfile(provider, data, accessToken);
  }

  /**
   * @summary Normalizes provider-specific profile to common format.
   *
   * @param {OAuthProvider} provider - Provider name
   * @param {any} data - Raw profile data from provider
   * @param {string} accessToken - Access token (needed for GitHub email)
   * @returns {Promise<OAuthUserProfile>} Normalized profile
   *
   * @private
   */
  private async normalizeProfile(
    provider: OAuthProvider,
    data: Record<string, unknown>,
    accessToken: string
  ): Promise<OAuthUserProfile> {
    switch (provider) {
      case 'google':
        return {
          id: data.id as string,
          email: data.email as string,
          displayName: data.name as string || (data.email as string).split('@')[0],
          avatarUrl: data.picture as string
        };

      case 'discord':
        return {
          id: data.id as string,
          email: data.email as string,
          displayName: data.global_name as string || data.username as string,
          avatarUrl: data.avatar
            ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
            : undefined
        };

      case 'github': {
        // GitHub may not return email in profile, need separate API call
        let email = data.email as string;
        if (!email) {
          email = await this.fetchGitHubEmail(accessToken);
        }
        return {
          id: String(data.id),
          email,
          displayName: data.name as string || data.login as string,
          avatarUrl: data.avatar_url as string
        };
      }

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * @summary Fetches primary email from GitHub.
   *
   * @description
   * GitHub users can hide their email from the profile API.
   * This fetches the primary verified email from the emails endpoint.
   *
   * @param {string} accessToken - GitHub access token
   * @returns {Promise<string>} Primary email address
   *
   * @private
   */
  private async fetchGitHubEmail(accessToken: string): Promise<string> {
    const response = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch GitHub email');
    }

    const emails = await response.json() as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;

    // Find primary verified email
    const primary = emails.find(e => e.primary && e.verified);
    if (primary) {
      return primary.email;
    }

    // Fall back to any verified email
    const verified = emails.find(e => e.verified);
    if (verified) {
      return verified.email;
    }

    throw new Error('No verified email found on GitHub account');
  }

  /**
   * @summary Generates a random state string for CSRF protection.
   *
   * @returns {string} Random state string
   */
  static generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let oauthServiceInstance: IOAuthService | null = null;

/**
 * @summary Gets the singleton OAuthService instance.
 *
 * @description
 * Returns the single instance of OAuthService for the application.
 * Creates the instance on first call.
 *
 * @pattern Singleton Pattern - Ensures single instance across application
 *
 * @returns {IOAuthService} The OAuth service instance
 */
export function getOAuthService(): IOAuthService {
  if (!oauthServiceInstance) {
    oauthServiceInstance = new OAuthService();
  }
  return oauthServiceInstance;
}
