# Roles and Features Division

This document outlines the division of features and responsibilities among the different types of users in the Vending Machine SaaS platform.

---

## 1. Customers (Public Users)
Customers interact with the public-facing side of the application, typically by scanning a QR code on the vending machine or interacting directly with the machine's screen. They do not require an account or authentication.

**Features & Capabilities:**
- **View Machine Catalog:** Browse the list of products currently available in a specific vending machine, along with their machine-specific prices.
- **Initiate Order:** Select desired items from the catalog and create an order.
- **Make Payments:** Complete transactions using digital payment methods (UPI, Cards, Wallets via Razorpay) or cash.

---

## 2. Super Admin (Business Owner)
The Super Admin is the highest authority within a company's tenant workspace. They have full control over the business operations, system configurations, and staff management.

**Features & Capabilities:**
- **Full Operational Access:** Inherits all capabilities of Admins and Technicians.
- **User Management:** Invite, suspend, or remove other staff members (Admins and Technicians).
- **Company Settings:** Manage high-level company profile, billing, and subscription details.
- **Global Configurations:** Set up and manage integrations, such as payment gateway credentials (Razorpay).
- **Advanced Analytics:** Access comprehensive business reports, overall revenue trends, and system-wide analytics.

---

## 3. Admin (Company Staff / Manager)
Admins are responsible for the day-to-day management of the vending machine fleet, inventory, and product catalog.

**Features & Capabilities:**
- **Product Management (CRUD):** Add new products, update details, manage pricing, and delete products in the central catalog.
- **Machine Management:** Register new vending machines into the system, update machine metadata, and track their physical locations.
- **Inventory & Allocation:** Assign specific products to individual machines, define maximum capacities for slots, and set custom prices per machine.
- **Order & Transaction Monitoring:** View real-time order histories, transaction statuses, and payment logs.
- **Operational Analytics:** Monitor dashboards for top-selling products, individual machine revenue, and overall machine health (Active vs. Maintenance).

---

## 4. Technician (On-field Staff)
Technicians are on-the-ground employees tasked with physically restocking and maintaining the vending machines. Their system access is strictly limited to operational necessities to prevent unauthorized catalog or pricing changes.

**Features & Capabilities:**
- **View Inventory (Read-only):** Check the current stock levels and capacity of assigned machines to prepare for restocking trips.
- **View Products (Read-only):** Browse the product catalog to identify items accurately.
- **Update Stock Levels:** Adjust inventory counts in the system after physically restocking a vending machine.
- **Machine Status Monitoring:** Check telemetry data (last seen, error codes) to identify broken or offline machines.
- **Maintenance Actions:** Toggle a machine's status between "Maintenance" and "Active" while servicing it.
