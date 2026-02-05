/**
 * @fileoverview Game action utility functions.
 * @module lib/gameActionUtils
 *
 * @description
 * Shared utilities for night action context and request handling.
 * Extracts common logic from GameSidebar for reusability.
 *
 * @pattern Utility Pattern - Shared stateless helper functions
 * @pattern Single Responsibility - Each function has one purpose
 */

import { ActionRequest, RoleName, ROLE_METADATA, NightActionResult } from '@/types/game';

/**
 * Get reason from action request if available.
 *
 * @description
 * Extracts the reason string from action requests that support it.
 * Only selectPlayer, selectCenter, and selectTwoPlayers have reason fields.
 *
 * @param request - The action request to extract reason from
 * @returns The reason string if available, undefined otherwise
 */
export function getRequestReason(request: ActionRequest): string | undefined {
  if (request.actionType === 'selectPlayer' ||
      request.actionType === 'selectCenter' ||
      request.actionType === 'selectTwoPlayers') {
    return request.reason;
  }
  return undefined;
}

/**
 * Get contextual action description for night actions.
 *
 * @description
 * Determines the appropriate title and description to show for the current
 * night action. Handles special cases like Doppelganger multi-step actions.
 *
 * @param request - The pending action request, or null if none
 * @param startingRole - The player's starting role
 * @param nightInfo - Array of night action results for context
 * @returns Object with title and description, or null if no context needed
 *
 * @example
 * ```tsx
 * const context = getActionContext(pendingRequest, RoleName.DOPPELGANGER, nightInfo);
 * if (context) {
 *   return <div>{context.title}: {context.description}</div>;
 * }
 * ```
 */
export function getActionContext(
  request: ActionRequest | null,
  startingRole: RoleName,
  nightInfo: readonly NightActionResult[]
): { title: string; description: string } | null {
  if (!request) return null;

  // Check if this is a Doppelganger follow-up action
  // Use the LAST matching result (backend sends partial first, then complete with all info)
  const isDoppelganger = startingRole === RoleName.DOPPELGANGER;
  const doppelResults = nightInfo.filter(result => result.roleName === RoleName.DOPPELGANGER && result.info.copied);
  const copyResult = doppelResults.length > 0 ? doppelResults[doppelResults.length - 1] : null;
  const copiedRole = copyResult?.info.copied?.role;

  // For Doppelganger with a copied role doing follow-up action
  if (isDoppelganger && copiedRole && request.actionType !== 'selectPlayer') {
    const copiedMeta = ROLE_METADATA[copiedRole];
    const reason = getRequestReason(request);
    return {
      title: `As ${copiedMeta.displayName}`,
      description: reason || copiedMeta.nightActionDescription || 'Perform your copied role\'s action'
    };
  }

  // For Doppelganger's initial selection
  if (isDoppelganger && request.actionType === 'selectPlayer' && !copiedRole) {
    return {
      title: 'Choose Target',
      description: 'Select a player to copy their role'
    };
  }

  // Use the request's reason if available
  const reason = getRequestReason(request);
  if (reason) {
    return {
      title: 'Current Action',
      description: reason
    };
  }

  return null;
}
