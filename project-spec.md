# Budget & Expense Tracker Application Specification

## Overview
Build a complete Budget & Expense Tracker web application with a modern, clean, and minimal UI similar to Notion, Stripe Dashboard, or Linear.

### Tech Stack

#### Frontend
- Vue 3
- Vite
- Pinia
- Vue Router
- Tailwind CSS
- Axios
- Chart.js or ApexCharts

#### Backend
- Node.js
- Express.js
- Prisma ORM
- PostgreSQL (SQLite for development is acceptable)
- JWT Authentication
- bcrypt
- REST API

## Main Goal
Create an easy-to-use personal finance application where users can:
- Register and login
- Create expenses
- Edit expenses
- Delete expenses
- Create income records
- Set monthly budgets
- Track spending through an interactive dashboard
- View spending analytics

## UI Requirements
Design a beautiful interface with:
- Responsive layout
- Sidebar navigation
- Top navigation bar
- Dark mode
- Mobile friendly experience
- Rounded cards
- Soft shadows
- Smooth animations
- Loading skeletons
- Toast notifications
- Confirmation dialogs before deleting
- Search and filtering
- Pagination
- Empty states
- Clean typography

Use Tailwind CSS.

## Pages

### Authentication
- Login
  - Email
  - Password
  - Remember Me
  - Forgot Password
  - Login button
- Register
  - Name
  - Email
  - Password
  - Confirm Password

### Dashboard
Display cards for:
- Total Income
- Total Expenses
- Remaining Budget
- Savings
- Monthly Budget
- Current Balance

Charts:
- Expenses by Category (Pie Chart)
- Monthly Expenses (Line Chart)
- Income vs Expenses (Bar Chart)
- Weekly Spending

Additional dashboard sections:
- Recent Activity
- Upcoming Bills (optional)
- Quick Add Expense button

### Expenses Page
Table showing:
- Date
- Title
- Category
- Amount
- Payment Method
- Notes
- Actions

Actions:
- View
- Edit
- Delete

Features:
- Search
- Filter
- Sort
- Pagination
- Export CSV
- Export Excel
- Floating "Add Expense" button

### Add Expense
Fields:
- Expense Name
- Amount
- Date
- Category
- Payment Method
- Notes
- Receipt Upload (optional)

Categories:
- Food
- Transportation
- Shopping
- Utilities
- Rent
- Entertainment
- Health
- Education
- Bills
- Travel
- Other

### Income Page
Manage income records.
Fields:
- Source
- Amount
- Date
- Notes

Support full CRUD operations.

### Budget Page
Users can:
- Set Monthly Budget
- Set Category Budget
- Edit Budget
- Delete Budget

Display progress bars showing completion levels.

### Analytics Page
Interactive charts:
- Monthly Spending
- Yearly Spending
- Income Growth
- Expense Growth
- Category Breakdown
- Cash Flow
- Budget Utilization

Allow filtering by:
- Week
- Month
- Year
- Custom Date Range

### Profile
Allow users to update:
- Name
- Email
- Password
- Avatar

## Expense Features
Each expense should include:
- id
- title
- amount
- category
- paymentMethod
- notes
- date
- createdAt
- updatedAt

Users should be able to:
- Create
- Edit
- Delete
- Duplicate
- Archive (optional)

## Dashboard Features
Show:
- Current Month
  - Income
  - Expenses
  - Remaining Budget
- This Week
  - Spending
- Today's Spending
- Top Spending Categories
- Highest Expense
- Lowest Expense
- Average Daily Spending
- Savings Rate

## Reporting
Generate:
- Monthly Report
- Weekly Report
- Annual Report
- Category Report

Export as:
- PDF
- CSV
- Excel

## Notifications
Notify users when:
- Budget reaches 50%
- Budget reaches 75%
- Budget reaches 90%
- Budget exceeded

## Search and Filters
Search expenses by:
- Name
- Category
- Amount
- Notes

Filter by:
- Date
- Month
- Year
- Category
- Amount Range
- Payment Method

## Authentication
Use JWT.

Features:
- Register
- Login
- Logout
- Protected Routes
- Refresh Token
- Password Hashing

## Database Schema

### Users
- id
- name
- email
- password
- avatar
- createdAt

### Expenses
- id
- userId
- title
- amount
- category
- paymentMethod
- notes
- date
- createdAt

### Income
- id
- userId
- source
- amount
- date
- notes

### Budget
- id
- userId
- category
- limit
- month

## REST API

### Authentication
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/logout

### Expenses
- GET /api/expenses
- GET /api/expenses/:id
- POST /api/expenses
- PUT /api/expenses/:id
- DELETE /api/expenses/:id

### Income
- GET /api/income
- POST /api/income
- PUT /api/income/:id
- DELETE /api/income/:id

### Budget
- GET /api/budgets
- POST /api/budgets
- PUT /api/budgets/:id
- DELETE /api/budgets/:id

### Dashboard
- GET /api/dashboard

### Reports
- GET /api/reports/monthly
- GET /api/reports/yearly
- GET /api/reports/categories

## UX Enhancements
- Instant form validation
- Optimistic UI updates
- Auto-save drafts
- Keyboard shortcuts
- Drag-and-drop receipt upload
- Responsive tables
- Sticky headers
- Smooth page transitions
- Skeleton loaders
- Toast notifications
- Confirmation modals
- Empty states
- Error pages (404/500)

## Folder Structure

### backend/
- src/
  - controllers/
  - routes/
  - middleware/
  - services/
  - prisma/
  - utils/
  - config/
  - app.js
- prisma/
  - schema.prisma

### frontend/
- src/
  - components/
  - layouts/
  - pages/
  - router/
  - stores/
  - composables/
  - services/
  - assets/
  - App.vue

## Code Quality Requirements
- Use Composition API in Vue 3
- Write reusable, modular components
- Follow RESTful API design
- Use environment variables for configuration
- Implement centralized error handling
- Validate all incoming API requests
- Secure all protected endpoints with JWT middleware
- Use Prisma migrations and seed data
- Add comments where appropriate and maintain consistent code style

## Final Deliverables
- Complete Node.js + Express backend
- Complete Vue 3 frontend
- Prisma database schema and migrations
- JWT authentication
- Fully functional CRUD operations for expenses, income, and budgets
- Interactive analytics dashboard with charts
- Responsive, accessible UI using Tailwind CSS
- Dashboard statistics, reporting, search, filtering, and export functionality
- Seed data for development
- Docker configuration (`Dockerfile` and `docker-compose.yml`)
- API documentation (OpenAPI/Swagger)
- Unit and integration tests for key backend services and frontend components
- Comprehensive `README.md` with setup instructions, environment variables, project structure, and deployment steps

The final result should feel polished and professional, with an intuitive user experience comparable to modern SaaS finance applications.
