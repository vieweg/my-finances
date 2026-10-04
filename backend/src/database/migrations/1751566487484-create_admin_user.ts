import { MigrationInterface } from 'typeorm';

// Used to seed an admin account. The first account is now created on first access
// (see modules/setup); this stays as a no-op so databases that already ran it keep a
// consistent migration history.
export class CreateAdminUser1751566487484 implements MigrationInterface {
  public async up(): Promise<void> {}

  public async down(): Promise<void> {}
}
