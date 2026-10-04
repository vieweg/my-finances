import 'dotenv/config';
import app from './app';
import { dataSource } from './database';
import { startContractInvoicesJob } from './jobs/contractInvoices.job';
import { startBackupJob } from './jobs/backup.job';

const requiredEnvVars = [
  'JWT_SECRET',
  'JWT_SECRET_REFRESH',
  'JWT_RESET_SECRET',
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'FRONTEND_URL',
];
const missing = requiredEnvVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

interface Config {
  port: number;
  nodeEnv: string;
}

const config: Config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
};

// establish database connection and start server
dataSource
  .initialize()
  .then(() => {
    app.set('config', config);
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
    startContractInvoicesJob();
    startBackupJob();
  })
  .catch((err) => {
    console.error('Error during Data Source initialization:', err);
  });
