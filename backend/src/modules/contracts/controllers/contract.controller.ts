import { Request, Response, NextFunction } from 'express';
import { ValidateContract } from '../middlewares/validateContract';
import {
  CreateContractService,
  ListContractsService,
  GetContractService,
  UpdateContractService,
  DeleteContractService,
  GenerateContractInvoicesService,
  RestoreContractService,
  CompleteContractService,
  ReactivateContractService,
} from '../services';

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.currency && req.body.currency) {
      res.status(400).json({ message: 'currency cannot be provided in the body when X-Currency header is set' });
      return;
    }
    const { error, value } = ValidateContract.create({
      userId: req.userId,
      ...req.body,
      ...(!req.body.walletId && req.currency && { currency: req.currency }),
    });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    res.status(201).json(await new CreateContractService().execute(value));
  } catch (err) {
    next(err);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, sortBy, sortOrder, filterByStatus, filterByType, filterByContactId, filterByContactName, filterByCurrency, name, description, search, deleted, includeCompleted } = req.query;

    if (req.currency && filterByCurrency) {
      res.status(400).json({ message: 'filterByCurrency cannot be used when X-Currency header is set' });
      return;
    }

    const { error, value } = ValidateContract.list({
      userId: req.userId,
      ...(page && { page: Number(page) }),
      ...(limit && { limit: Number(limit) }),
      ...(sortBy && { sortBy: String(sortBy) }),
      ...(sortOrder && { sortOrder: String(sortOrder) }),
      ...(filterByStatus && { filterByStatus: String(filterByStatus) as any }),
      ...(filterByType && { filterByType: String(filterByType) as any }),
      ...(filterByContactId && { filterByContactId: String(filterByContactId) }),
      ...(filterByContactName && { filterByContactName: String(filterByContactName) }),
      ...((req.currency || filterByCurrency) && { filterByCurrency: String(req.currency ?? filterByCurrency) }),
      ...(name && { name: String(name) }),
      ...(description && { description: String(description) }),
      ...(search && { search: String(search) }),
      ...(deleted !== undefined && { deleted: deleted === 'true' }),
      ...(includeCompleted !== undefined && { includeCompleted: includeCompleted === 'true' }),
    });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    res.status(200).json(await new ListContractsService().execute(value));
  } catch (err) {
    next(err);
  }
};

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateContract.query({
      id: req.params.id,
      userId: req.userId,
      ...(req.query.deleted !== undefined && { deleted: req.query.deleted === 'true' }),
    });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    res.status(200).json(await new GetContractService().execute(value));
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateContract.update({ id: req.params.id, userId: req.userId, ...req.body });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    res.status(200).json(await new UpdateContractService().execute(value));
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateContract.query({
      id: req.params.id,
      userId: req.userId,
      remove: req.params.remove,
    });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    res.status(200).json(await new DeleteContractService().execute(value));
  } catch (err) {
    next(err);
  }
};

export const generateForContract = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateContract.generateFor({ id: req.params.id, userId: req.userId });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    res.status(200).json(await new GenerateContractInvoicesService().execute(value.id, value.userId));
  } catch (err) {
    next(err);
  }
};

export const restore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateContract.query({ id: req.params.id, userId: req.userId });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    res.status(200).json(await new RestoreContractService().execute(value));
  } catch (err) {
    next(err);
  }
};

export const complete = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateContract.query({ id: req.params.id, userId: req.userId });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    res.status(200).json(await new CompleteContractService().execute(value));
  } catch (err) {
    next(err);
  }
};

export const reactivate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateContract.query({ id: req.params.id, userId: req.userId });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    res.status(200).json(await new ReactivateContractService().execute(value));
  } catch (err) {
    next(err);
  }
};
