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

**PostgreSQL** via `@neondatabase/serverless` is the primary database, managed by **Drizzle ORM**. The schema includes `Users` (id, email, password, status, ultimoPagamento, isAdmin), `Credentials` (id, userId, month, data - JSON with `ChaveAPI` filtered from client view), and `Payments` (id, userId, amount, status, txid, createdAt). Drizzle Kit is used for schema migrations.

### Authorization

A **role-based access** model is implemented, differentiating between client users (access to own data) and admin users (full system access). `requireAuth` and `requireAdmin` middleware protect routes, with frontend guards checking authentication status.

### Payment Integration

The system supports a **monthly subscription of R$ 17,50**. It integrates with the **PushinPay API** for PIX payment generation. The flow involves client initiation, backend generation of a unique TXID, API call to PushinPay, storage of payment in cents, and return of QR code data. A demo mode fallback is available for testing. Webhook handling is security-hardened with X-Token validation, TXID validation, and idempotency checks. Successful payments update user status to "ATIVO" and set `ultimoPagamento`.

### Email Notification System

**Resend** is used for automated payment reminders and account status notifications. Email templates include "Payment due tomorrow," "Payment due today," and "Access blocked," all branded and with WhatsApp contact. A `users.nextPaymentDate` field tracks payment due dates. Cron jobs (scheduled for Day 4, 5, and 6 relative to `nextPaymentDate` in America/Sao_Paulo timezone) trigger these notifications and block overdue users. Admin testing endpoints are available for emails and cron jobs. The system is designed for graceful degradation if `RESEND_API_KEY` is not configured or if cron jobs fail.

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