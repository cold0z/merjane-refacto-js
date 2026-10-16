import {type Cradle} from '@fastify/awilix';
import {eq} from 'drizzle-orm';
import {products, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';

export class ProductRepository {
	private readonly db: Database;

	public constructor({db}: Pick<Cradle, 'db'>) {
		this.db = db;
	}

	public async save(product: Product): Promise<void> {
		await this.db.update(products).set(product).where(eq(products.id, product.id));
	}
}
