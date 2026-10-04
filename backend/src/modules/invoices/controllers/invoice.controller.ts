import { Request, Response, NextFunction } from 'express';
import { ValidateInvoice } from '../middlewares/validateInvoice';
import {
  CreateInvoiceService,
  ListInvoicesService,
  GetInvoiceService,
  UpdateInvoiceService,
  DeleteInvoiceService,
  AddInvoiceTransactionService,
  MarkPaidService,
  UnmarkPaidService,
  RestoreInvoiceService,
} from '../services';

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.currency && req.body.currency) {
      res.status(400).json({ message: 'currency cannot be provided in the body when X-Currency header is set' });
      return;
    }

    const { error, value } = ValidateInvoice.create({
      userId: req.userId,
      ...req.body,
      ...(!req.body.walletId && req.currency && { currency: req.currency }),
    });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    res.status(201).json(await new CreateInvoiceService().execute(value));
  } catch (error) {
    next(error);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, sortBy, sortOrder, filterByType, filterByStatus, filterByIsOverdue,
      filterByCurrency, filterByContactId, filterByContactName, search, startDate, endDate, description, filterByTag, filterByTagId, deleted, contractId, forecast } = req.query;

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

    const { error, value } = ValidateInvoice.list({
      userId: req.userId,
      ...(page && { page: Number(page) }),
      ...(limit && { limit: Number(limit) }),
      ...(sortBy && { sortBy: String(sortBy) }),
      ...(sortOrder && { sortOrder: String(sortOrder) }),
      ...(filterByType && { filterByType: String(filterByType) }),
      ...(filterByStatus && {
        filterByStatus: Array.isArray(filterByStatus)
          ? filterByStatus.map(String)
          : String(filterByStatus),
      }),
      ...(filterByIsOverdue !== undefined && { filterByIsOverdue: filterByIsOverdue === 'true' }),
      ...((req.currency || filterByCurrency) && { filterByCurrency: String(req.currency ?? filterByCurrency) }),
      ...(filterByContactId && { filterByContactId: String(filterByContactId) }),
      ...(filterByContactName && { filterByContactName: String(filterByContactName) }),
      ...(search && { search: String(search) }),
      ...((startDate || endDate) && {
        filterByDateRange: {
          ...(startDate && { startDate: new Date(String(startDate)) }),
          ...(endDate && { endDate: new Date(String(endDate)) }),
        },
      }),
      ...(description && { description: String(description) }),
      ...(rawTags?.length && { filterByTag: rawTags }),
      ...(rawTagIds?.length && { filterByTagId: rawTagIds }),
      ...(deleted !== undefined && { deleted: deleted === 'true' }),
      ...(contractId && { contractId: String(contractId) }),
      ...(forecast !== undefined && { forecast: forecast === 'true' }),
    });

    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    res.status(200).json(await new ListInvoicesService().execute(value));
  } catch (error) {
    next(error);
  }
};

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateInvoice.query({
      id: req.params.id,
      userId: req.userId,
      ...(req.query.deleted !== undefined && { deleted: req.query.deleted === 'true' }),
    });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    res.status(200).json(await new GetInvoiceService().execute(value));
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateInvoice.update({ id: req.params.id, userId: req.userId, ...req.body });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    res.status(200).json(await new UpdateInvoiceService().execute(value));
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateInvoice.query({
      id: req.params.id,
      userId: req.userId,
      remove: req.params.remove,
      ...(req.body?.reason !== undefined && { reason: req.body.reason }),
    });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    res.status(200).json(await new DeleteInvoiceService().execute(value));
  } catch (error) {
    next(error);
  }
};

export const addTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateInvoice.addTransaction({
      invoiceId: req.params.id,
      userId: req.userId,
      ...req.body,
    });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    res.status(201).json(await new AddInvoiceTransactionService().execute(value));
  } catch (error) {
    next(error);
  }
};

export const markPaid = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateInvoice.markPaid({ id: req.params.id, userId: req.userId });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    res.status(200).json(await new MarkPaidService().execute(value));
  } catch (error) {
    next(error);
  }
};

export const unmarkPaid = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateInvoice.markPaid({ id: req.params.id, userId: req.userId });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    res.status(200).json(await new UnmarkPaidService().execute(value));
  } catch (error) {
    next(error);
  }
};

export const restore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateInvoice.query({
      id: req.params.id,
      userId: req.userId,
      ...(req.body?.reason !== undefined && { reason: req.body.reason }),
    });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    res.status(200).json(await new RestoreInvoiceService().execute(value));
  } catch (error) {
    next(error);
  }
};
