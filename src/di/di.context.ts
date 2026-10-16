import {type Cradle, diContainer} from '@fastify/awilix';
import {asClass, asValue} from 'awilix';
import {type FastifyBaseLogger, type FastifyInstance} from 'fastify';
import {type INotificationService} from '@/services/notifications.port.js';
import {NotificationService} from '@/services/impl/notification.service.js';
import {type Database} from '@/db/type.js';
import {ProductService} from '@/services/impl/product.service.js';
import {ProductRepository} from '@/repositories/product.repository.js';
import {OrderRepository} from '@/repositories/order.repository.js';
import {OrderService} from '@/services/impl/order.service.js';
import {NormalProductHandler} from '@/services/impl/handlers/normal-product.handler.js';
import {SeasonalProductHandler} from '@/services/impl/handlers/seasonal-product.handler.js';
import {ExpirableProductHandler} from '@/services/impl/handlers/expirable-product.handler.js';

declare module '@fastify/awilix' {

	interface Cradle { // eslint-disable-line @typescript-eslint/consistent-type-definitions
		logger: FastifyBaseLogger;
		db: Database;
		ns: INotificationService;
		ps: ProductService;
		productRepository: ProductRepository;
		orderRepository: OrderRepository;
		normalProductHandler: NormalProductHandler;
		seasonalProductHandler: SeasonalProductHandler;
		expirableProductHandler: ExpirableProductHandler;
		orderService: OrderService;
	}
}

export async function configureDiContext(
	server: FastifyInstance,
): Promise<void> {
	diContainer.register({
		logger: asValue(server.log),
	});
	diContainer.register({
		db: asValue(server.database),
	});
	diContainer.register({
		ns: asClass(NotificationService),
	});
	diContainer.register({
		ps: asClass(ProductService),
	});
	diContainer.register({
		productRepository: asClass(ProductRepository),
		orderRepository: asClass(OrderRepository),
	});
	diContainer.register({
		normalProductHandler: asClass(NormalProductHandler),
		seasonalProductHandler: asClass(SeasonalProductHandler),
		expirableProductHandler: asClass(ExpirableProductHandler),
	});
	diContainer.register({
		orderService: asClass(OrderService),
	});
}

export function resolve<Service extends keyof Cradle>(
	service: Service,
): Cradle[Service] {
	return diContainer.resolve(service);
}
