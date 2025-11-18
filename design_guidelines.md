# Design Guidelines: Credential Management & Payment System

## Design Approach

**Selected System:** Material Design with Fluent Design influences  
**Rationale:** This is a utility-focused, data-dense dashboard application requiring clear information hierarchy, efficient workflows, and standard patterns for authentication, tables, and forms.

**Core Principles:**
- Clarity and efficiency over visual flourish
- Consistent, predictable patterns for both client and admin interfaces
- Clear status indicators for payment states
- Scannable data presentation

---

## Typography System

**Font Stack:** 'Inter' or 'Roboto' from Google Fonts CDN

**Hierarchy:**
- Page Titles: 2.5rem (text-4xl), font-semibold
- Section Headers: 1.875rem (text-3xl), font-semibold
- Card/Panel Headers: 1.25rem (text-xl), font-medium
- Body Text: 1rem (text-base), font-normal
- Supporting Text/Labels: 0.875rem (text-sm), font-medium
- Captions/Metadata: 0.75rem (text-xs), font-normal

---

## Layout & Spacing System

**Tailwind Units:** Standardize on 2, 4, 6, 8, 12, 16 for consistency
- Component padding: p-6 or p-8
- Section spacing: space-y-6 or space-y-8
- Card gaps: gap-4 or gap-6
- Form field spacing: space-y-4

**Container Strategy:**
- Max width for content areas: max-w-7xl
- Form containers: max-w-md centered
- Admin tables: Full width with horizontal scroll on mobile

---

## Authentication Pages

### Login Pages (Client & Admin)

**Layout:**
- Centered card design on minimal background
- Form container: max-w-md, p-8, rounded-lg with subtle shadow
- Logo/heading at top, centered
- Input fields with clear labels above each field
- Full-width submit button
- "Forgot password" link below button (client only)
- No decorative elements - focus on functionality

**Form Structure:**
- Label + input pairs with space-y-2
- Input height: h-12
- Border radius: rounded-md
- Input focus states with ring utility

---

## Client Dashboard

### Layout Structure

**Two-Column Split (Desktop):**
- Sidebar (left): w-64, fixed positioning, full height
  - User profile section at top
  - Navigation menu items
  - Payment status indicator
  - Logout button at bottom
- Main Content: Remaining space, p-8

**Mobile:** Stack vertically, collapsible sidebar with hamburger menu

### Dashboard Components

**Credentials Display Card:**
- Full-width card with p-6
- Header showing current month/period
- Table or definition list format:
  - Label column (font-medium, text-sm)
  - Value column (font-mono for credentials)
- Copy buttons next to each credential (icon-only, small)
- Hidden state when payment inactive shows locked icon with message

**Payment Status Banner:**
- Prominent alert-style component
- Shows: Status, Last payment date, Next due date
- Action button "Pagar via PIX" when overdue
- Icons: Heroicons CDN

**Payment Calendar:**
- Grid layout: 3-4 columns on desktop
- Each month as card showing:
  - Month/year header
  - Payment status badge
  - Payment date if completed
  - Amount
- Status badges use consistent styling (paid, pending, overdue)

---

## Payment Flow

### PIX Payment Page

**Layout:**
- Centered content, max-w-2xl
- QR Code display: Large, centered in card
- PIX code text: Monospace font, with copy button
- Payment amount prominently displayed
- Instructions text: Clear, numbered steps
- "Waiting for payment..." status indicator
- Return to dashboard button

---

## Admin Dashboard

### Top Navigation Bar
- Full-width, fixed, h-16
- Logo/title left
- Admin name and logout right
- Shadow for depth

### Main Layout

**Sidebar Navigation:**
- Fixed left sidebar, w-56
- Menu items with icons (Heroicons)
- Active state indication
- Sections: Users, Credentials, Payments, Settings

**Content Area:**
- Breadcrumb navigation at top
- Page title with action buttons (e.g., "+ Add User")
- Content in cards/panels with proper spacing

### Data Tables

**User Management Table:**
- Responsive table with horizontal scroll
- Columns: Name, Email, Status Badge, Last Payment, Actions
- Row height: Comfortable spacing (h-14)
- Action buttons: Icon-only (edit, delete) in final column
- Alternating row treatment for scannability
- Pagination controls if >20 records

**Payment Monitor Table:**
- Columns: User, Date, Amount, Status, TxID, Actions
- Status column with distinct badges
- Filter controls above table
- Export/download option

### Forms (User Creation/Editing)

**Layout:**
- Modal overlay OR dedicated page with max-w-2xl
- Two-column grid on desktop for related fields
- Required field indicators
- Field grouping with section headers
- Cancel + Save buttons, right-aligned

---

## Component Library

### Buttons
- Primary: h-10 or h-11, px-6, rounded-md, font-medium
- Secondary: Same dimensions, outlined style
- Danger: Used for delete actions
- Icon buttons: Square aspect ratio, p-2

### Cards/Panels
- rounded-lg, shadow-sm
- Padding: p-6 standard, p-8 for major sections
- Header with bottom border (border-b)

### Badges
- Small, pill-shaped elements (rounded-full)
- Sizes: px-3 py-1 for status, px-2 py-0.5 for counts
- Used for: Payment status, user status, notification counts

### Form Inputs
- Text inputs: h-11, px-4, rounded-md, border
- Textareas: min-h-32, p-4
- Selects: Match text input height
- Checkboxes/radios: Larger touch targets (w-5 h-5)

### Status Indicators
- Payment Status: Badge with icon
- Loading States: Spinner with text
- Empty States: Icon + message + action

---

## Mobile Responsiveness

**Breakpoint Strategy:**
- Mobile-first approach
- Key breakpoints: md (768px), lg (1024px)
- Tables convert to stacked cards on mobile
- Sidebar becomes drawer/overlay
- Two-column forms become single column
- Touch-friendly targets: Minimum 44x44px

---

## Accessibility

**Focus Management:**
- Visible focus rings on all interactive elements
- Logical tab order through forms and dashboards
- Skip to content link for screen readers

**Form Labels:**
- Every input has associated label (for attribute)
- Placeholder text for additional context only
- Error messages linked via aria-describedby

**ARIA Labels:**
- Icon-only buttons include aria-label
- Status badges include sr-only descriptive text
- Table headers properly marked

---

## Animations

**Minimal, Purposeful Only:**
- Sidebar slide in/out: 200ms ease
- Modal fade in: 150ms
- Loading spinners: Consistent rotation
- NO scroll animations, parallax, or decorative motion
- Button hover: Subtle opacity shift only