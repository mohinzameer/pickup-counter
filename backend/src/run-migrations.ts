import 'reflect-metadata';
import { AppDataSource } from './data-source';

(async () => {
  await AppDataSource.initialize();
  await AppDataSource.runMigrations();
  await AppDataSource.destroy();
  // eslint-disable-next-line no-console
  console.log('migrations: up to date');
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('migration bootstrap failed', err);
  process.exit(1);
});