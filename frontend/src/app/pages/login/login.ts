import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { ConfigService } from '../../core/services/config';
import { LiveProjectsService } from '../../core/services/live-projects';
import { TenantAuthService } from '../../core/services/tenant-auth';
import { WorkspaceService } from '../../core/services/workspace';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit {
  private configService = inject(ConfigService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private tenantAuth = inject(TenantAuthService);
  private workspace = inject(WorkspaceService);
  private liveProjects = inject(LiveProjectsService);

  departments = signal<string[]>([]);
  teamMembers = signal<Record<string, string[]>>({});

  department = signal('');
  name = signal('');

  namesForDepartment = computed(() => this.teamMembers()[this.department()] ?? []);
  submitting = signal(false);
  error = signal('');

  async ngOnInit(): Promise<void> {
    const [config, teamMembers] = await Promise.all([
      this.configService.getConfig(),
      this.configService.getTeamMembers(),
    ]);
    const depts = Object.keys(config.departments);
    this.departments.set(depts);
    this.teamMembers.set(teamMembers);
    this.department.set(depts[0]);
    this.name.set(teamMembers[depts[0]]?.[0] ?? '');
  }

  onDepartmentChange(dept: string): void {
    this.department.set(dept);
    this.name.set(this.teamMembers()[dept]?.[0] ?? '');
  }

  async continue(): Promise<void> {
    this.submitting.set(true);
    this.error.set('');
    try {
      const previousDepartment = this.auth.lastDepartment();
      await this.auth.login(this.department(), this.name());

      // Switching department means a different team — the tenant/SSO session
      // (Environment/Tenant/Username/Passcode) doesn't carry over. A plain
      // name change within the same department keeps it intact.
      if (previousDepartment && previousDepartment !== this.department()) {
        this.tenantAuth.logout();
        this.workspace.setTenant('');
        this.liveProjects.reset();
      }

      this.router.navigateByUrl('/overview');
    } catch {
      this.error.set('Could not sign in. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }
}
