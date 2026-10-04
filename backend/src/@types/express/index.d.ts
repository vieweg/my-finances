declare namespace Express {
  interface Request {
    userId: string;
    currency?: string;
  }
}
