
// GET /api/admin/orders 

import { confirmCashPayment, getCompanyOrders } from "../../../services/orderService.js"; 

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

//  POST /api/admin/orders/:id/confirm-cash 
// Admin calls this when a customer pays cash physically at the machine.

export const confirmCash = async (req, res, next) => {
    try {
        const order = await confirmCashPayment({
            company_id: req.company_id,
            orderId: req.params.id,
            collected_by: req.user.user_id,
        })
        res.json({
            success: true,
            message: "Cash payment confirmed. Machine will dispense",
            data: {
                order_id: order._id,
                payment_status: order.payment_status,
                order_status:   order.order_status,
                payment_method: order.payment_method,
                total_amount:   order.total_amount,
                paid_at:        order.paid_at,
            }
        })
    } catch (error) {
        next(error);
    }
}