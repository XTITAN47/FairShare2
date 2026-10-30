# FairShare2 Copilot Implementation Roadmap

This roadmap provides safe, test-driven instructions designed to be executed prompt-by-prompt with GitHub Copilot (or Copilot Chat). Each phase is divided into self-contained tasks with explicit unit and manual regression tests to prevent breakage.

---

## Root Cause Analysis: Auth Latency (Login & Registration)

Before refactoring features, address the root causes of registration and login delays:

1. **`bcryptjs` Event Loop Freezes:** 
   - `bcryptjs` is written in 100% interpreted JavaScript. On default salt work factors (10–12 rounds), calculating a hash blocks the Node.js single-threaded event loop for 200–500ms per request. Under concurrent requests, latency compounds significantly.
   - *Fix:* Replace `bcryptjs` with native `bcrypt` (C++ bindings running in thread pools via libuv), or calibrate salt rounds to `10`.
2. **Missing Unique Database Index on MongoDB `email`:**
   - If the `User` schema queries email via regex or unindexed scanning before password comparison, collection scans degrade lookup times.
   - *Fix:* Ensure `{ unique: true, index: true }` is enforced directly at the schema layer and synced with MongoDB.
3. **Overfetching on User Population:**
   - Registration or login routes frequently populate associated arrays (e.g., `groups`, profile avatars) eagerly.
   - *Fix:* Return only token and basic user identity (`id`, `name`, `email`) on auth endpoints; defer heavy profile data fetching.
4. **Vite / Local Server Host Redirection Delay:**
   - Running Vite and Express over LAN with unresolved IP timeouts (`showLocalIp.js` / DNS resolution) can add 1–2s connection timeouts if endpoints fall back to localhost vs. 127.0.0.1.

---

## Execution Overview

```
Phase 0: Auth Performance & Core Stability (Quick Wins)
   └── Bcrypt optimization + Mongo Indexing + Token payload pruning
Phase 1: Safe Architecture & UI Clean Up
   └── CSS Consolidation + Layout / Component decomposition
Phase 2: Data Integrity & Safe Ledger Updates
   └── Mongoose Transactions + Concurrency guards
Phase 3: High-Value Features
   └── UPI Deep Links + Multi-currency + Receipt OCR
```

---

## Phase 0: Auth Performance & Latency Remediation

### Task 0.1: Optimize Password Hashing & Schema Indexes
- **Files Modified:** `server/package.json`, `server/models/User.js`, `server/controllers/userController.js`
- **Objective:** Eliminate event-loop stalls during password hashing and email lookups.

#### Step-by-Step Instructions
1. Replace `bcryptjs` with `bcrypt` in `server/package.json`.
2. In `server/models/User.js`, ensure the `email` field is indexed:
   ```javascript
   email: {
     type: String,
     required: true,
     unique: true,
     trim: true,
     lowercase: true,
     index: true
   }
   ```
3. Set salt rounds strictly to `10` (recommended balance between security and <100ms execution).
4. In `server/controllers/userController.js`, ensure email lookup uses `.lean()` or `.select('+password')` without loading nested collections.

#### Copilot Prompt
```text
In server/models/User.js and server/controllers/userController.js:
1. Replace bcryptjs with bcrypt using asynchronous methods (bcrypt.hash and bcrypt.compare with 10 rounds).
2. Ensure the email schema field has lowercase: true, index: true, and unique: true.
3. In login and register controllers, prevent overfetching: only retrieve the fields needed for authentication, and do not populate groups or history during login. Return only { _id, name, email, token }.
4. Ensure all database queries use lean() where applicable for read operations.
```

#### Verification & Functionality Testing
- **Command:** `cd server && npm install && npm test`
- **Postman/cURL Benchmark:**
  ```bash
  time curl -X POST http://localhost:5000/api/users/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"yourpassword"}'
  ```
- **Acceptance Criteria:** Auth API response time drops below 150ms on local test environments.

