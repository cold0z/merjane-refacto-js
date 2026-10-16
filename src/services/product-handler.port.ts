import {type Product} from '@/db/schema.js';

// Common contract for the 3 product types, so adding a new type means adding a new handler - cl_Jihad
export type ProductHandler = {
	handle(product: Product): Promise<void>;
};
