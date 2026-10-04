import 'reflect-metadata';

import dotenv from 'dotenv';

process.env.NODE_ENV === 'test' ? dotenv.config({ path: '.env.test' }) : dotenv.config();

import { DataSource, DataSourceOptions } from 'typeorm';

const options: DataSourceOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../modules/**/models/*.{js,ts}'],
  migrations: [__dirname + '/migrations/*.{js,ts}'],
  migrationsTableName: 'migrations_history',
  subscribers: [__dirname + '/../modules/**/subscribers/*.{js,ts}'],
  timezone: 'Z',
  logging: ['warn', 'error'],
  synchronize: process.env.NODE_ENV === 'development',
};

export const dataSource = new DataSource(options);
export const dataSourceOptions = options;
