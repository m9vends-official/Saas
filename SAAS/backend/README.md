# Project Summary

## What does this application do?
This is a SaaS (Software as a Service) backend for managing a network of smart vending machines (often referred to as "devices" or "machines" in the code). It allows a company to register their machines, manage the product catalog available in each machine, track inventory (stock), process orders made at the machines (via UPI/Cash/Card/Wallet), and view analytics about revenue and machine health. 

## Who are the users?
There are two main categories of users:
1. **Public Users (Customers)**: The people buying products from the vending machines. They don't have accounts. They simply scan a QR code on the machine, view the catalog, and make a payment.
2. **Admin Users (Company Staff)**: 
   - **SUPER_ADMIN / ADMIN**: Business owners or managers who monitor revenue, add new products, set prices, and register new machines.
   - **TECHNICIAN**: On-field staff responsible for restocking machines and doing maintenance.

## What business problem does it solve?
Managing a fleet of vending machines is difficult. Without this software, owners wouldn't know when a machine is out of stock, if a machine is broken, or how much money it's making until they physically visit it. This backend provides real-time telemetry, centralized inventory management, remote catalog updates, and automated digital payments.

## What features exist?
- **Multi-tenant Architecture**: Multiple companies can use the same SaaS platform, each isolated to their own data.
- **Authentication**: JWT-based login with access and refresh tokens. Role-based access control (RBAC).
- **Catalog & Inventory**: Manage a central product list and assign specific products to specific machines with stock counts and custom prices.
- **Order Processing & Payments**: Create orders and handle Razorpay payment webhooks.
- **Device Management**: Track machine locations, status (Active, Maintenance), and last seen timestamps.
- **Analytics**: Dashboards for revenue, top-selling products, and payment methods.

---

# Tech Stack

The backend is built with Node.js and Express, connected to a MongoDB database.

## Dependencies in `package.json`

- **`express`**: The core web server framework used to define API routes and handle HTTP requests.
- **`mongoose`**: An Object Data Modeling (ODM) library for MongoDB. Used to define database schemas (models) and query the database easily.
- **`jsonwebtoken` (JWT)**: Used for generating and verifying secure tokens to handle user authentication without sessions.
- **`bcrypt`**: Used to securely hash and verify user passwords before saving them to the database.
- **`cors`**: Middleware to enable Cross-Origin Resource Sharing. *Important for frontend devs:* This is what allows your React app running on `localhost:5173` to talk to the backend on `localhost:5000` without browser security blocks.
- **`dotenv`**: Loads environment variables from a `.env` file into `process.env`.
- **`razorpay`**: The official SDK for integrating the Razorpay payment gateway to process customer transactions.
- **`zod`**: A schema validation library. Used here to ensure environment variables and API request bodies are exactly what the backend expects before processing them.
- **`cookie-parser`**: Parses HTTP cookies. Used to securely read the `refresh_token` stored in an `httpOnly` cookie.
- **`express-rate-limit`**: Protects the API from brute-force attacks (e.g., spamming the login endpoint).
- **`helmet`**: Automatically sets secure HTTP headers to protect the API from common web vulnerabilities.
- **`compression`**: Compresses API responses (like GZIP) to make them smaller, improving frontend load times.
- **`morgan`, `pino`, `pino-http`, `pino-pretty`**: Logging libraries used to print beautifully formatted API request logs in the terminal, helping with debugging.
- **`mqtt` & `@influxdata/influxdb-client` & `socket.io`**: (Phase 3/IoT integrations) Used for real-time bidirectional communication with the physical vending machines and storing time-series telemetry data.

*Should frontend developers care about these?*
You mainly need to care about `cors` (if you get CORS errors, tell the backend dev to whitelist your URL), `jsonwebtoken` & `cookie-parser` (to understand how to send tokens in headers/cookies), and `zod` (if you send a wrong payload, Zod will throw a validation error you need to catch and display).
