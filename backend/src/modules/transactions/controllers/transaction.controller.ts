import { Request, Response, NextFunction } from 'express';
import {
  CreateService,
  GetsService,
  UpdateService,
  DeleteService,
  ListService,
  HistoryService,
  RestoreService,
  RestoreDeletedService,
  SummaryService,
} from '../services';
import { ValidateTransaction } from '../middlewares/validateTransaction';

export const create = async function (req: Request, res: Response, next: NextFunction) {
  try {
    if (req.currency && req.body.currency) {
      res.status(400).json({ message: 'currency cannot be provided in the body when X-Currency header is set' });
      return;
    }

    const { error, value } = ValidateTransaction.create({
      userId: req.userId,
      ...req.body,
      ...(!req.body.walletId && req.currency && { currency: req.currency }),
    });

    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const service = new CreateService();
    const transaction = await service.execute(value);

    res.status(200).send(transaction);
  } catch (error) {
    next(error);
  }
};

export const update = async function (req: Request, res: Response, next: NextFunction) {
  try {
    if (req.currency && req.body.currency) {
      res.status(400).json({ message: 'currency cannot be provided in the body when X-Currency header is set' });
      return;
    }

    const { error, value } = ValidateTransaction.update({
      id: req.params.id,
      userId: req.userId,
      ...req.body,
      ...(!req.body.walletId && req.currency && { currency: req.currency }),
    });

    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const service = new UpdateService();
    const transaction = await service.execute(value);

    res.status(200).send(transaction);
  } catch (error) {
    next(error);
  }
};

export const list = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, sortBy, sortOrder, filterByType, filterByCurrency, startDate, endDate, description, search, filterByTag, filterByTagId, deleted } =
      req.query;

    if (req.currency && filterByCurrency) {
      res.status(400).json({ message: 'filterByCurrency cannot be used when X-Currency header is set' });
      return;
    }

    const rawTags = filterByTag
      ? (Array.isArray(filterByTag) ? filterByTag : [filterByTag]).map(String)
      : undefined;
    const rawTagIds = filterByTagId
      ? (Array.isArray(filterByTagId) ? filterByTagId : [filterByTagId]).map(String)
      : undefined;

    const { error, value } = ValidateTransaction.list({
      userId: req.userId,
      ...(page && { page: Number(page) }),
      ...(limit && { limit: Number(limit) }),
      ...(sortBy && { sortBy: String(sortBy) }),
      ...(sortOrder && { sortOrder: String(sortOrder) }),
      ...(filterByType && { filterByType: String(filterByType) }),
      ...((req.currency || filterByCurrency) && { filterByCurrency: String(req.currency ?? filterByCurrency) }),
      ...((startDate || endDate) && {
        filterByDateRange: {
          ...(startDate && { startDate: new Date(String(startDate)) }),
          ...(endDate && { endDate: new Date(String(endDate)) }),
        },
      }),
      ...(description && { description: String(description) }),
      ...(search && { search: String(search) }),
      ...(rawTags?.length && { filterByTag: rawTags }),
      ...(rawTagIds?.length && { filterByTagId: rawTagIds }),
      ...(deleted !== undefined && { deleted: deleted === 'true' }),
    });

    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const service = new ListService();
    const transactions = await service.execute(value);
    res.status(200).send(transactions);
  } catch (error) {
    next(error);
  }
};

export const get = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = ValidateTransaction.getOrRemove({
      id: req.params.id,
      userId: req.userId,
      ...(req.query.deleted !== undefined && { deleted: req.query.deleted === 'true' }),
    });

    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const service = new GetsService();
    const transaction = await service.execute(value);
    res.status(200).send(transaction);
  } catch (error) {
    next(error);
  }
};

export const remove = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = ValidateTransaction.getOrRemove({
      id: req.params.id,
      userId: req.userId,
      remove: req.params.remove,
    });

    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const service = new DeleteService();
    const transaction = await service.execute(value);

    res.status(200).send(transaction);
  } catch (error) {
    next(error);
  }
};

export const history = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit } = req.query;

    const { error, value } = ValidateTransaction.history({
      id: req.params.id,
      userId: req.userId,
      ...(page && { page: Number(page) }),
      ...(limit && { limit: Number(limit) }),
    });

    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const service = new HistoryService();
    const result = await service.execute(value);
    res.status(200).send(result);
  } catch (error) {
    next(error);
  }
};

export const summary = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { month, year, currency } = req.query;

    const { error, value } = ValidateTransaction.summary({
      userId: req.userId,
      month: Number(month),
      year: Number(year),
      currency: String(currency ?? ''),
    });

    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const service = new SummaryService();
    const result = await service.execute(value);
    res.status(200).send(result);
  } catch (error) {
    next(error);
  }
};

export const restore = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = ValidateTransaction.restore({
      id: req.params.id,
      versionId: req.params.versionId,
      userId: req.userId,
    });

    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const service = new RestoreService();
    const transaction = await service.execute(value);
    res.status(200).send(transaction);
  } catch (error) {
    next(error);
  }
};

export const restoreDeleted = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = ValidateTransaction.getOrRemove({
      id: req.params.id,
      userId: req.userId,
    });

    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const service = new RestoreDeletedService();
    const transaction = await service.execute(value);
    res.status(200).send(transaction);
  } catch (error) {
    next(error);
  }
};
