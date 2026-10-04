import bcrypt from 'bcrypt';
import { dataSource } from '../../src/database';
import { User } from '../../src/modules/users/models/user.model';

module.exports = async function () {
  await dataSource.initialize();
  await dataSource.runMigrations();
  // The account most tests log in with (adminUserCredentials in setupTests.ts)
  await dataSource.getRepository(User).insert({
    name: 'Admin',
    email: 'admin@example.com',
    username: 'admin',
    password: bcrypt.hashSync('please_change_me', 10),
  });
  await dataSource.destroy();

  console.log('\nDatabase initialized and migrations run successfully.\n');
};
