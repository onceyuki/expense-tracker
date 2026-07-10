import { PAYMENT_METHODS } from '../utils/constants.js';

const bearerAuth = [{ bearerAuth: [] }];

const paginationParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
  { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 10, maximum: 100 } },
];

const expenseFilterParams = [
  { name: 'search', in: 'query', schema: { type: 'string' } },
  { name: 'category', in: 'query', schema: { type: 'string' } },
  { name: 'paymentMethod', in: 'query', schema: { type: 'string', enum: PAYMENT_METHODS } },
  { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' } },
  { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date' } },
  { name: 'minAmount', in: 'query', schema: { type: 'number' } },
  { name: 'maxAmount', in: 'query', schema: { type: 'number' } },
];

const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };

const ok = (description, schemaRef) => ({
  [200]: { description, ...(schemaRef && { content: { 'application/json': { schema: schemaRef } } }) },
});

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Budget & Expense Tracker API',
    version: '1.0.0',
    description:
      'REST API for the Budget & Expense Tracker. Authenticate via POST /api/auth/login, then send the access token as `Authorization: Bearer <token>`.',
  },
  servers: [{ url: '/' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          avatar: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Expense: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          title: { type: 'string' },
          amount: { type: 'number' },
          category: { type: 'string', description: 'One of the user\'s categories, see GET /api/categories' },
          paymentMethod: { type: 'string', enum: PAYMENT_METHODS },
          notes: { type: 'string', nullable: true },
          date: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ExpenseInput: {
        type: 'object',
        required: ['title', 'amount', 'category', 'paymentMethod', 'date'],
        properties: {
          title: { type: 'string' },
          amount: { type: 'number', minimum: 0.01 },
          category: { type: 'string', description: 'One of the user\'s categories, see GET /api/categories' },
          paymentMethod: { type: 'string', enum: PAYMENT_METHODS },
          notes: { type: 'string', nullable: true },
          date: { type: 'string', example: '2026-07-01' },
        },
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          color: { type: 'string', example: '#2a78d6' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CategoryInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', maxLength: 40 },
          color: { type: 'string', example: '#2a78d6' },
        },
      },
      Income: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          source: { type: 'string' },
          amount: { type: 'number' },
          date: { type: 'string', format: 'date-time' },
          notes: { type: 'string', nullable: true },
        },
      },
      Budget: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          category: { type: 'string', nullable: true, description: 'null = overall monthly budget' },
          limit: { type: 'number' },
          month: { type: 'string', example: '2026-07' },
          spent: { type: 'number' },
          remaining: { type: 'number' },
          percentUsed: { type: 'number' },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: { summary: 'Health check', responses: ok('Service healthy') },
    },
    '/api/auth/register': {
      post: {
        summary: 'Register a new account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'User created; sets refreshToken cookie' }, 409: { description: 'Email taken' } },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                  remember: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'user + accessToken; sets refreshToken cookie' }, 401: { description: 'Bad credentials' } },
      },
    },
    '/api/auth/refresh': {
      post: { summary: 'Rotate refresh token, get new access token', responses: ok('New accessToken') },
    },
    '/api/auth/logout': {
      post: { summary: 'Clear refresh cookie', responses: ok('Logged out') },
    },
    '/api/auth/forgot-password': {
      post: { summary: 'Request password reset (stub)', responses: ok('Always success') },
    },
    '/api/auth/me': {
      get: { summary: 'Current user', security: bearerAuth, responses: ok('User', { $ref: '#/components/schemas/User' }) },
    },
    '/api/auth/profile': {
      put: {
        summary: 'Update profile (name/email/avatar/password)',
        security: bearerAuth,
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  avatar: { type: 'string', nullable: true },
                  currentPassword: { type: 'string' },
                  newPassword: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: ok('Updated user'),
      },
    },
    '/api/expenses': {
      get: {
        summary: 'List expenses (search, filter, sort, paginate)',
        security: bearerAuth,
        parameters: [
          ...expenseFilterParams,
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['date', 'amount', 'title', 'category', 'createdAt'] } },
          { name: 'sortDir', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
          ...paginationParams,
        ],
        responses: ok('Paginated expenses'),
      },
      post: {
        summary: 'Create expense',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ExpenseInput' } } },
        },
        responses: { 201: { description: 'Created expense' } },
      },
    },
    '/api/expenses/export': {
      get: {
        summary: 'Export expenses as CSV or Excel (honors filters)',
        security: bearerAuth,
        parameters: [
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['csv', 'xlsx'], default: 'csv' } },
          ...expenseFilterParams,
        ],
        responses: ok('File download'),
      },
    },
    '/api/expenses/{id}': {
      get: { summary: 'Get expense', security: bearerAuth, parameters: [idParam], responses: ok('Expense', { $ref: '#/components/schemas/Expense' }) },
      put: {
        summary: 'Update expense',
        security: bearerAuth,
        parameters: [idParam],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/ExpenseInput' } } } },
        responses: ok('Updated expense'),
      },
      delete: { summary: 'Delete expense', security: bearerAuth, parameters: [idParam], responses: { 204: { description: 'Deleted' } } },
    },
    '/api/expenses/{id}/duplicate': {
      post: { summary: "Duplicate expense with today's date", security: bearerAuth, parameters: [idParam], responses: { 201: { description: 'Duplicated expense' } } },
    },
    '/api/income': {
      get: {
        summary: 'List income records',
        security: bearerAuth,
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date' } },
          ...paginationParams,
        ],
        responses: ok('Paginated income'),
      },
      post: {
        summary: 'Create income record',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['source', 'amount', 'date'],
                properties: {
                  source: { type: 'string' },
                  amount: { type: 'number', minimum: 0.01 },
                  date: { type: 'string' },
                  notes: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Created income' } },
      },
    },
    '/api/income/{id}': {
      put: { summary: 'Update income', security: bearerAuth, parameters: [idParam], responses: ok('Updated income') },
      delete: { summary: 'Delete income', security: bearerAuth, parameters: [idParam], responses: { 204: { description: 'Deleted' } } },
    },
    '/api/budgets': {
      get: {
        summary: 'List budgets for a month with computed progress',
        security: bearerAuth,
        parameters: [{ name: 'month', in: 'query', schema: { type: 'string', example: '2026-07' } }],
        responses: ok('Budgets', { type: 'array', items: { $ref: '#/components/schemas/Budget' } }),
      },
      post: {
        summary: 'Create budget (category null = overall monthly budget)',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['limit', 'month'],
                properties: {
                  category: { type: 'string', nullable: true, description: 'One of the user\'s categories, or omit/null for the overall budget' },
                  limit: { type: 'number', minimum: 0.01 },
                  month: { type: 'string', example: '2026-07' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Created budget' }, 409: { description: 'Duplicate for category+month' } },
      },
    },
    '/api/budgets/{id}': {
      put: { summary: 'Update budget', security: bearerAuth, parameters: [idParam], responses: ok('Updated budget') },
      delete: { summary: 'Delete budget', security: bearerAuth, parameters: [idParam], responses: { 204: { description: 'Deleted' } } },
    },
    '/api/categories': {
      get: {
        summary: "List the user's categories",
        security: bearerAuth,
        responses: ok('Categories', { type: 'array', items: { $ref: '#/components/schemas/Category' } }),
      },
      post: {
        summary: 'Create a category (color auto-assigned if omitted)',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CategoryInput' } } },
        },
        responses: { 201: { description: 'Created category' }, 409: { description: 'Name already in use' } },
      },
    },
    '/api/categories/{id}': {
      put: {
        summary: 'Rename or recolor a category (renaming updates existing expenses/budgets)',
        security: bearerAuth,
        parameters: [idParam],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CategoryInput' } } } },
        responses: ok('Updated category'),
      },
      delete: {
        summary: 'Delete a category',
        security: bearerAuth,
        parameters: [idParam],
        responses: { 204: { description: 'Deleted' }, 409: { description: 'Still in use by expenses or budgets' } },
      },
    },
    '/api/dashboard': {
      get: {
        summary: 'Dashboard aggregates: totals, stats, chart series, recent activity, budget alerts',
        security: bearerAuth,
        parameters: [{ name: 'month', in: 'query', schema: { type: 'string', example: '2026-07' } }],
        responses: ok('Dashboard payload'),
      },
    },
    '/api/analytics': {
      get: {
        summary: 'Analytics series over a date range',
        security: bearerAuth,
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'granularity', in: 'query', schema: { type: 'string', enum: ['week', 'month', 'year'], default: 'month' } },
        ],
        responses: ok('Analytics payload'),
      },
    },
    '/api/reports/monthly': {
      get: {
        summary: 'Monthly report',
        security: bearerAuth,
        parameters: [
          { name: 'month', in: 'query', schema: { type: 'string', example: '2026-07' } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'csv', 'xlsx', 'pdf'], default: 'json' } },
        ],
        responses: ok('Report'),
      },
    },
    '/api/reports/yearly': {
      get: {
        summary: 'Yearly report',
        security: bearerAuth,
        parameters: [
          { name: 'year', in: 'query', schema: { type: 'string', example: '2026' } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'csv', 'xlsx', 'pdf'], default: 'json' } },
        ],
        responses: ok('Report'),
      },
    },
    '/api/reports/categories': {
      get: {
        summary: 'Category breakdown report',
        security: bearerAuth,
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'csv', 'xlsx', 'pdf'], default: 'json' } },
        ],
        responses: ok('Report'),
      },
    },
  },
};
