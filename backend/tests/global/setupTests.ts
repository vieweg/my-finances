import { dataSource } from '../../src/database';
import { SessionResponseDto } from '../../src/modules/sessions/dtos';
import { faker } from '@faker-js/faker/locale/en';

beforeAll(async () => {
  await dataSource.initialize();
});

afterAll(async () => {
  await dataSource.destroy();
});

// User data created from seeds/migration
const adminUserCredentials = {
  username: 'admin',
  email: 'admin@example.com',
  password: 'please_change_me',
};

const buildCreateUserPayload = (params?: any) => {
  const firstName = params?.name || faker.person.firstName();
  const username = params?.username || faker.internet.username({ firstName });
  const name = params?.name || faker.person.fullName({ firstName });
  const email = params?.email || faker.internet.email({ firstName });
  const password = params?.password || faker.internet.password();
  const confirmPassword = params?.confirmPassword || password;

  return {
    name,
    email,
    username,
    password,
    confirmPassword,
  };
};

export { adminUserCredentials, buildCreateUserPayload, SessionResponseDto };
