import {
	describe, it, expect, beforeEach,
	afterEach,
} from 'vitest';
import {type FastifyInstance} from 'fastify';
import supertest from 'supertest';
import {eq} from 'drizzle-orm';
import {type DeepMockProxy, mockDeep} from 'vitest-mock-extended';
import {asValue} from 'awilix';
import {type INotificationService} from '@/services/notifications.port.js';
import {
	type ProductInsert,
	products,
	orders,
	ordersToProducts,
} from '@/db/schema.js';
import {type Database} from '@/db/type.js';
import {buildFastify} from '@/fastify.js';

describe('MyController Integration Tests', () => {
	let fastify: FastifyInstance;
	let database: Database;
	let notificationServiceMock: DeepMockProxy<INotificationService>;

	beforeEach(async () => {
		notificationServiceMock = mockDeep<INotificationService>();

		fastify = await buildFastify();
		fastify.diContainer.register({
			ns: asValue(notificationServiceMock as INotificationService),
		});
		await fastify.ready();
		database = fastify.database;
	});
	afterEach(async () => {
		await fastify.close();
	});

	it('ProcessOrderShouldReturn', async () => {
		const client = supertest(fastify.server);
		const allProducts = createProducts();
		const orderId = database.transaction(tx => {
			const productList = tx.insert(products).values(allProducts).returning({productId: products.id}).all();
			const order = tx.insert(orders).values([{}]).returning({orderId: orders.id}).get();
			tx.insert(ordersToProducts).values(productList.map(p => ({orderId: order.orderId, productId: p.productId}))).run();
			return order.orderId;
		});

		await client.post(`/orders/${orderId}/processOrder`).expect(200).expect('Content-Type', /application\/json/);

		const resultOrder = await database.query.orders.findFirst({where: eq(orders.id, orderId)});
		expect(resultOrder!.id).toBe(orderId);
	});

	// Added by cl_Jihad
	const day = 24 * 60 * 60 * 1000;

	// Added by cl_Jihad
	async function processOrderWith(product: ProductInsert) {
		const [saved] = database.insert(products).values(product).returning().all();
		const order = database.insert(orders).values({}).returning().get();
		database.insert(ordersToProducts).values({orderId: order.id, productId: saved!.id}).run();

		await supertest(fastify.server).post(`/orders/${order.id}/processOrder`).expect(200);

		return database.query.products.findFirst({where: eq(products.id, saved!.id)});
	}

	// Added by cl_Jihad
	function expectNoNotification() {
		expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
		expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
		expect(notificationServiceMock.sendExpirationNotification).not.toHaveBeenCalled();
	}

	// Added by cl_Jihad
	describe('NORMAL products', () => {
		it('decrements the stock when available', async () => {
			const result = await processOrderWith({
				leadTime: 15, available: 5, type: 'NORMAL', name: 'USB Cable',
			});

			expect(result!.available).toBe(4);
			expectNoNotification();
		});

		it('notifies the delay when out of stock', async () => {
			const result = await processOrderWith({
				leadTime: 10, available: 0, type: 'NORMAL', name: 'USB Dongle',
			});

			expect(result!.available).toBe(0);
			expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(10, 'USB Dongle');
		});

		it('sends nothing when out of stock with no lead time', async () => {
			const result = await processOrderWith({
				leadTime: 0, available: 0, type: 'NORMAL', name: 'Ghost Cable',
			});

			expect(result!.available).toBe(0);
			expectNoNotification();
		});
	});

	// Added by cl_Jihad
	describe('SEASONAL products', () => {
		it('decrements the stock when in season and available', async () => {
			const result = await processOrderWith({
				leadTime: 15, available: 30, type: 'SEASONAL', name: 'Watermelon',
				seasonStartDate: new Date(Date.now() - (2 * day)), seasonEndDate: new Date(Date.now() + (58 * day)),
			});

			expect(result!.available).toBe(29);
			expectNoNotification();
		});

		it('notifies the delay when in season, out of stock and restock fits in the season', async () => {
			const result = await processOrderWith({
				leadTime: 15, available: 0, type: 'SEASONAL', name: 'Watermelon',
				seasonStartDate: new Date(Date.now() - (2 * day)), seasonEndDate: new Date(Date.now() + (58 * day)),
			});

			expect(result!.available).toBe(0);
			expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(15, 'Watermelon');
			expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
		});

		it('notifies out of stock and zeroes the stock when restock would exceed the season end', async () => {
			const result = await processOrderWith({
				leadTime: 15, available: 0, type: 'SEASONAL', name: 'Watermelon',
				seasonStartDate: new Date(Date.now() - (30 * day)), seasonEndDate: new Date(Date.now() + (5 * day)),
			});

			expect(result!.available).toBe(0);
			expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Watermelon');
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
		});

		it('notifies out of stock when the season has not started yet', async () => {
			const result = await processOrderWith({
				leadTime: 15, available: 30, type: 'SEASONAL', name: 'Grapes',
				seasonStartDate: new Date(Date.now() + (180 * day)), seasonEndDate: new Date(Date.now() + (240 * day)),
			});

			expect(result!.available).toBe(30);
			expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Grapes');
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
		});

		it('notifies out of stock and zeroes the stock when the season is over', async () => {
			const result = await processOrderWith({
				leadTime: 15, available: 30, type: 'SEASONAL', name: 'Pumpkin',
				seasonStartDate: new Date(Date.now() - (60 * day)), seasonEndDate: new Date(Date.now() - (10 * day)),
			});

			expect(result!.available).toBe(0);
			expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Pumpkin');
		});
	});

	// Added by cl_Jihad
	describe('EXPIRABLE products', () => {
		it('decrements the stock when not expired and available', async () => {
			const result = await processOrderWith({
				leadTime: 15, available: 30, type: 'EXPIRABLE', name: 'Butter',
				expiryDate: new Date(Date.now() + (26 * day)),
			});

			expect(result!.available).toBe(29);
			expectNoNotification();
		});

		it('notifies the expiration and zeroes the stock when expired', async () => {
			const expiryDate = new Date(Date.now() - (2 * day));
			const result = await processOrderWith({
				leadTime: 90, available: 6, type: 'EXPIRABLE', name: 'Milk', expiryDate,
			});

			expect(result!.available).toBe(0);
			expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalledWith('Milk', expiryDate);
		});

		it('notifies the expiration when not expired but out of stock', async () => {
			const expiryDate = new Date(Date.now() + (10 * day));
			const result = await processOrderWith({
				leadTime: 15, available: 0, type: 'EXPIRABLE', name: 'Cheese', expiryDate,
			});

			expect(result!.available).toBe(0);
			expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalledWith('Cheese', expiryDate);
		});
	});

	function createProducts(): ProductInsert[] {
		const d = 24 * 60 * 60 * 1000;
		return [
			{
				leadTime: 15, available: 30, type: 'NORMAL', name: 'USB Cable',
			},
			{
				leadTime: 10, available: 0, type: 'NORMAL', name: 'USB Dongle',
			},
			{
				leadTime: 15, available: 30, type: 'EXPIRABLE', name: 'Butter', expiryDate: new Date(Date.now() + (26 * d)),
			},
			{
				leadTime: 90, available: 6, type: 'EXPIRABLE', name: 'Milk', expiryDate: new Date(Date.now() - (2 * d)),
			},
			{
				leadTime: 15, available: 30, type: 'SEASONAL', name: 'Watermelon', seasonStartDate: new Date(Date.now() - (2 * d)), seasonEndDate: new Date(Date.now() + (58 * d)),
			},
			{
				leadTime: 15, available: 30, type: 'SEASONAL', name: 'Grapes', seasonStartDate: new Date(Date.now() + (180 * d)), seasonEndDate: new Date(Date.now() + (240 * d)),
			},
		];
	}
});
