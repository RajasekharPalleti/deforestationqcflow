import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { TenantAuthService } from '../services/tenant-auth';

/**
 * Gates the whole dashboard (Shell + its children): the department/name login
 * must have happened (auth.user()), and the tenant/SSO login must have
 * succeeded (tenantAuth.accessToken()) — otherwise redirect to the
 * appropriate login screen.
 */
export const tenantAuthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const tenantAuth = inject(TenantAuthService);
  const router = inject(Router);

  if (!auth.user()) return router.parseUrl('/login');
  if (!tenantAuth.accessToken()) return router.parseUrl('/tenant-login');
  return true;
};
