/**
 * RBAC Utility Functions
 *
 * Centralises repeated access-control patterns used across controllers.
 *
 * Design principles:
 * - These helpers return data; they never send HTTP responses.
 *   Callers remain responsible for their own error responses and messages.
 * - No behavior change vs. the inline code they replace — pure extraction.
 * - Single-instance safe; no external dependencies.
 *
 * Before/After behavior guarantee:
 *   resolveEffectiveMembership:
 *     BEFORE: inline in createTranslation and bulkUpload (identical 6-line block each)
 *     AFTER:  same DB queries, same owner comparison, same synthetic membership object
 *
 *   isPrivilegedRole:
 *     BEFORE: `membership.role !== ROLES.OWNER && membership.role !== ROLES.ADMIN` (negated)
 *     AFTER:  `!isPrivilegedRole(membership.role)` — mathematically identical
 */

import ProjectMember from '../models/ProjectMember.js';
import Project from '../models/Project.js';
import { ROLES } from '../constants/index.js';
import type { IProject } from '../models/Project.js';
import type { IProjectMember } from '../models/ProjectMember.js';

/**
 * A minimal membership shape that callers need after resolution.
 * Covers both full IProjectMember documents and the synthetic OWNER
 * stub produced when the requester is the project owner without an
 * explicit ProjectMember record.
 */
export interface EffectiveMembership {
  role: typeof ROLES[keyof typeof ROLES];
}

/**
 * Resolves the effective project membership for a user.
 *
 * If the user has no explicit ProjectMember record but IS the project owner
 * (determined by project.owner), a synthetic OWNER membership is returned.
 * This handles edge cases where the owner record may be missing (e.g. legacy data).
 *
 * @param projectId       - The project to look up (string or ObjectId-compatible)
 * @param userId          - The requesting user's _id
 * @param existingProject - Optional pre-fetched project document to avoid a second DB query
 *
 * @returns { membership, project }
 *   membership — null if the user has no access at all
 *   project    — the project document (fetched if not provided)
 */
export const resolveEffectiveMembership = async (
  projectId: string,
  userId: string,
  existingProject?: IProject | null
): Promise<{
  membership: (IProjectMember & EffectiveMembership) | EffectiveMembership | null;
  project: IProject | null;
}> => {
  let membership: (IProjectMember & EffectiveMembership) | EffectiveMembership | null =
    await ProjectMember.findOne({ projectId, userId });

  const project = existingProject !== undefined ? existingProject : (await Project.findById(projectId));

  // Owner-fallback: if no membership record exists but the user IS the project owner,
  // treat them as OWNER. This matches the inline behaviour in both createTranslation
  // and bulkUpload exactly.
  if (!membership && project?.owner?.toString() === userId.toString()) {
    membership = { role: ROLES.OWNER };
  }

  return { membership, project };
};

/**
 * Returns true if the given role has privileged (admin-level) access.
 *
 * Privileged roles: OWNER, ADMIN
 * Non-privileged roles: EDITOR, VIEWER
 *
 * This is the positive form of the repeated inline pattern:
 *   `membership.role !== ROLES.OWNER && membership.role !== ROLES.ADMIN`
 * which is equivalent to `!isPrivilegedRole(membership.role)`.
 */
export const isPrivilegedRole = (role: string): boolean =>
  role === ROLES.OWNER || role === ROLES.ADMIN;
