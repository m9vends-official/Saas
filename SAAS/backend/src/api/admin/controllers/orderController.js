
// GET /api/admin/orders 

import { getCompanyOrders } from "../../../services/orderService.js"; 

export const listOrders = async (req, res, next) => {
    try {

        const {machine_id, status, page, limit} = req.query;

        const result = await getCompanyOrders({
            company_id: req.company_id,
            machine_id,
            status,
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
        })

        res.json({
            success: true,
            ...result,
        })

    } catch (error) {
        next(error);
    }
}