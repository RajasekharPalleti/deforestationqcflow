import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { LiveProjectsService } from '../core/services/live-projects';
import { TenantAuthService } from '../core/services/tenant-auth';
import { Sidebar } from './sidebar/sidebar';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, Sidebar],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private tenantAuth = inject(TenantAuthService);
  private liveProjects = inject(LiveProjectsService);
  private router = inject(Router);

  logout(): void {
    this.tenantAuth.logout();
    this.liveProjects.reset();
    this.router.navigateByUrl('/tenant-login');
  }
}
