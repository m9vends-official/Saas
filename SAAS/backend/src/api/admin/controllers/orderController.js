// GET /api/admin/orders

import { confirmCashPayment, getCompanyOrders } from "../../../services/orderService.js";
import MachineAssignment from "../../../models/MachineAssignment.js";

export const listOrders = async (req, res, next) => {
    try {
        const { machine_id, status, page, limit } = req.query;

        let assigned_machine_ids = null;
        if (req.user.role === "TECHNICIAN") {
            const assignments = await MachineAssignment.find({
                company_id: req.company_id,
                technician_id: req.user.user_id
            }).lean();
            assigned_machine_ids = assignments.map(a => a.machine_id);
            if (assigned_machine_ids.length === 0) {
                return res.json({ success: true, orders: [], total: 0, page: 1, limit: 20 });
            }
        }

        const result = await getCompanyOrders({
            company_id: req.company_id,
            machine_id,
            assigned_machine_ids,
            status,
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
        });

        res.json({
            success: true,
            ...result,
        });

    } catch (error) {
        next(error);
    }
};

//  POST /api/admin/orders/:id/confirm-cash
export const confirmCash = async (req, res, next) => {
    try {
        const order = await confirmCashPayment({
            company_id: req.company_id,
            orderId: req.params.id,
            collected_by: req.user.user_id,
        });
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
        });
    } catch (error) {
        next(error);
    }
};
