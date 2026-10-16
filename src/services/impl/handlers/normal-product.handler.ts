import {type Cradle} from '@fastify/awilix';
import {type ProductHandler} from '../../product-handler.port.js';
import {type Product} from '@/db/schema.js';
import {type ProductService} from '@/services/impl/product.service.js';

export class NormalProductHandler implements ProductHandler {
	private readonly ps: ProductService;

	public constructor({ps}: Pick<Cradle, 'ps'>) {
		this.ps = ps;
	}

	public async handle(product: Product): Promise<void> {
		if (product.available > 0) {
			await this.ps.decrementStock(product);
			return;
		}

		// No lead time means there is no delay to announce - cl_Jihad
		if (product.leadTime > 0) {
			await this.ps.notifyDelay(product.leadTime, product);
		}
	}
}
