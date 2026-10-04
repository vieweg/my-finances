import { Request, Response, NextFunction } from 'express';
import ms from 'ms';
import {
  CreateSessionService,
  DeleteSessionService,
  DeleteAllSessionsService,
  RefreshSessionService,
} from '../services/';
import { ValidateSession } from '../middlewares/validateSession';

const REFRESH_COOKIE = 'refresh_token';

const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/sessions',
  maxAge:
    (ms((process.env.JWT_EXPIRATION_REFRESH || '7d') as ms.StringValue) as number | undefined) ??
    7 * 24 * 60 * 60 * 1000,
});

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { value, error } = ValidateSession.create(req.body);
    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const createSessionService = new CreateSessionService();
    const { refreshToken, ...session } = await createSessionService.execute(value);

    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
};

export const destroy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { value, error } = ValidateSession.destroy(req.headers.authorization || null);
    if (error) {
      res.status(400).json({
        message: 'Validation error',
        error: error.details.map((detail) => detail.message),
      });
      return;
    }

    const deleteSessionService = new DeleteSessionService();
    await deleteSessionService.execute(value.replace('Bearer ', ''));

    res.clearCookie(REFRESH_COOKIE, { path: '/api/sessions' });
    res.status(200).send();
  } catch (err) {
    next(err);
  }
};

export const destroyAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleteSessionService = new DeleteAllSessionsService();
    await deleteSessionService.execute(req.userId!);

    res.clearCookie(REFRESH_COOKIE, { path: '/api/sessions' });
    res.status(200).send();
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const receivedToken: string | undefined = req.cookies?.[REFRESH_COOKIE];
    if (!receivedToken) {
      res.status(401).json({ message: 'Refresh token not provided' });
      return;
    }

    const refreshTokenService = new RefreshSessionService();
    const { refreshToken, ...session } = await refreshTokenService.execute(receivedToken);

    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    res.status(200).json(session);
  } catch (err) {
    next(err);
  }
};
