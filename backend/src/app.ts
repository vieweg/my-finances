import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import userRoutes from './modules/users/routes/user.routes';
import sessionRoutes from './modules/sessions/routes/session.routes';
import swaggerUi from 'swagger-ui-express';
import transactionRoutes from './modules/transactions/routes/transaction.routes';
import tagRoutes from './modules/tags/routes/tag.routes';
import walletRoutes from './modules/wallets/routes/wallet.routes';
import contactRoutes from './modules/contacts/routes/contact.routes';
import invoiceRoutes from './modules/invoices/routes/invoice.routes';
import contractRoutes from './modules/contracts/routes/contract.routes';
import backupRoutes from './modules/backups/routes/backup.routes';
import { errorHandler } from './middlewares/errorHandler';
import { RequestsLog } from './middlewares/requestLog';
import { authenticated } from './middlewares/authenticated';
import { currencyFilter } from './middlewares/currencyFilter';
import { spec } from './swagger';

const app = express();
app.use(helmet());
app.use(express.json({ limit: '50kb' }));
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') app.use(RequestsLog);

// Routes
app.use('/api/sessions', sessionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/transactions', authenticated, currencyFilter, transactionRoutes);
app.use('/api/tags', authenticated, tagRoutes);
app.use('/api/wallets', authenticated, currencyFilter, walletRoutes);
app.use('/api/contacts', authenticated, contactRoutes);
app.use('/api/invoices', authenticated, currencyFilter, invoiceRoutes);
app.use('/api/contracts', authenticated, currencyFilter, contractRoutes);
app.use('/api/backups', authenticated, backupRoutes);

if (process.env.NODE_ENV !== 'production') {
  // OpenAPI spec endpoint (for openapi-typescript generation)
  app.get('/api/docs/openapi.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(spec);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec));
}
// Global error handler (should be after routes)
app.use(errorHandler);

export default app;
