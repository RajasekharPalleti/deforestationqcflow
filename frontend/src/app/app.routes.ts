import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';
import { tenantAuthGuard } from './core/guards/tenant-auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  {
    path: 'tenant-login',
    loadComponent: () => import('./pages/tenant-login/tenant-login').then((m) => m.TenantLogin),
  },
  {
    path: '',
    canActivate: [tenantAuthGuard],
    loadComponent: () => import('./shell/shell').then((m) => m.Shell),
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      {
        path: 'overview',
        canActivate: [roleGuard],
        loadComponent: () => import('./pages/overview/overview').then((m) => m.Overview),
      },
      {
        path: 'qa-review',
        canActivate: [roleGuard],
        loadComponent: () => import('./pages/qa-review/qa-review').then((m) => m.QaReview),
      },
      {
        path: 'ds-review',
        canActivate: [roleGuard],
        loadComponent: () => import('./pages/ds-review/ds-review').then((m) => m.DsReview),
      },
      {
        path: 'publish',
        canActivate: [roleGuard],
        loadComponent: () => import('./pages/publish/publish').then((m) => m.Publish),
      },
      {
        path: 'activity',
        canActivate: [roleGuard],
        loadComponent: () => import('./pages/activity/activity').then((m) => m.Activity),
      },
      {
        path: 'manage-users',
        canActivate: [roleGuard],
        loadComponent: () => import('./pages/manage-users/manage-users').then((m) => m.ManageUsers),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
