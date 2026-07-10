import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { ENVIRONMENTS, TenantAuthService } from '../../core/services/tenant-auth';
import { WorkspaceService } from '../../core/services/workspace';

@Component({
  selector: 'app-tenant-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tenant-login.html',
  styleUrl: './tenant-login.scss',
})
export class TenantLogin implements OnInit {
  private tenantAuth = inject(TenantAuthService);
  private workspace = inject(WorkspaceService);
  private router = inject(Router);
  private auth = inject(AuthService);

  environments = ENVIRONMENTS;
  environment = signal(this.workspace.environment() || ENVIRONMENTS[0]);
  username = signal(this.tenantAuth.username());
  password = signal('');
  showPassword = signal(false);

  authenticating = computed(() => this.tenantAuth.authenticating());
  authError = computed(() => this.tenantAuth.authError());

  canSubmit = computed(() => this.username().trim().length > 0 && this.password().length > 0);

  ngOnInit(): void {
    // Already authenticated (e.g. navigated here directly) — nothing to do here.
    if (this.tenantAuth.accessToken()) {
      this.router.navigateByUrl('/overview');
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  backToMain(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  async login(): Promise<void> {
    if (!this.canSubmit()) return;
    try {
      this.workspace.setEnvironment(this.environment());
      await this.tenantAuth.login(this.environment(), this.username(), this.password());
      this.password.set('');
      this.router.navigateByUrl('/overview');
    } catch {
      // authError signal already set by the service
    }
  }
}
