import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ManagedUser } from '../../core/models/models';
import { ConfigService } from '../../core/services/config';
import { UsersService } from '../../core/services/users';

@Component({
  selector: 'app-manage-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manage-users.html',
  styleUrl: './manage-users.scss',
})
export class ManageUsers implements OnInit {
  private usersService = inject(UsersService);
  private configService = inject(ConfigService);

  users = signal<ManagedUser[]>([]);
  roles = signal<string[]>([]);

  newUsername = signal('');
  newDisplayName = signal('');
  newRole = signal('');
  newPassword = signal('');

  successMessage = signal('');
  errorMessage = signal('');
  submitting = signal(false);

  async ngOnInit(): Promise<void> {
    const [users, config] = await Promise.all([this.usersService.list(), this.configService.getConfig()]);
    this.users.set(users);
    this.roles.set(config.roles);
    this.newRole.set(config.roles[0]);
  }

  async addUser(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    if (!this.newUsername() || !this.newPassword()) return;
    this.submitting.set(true);
    try {
      await this.usersService.add(this.newUsername(), this.newDisplayName(), this.newRole(), this.newPassword());
      this.successMessage.set(`Added '${this.newUsername()}'.`);
      this.newUsername.set('');
      this.newDisplayName.set('');
      this.newPassword.set('');
      this.users.set(await this.usersService.list());
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 409) {
        this.errorMessage.set('Username exists.');
      } else {
        this.errorMessage.set('Could not add user.');
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
