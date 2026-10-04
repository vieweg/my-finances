import { Request, Response, NextFunction } from 'express';
import { ValidateContact } from '../middlewares/validateContact';
import {
  CreateContactService,
  ListContactsService,
  GetContactService,
  UpdateContactService,
  DeleteContactService,
  RestoreContactService,
} from '../services';

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateContact.create({ userId: req.userId, ...req.body });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    const contact = await new CreateContactService().execute(value);
    res.status(201).json(contact);
  } catch (error) {
    next(error);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deleted, name, email, sortBy, sortOrder, page, limit } = req.query;
    const { error, value } = ValidateContact.list({
      userId: req.userId,
      ...(deleted !== undefined && { deleted: deleted === 'true' }),
      ...(name && { name: name as string }),
      ...(email && { email: email as string }),
      ...(sortBy && { sortBy: sortBy as 'name' | 'email' | 'createdAt' | 'updatedAt' }),
      ...(sortOrder && { sortOrder: sortOrder as 'asc' | 'desc' }),
      ...(page && { page: Number(page) }),
      ...(limit && { limit: Number(limit) }),
    });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    const contacts = await new ListContactsService().execute(value);
    res.status(200).json(contacts);
  } catch (error) {
    next(error);
  }
};

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateContact.query({
      id: req.params.id,
      userId: req.userId,
      ...(req.query.deleted !== undefined && { deleted: req.query.deleted === 'true' }),
    });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    const contact = await new GetContactService().execute(value);
    res.status(200).json(contact);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateContact.update({ id: req.params.id, userId: req.userId, ...req.body });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    const contact = await new UpdateContactService().execute(value);
    res.status(200).json(contact);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateContact.query({
      id: req.params.id,
      userId: req.userId,
      remove: req.params.remove,
    });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    const contact = await new DeleteContactService().execute(value);
    res.status(200).json(contact);
  } catch (error) {
    next(error);
  }
};

export const restore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = ValidateContact.query({ id: req.params.id, userId: req.userId });
    if (error) {
      res.status(400).json({ message: 'Validation error', error: error.details.map((d) => d.message) });
      return;
    }
    const contact = await new RestoreContactService().execute(value);
    res.status(200).json(contact);
  } catch (error) {
    next(error);
  }
};
