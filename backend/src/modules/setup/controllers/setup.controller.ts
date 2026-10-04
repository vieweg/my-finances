import { Request, Response, NextFunction } from 'express';
import { ValidateUser } from '../../users/middlewares/validateUser';
import { GetSetupStatusService, CompleteSetupService } from '../services/setup.service';

export const status = async function (_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await new GetSetupStatusService().execute());
  } catch (error) {
    next(error);
  }
};

export const complete = async function (req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = ValidateUser.create(req.body);

    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }
    const user = await new CompleteSetupService().execute(value);

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
};
