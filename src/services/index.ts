/**
 * @fileoverview Services module exports.
 * @module services
 */

export {
  AuthService,
  getAuthService,
  RegisterParams,
  LoginParams,
  OAuthLoginParams,
  AuthResult
} from './AuthService';

export {
  OAuthService,
  getOAuthService,
  IOAuthService,
  OAuthProvider,
  OAuthProviderConfig,
  OAuthTokens,
  OAuthUserProfile
} from './OAuthService';
