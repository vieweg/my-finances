import { Request, Response, NextFunction } from 'express';
import {
  CreateService,
  DeleteService,
  DuplicatesService,
  GetService,
  ListService,
  MergeService,
  RestoreService,
  UpdateService,
} from '../services';
import { ValidateTag } from '../middlewares/validateTag';

export const create = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = ValidateTag.create({
      userId: req.userId,
      ...req.body,
    });

    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const service = new CreateService();
    const tag = await service.execute(value);

    res.status(200).send(tag);
  } catch (error) {
    next(error);
  }
};

export const list = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, sortBy, sortOrder, search, deleted } = req.query;

    const { error, value } = ValidateTag.list({
      userId: req.userId,
      ...(page && { page: Number(page) }),
      ...(limit && { limit: Number(limit) }),
      ...(sortBy && { sortBy: String(sortBy) }),
      ...(sortOrder && { sortOrder: String(sortOrder) }),
      ...(search && { search: String(search) }),
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
    const tags = await service.execute(value);
    res.status(200).send(tags);
  } catch (error) {
    next(error);
  }
};

export const get = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = ValidateTag.getOrRemove({
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

    const service = new GetService();
    const tag = await service.execute(value);
    res.status(200).send(tag);
  } catch (error) {
    next(error);
  }
};

export const update = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = ValidateTag.update({
      id: req.params.id,
      userId: req.userId,
      ...req.body,
    });

    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const service = new UpdateService();
    const tag = await service.execute(value);

    res.status(200).send(tag);
  } catch (error) {
    next(error);
  }
};

export const remove = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = ValidateTag.getOrRemove({
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

    const service = new DeleteService();
    const tag = await service.execute(value);

    res.status(200).send(tag);
  } catch (error) {
    next(error);
  }
};

export const duplicates = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = ValidateTag.duplicates({ userId: req.userId });

    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const service = new DuplicatesService();
    const groups = await service.execute(value);
    res.status(200).send(groups);
  } catch (error) {
    next(error);
  }
};

export const merge = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = ValidateTag.merge({
      userId: req.userId,
      ...req.body,
    });

    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const service = new MergeService();
    const result = await service.execute(value);
    res.status(200).send(result);
  } catch (error) {
    next(error);
  }
};

export const restore = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = ValidateTag.getOrRemove({
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

    const service = new RestoreService();
    const tag = await service.execute(value);

    res.status(200).send(tag);
  } catch (error) {
    next(error);
  }
};
