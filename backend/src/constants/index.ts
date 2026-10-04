export const NOTES_MAX_LENGTH = 2000;
export const REASON_MAX_LENGTH = 500;
export const MAX_BALANCE_SERIES_PERIODS = 400;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
  SORT_ORDER: ['asc', 'desc'],
};

export const PAGINATION_TRANSACTIONS = {
  ...PAGINATION,
  SORT_BY: ['createdAt', 'updatedAt', 'date', 'total', 'description', 'type', 'currency'],
};

export const PAGINATION_TAGS = {
  ...PAGINATION,
  SORT_BY: ['name', 'createdAt', 'updatedAt'],
};

export const PAGINATION_WALLETS = {
  ...PAGINATION,
  SORT_BY: ['position', 'name', 'createdAt', 'updatedAt'],
};

export const PAGINATION_CONTRACTS = {
  ...PAGINATION,
  SORT_BY: ['createdAt', 'updatedAt', 'name', 'amount', 'status', 'type', 'nextDueDate', 'firstDueDate'],
  DEFAULT_SORT_BY: 'createdAt',
};

export const PAGINATION_CONTACTS = {
  ...PAGINATION,
  SORT_BY: ['name', 'email', 'createdAt', 'updatedAt'],
  DEFAULT_SORT_BY: 'name',
};

export const PAGINATION_INVOICES = {
  ...PAGINATION,
  SORT_BY: ['createdAt', 'updatedAt', 'dueDate', 'issueDate', 'amount', 'status', 'type', 'currency', 'contact', 'outstanding', 'description'],
  DEFAULT_SORT_BY: 'dueDate',
};

export const VALID_CURRENCIES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BMD', 'BND', 'BOB', 'BRL', 'BSD',
  'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP',
  'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN',
  'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF',
  'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IQD',
  'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW',
  'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD',
  'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR',
  'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD',
  'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON',
  'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP',
  'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SVC', 'SYP', 'SZL', 'THB', 'TJS',
  'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD',
  'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF',
  'YER', 'ZAR', 'ZMW', 'ZWL',
];
