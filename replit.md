# Credential Management & Payment System

## Overview

This project is a web application designed for comprehensive user credential management and payment processing. It features a client portal for users to access monthly credentials and manage payments, and an admin dashboard for full control over users, credentials, and payment monitoring. The system is built with React, Express, and PostgreSQL, leveraging session-based authentication and integrating with the PushinPay API for PIX payment generation. The business vision is to provide a reliable and secure platform for managing access and subscriptions, with market potential in services requiring recurring payments and credential distribution. The ambition is to offer a seamless and automated experience for both users and administrators.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with **React** and **TypeScript** using **Vite** as the build tool. **Wouter** handles client-side routing. **TanStack Query** manages server state, while UI components are provided by **shadcn/ui** (based on Radix UI) with **Tailwind CSS** for styling, adhering to a Material Design aesthetic with Fluent Design influences and a "New York" style variant. A custom color system with CSS variables supports light/dark modes. WhatsApp contact buttons are context-aware and integrated across various pages.

### Backend

The backend is an **Express.js** application with **TypeScript** running on **Node.js**. It uses **session-based authentication** with `express-session` and `bcrypt` for password hashing. The **RESTful API** is structured with clear route prefixes. A middleware stack handles JSON and URL-encoded parsing, request logging, and authentication guards. Development includes Vite integration for HMR.

### Data Storage

**PostgreSQL** via `@neondatabase/serverless` is the primary database, managed by **Drizzle ORM**. The schema includes:

**Core Tables:**
- `Users` (id, email, password, status, ultimoPagamento, isAdmin) - Legacy user table, maintained for backward compatibility
- `Services` (id, name, description, isActive, monthlyPrice) - Service definitions (e.g., Vectorizer)
- `UserServices` (id, userId, serviceId, status, nextPaymentDate) - Per-service subscription management
- `Credentials` (id, userId, **serviceId**, month, data) - Service credentials (JSON with `ChaveAPI` filtered from client view)
- `Payments` (id, userId, **serviceId**, amount, status, txid, createdAt) - Payment tracking per service

**Multi-Service Architecture (November 2025):**
The system now supports multiple services internally while maintaining **zero visual impact** on the existing UI. All operations use `DEFAULT_SERVICE_ID` constant (currently "vectorizer-001") from `shared/constants.ts`. The `UserServices` table manages per-service subscriptions, while the legacy `Users` table is maintained for backward compatibility. When adding new services in the future, simply create a new service record and the infrastructure is ready - no migration of existing users required.

Drizzle Kit is used for schema migrations.

### Authorization

A **role-based access** model is implemented, differentiating between client users (access to own data) and admin users (full system access). `requireAuth` and `requireAdmin` middleware protect routes, with frontend guards checking authentication status.

**Credential Isolation Security (November 2025):**
- **Multi-service isolation**: Users only see credentials for their active subscriptions
- **getCredentialsByUserAndServices()**: New secure method filters by userId AND serviceIds
- **Admin validation**: Even admins cannot create credentials for services users don't have
- **20 security tests**: Complete test coverage for credential access control
- **Zero trust model**: Every credential access validates user ownership and service subscription

### User Registration

The system supports **two methods** for user onboarding:

1. **Admin Invitation** - Admins can invite users via the admin dashboard, generating a 24-hour password creation token sent via email
2. **Self-Registration** - Users can register directly from the login page via a glassmorphism modal (`RegisterModal.tsx`), which creates an account with status `INATIVO` and sends a password creation email

**Registration Flow:**
- User submits email via `POST /api/auth/register`
- System creates user with status `INATIVO`, no password
- Password creation token generated (24-hour expiry)
- Welcome email sent with password creation link
- User creates password → status remains `INATIVO` (credentials locked until payment)
- User makes first payment → status changes to `ATIVO` (credentials unlocked)

**Duplicate Prevention:**
- Frontend uses ref guard + mutateAsync to prevent rapid submissions
- Backend returns friendly message if email already exists with status `ATIVO`
- Existing `INATIVO` users receive new password creation token

### Payment Integration

The system supports a **monthly subscription of R$ 17,50** (defined in `shared/constants.ts`). It integrates with the **PushinPay API** for PIX payment generation. The flow involves client initiation, backend generation of a unique TXID, API call to PushinPay, storage of payment in cents with `serviceId`, and return of QR code data. A demo mode fallback is available for testing.

**Webhook Processing:**
- Security-hardened with X-Token validation, TXID validation, and idempotency checks
- Updates **both** `Users.status` (backward compatibility) and `UserServices.status` (multi-service support)
- Sets `Users.ultimoPagamento` and `UserServices.nextPaymentDate` to day 5 of following month
- All payments automatically tagged with `serviceId` (defaults to "vectorizer-001")

### Email Notification System

**Resend** is used for automated payment reminders and account status notifications. Email templates include "Payment due in 2 days," "Payment due tomorrow," and "Access blocked," all branded with VectorPro and WhatsApp contact (5544936184613). 

**Standardized Billing Cycle:** All payments are due on **DAY 5 of each month**. When a user pays, their `nextPaymentDate` is automatically set to day 5 of the following month (not +30 days from payment). This creates a consistent, predictable billing cycle for all customers.

**Cron Schedule** (America/Sao_Paulo timezone):
- **Day 3 at 9:00 AM**: Pre-reminder emails ("Payment due in 2 days") - Queries `UserServices` table
- **Day 4 at 9:00 AM**: Final warning emails ("Payment due tomorrow - day 5") - Queries `UserServices` table
- **Day 6 at 9:00 AM**: Block overdue users + send "Access blocked" emails (1 day grace period) - Updates both `Users` and `UserServices` tables

**Multi-Service Cron Support:**
Cron jobs now operate on the `UserServices` table filtered by `DEFAULT_SERVICE_ID`, allowing independent billing cycles for future services. Legacy `Users` table is updated in parallel for backward compatibility.

Admin testing endpoints are available:
- `POST /api/admin/test-email` - Manual email testing
- `POST /api/admin/trigger-cron` - Manual cron trigger (actions: day3, day4, day6)

The system is designed for graceful degradation: works without `RESEND_API_KEY` (logs warnings), cron failures don't crash the server. Requires Always-On/Reserved VM for 24/7 cron execution.

## External Dependencies

### Third-Party APIs

*   **PushinPay API**: For PIX payment generation.
    *   `PUSHINPAY_TOKEN` for authentication.
    *   `PUSHINPAY_WEBHOOK_SECRET` for webhook authentication.
*   **Resend**: Transactional email service for notifications.
    *   `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

### Database Services

*   **Neon PostgreSQL**: Serverless PostgreSQL database.

### UI Component Libraries

*   **Radix UI**: Headless component primitives.
*   **shadcn/ui**: Pre-styled component library built on Radix UI.

### Development Tools

*   **Replit Integration Plugins**: For error modals, code navigation, and dev banners in non-production environments.

### Session Management

*   **express-session**: Server-side session management.

### Form Handling

*   **React Hook Form**: Frontend form state management.
*   **Zod**: Schema validation for runtime checks and form inputs.