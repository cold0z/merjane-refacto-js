import {
	describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {SeasonalProductHandler} from './seasonal-product.handler.js';
import {type ProductService} from '@/services/impl/product.service.js';
import {type INotificationService} from '@/services/notifications.port.js';
import {type ProductRepository} from '@/repositories/product.repository.js';
import {type Product} from '@/db/schema.js';

describe('SeasonalProductHandler', () => {
	const day = 24 * 60 * 60 * 1000;
	const now = new Date('2026-06-15T12:00:00Z');

	let productServiceMock: DeepMockProxy<ProductService>;
	let notificationServiceMock: DeepMockProxy<INotificationService>;
	let productRepositoryMock: DeepMockProxy<ProductRepository>;
	let handler: SeasonalProductHandler;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
		productServiceMock = mockDeep<ProductService>();
		notificationServiceMock = mockDeep<INotificationService>();
		productRepositoryMock = mockDeep<ProductRepository>();
		handler = new SeasonalProductHandler({
			ps: productServiceMock,
			ns: notificationServiceMock,
			productRepository: productRepositoryMock,
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function daysFromNow(days: number): Date {
		return new Date(now.getTime() + (days * day));
	}

	function buildProduct(overrides: Partial<Product> = {}): Product {
		return {
			id: 1,
			leadTime: 15,
			available: 30,
			type: 'SEASONAL',
			name: 'Watermelon',
			expiryDate: null,
			seasonStartDate: daysFromNow(-2),
			seasonEndDate: daysFromNow(58),
			...overrides,
		};
	}

	it('sells one unit when in season and in stock', async () => {
		const product = buildProduct();

		await handler.handle(product);

		expect(productServiceMock.decrementStock).toHaveBeenCalledWith(product);
		expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
	});

	it('notifies the delay when in season, out of stock and the restock fits in the season', async () => {
		const product = buildProduct({available: 0, leadTime: 15});

		await handler.handle(product);

		expect(productServiceMock.notifyDelay).toHaveBeenCalledWith(15, product);
		expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
	});

	it('notifies out of stock and zeroes the stock when the restock would land after the season end', async () => {
		const product = buildProduct({available: 0, leadTime: 15, seasonEndDate: daysFromNow(5)});

		await handler.handle(product);

		expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Watermelon');
		expect(product.available).toBe(0);
		expect(productRepositoryMock.save).toHaveBeenCalledWith(product);
		expect(productServiceMock.notifyDelay).not.toHaveBeenCalled();
	});

	it('notifies out of stock without touching the stock when the season has not started yet', async () => {
		const product = buildProduct({
			name: 'Grapes',
			available: 30,
			seasonStartDate: daysFromNow(180),
			seasonEndDate: daysFromNow(240),
		});

		await handler.handle(product);

		expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Grapes');
		expect(product.available).toBe(30);
		expect(productServiceMock.decrementStock).not.toHaveBeenCalled();
		expect(productServiceMock.notifyDelay).not.toHaveBeenCalled();
	});

	it('notifies out of stock and zeroes the stock when the season is over', async () => {
		const product = buildProduct({
			name: 'Pumpkin',
			available: 30,
			seasonStartDate: daysFromNow(-60),
			seasonEndDate: daysFromNow(-10),
		});

		await handler.handle(product);

		expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Pumpkin');
		expect(product.available).toBe(0);
		expect(productRepositoryMock.save).toHaveBeenCalledWith(product);
		expect(productServiceMock.decrementStock).not.toHaveBeenCalled();
	});

	it('still notifies the delay when the restock lands exactly on the season end', async () => {
		const product = buildProduct({available: 0, leadTime: 15, seasonEndDate: daysFromNow(15)});

		await handler.handle(product);

		expect(productServiceMock.notifyDelay).toHaveBeenCalledWith(15, product);
		expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
	});
});
