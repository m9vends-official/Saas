# New Intern Onboarding Guide

Welcome to the team! I'm your senior developer. My goal is to get you up and running as fast as possible so you can start contributing to the frontend. Don't worry about understanding every single line of backend code—you just need to know how to interact with it.

---

## 1. Your Learning Path

### Day 1: The Big Picture & Setup
- **What to read**: `README.md` and `docs/Architecture.md`.
- **Action**: Get the backend running locally on your machine.
  - Run `npm install` in the backend folder.
  - Ensure you have a MongoDB instance running locally (or ask me for a test connection string).
  - Create a `.env` file based on `src/server.js` requirements.
  - Run `npm run dev`. You should see "Server running on http://localhost:5000" and "Database connected".
- **What to ignore**: Do not read `src/services/` or `src/controllers/` yet. Just know they exist.

### Day 2: Postman & API Contracts
- **What to read**: `docs/API.md` and `docs/Auth.md`.
- **Action**: Open Postman (or Insomnia/Bruno) and hit the APIs yourself.
  1. Register a user (`POST /api/admin/auth/register`).
  2. Login (`POST /api/admin/auth/login`).
  3. Copy the `accessToken` and use it to hit `GET /api/admin/products`.
- **Goal**: Visually see the JSON responses so you know exactly what your React components will receive.

### Week 1: Frontend Scaffold & Authentication
- **Action**: Start building the React application.
- Set up Vite + React.
- Create the Login page.
- Write your Axios interceptor to automatically attach the `Authorization: Bearer <token>` header to all outgoing requests.
- **Challenge**: Handle the 401 Unauthorized error globally so that if a token expires, the user is redirected to the login screen.

### Week 2: CRUD Operations
- **Action**: Build the "Products" and "Devices" management screens.
- Use a UI library (like Tailwind + shadcn/ui or MUI) to create tables.
- Fetch data from `GET /api/admin/products` and display it.
- Create a form to add a new product `POST /api/admin/products`.
- **Challenge**: Implement loading spinners while data is fetching, and error toast messages if a submission fails (e.g., if a Zod validation fails).

---

## 2. Your First Contribution (Beginner Tasks)

I've scoped out some perfect beginner tasks for you to get your hands dirty in the frontend:

### Task 1: "Add Product" Form
- **APIs Used**: `POST /api/admin/products`
- **Components to Create**: `ProductForm.jsx`, `TextInput.jsx`, `SubmitButton.jsx`
- **Possible Challenges**: Handling the Zod validation errors returned by the backend. You need to map the backend error array (`[{ field: "price", message: "Price cannot be negative" }]`) to your frontend form fields.

### Task 2: Machine Status Dashboard
- **APIs Used**: `GET /api/admin/devices`
- **Components to Create**: `DeviceList.jsx`, `StatusBadge.jsx` (Green for ACTIVE, Red for MAINTENANCE).
- **Possible Challenges**: Designing a clean grid or table to display the machines. Parsing the `last_seen_at` date into a human-readable format like "2 mins ago" using `date-fns` or `dayjs`.

---

## 3. Interview Checkpoint

Before you start writing code, let's make sure you understand the project. Think about these questions. If you can't answer them, review the docs again!

### Beginner
1. If your React app is running on port 5173 and the backend is on 5000, what mechanism allows them to communicate without browser security errors?
2. Where does the backend store the refresh token, and why shouldn't your React code try to read it?
3. What is the difference between a `Product` and a `MachineCatalog` entry?

### Intermediate
1. If a user logs in and gets an access token, but then the backend administrator changes that user's role in the database, will the access token immediately reflect the new role? Why or why not?
2. When creating a POST request to add a new device, the backend returns a 422 status code. What does this mean, and what should your UI do?
3. Explain the lifecycle of a request from the moment the user clicks "Save" on the frontend to the moment the success toast appears.

### Advanced
1. How would you handle API request cancellation on the frontend if the user quickly navigates away from a page before a slow `GET /api/admin/analytics/revenue-over-time` request finishes?
2. The `Order` model stores `product_name` and `unit_price` inside the `items` array, instead of just storing the `product_id`. From a system design perspective, why is this crucial? (Hint: What happens if the product price changes tomorrow?)
