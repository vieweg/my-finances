import { dataSource } from '../../src/database';

module.exports = async function () {
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();

  console.log('\nDatabase initialized and migrations run successfully.\n');
};
