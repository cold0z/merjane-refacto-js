import {type Cradle} from '@fastify/awilix';
import {eq} from 'drizzle-orm';
import {orders, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';

export class OrderRepository {
	private readonly db: Database;

	public constructor({db}: Pick<Cradle, 'db'>) {
		this.db = db;
	}

	// Gives back just the products, or undefined if the order is not there - cl_Jihad
	public async findProductsByOrderId(orderId: number): Promise<Product[] | undefined> {
		const order = await this.db.query.orders.findFirst({
			where: eq(orders.id, orderId),
			with: {
				products: {
					columns: {},
					with: {
						product: true,
					},
				},
			},
		});

		return order?.products.map(({product}) => product);
	}
}
