import { Request, Response, NextFunction } from 'express';
import { ValidateUser } from '../middlewares/validateUser';
import {
  CreateUserService,
  UpdateUserService,
  GetUserService,
  DeleteUserService,
  ForgotPasswordService,
  ChangePasswordService,
} from '../services';

export const create = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = ValidateUser.create(req.body);

    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }
    const createService = new CreateUserService();
    const results = await createService.execute(value);

    res.status(201).json(results);
  } catch (error) {
    next(error);
  }
};

export const list = async function (_req: Request, res: Response, next: NextFunction) {
  try {
    const getUsersService = new GetUserService();
    const users = await getUsersService.execute();
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};

export const get = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = ValidateUser.get(req.params.id);
    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const getUsersService = new GetUserService();
    const user = await getUsersService.execute(value);

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

export const update = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = ValidateUser.update({
      id: req.params.id,
      ...req.body,
    });

    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const updateService = new UpdateUserService();
    const results = await updateService.execute(value);
    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
};

export const remove = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = ValidateUser.delete(req.params.id, req.params.remove);
    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const deleteService = new DeleteUserService();
    await deleteService.execute({ id: value.id, remove: !!value.remove });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const changePassword = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = ValidateUser.changePassword(req.body);

    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const updateService = new ChangePasswordService();
    const results = await updateService.execute(value);
    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = ValidateUser.forgotPassword(req.body.email);

    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const updateService = new ForgotPasswordService();
    await updateService.execute(value);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
