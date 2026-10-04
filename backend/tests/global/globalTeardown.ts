import { dataSource } from '../../src/database';

module.exports = async function () {
  await dataSource.initialize();
  await dataSource.dropDatabase();
  await dataSource.destroy();
  console.log('Database dropped and connection closed.');
};
