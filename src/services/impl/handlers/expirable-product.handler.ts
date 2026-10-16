import {type Cradle} from '@fastify/awilix';
import {type ProductHandler} from '../../product-handler.port.js';
import {type INotificationService} from '../../notifications.port.js';
import {type ProductService} from '../product.service.js';
import {type Product} from '@/db/schema.js';
import {type ProductRepository} from '@/repositories/product.repository.js';

export class ExpirableProductHandler implements ProductHandler {
	private readonly ps: ProductService;
	private readonly ns: INotificationService;
	private readonly productRepository: ProductRepository;

	public constructor({ps, ns, productRepository}: Pick<Cradle, 'ps' | 'ns' | 'productRepository'>) {
		this.ps = ps;
		this.ns = ns;
		this.productRepository = productRepository;
	}

	public async handle(product: Product): Promise<void> {
		const isExpired = product.expiryDate! <= new Date();

		if (product.available > 0 && !isExpired) {
			await this.ps.decrementStock(product);
			return;
		}

		this.ns.sendExpirationNotification(product.name, product.expiryDate!);
		product.available = 0;
		await this.productRepository.save(product);
	}
}