---

## Phase 1: UI Modernization & Component Refactoring

### Task 1.1: CSS Sprawl Consolidation
- **Files Modified:** `client/src/index.css`, `client/src/components/layout/ButtonFixes.css`, `client/src/components/layout/ButtonFixes2.css`, `client/src/components/groups/AlertStyles.css`
- **Objective:** Eliminate patch CSS files (`ButtonFixes.css`, `ButtonFixes2.css`) and centralize CSS custom properties (tokens) without breaking component layouts.

#### Step-by-Step Instructions
1. Extract duplicate button and modal overrides from `ButtonFixes.css` and `ButtonFixes2.css` into centralized CSS classes inside `client/src/index.css`.
2. Define standard CSS variables:
   ```css
   :root {
     --color-primary: #4f46e5;
     --color-primary-hover: #4338ca;
     --color-bg-base: #f9fafb;
     --color-surface: #ffffff;
     --color-border: #e5e7eb;
     --radius-sm: 6px;
     --radius-md: 10px;
   }
   ```
3. Remove redundant imports of `ButtonFixes*.css` from `App.jsx` and component headers.

#### Copilot Prompt
```text
Review client/src/components/layout/ButtonFixes.css, ButtonFixes2.css, and client/src/index.css:
1. Consolidate all overrides in ButtonFixes.css and ButtonFixes2.css into client/src/index.css using clean, semantic CSS variables for buttons and container states.
2. Ensure all existing class names remain backward-compatible to avoid UI regression.
3. Provide instructions to safely remove the references to ButtonFixes files across client/src/App.jsx.
```

#### Verification & Functionality Testing
- **Visual Regression Check:**
  - Launch client: `cd client && npm run dev`
  - Navigate to Dashboard, Group View, and Add Expense modal.
  - Verify buttons, alignments, and alert popups maintain consistent padding, borders, and hover effects.

---

### Task 1.2: Deconstruct Monolithic `GroupDetail.jsx`
- **Files Modified:** `client/src/components/groups/GroupDetail.jsx`, `client/src/components/groups/subcomponents/`
- **Objective:** Break down the monolithic `GroupDetail.jsx` into smaller, reusable presentational components.

```
client/src/components/groups/
├── GroupDetail.jsx             (Container & state orchestrator)
└── components/
    ├── GroupHeader.jsx         (Title, group metadata, actions)
    ├── MemberList.jsx          (Members list, invite trigger, QR modal)
    ├── ExpenseList.jsx         (Historical transaction log)
    └── SettlementSummary.jsx   (Debts summary and settle triggers)
```

#### Copilot Prompt
```text
Refactor client/src/components/groups/GroupDetail.jsx:
1. Extract the expense listing block into a dedicated child component client/src/components/groups/components/ExpenseList.jsx.
2. Extract the member roster and invite logic into client/src/components/groups/components/MemberList.jsx.
3. Keep the state management (activeGroup, loading, balances) inside GroupDetail.jsx and pass data/callbacks as props.
4. Do not alter existing prop signatures or variable names to maintain functionality.
```

#### Verification & Functionality Testing
- Open an existing group with test transactions.
- Verify:
  - Members render with payment badges.
  - Expense items expand and trigger detail dialogs.
  - Settlements reflect simplified debt calculations.

---

## Phase 2: Ledger Concurrency & Backend Integrity

### Task 2.1: Atomic Balance Updates via MongoDB Sessions
- **Files Modified:** `server/controllers/expenseController.js`
- **Objective:** Prevent race conditions where simultaneous expense additions leave group balance maps in an inconsistent state.

