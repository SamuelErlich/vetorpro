# Credential Management & Payment System

## Overview

A web application for managing user credentials and payment processing. The system provides two distinct interfaces: a client portal where users can access their monthly credentials and manage payments, and an admin dashboard for managing users, credentials, and monitoring payments. Built with React, Express, and PostgreSQL, the application uses session-based authentication and integrates with the PushinPay API for PIX payment generation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool

**Routing**: Wouter for client-side routing with the following structure:
- `/` - Client login page
- `/dashboard` - Client dashboard (protected)
- `/admin/login` - Admin login page
- `/admin` - Admin dashboard (protected)
- `/payment` - PIX payment generation page

**State Management**: TanStack Query (React Query) for server state management with custom query client configuration. Session data is managed server-side with cookies.

**UI Components**: shadcn/ui component library based on Radix UI primitives, configured with:
- Tailwind CSS for styling with custom design tokens
- Material Design with Fluent Design influences (per design guidelines)
- "New York" style variant
- Custom color system using CSS variables for light/dark mode support

**Design System**:
- Typography: Inter or Roboto font families
- Spacing: Standardized Tailwind units (2, 4, 6, 8, 12, 16)
- Layout: Max-width containers (max-w-7xl for content, max-w-md for forms)
- Component hierarchy: Cards with clear visual separation

### Backend Architecture

**Server Framework**: Express.js with TypeScript running on Node.js

**Authentication**: Session-based authentication using express-session with:
- 7-day session expiration
- HTTP-only cookies
- Secure flag in production
- Session storage configured via middleware

**Password Security**: bcrypt for password hashing with salt rounds of 10

**API Design**: RESTful API structure with route prefixes:
- `/api/auth/*` - Authentication endpoints (login, logout, session check)
- `/api/users` - User management
- `/api/credentials` - Credential CRUD operations
- `/api/payments` - Payment operations and PIX generation
- `/api/admin/*` - Admin-specific endpoints

**Middleware Stack**:
- JSON body parsing with raw body capture for webhook validation
- URL-encoded form parsing
- Request logging with duration tracking
- Authentication guards (requireAuth, requireAdmin)

**Development Setup**: Vite integration for HMR in development with custom error overlay and Replit-specific tooling

### Data Storage

**Database**: PostgreSQL via Neon serverless driver (@neondatabase/serverless)

**ORM**: Drizzle ORM with schema definition in TypeScript

**Schema Structure**:

1. **Users Table**:
   - id (UUID, primary key)
   - email (unique, text)
   - password (bcrypt hashed, text)
   - status (ATIVO/INATIVO, text)
   - ultimoPagamento (timestamp, nullable)
   - isAdmin (text, "true"/"false")

2. **Credentials Table**:
   - id (UUID, primary key)
   - userId (foreign key to users)
   - month (text, e.g., "Janeiro 2025")
   - data (JSON string containing credential details)

3. **Payments Table**:
   - id (UUID, primary key)
   - userId (foreign key to users)
   - amount (decimal)
   - status (pending/paid/failed, text)
   - txid (PIX transaction ID, text, nullable)
   - createdAt (timestamp)

**Storage Implementation**: Dual-mode storage system with in-memory fallback (MemStorage class) for development, designed to be swapped with PostgreSQL connection in production.

**Migration Strategy**: Drizzle Kit for schema migrations with configuration pointing to PostgreSQL database URL from environment variables.

### Authorization Model

**Role-Based Access**:
- Client users: Access to own credentials and payment management
- Admin users: Full access to user management, all credentials, and payment monitoring

**Route Protection**:
- `requireAuth` middleware validates session exists
- `requireAdmin` middleware validates admin role
- Frontend route guards check user authentication status via `/api/auth/me` endpoint

### Payment Integration

**PIX Generation Flow**:
1. Client initiates payment from dashboard
2. POST to `/api/payments/pix` with amount
3. Backend calls PushinPay API (POST https://api.pushinpay.com.br/pix)
4. Returns QR code image and "copia e cola" string
5. Payment record created with "pending" status

**Webhook Handling**:
- Token-based validation for incoming webhook requests
- Payment status updates upon confirmation
- User status updates (ATIVO/INATIVO) based on payment

## External Dependencies

### Third-Party APIs

**PushinPay API**: PIX payment generation service
- Endpoint: POST https://api.pushinpay.com.br/pix
- Parameters: valor (amount), chave_pix (PIX key), txid (transaction ID)
- Returns: QR code image URL and payment string
- Webhook for payment confirmation

### Database Services

**Neon PostgreSQL**: Serverless PostgreSQL database
- Connection via @neondatabase/serverless package
- DATABASE_URL environment variable required
- Used with Drizzle ORM for type-safe queries

### UI Component Libraries

**Radix UI**: Headless component primitives
- Comprehensive set of accessible components
- Dialog, Dropdown, Select, Toast, and 20+ other primitives
- Provides behavior and accessibility, styled with Tailwind

**shadcn/ui**: Pre-styled component layer on top of Radix UI
- Customizable via components.json configuration
- New York style variant selected
- Components aliased under @/components

### Development Tools

**Replit Integration**:
- @replit/vite-plugin-runtime-error-modal for error overlay
- @replit/vite-plugin-cartographer for code navigation
- @replit/vite-plugin-dev-banner for development indicators
- Conditional loading in non-production environments

### Session Management

**express-session**: Server-side session management
- connect-pg-simple available for PostgreSQL session store (not currently configured)
- In-memory session store in current implementation
- SESSION_SECRET environment variable for signing cookies

### Form Handling

**React Hook Form**: Form state management on frontend
- @hookform/resolvers for Zod schema validation
- Integration with shadcn/ui form components

**Zod**: Schema validation
- Used with drizzle-zod for automatic schema generation from database schema
- Runtime validation of API requests and form inputs