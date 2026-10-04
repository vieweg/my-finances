import 'reflect-metadata';
import * as readline from 'readline';
import bcrypt from 'bcrypt';
import { dataSource } from './database';
import CreateUserService from './modules/users/services/createUser.service';
import UserRepository from './modules/users/repositories/user.repository';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
}

async function createUser() {
  console.log('--- Create User ---');
  const name = await ask('Name: ');
  const email = await ask('Email: ');
  const username = await ask('Username: ');
  const password = await ask('Password: ');
  const confirmPassword = await ask('Confirm password: ');

  if (password !== confirmPassword) throw new Error('Passwords do not match');
  if (password.length < 6) throw new Error('Password must be at least 6 characters');

  const service = new CreateUserService();
  const user = await service.execute({ name, email, username, password, confirmPassword });

  console.log('\nUser created:');
  console.log(`  ID:       ${user.id}`);
  console.log(`  Name:     ${user.name}`);
  console.log(`  Email:    ${user.email}`);
  console.log(`  Username: ${user.username}`);
}

async function changePassword() {
  console.log('--- Change Password ---');
  const identifier = await ask('Email or username: ');
  const newPassword = await ask('New password: ');
  const confirmPassword = await ask('Confirm new password: ');

  if (newPassword !== confirmPassword) throw new Error('Passwords do not match');
  if (newPassword.length < 6) throw new Error('Password must be at least 6 characters');

  const userRepository = new UserRepository(dataSource);
  const user = await userRepository.findByEmailOrUsername(identifier, true);
  if (!user) throw new Error(`User not found: ${identifier}`);

  const wasDeleted = !!user.deletedAt;
  user.password = await bcrypt.hash(newPassword, 10);
  await userRepository.save(user);
  if (wasDeleted) await userRepository.recover(user);

  console.log(`\nPassword updated for ${user.username} (${user.email})`);
  if (wasDeleted) console.log('  User was inactive and has been reactivated.');
}

async function restoreUser() {
  console.log('--- Restore User ---');
  const identifier = await ask('Email or username: ');

  const userRepository = new UserRepository(dataSource);
  const user = await userRepository.findByEmailOrUsername(identifier, true);
  if (!user) throw new Error(`User not found: ${identifier}`);
  if (!user.deletedAt) throw new Error(`User ${user.username} is already active`);

  await userRepository.recover(user);

  console.log(`\nUser reactivated: ${user.username} (${user.email})`);
}

async function main() {
  const command = process.argv[2];

  if (!command) {
    console.log('Usage: npm run cli <command>');
    console.log('\nCommands:');
    console.log('  create-user      Create a new user');
    console.log('  change-password  Reset a user\'s password');
    console.log('  restore-user     Reactivate a soft-deleted user');
    process.exit(0);
  }

  await dataSource.initialize();

  try {
    switch (command) {
      case 'create-user':
        await createUser();
        break;
      case 'change-password':
        await changePassword();
        break;
      case 'restore-user':
        await restoreUser();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "npm run cli" for usage.');
        process.exit(1);
    }
  } finally {
    rl.close();
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error('Error:', err.message ?? err);
  rl.close();
  if (dataSource.isInitialized) dataSource.destroy();
  process.exit(1);
});
