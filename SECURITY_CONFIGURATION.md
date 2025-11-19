# Security Configuration Guide

## 🔒 Critical Security Requirements

This document outlines the security configurations implemented in the application and required for production deployment.

---

## 1. CORS Configuration

### Overview
Cross-Origin Resource Sharing (CORS) has been configured to restrict which domains can access the API.

### Implementation Location
- **File**: `server/index.ts`
- **Configuration**: Dynamic CORS policy based on environment

### Allowed Origins

#### Development Environment
- `http://localhost:5000` - Local development server
- `http://localhost:5173` - Vite dev server
- `*.replit.dev` - All Replit preview domains
- `*.repl.co` - All Replit production domains

#### Production Environment
- `http://localhost:5000` - Always allowed for local testing
- **Custom Domain**: Set via `PRODUCTION_DOMAIN` environment variable

### Production Setup

1. **Set the production domain** in environment variables:
   ```bash
   PRODUCTION_DOMAIN=https://yourdomain.com
   ```

2. **Verify CORS is working** by checking browser console for CORS errors when accessing from unauthorized domains.

### CORS Headers Configured
- **Allowed Methods**: GET, POST, PUT, PATCH, DELETE, OPTIONS
- **Allowed Headers**: Content-Type, Authorization, X-Token, x-token
- **Credentials**: Enabled (required for session cookies)

### Testing CORS
```bash
# Test from allowed origin
curl -H "Origin: http://localhost:5000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-Token" \
     -X OPTIONS \
     https://your-api.com/api/webhook/pushinpay

# Should return appropriate CORS headers
```

---

## 2. Rate Limiting

### Overview
Rate limiting has been implemented to prevent abuse and brute force attacks.

### Implementation
- **Package**: `express-rate-limit`
- **File**: `server/routes.ts`

### Rate Limits by Endpoint

| Endpoint Pattern | Limit | Window | Purpose |
|-----------------|-------|---------|----------|
| `/api/auth/*` (general) | 5 requests | 15 minutes | Prevent brute force login attempts |
| `/api/auth/admin/login` | 3 requests | 15 minutes | Stricter limit for admin access |
| `/api/payments/*` | 10 requests | 1 minute | Prevent payment spam |
| `/api/webhook/pushinpay` | 100 requests | 1 minute | Allow legitimate webhook traffic |

### Rate Limit Headers
Each response includes rate limit information:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining in current window
- `RateLimit-Reset`: Time when the limit resets

### Error Response
When rate limit is exceeded:
```json
{
  "error": "Muitas tentativas. Por favor, tente novamente em X minutos."
}
```

---

## 3. Webhook Authentication

### Overview
Webhook endpoints require mandatory authentication via X-Token header.

### Security Requirements

#### Environment Variable (MANDATORY)
```bash
# Generate a secure webhook secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set in environment
PUSHINPAY_WEBHOOK_SECRET=your-generated-secret-here
```

⚠️ **CRITICAL**: The application will **NOT start in production** without this secret configured!

### Authentication Methods
The webhook accepts authentication via any of these headers:
- `X-Token: your-secret`
- `x-token: your-secret`
- `Authorization: Bearer your-secret`
- `Authorization: your-secret`

### Security Behavior

#### If Secret Not Configured
- **Development**: Warning logged, webhook returns 403 for all requests
- **Production**: Application refuses to start (fail fast)

#### If Authentication Fails
- Returns `403 Forbidden`
- Logs security violation
- Request is immediately rejected

### PushinPay Webhook Configuration
Configure the webhook in PushinPay dashboard:
1. Set webhook URL: `https://yourdomain.com/api/webhook/pushinpay`
2. Add authentication header: `X-Token: your-secret-value`
3. Test webhook to ensure authentication works

---

## 4. Session Security

### Configuration
- **Secret**: Set via `SESSION_SECRET` environment variable
- **Cookie Settings**:
  - `httpOnly`: true (prevents JavaScript access)
  - `secure`: true in production (HTTPS only)
  - `sameSite`: 'lax' (CSRF protection)
  - `maxAge`: 7 days

### Production Requirements
```bash
# Generate a secure session secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Set in environment
SESSION_SECRET=your-generated-session-secret
```

---

## 5. Additional Security Features

### Password Hashing
- **Algorithm**: bcrypt with 10 rounds
- **Implementation**: All passwords hashed before storage

### SQL Injection Prevention
- **Method**: Parameterized queries via Drizzle ORM
- **Validation**: Zod schemas for input validation

### XSS Protection
- **React**: Automatic escaping of user content
- **API**: JSON responses only (no HTML rendering)

---

## 6. Production Deployment Checklist

### Required Environment Variables
```bash
# Critical Security Variables
PUSHINPAY_WEBHOOK_SECRET=<secure-random-32-bytes>  # MANDATORY
SESSION_SECRET=<secure-random-64-bytes>            # MANDATORY
NODE_ENV=production                                # MANDATORY

# CORS Configuration
PRODUCTION_DOMAIN=https://yourdomain.com          # Your production domain

# Database
DATABASE_URL=<your-database-url>                  # PostgreSQL connection

# Email (if using)
RESEND_API_KEY=<your-resend-api-key>             # For email notifications

# Payment Gateway
USE_PUSHINPAY_DEMO=false                         # Use real payments in production
```

### Security Verification Steps

1. **Test Webhook Authentication**:
   ```bash
   # Should return 403 without proper header
   curl -X POST https://yourdomain.com/api/webhook/pushinpay \
        -H "Content-Type: application/json" \
        -d '{"test": true}'
   
   # Should succeed with proper header
   curl -X POST https://yourdomain.com/api/webhook/pushinpay \
        -H "Content-Type: application/json" \
        -H "X-Token: your-secret" \
        -d '{"test": true}'
   ```

2. **Test Rate Limiting**:
   ```bash
   # Try multiple login attempts
   for i in {1..6}; do
     curl -X POST https://yourdomain.com/api/auth/login \
          -H "Content-Type: application/json" \
          -d '{"email":"test@test.com","password":"test"}'
   done
   # Should get rate limit error on 6th attempt
   ```

3. **Test CORS**:
   - Open browser console
   - Try to access API from unauthorized domain
   - Should see CORS error

4. **Verify HTTPS**:
   - Ensure production uses HTTPS only
   - Check that secure cookies are set

---

## 7. Security Monitoring

### Recommended Logging
Monitor these security events:
- Failed webhook authentications
- Rate limit violations
- Failed login attempts
- CORS violations

### Security Headers to Add (Optional)
Consider adding these headers in production:
```javascript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

---

## 8. Emergency Response

### If Webhook Secret is Compromised
1. Generate new secret immediately
2. Update environment variable
3. Update PushinPay configuration
4. Restart application
5. Monitor logs for unauthorized attempts

### If Under Attack
1. Temporarily reduce rate limits
2. Block suspicious IPs at firewall level
3. Enable additional logging
4. Consider implementing IP allowlisting for webhooks

---

## Support

For security issues or questions:
- Review application logs for security warnings
- Check rate limit headers in API responses
- Verify environment variables are properly set
- Test authentication with curl commands above

Remember: **Security is not optional in production!**