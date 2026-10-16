// Wrote this one to keep all product DB writes in one spot - cl_Jihad
import {type Cradle} from '@fastify/awilix';
import {eq} from 'drizzle-orm';
import {products, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';

// Only class allowed to save products, the services just call it - cl_Jihad
export class ProductRepository {
	private readonly db: Database;

	public constructor({db}: Pick<Cradle, 'db'>) {
		this.db = db;
	}

	// Same update the controller used to do inline, just moved here - cl_Jihad
	public async save(product: Product): Promise<void> {
		await this.db.update(products).set(product).where(eq(products.id, product.id));
	}
}
