import {type Cradle} from '@fastify/awilix';
import {type ProductHandler} from '../../product-handler.port.js';
import {type INotificationService} from '../../notifications.port.js';
import {type ProductService} from '../product.service.js';
import {type Product} from '@/db/schema.js';
import {type ProductRepository} from '@/repositories/product.repository.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Rules for SEASONAL products: only sellable during the season, and a restock after the season is useless - cl_Jihad
export class SeasonalProductHandler implements ProductHandler {
	private readonly ps: ProductService;
	private readonly ns: INotificationService;
	private readonly productRepository: ProductRepository;

	public constructor({ps, ns, productRepository}: Pick<Cradle, 'ps' | 'ns' | 'productRepository'>) {
		this.ps = ps;
		this.ns = ns;
		this.productRepository = productRepository;
	}

	public async handle(product: Product): Promise<void> {
		const now = new Date();

		if (this.isInSeason(product, now) && product.available > 0) {
			await this.ps.decrementStock(product);
			return;
		}

		await this.handleUnavailable(product, now);
	}

	private isInSeason(product: Product, now: Date): boolean {
		return now > product.seasonStartDate! && now < product.seasonEndDate!;
	}

	// Called when we can't sell right now: decide between "gone for the season" and "come back later" - cl_Jihad
	private async handleUnavailable(product: Product, now: Date): Promise<void> {
		const restockDate = new Date(now.getTime() + (product.leadTime * DAY_IN_MS));

		if (restockDate > product.seasonEndDate!) {
			this.ns.sendOutOfStockNotification(product.name);
			product.available = 0;
			await this.productRepository.save(product);
		} else if (product.seasonStartDate! > now) {
			this.ns.sendOutOfStockNotification(product.name);
			await this.productRepository.save(product);
		} else {
			await this.ps.notifyDelay(product.leadTime, product);
		}
	}
}
