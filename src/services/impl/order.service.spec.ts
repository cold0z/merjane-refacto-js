import {
	describe, it, expect, beforeEach,
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {OrderService, OrderNotFoundError} from './order.service.js';
import {type NormalProductHandler} from './handlers/normal-product.handler.js';
import {type SeasonalProductHandler} from './handlers/seasonal-product.handler.js';
import {type ExpirableProductHandler} from './handlers/expirable-product.handler.js';
import {type OrderRepository} from '@/repositories/order.repository.js';
import {type Product} from '@/db/schema.js';

describe('OrderService', () => {
	let orderRepositoryMock: DeepMockProxy<OrderRepository>;
	let normalHandlerMock: DeepMockProxy<NormalProductHandler>;
	let seasonalHandlerMock: DeepMockProxy<SeasonalProductHandler>;
	let expirableHandlerMock: DeepMockProxy<ExpirableProductHandler>;
	let orderService: OrderService;

	beforeEach(() => {
		orderRepositoryMock = mockDeep<OrderRepository>();
		normalHandlerMock = mockDeep<NormalProductHandler>();
		seasonalHandlerMock = mockDeep<SeasonalProductHandler>();
		expirableHandlerMock = mockDeep<ExpirableProductHandler>();
		orderService = new OrderService({
			orderRepository: orderRepositoryMock,
			normalProductHandler: normalHandlerMock,
			seasonalProductHandler: seasonalHandlerMock,
			expirableProductHandler: expirableHandlerMock,
		});
	});

	function buildProduct(id: number, type: string): Product {
		return {
			id,
			leadTime: 15,
			available: 30,
			type,
			name: `Product ${id}`,
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
		};
	}

	it('sends each product to the handler matching its type', async () => {
		const normal = buildProduct(1, 'NORMAL');
		const seasonal = buildProduct(2, 'SEASONAL');
		const expirable = buildProduct(3, 'EXPIRABLE');
		orderRepositoryMock.findProductsByOrderId.mockResolvedValue([normal, seasonal, expirable]);

		await orderService.processOrder(1);

		expect(normalHandlerMock.handle).toHaveBeenCalledTimes(1);
		expect(normalHandlerMock.handle).toHaveBeenCalledWith(normal);
		expect(seasonalHandlerMock.handle).toHaveBeenCalledTimes(1);
		expect(seasonalHandlerMock.handle).toHaveBeenCalledWith(seasonal);
		expect(expirableHandlerMock.handle).toHaveBeenCalledTimes(1);
		expect(expirableHandlerMock.handle).toHaveBeenCalledWith(expirable);
	});

	it('handles several products of the same type', async () => {
		const first = buildProduct(1, 'NORMAL');
		const second = buildProduct(2, 'NORMAL');
		orderRepositoryMock.findProductsByOrderId.mockResolvedValue([first, second]);

		await orderService.processOrder(1);

		expect(normalHandlerMock.handle).toHaveBeenCalledTimes(2);
		expect(normalHandlerMock.handle).toHaveBeenNthCalledWith(1, first);
		expect(normalHandlerMock.handle).toHaveBeenNthCalledWith(2, second);
	});

	it('ignores products of an unknown type, as the old code did', async () => {
		orderRepositoryMock.findProductsByOrderId.mockResolvedValue([buildProduct(1, 'MYSTERY')]);

		await orderService.processOrder(1);

		expect(normalHandlerMock.handle).not.toHaveBeenCalled();
		expect(seasonalHandlerMock.handle).not.toHaveBeenCalled();
		expect(expirableHandlerMock.handle).not.toHaveBeenCalled();
	});

	it('does nothing for an order without products', async () => {
		orderRepositoryMock.findProductsByOrderId.mockResolvedValue([]);

		await orderService.processOrder(1);

		expect(normalHandlerMock.handle).not.toHaveBeenCalled();
	});

	it('throws OrderNotFoundError when the order does not exist', async () => {
		orderRepositoryMock.findProductsByOrderId.mockResolvedValue(undefined);

		await expect(orderService.processOrder(42)).rejects.toThrow(OrderNotFoundError);
	});
});
