import { Request, Response, NextFunction } from 'express';
import { VALID_CURRENCIES } from '../constants';

export const currencyFilter = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers['x-currency'];
  if (!header) {
    next();
    return;
  }

  const value = String(header).toUpperCase();
  if (!VALID_CURRENCIES.includes(value)) {
    res.status(400).json({ message: 'Invalid X-Currency header. Must be a valid ISO 4217 currency code.' });
    return;
  }

  req.currency = value;
  next();
};
