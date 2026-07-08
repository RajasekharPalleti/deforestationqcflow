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
  tenant = signal(this.workspace.tenant());
  username = signal(this.tenantAuth.username());
  password = signal('');
  showPassword = signal(false);

  authenticating = computed(() => this.tenantAuth.authenticating());
  authError = computed(() => this.tenantAuth.authError());

  /** Lowercase letters/digits only — no spaces or symbols (e.g. "qazone7"). */
  tenantValid = computed(() => /^[a-z0-9]+$/.test(this.tenant()));
  canSubmit = computed(
    () => this.tenantValid() && this.username().trim().length > 0 && this.password().length > 0
  );

  ngOnInit(): void {
    // Already authenticated (e.g. navigated here directly) — nothing to do here.
    if (this.tenantAuth.accessToken()) {
      this.router.navigateByUrl('/overview');
    }
  }

  /** Strip anything that isn't a lowercase letter or digit as the user types, live. */
  onTenantInput(raw: string): void {
    this.tenant.set(raw.toLowerCase().replace(/[^a-z0-9]/g, ''));
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
      this.workspace.setTenant(this.tenant());
      await this.tenantAuth.login(this.environment(), this.tenant(), this.username(), this.password());
      this.password.set('');
      this.router.navigateByUrl('/overview');
    } catch {
      // authError signal already set by the service
    }
  }
}
