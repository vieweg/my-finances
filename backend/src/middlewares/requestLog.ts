import { Request, Response, NextFunction } from 'express';

export const RequestsLog = (req: Request, res: Response, next: NextFunction) => {
  const formatMemoryUsage = (data: number) => `${Math.round((data / 1024 / 1024) * 100) / 100} MB`;
  const getDurationInMilliseconds = (start: [number, number]) => {
    const NS_PER_SEC = 1e9;
    const NS_TO_MS = 1e6;
    const diff = process.hrtime(start);
    return (diff[0] * NS_PER_SEC + diff[1]) / NS_TO_MS;
  };

  const start = process.hrtime();

  res.on('finish', () => {
    const durationInMilliseconds = getDurationInMilliseconds(start);
    const endMemory = process.memoryUsage();

    console.log(
      `${req.method} ${req.originalUrl} ${formatMemoryUsage(endMemory.heapUsed)} ${Number(
        durationInMilliseconds,
      ).toFixed(2)} ms`,
    );
  });

  next();
};
