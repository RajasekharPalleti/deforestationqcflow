import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

/**
 * Mirrors the nav filtering in app.py render_sidebar():
 * QA -> Overview + QA Review only, DS -> Overview + DS Review only,
 * PM/OTHER -> everything. Publish and Manage Users are PM-only.
 */
const ALLOWED_ROLES: Record<string, string[]> = {
  '/overview': ['PM', 'QA', 'DS', 'OTHER'],
  '/qa-review': ['PM', 'QA', 'OTHER'],
  '/ds-review': ['PM', 'DS', 'OTHER'],
  '/publish': ['PM', 'OTHER'],
  '/activity': ['PM', 'OTHER'],
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
