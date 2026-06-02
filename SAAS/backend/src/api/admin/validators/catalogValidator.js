import { z } from "zod";

export const addCatalogSchema = z.object({
    machine_id: z.string().min(1),

    product_id: z.string().min(1),

    stock: z.number().int().min(0),

    slot_label: z.string().optional(),

    price_override: z.number().min(0).optional(),
});

export const updateCatalogSchema = z
    .object({
        stock: z.number().int().min(0).optional(),

        is_enabled: z.boolean().optional(),

        price_override: z.number().min(0).optional(),
    })
    .refine(
        (data) =>
            Object.keys(data).length > 0,
        {
            message:
                "At least one field must be provided",
        }
    );