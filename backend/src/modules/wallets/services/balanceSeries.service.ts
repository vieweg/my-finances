import { In } from 'typeorm';
import { dataSource } from '../../../database';
import AppError from '../../../errors/AppError';
import WalletRepository from '../repositories/wallet.repository';
import WalletSnapshotRepository from '../repositories/wallet-snapshot.repository';
import { Wallet } from '../models/wallet.model';
import { BalanceSeriesDto, BalanceSeriesInterval, BalanceSeriesResponseDto } from '../dtos';
import { MAX_BALANCE_SERIES_PERIODS } from '../../../constants';
import { formatCalendarDate, localMidnight, parseCalendarDate } from '../../../utils/timezone';

const DAY_MS = 24 * 60 * 60 * 1000;

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
const firstOfMonth = (date: Date, months = 0) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));

// Up to 45 days by day, up to 6 months by week, longer by month
const defaultInterval = (start: Date, end: Date): BalanceSeriesInterval => {
  if ((end.getTime() - start.getTime()) / DAY_MS + 1 <= 45) return 'day';
  const sixMonthsLater = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 6, start.getUTCDate()));
  return end <= sixMonthsLater ? 'week' : 'month';
};

// Weeks start on Monday
const periodStartOf = (date: Date, interval: BalanceSeriesInterval): Date => {
  if (interval === 'week') return addDays(date, -((date.getUTCDay() + 6) % 7));
  if (interval === 'month') return firstOfMonth(date);
  return date;
};

const nextPeriodStart = (date: Date, interval: BalanceSeriesInterval): Date => {
  if (interval === 'week') return addDays(date, 7);
  if (interval === 'month') return firstOfMonth(date, 1);
  return addDays(date, 1);
};

const LARGER_INTERVAL: Record<BalanceSeriesInterval, string> = {
  day: 'use interval=week or interval=month',
  week: 'use interval=month',
  month: 'use a shorter date range',
};

const toCents = (value: string | number) => Math.round(Number(value) * 100);

export default class BalanceSeriesService {
  private walletRepository: WalletRepository;
  private snapshotRepository: WalletSnapshotRepository;

  constructor() {
    this.walletRepository = new WalletRepository(dataSource);
    this.snapshotRepository = new WalletSnapshotRepository(dataSource);
  }

  async execute(dto: BalanceSeriesDto): Promise<BalanceSeriesResponseDto> {
    const start = parseCalendarDate(dto.startDate)!;
    const end = parseCalendarDate(dto.endDate)!;
    if (end < start) throw new AppError('endDate must be on or after startDate', 400);

    const timezone = dto.timezone ?? process.env.APP_TIMEZONE ?? 'UTC';
    const interval = dto.interval ?? defaultInterval(start, end);

    // Every period in the range, labelled by its first day; the first one may start before startDate
    const periodStarts: Date[] = [];
    for (let period = periodStartOf(start, interval); period <= end; period = nextPeriodStart(period, interval)) {
      periodStarts.push(period);
      if (periodStarts.length > MAX_BALANCE_SERIES_PERIODS) {
        throw new AppError(
          `The range has more than ${MAX_BALANCE_SERIES_PERIODS} ${interval} periods; ${LARGER_INTERVAL[interval]}`,
          400,
        );
      }
    }

    // Each period ends where the next one starts, and the last one at the end of endDate
    const dayAfterEnd = addDays(end, 1);
    const periodEnds = periodStarts.map((period) => {
      const next = nextPeriodStart(period, interval);
      return localMidnight(next < dayAfterEnd ? next : dayAfterEnd, timezone).getTime();
    });
    const rangeStart = localMidnight(start, timezone);
    const rangeEnd = localMidnight(dayAfterEnd, timezone);

    const wallets = await this.findWallets(dto);
    const walletIds = wallets.map((w) => w.id);

    const [openingRows, entries]: [
      Array<{ walletId: string; balance: string }>,
      Array<{ walletId: string; effectiveAt: Date; delta: string }>,
    ] = walletIds.length
      ? await Promise.all([
          this.snapshotRepository
            .createQueryBuilder('s')
            .select('s.walletId', 'walletId')
            .addSelect('SUM(s.delta)', 'balance')
            .where('s.walletId IN (:...walletIds)', { walletIds })
            .andWhere('s.effectiveAt < :rangeStart', { rangeStart })
            .groupBy('s.walletId')
            .getRawMany(),
          this.snapshotRepository
            .createQueryBuilder('s')
            .select(['s.walletId AS walletId', 's.effectiveAt AS effectiveAt', 's.delta AS delta'])
            .where('s.walletId IN (:...walletIds)', { walletIds })
            .andWhere('s.effectiveAt >= :rangeStart AND s.effectiveAt < :rangeEnd', { rangeStart, rangeEnd })
            .orderBy('s.effectiveAt', 'ASC')
            .getRawMany(),
        ])
      : [[], []];

    const openingByWallet = new Map(openingRows.map((row) => [row.walletId, toCents(row.balance)]));

    // Balances are summed in cents to avoid floating-point drift
    const seriesCents = wallets.map((wallet) => {
      const walletEntries = entries.filter((e) => e.walletId === wallet.id);
      const opening = openingByWallet.get(wallet.id) ?? 0;
      let running = opening;
      let next = 0;
      const balances = periodEnds.map((periodEnd) => {
        while (next < walletEntries.length && new Date(walletEntries[next].effectiveAt).getTime() < periodEnd) {
          running += toCents(walletEntries[next].delta);
          next++;
        }
        return running;
      });
      return { wallet, opening, balances };
    });

    const currencies = new Set(wallets.map((w) => w.currency));

    return {
      interval,
      timezone,
      buckets: periodStarts.map(formatCalendarDate),
      series: seriesCents.map(({ wallet, opening, balances }) => ({
        walletId: wallet.id,
        name: wallet.name,
        currency: wallet.currency,
        openingBalance: opening / 100,
        balances: balances.map((cents) => cents / 100),
      })),
      // Adding balances only makes sense in a single currency
      total:
        currencies.size <= 1
          ? periodStarts.map((_, i) => seriesCents.reduce((sum, s) => sum + s.balances[i], 0) / 100)
          : null,
    };
  }

  // Wallets asked for by id are returned even when soft-deleted; otherwise all active wallets
  // (of the X-Currency when set)
  private async findWallets(dto: BalanceSeriesDto): Promise<Wallet[]> {
    const order = { position: 'ASC' as const, name: 'ASC' as const };

    if (dto.walletIds?.length) {
      const ids = [...new Set(dto.walletIds)];
      const wallets = await this.walletRepository.find({
        where: { id: In(ids), user: { id: dto.userId } },
        order,
        withDeleted: true,
      });
      if (wallets.length !== ids.length) throw new AppError('Wallet not found', 404);
      return wallets;
    }

    return this.walletRepository.find({
      where: { user: { id: dto.userId }, ...(dto.currency && { currency: dto.currency }) },
      order,
    });
  }
}
