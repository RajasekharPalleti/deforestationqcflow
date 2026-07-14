import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

/**
 * Mirrors the nav filtering in sidebar.ts:
 * QA -> Overview + QA Review + Activity Log, DS -> Overview + DS Review + Publish + Activity Log,
 * PM/OTHER -> everything. Manage Users is PM-only.
 */
const ALLOWED_ROLES: Record<string, string[]> = {
  '/overview': ['PM', 'QA', 'DS', 'OTHER'],
  '/qa-review': ['PM', 'QA', 'OTHER'],
  '/ds-review': ['PM', 'DS', 'OTHER'],
  '/publish': ['PM', 'DS', 'OTHER'],
  '/activity': ['PM', 'QA', 'DS', 'OTHER'],
  '/manage-users': ['PM'],
};

export const roleGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.user();

  if (!user) return router.parseUrl('/login');

  const path = '/' + state.url.split('?')[0].split('/').filter(Boolean)[0];
  const allowed = ALLOWED_ROLES[path];
  if (allowed && !allowed.includes(user.role)) {
    return router.parseUrl('/overview');
  }
  return true;
};
