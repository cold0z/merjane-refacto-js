import {type Cradle} from '@fastify/awilix';
import {type INotificationService} from '../notifications.port.js';
import {type Product} from '@/db/schema.js';
// Service goes through the repo now instead of Drizzle directly - cl_Jihad
import {type ProductRepository} from '@/repositories/product.repository.js';

export class ProductService {
	private readonly ns: INotificationService;
	// Injected by awilix, replaces the old db field - cl_Jihad
	private readonly productRepository: ProductRepository;

	public constructor({ns, productRepository}: Pick<Cradle, 'ns' | 'productRepository'>) {
		this.ns = ns;
		this.productRepository = productRepository;
	}

	public async notifyDelay(leadTime: number, p: Product): Promise<void> {
		p.leadTime = leadTime;
		await this.productRepository.save(p);
		this.ns.sendDelayNotification(leadTime, p.name);
	}

	// Shared by the 3 handlers, selling one unit is always the same operation - cl_Jihad
	public async decrementStock(p: Product): Promise<void> {
		p.available -= 1;
		await this.productRepository.save(p);
	}
}