#### Step-by-Step Instructions
1. Import `mongoose` inside `server/controllers/expenseController.js`.
2. Wrap expense insertion and group balance adjustment in a managed transaction:
   ```javascript
   const session = await mongoose.startSession();
   session.startTransaction();
   try {
     const newExpense = await Expense.create([expenseData], { session });
     await Group.findByIdAndUpdate(
       groupId,
       { $push: { expenses: newExpense[0]._id } },
       { session }
     );
     await session.commitTransaction();
   } catch (error) {
     await session.abortTransaction();
     throw error;
   } finally {
     session.endSession();
   }
   ```

#### Copilot Prompt
```text
In server/controllers/expenseController.js:
Wrap createExpense and deleteExpense operations in a MongoDB session transaction (session.withTransaction or manual session commit/abort).
Ensure that if updating the Group expenses array or recalculating debt matrices fails, the created Expense document is rolled back automatically.
```

#### Verification & Functionality Testing
- Trigger an intentional failure (e.g., provide an invalid Group ID with valid expense data) and verify no orphan `Expense` document persists in the database.

---

## Phase 3: High-Impact Feature Enhancements

### Task 3.1: Direct UPI Deep Links for Settlements
- **Files Modified:** `client/src/components/layout/QRCodeModal.jsx`, `client/src/components/expenses/SettlementPlan.jsx`
- **Objective:** Allow one-click settlements on mobile devices via native UPI intent handles (`upi://pay`).

#### Step-by-Step Instructions
1. In `QRCodeModal.jsx`, parse the payee's UPI ID, user name, and settlement amount.
2. Generate the formatted deep link URI:
   ```javascript
   const upiDeepLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR`;
   ```
3. Add a responsive "Pay Now via UPI App" button visible primarily on mobile viewports (`window.innerWidth < 768` or media query).

#### Copilot Prompt
```text
In client/src/components/layout/QRCodeModal.jsx:
1. Construct a standardized UPI Intent URL using the receiver's UPI ID, receiver name, and current debt amount.
2. Render a "Pay via UPI App" primary button underneath the QR code that opens this URL on mobile devices.
3. Include a fallback "Copy UPI ID" action with visual confirmation toast when clicked.
```

#### Verification & Functionality Testing
- Click "Settle Up" in a test group on a mobile view or mobile emulation mode.
- Click "Pay via UPI App" and confirm the system attempts to open native handlers (`upi://`).

---

### Task 3.2: Export to CSV / PDF Summary
- **Files Modified:** `client/src/components/groups/GroupDetail.jsx`, `client/package.json`
- **Objective:** Add single-click ledger export for expense auditing.

#### Step-by-Step Instructions
1. Install a client-side CSV parser/utility: `npm install papaparse` in `client/`.
2. Add an "Export CSV" trigger to the group action menu.
3. Format expense items: `[Date, Description, PaidBy, SplitType, Amount, Category]`.

#### Copilot Prompt
```text
In client/src/components/groups/GroupDetail.jsx:
1. Implement a handleExportCSV function that formats the group's expenses array into CSV columns: Date, Description, Payer, Total Amount, and My Share.
2. Trigger an automatic browser download of the generated file as `fairshare-${groupName}-${date}.csv`.
```

#### Verification & Functionality Testing
- Export a test group with 5+ expenses.
- Open the resulting `.csv` file in Excel or Google Sheets to verify numeric formatting and column alignments.

---

## Final Regression Testing Checklist

Before deploying changes to production or merging to `main`:

| Area | Check | Expected Result |
| :--- | :--- | :--- |
| **Authentication** | Registration of new user | Instant response (<200ms), proper JWT issued |
| **Authentication** | Login with valid credentials | Redirects to dashboard immediately without lag |
| **Expense Creation** | Equal split among 3+ members | Balances recalculate accurately |
| **Expense Creation** | Unequal split with decimal amounts | Math balances correctly without floating-point errors |
| **Debt Simplification**| Multi-party settlement graph | Correct minimum transactions generated |
| **Mobile UX** | Open QR Code modal on mobile viewport | Shows UPI link and QR code cleanly |
| **Exports** | Download group ledger CSV | Contains all expenses and correct headers |