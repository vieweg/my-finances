import { Request, Response, NextFunction } from 'express';
import {
  CreateWalletService,
  ListWalletService,
  GetWalletService,
  UpdateWalletService,
  DeleteWalletService,
  RestoreWalletService,
  AdjustWalletService,
  WalletHistoryService,
  RemoveSnapshotService,
  ReorderWalletsService,
  BalanceSeriesService,
} from '../services';
import { ValidateWallet } from '../middlewares/validateWallet';

const validationError = (res: Response, details: { message: string }[]) => {
  res.status(400).json({ message: 'Validation error', error: details.map((d) => d.message) });
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateWallet.create({ userId: req.userId, ...req.body });
    if (error) { validationError(res, error.details); return; }

    const wallet = await new CreateWalletService().execute(value);
    res.status(201).json(wallet);
  } catch (err) {
    next(err);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, sortBy, sortOrder, currency, deleted } = req.query;
    const { error, value } = ValidateWallet.list({
      userId: req.userId,
      ...(page && { page: Number(page) }),
      ...(limit && { limit: Number(limit) }),
      ...(sortBy && { sortBy: String(sortBy) }),
      ...(sortOrder && { sortOrder: String(sortOrder) }),
      ...((currency || req.currency) && { currency: String(currency ?? req.currency) }),
      ...(deleted !== undefined && { deleted: deleted === 'true' }),
    });
    if (error) { validationError(res, error.details); return; }

    const wallets = await new ListWalletService().execute(value);
    res.status(200).json(wallets);
  } catch (err) {
    next(err);
  }
};

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateWallet.getOrDelete({
      id: req.params.id,
      userId: req.userId,
      ...(req.query.deleted !== undefined && { deleted: req.query.deleted === 'true' }),
    });
    if (error) { validationError(res, error.details); return; }

    const wallet = await new GetWalletService().execute(value);
    res.status(200).json(wallet);
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateWallet.update({ id: req.params.id, userId: req.userId, ...req.body });
    if (error) { validationError(res, error.details); return; }

    const wallet = await new UpdateWalletService().execute(value);
    res.status(200).json(wallet);
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateWallet.getOrDelete({ id: req.params.id, userId: req.userId, remove: req.params.remove });
    if (error) { validationError(res, error.details); return; }

    await new DeleteWalletService().execute(value);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const restore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateWallet.getOrDelete({ id: req.params.id, userId: req.userId });
    if (error) { validationError(res, error.details); return; }

    const wallet = await new RestoreWalletService().execute(value);
    res.status(200).json(wallet);
  } catch (err) {
    next(err);
  }
};

export const adjust = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateWallet.adjust({ id: req.params.id, userId: req.userId, ...req.body });
    if (error) { validationError(res, error.details); return; }

    const wallet = await new AdjustWalletService().execute(value);
    res.status(200).json(wallet);
  } catch (err) {
    next(err);
  }
};

export const reorder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateWallet.reorder({ userId: req.userId, ids: req.body.ids, currency: req.body.currency });
    if (error) { validationError(res, error.details); return; }

    await new ReorderWalletsService().execute(value);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const removeSnapshot = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await new RemoveSnapshotService().execute(req.params.id, req.params.snapshotId, req.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const balanceSeries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, interval, walletId, timezone } = req.query;
    const walletIds = walletId ? (Array.isArray(walletId) ? walletId : [walletId]).map(String) : undefined;

    const { error, value } = ValidateWallet.balanceSeries({
      userId: req.userId,
      startDate: startDate as string,
      endDate: endDate as string,
      ...(interval && { interval: String(interval) as any }),
      ...(walletIds?.length && { walletIds }),
      ...(timezone && { timezone: String(timezone) }),
      ...(req.currency && { currency: req.currency }),
    });
    if (error) { validationError(res, error.details); return; }

    const result = await new BalanceSeriesService().execute(value);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const history = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, startDate, endDate } = req.query;
    const { error, value } = ValidateWallet.history({
      id: req.params.id,
      userId: req.userId,
      ...(page && { page: Number(page) }),
      ...(limit && { limit: Number(limit) }),
      ...(startDate && { startDate: new Date(String(startDate)) }),
      ...(endDate && { endDate: new Date(String(endDate)) }),
    });
    if (error) { validationError(res, error.details); return; }

    const result = await new WalletHistoryService().execute(value);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
