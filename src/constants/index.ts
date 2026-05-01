export const ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER'
} as const;

export const SYSTEM_ROLES = {
  ADMIN: 'ADMIN',
  USER: 'USER'
} as const;

export const TRANSLATION_STATUS = {
  DRAFT: 'DRAFT',
  AI_SUGGESTED: 'AI_SUGGESTED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
} as const;

export const REQUEST_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE'
} as const;

export const ENVIRONMENTS = {
  DEVELOPMENT: 'DEVELOPMENT',
  PRODUCTION: 'PRODUCTION',
  PROD: 'PROD'
} as const;

export const INVITATION_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED'
} as const;

export const API_KEY_PERMISSIONS = {
  READ_ONLY: 'READ_ONLY',
  ADMIN: 'ADMIN'
} as const;

export const API_KEY_STATUS = {
  EMPTY: 'EMPTY',
  RESTRICTED: 'RESTRICTED',
  ACTIVE: 'ACTIVE'
} as const;

export const DEFAULT_LANGUAGE = 'en';
export const DEFAULT_NAMESPACE = 'common';
