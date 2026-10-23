import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { Product } from '../entities/product.entity';

/**
 * Idempotent seed: only inserts products that don't exist yet (by name),
 * so re-running never duplicates stock.
 */
async function seed() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Product);
  const catalogue = [
    { name: 'Masala Chips', price_paise: '4500', stock_units: 20 },
    { name: 'Roasted Almonds', price_paise: '12000', stock_units: 10 },
    { name: 'Cold Coffee', price_paise: '8000', stock_units: 15 },
    { name: 'Dark Chocolate', price_paise: '9500', stock_units: 25 },
    { name: 'Salted Peanuts', price_paise: '3000', stock_units: 30 },
  ];
  for (const row of catalogue) {
    const exists = await repo.findOne({ where: { name: row.name } });
    if (!exists) await repo.insert(row);
  }
  await AppDataSource.destroy();
  // eslint-disable-next-line no-console
  console.log('seed: ok');
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});