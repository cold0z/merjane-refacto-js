import {
	describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {ExpirableProductHandler} from './expirable-product.handler.js';
import {type ProductService} from '@/services/impl/product.service.js';
import {type INotificationService} from '@/services/notifications.port.js';
import {type ProductRepository} from '@/repositories/product.repository.js';
import {type Product} from '@/db/schema.js';

// Unit tests for the EXPIRABLE rules: valid and in stock = sold, anything else = expiration notice - cl_Jihad
describe('ExpirableProductHandler', () => {
	const day = 24 * 60 * 60 * 1000;
	const now = new Date('2026-06-15T12:00:00Z');

	let productServiceMock: DeepMockProxy<ProductService>;
	let notificationServiceMock: DeepMockProxy<INotificationService>;
	let productRepositoryMock: DeepMockProxy<ProductRepository>;
	let handler: ExpirableProductHandler;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
		productServiceMock = mockDeep<ProductService>();
		notificationServiceMock = mockDeep<INotificationService>();
		productRepositoryMock = mockDeep<ProductRepository>();
		handler = new ExpirableProductHandler({
			ps: productServiceMock,
			ns: notificationServiceMock,
			productRepository: productRepositoryMock,
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function buildProduct(overrides: Partial<Product> = {}): Product {
		return {
			id: 1,
			leadTime: 15,
			available: 30,
			type: 'EXPIRABLE',
			name: 'Butter',
			expiryDate: new Date(now.getTime() + (26 * day)),
			seasonStartDate: null,
			seasonEndDate: null,
			...overrides,
		};
	}

	it('sells one unit when not expired and in stock', async () => {
		const product = buildProduct();

		await handler.handle(product);

		expect(productServiceMock.decrementStock).toHaveBeenCalledWith(product);
		expect(notificationServiceMock.sendExpirationNotification).not.toHaveBeenCalled();
	});

	it('notifies the expiration and zeroes the stock when expired', async () => {
		const expiryDate = new Date(now.getTime() - (2 * day));
		const product = buildProduct({name: 'Milk', available: 6, expiryDate});

		await handler.handle(product);

		expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalledWith('Milk', expiryDate);
		expect(product.available).toBe(0);
		expect(productRepositoryMock.save).toHaveBeenCalledWith(product);
		expect(productServiceMock.decrementStock).not.toHaveBeenCalled();
	});

	it('notifies the expiration when not expired but out of stock', async () => {
		const expiryDate = new Date(now.getTime() + (10 * day));
		const product = buildProduct({name: 'Cheese', available: 0, expiryDate});

		await handler.handle(product);

		expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalledWith('Cheese', expiryDate);
		expect(productServiceMock.decrementStock).not.toHaveBeenCalled();
	});
});
