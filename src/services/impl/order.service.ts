import {type Cradle} from '@fastify/awilix';
import {type ProductHandler} from '../product-handler.port.js';
import {type OrderRepository} from '@/repositories/order.repository.js';

// Fastify turns the statusCode into the HTTP status, so a missing order is a 404 and not a crash - cl_Jihad
export class OrderNotFoundError extends Error {
	public constructor(orderId: number) {
		super(`Order ${orderId} not found`);
		this.name = 'OrderNotFoundError';
	}

	public get statusCode(): number {
		return 404;
	}
}

// Orchestrates an order: load its products, then let the right handler deal with each one - cl_Jihad
export class OrderService {
	private readonly orderRepository: OrderRepository;
	private readonly handlersByType: Map<string, ProductHandler>;

	public constructor({
		orderRepository, normalProductHandler, seasonalProductHandler, expirableProductHandler,
	}: Pick<Cradle, 'orderRepository' | 'normalProductHandler' | 'seasonalProductHandler' | 'expirableProductHandler'>) {
		this.orderRepository = orderRepository;
		// This map is the only place to touch when a new product type shows up - cl_Jihad
		this.handlersByType = new Map<string, ProductHandler>([
			['NORMAL', normalProductHandler],
			['SEASONAL', seasonalProductHandler],
			['EXPIRABLE', expirableProductHandler],
		]);
	}

	public async processOrder(orderId: number): Promise<void> {
		const products = await this.orderRepository.findProductsByOrderId(orderId);

		if (!products) {
			throw new OrderNotFoundError(orderId);
		}

		for (const product of products) {
			// Products are handled one after the other on purpose, like before the refactor - cl_Jihad
			// eslint-disable-next-line no-await-in-loop
			await this.handlersByType.get(product.type)?.handle(product);
		}
	}
}
