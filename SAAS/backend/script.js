const fs = require('fs');
const file = 'src/services/orderService.js';
let code = fs.readFileSync(file, 'utf8');

const target = `    // UPI: create Razorpay order -> get payment link for QR code
    const razorpayOrder = await createRazorpayOrder({
        amount: total_amount,
        receipt: order._id.toString(),
        notes: {
            machine_id: normalizedMachineId,
            order_id:   order._id.toString(),
        },
    });

    const payment_link = \`upi://pay?pa=MERCHANT_UPI_ID&pn=M9Vends&tr=\${razorpayOrder.id}&am=\${total_amount}&cu=INR\`;

    order.razorpay_order_id = razorpayOrder.id;
    order.payment_link      = payment_link;`;

const replacement = `    // UPI: create Razorpay Payment Link -> get short_url for QR code
    const razorpayOrder = await createRazorpayOrder({
        amount: total_amount,
        receipt: \`rcpt_\${order._id}\`,
        notes: {
            machine_id: normalizedMachineId,
            order_id:   order._id.toString(),
            company_id: company_id.toString(),
        },
        company_id: company_id,
    });

    order.razorpay_order_id = razorpayOrder.id;
    order.payment_link      = razorpayOrder.short_url;`;

code = code.replace(target, replacement);

const targetReturn = `        razorpay_order_id: razorpayOrder.id,
        total_amount,
        items:             resolvedItems,
        payment_link,`;

const replacementReturn = `        razorpay_order_id: razorpayOrder.id,
        total_amount,
        items:             resolvedItems,
        payment_link:      razorpayOrder.short_url,`;

code = code.replace(targetReturn, replacementReturn);

fs.writeFileSync(file, code);
console.log('orderService.js updated');
