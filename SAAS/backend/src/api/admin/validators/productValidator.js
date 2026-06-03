import { z } from "zod";

// ─── Create Product Schema ────────────────────────────────────────────────────
export const createProductSchema = z.object({
    product_name: z.string().min(1, "Product name is required"),

    description: z.string().optional(),

    price: z.number({ required_error: "Price is required" }).min(0, "Price cannot be negative"),

    image_url: z.string().url("Must be a valid URL").optional(),

    category: z.string().optional(),

    sku: z.string().optional(),

    tax_percent: z.number().min(0).max(100).optional(),

    is_available: z.boolean().optional(),
});

// ─── Update Product Schema ────────────────────────────────────────────────────
export const updateProductSchema = z
    .object({
        product_name: z.string().min(1).optional(),

        description: z.string().optional(),

        price: z.number().min(0).optional(),

        image_url: z.string().url("Must be a valid URL").optional(),

        category: z.string().optional(),

        sku: z.string().optional(),

        tax_percent: z.number().min(0).max(100).optional(),

        is_available: z.boolean().optional(),
    })
    .refine(
        (data) => Object.keys(data).length > 0,
        { message: "At least one field must be provided" }
    );
