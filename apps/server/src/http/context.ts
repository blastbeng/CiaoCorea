import type { AppConfig } from '../config';
import type { Db } from '../db/client';

export interface Ctx {
  db: Db;
  config: AppConfig;
}
