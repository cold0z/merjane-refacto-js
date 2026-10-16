import {
	describe, it, expect, beforeEach,
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {NormalProductHandler} from './normal-product.handler.js';
import {type ProductService} from '@/services/impl/product.service.js';
import {type Product} from '@/db/schema.js';

describe('NormalProductHandler', () => {
	let productServiceMock: DeepMockProxy<ProductService>;
	let handler: NormalProductHandler;

	beforeEach(() => {
		productServiceMock = mockDeep<ProductService>();
		handler = new NormalProductHandler({ps: productServiceMock});
	});

	function buildProduct(overrides: Partial<Product> = {}): Product {
		return {
			id: 1,
			leadTime: 15,
			available: 5,
			type: 'NORMAL',
			name: 'USB Cable',
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
			...overrides,
		};
	}

	it('sells one unit when in stock', async () => {
		const product = buildProduct({available: 5});

		await handler.handle(product);

		expect(productServiceMock.decrementStock).toHaveBeenCalledWith(product);
		expect(productServiceMock.notifyDelay).not.toHaveBeenCalled();
	});

	it('notifies the delay when out of stock', async () => {
		const product = buildProduct({available: 0, leadTime: 10});

		await handler.handle(product);

		expect(productServiceMock.notifyDelay).toHaveBeenCalledWith(10, product);
		expect(productServiceMock.decrementStock).not.toHaveBeenCalled();
	});

	it('does nothing when out of stock and there is no lead time', async () => {
		const product = buildProduct({available: 0, leadTime: 0});

		await handler.handle(product);

		expect(productServiceMock.notifyDelay).not.toHaveBeenCalled();
		expect(productServiceMock.decrementStock).not.toHaveBeenCalled();
	});
});
