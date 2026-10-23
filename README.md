# Pickup Counter

A full-stack, self-service snack counter. Customers pick items from a virtual shelf, pay via a simulated UPI webhook, and collect their order from a locker.

It is built to survive the realities of production: concurrent users fighting for the last item, payment providers sending duplicate webhooks, and clients with badly wrong system clocks.

## Stack

- **Backend:** NestJS, TypeORM (query builders only, no raw SQL strings built from user input), PostgreSQL
- **Frontend:** React (Vite), Tailwind CSS, React Three Fiber (3D product shelf)
- **Testing:** Jest + Supertest against a **real** PostgreSQL database (no mocks)

---

## Running the app

Choose **Option A (Docker)** for a one-command start, or **Option B (local)** if you don't use Docker.

### Option A: Docker (one command)

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### Option B: Local setup (no Docker)

You need a local PostgreSQL server (a local install or pgAdmin is fine).

**1. Create the role and databases**

```sql
CREATE ROLE counter WITH LOGIN PASSWORD 'counter';
CREATE DATABASE counter OWNER counter;
CREATE DATABASE counter_test OWNER counter;
```

**2. Start the backend**

```bash
cd backend
cp .env.example .env
npm install
npm run migration:run
npm run seed
npm run dev
```

The backend runs on http://localhost:3000.

**3. Start the frontend**

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on http://localhost:5173.

---

## How to simulate a payment

No real UPI provider is connected. The backend exposes a webhook endpoint, `POST /payments/webhook`, which requires an HMAC-SHA256 signature.

1. Select items in the UI and click **Place order**.
2. The payment screen appears with a 120-second countdown. Note the `orderId` and `totalPaise` (for example `8000` for ₹80.00).
3. In a terminal, send a correctly signed webhook:

   ```bash
   cd backend
   npm run send-webhook -- <orderId> <totalPaise>
   ```

4. Within about 1.5 seconds the frontend detects the payment, turns green and shows a **Simulate locker pickup** button.

The script signs the request with `WEBHOOK_SECRET`, which must match the value the backend is running with. A mismatch returns `400 invalid_signature`.

---

## Running the automated tests

The tests run against a real PostgreSQL database to prove that the locks and constraints actually work. **They TRUNCATE tables between runs, so only point them at a throwaway database.**

**Docker** (starts an isolated test database):

```bash
docker compose --profile test run --rm backend-test
```

**Local:**

```bash
cd backend

# Windows (PowerShell)
$env:TEST_DATABASE_URL = "postgres://counter:counter@localhost:5432/counter_test"

# macOS / Linux
export TEST_DATABASE_URL="postgres://counter:counter@localhost:5432/counter_test"

npm run test:e2e
```

The suite covers three hard scenarios:

1. **The last two units:** ten customers order at the same instant. Exactly two succeed and eight fail cleanly with `409`.
2. **Webhook idempotency:** the same payment event (same `eventId`) is sent twice. The order is marked paid exactly once and the duplicate is ignored.
3. **Locker race:** two lockers claim the same pickup at the same moment. Exactly one succeeds and the other gets `409 Conflict`.

---

## Architecture and key decisions

### 1. Late payment policy

**Scenario:** a customer places an order, the 120-second hold expires, and their UPI payment clears minutes later.

**Decision:** if a valid `captured` webhook arrives after the hold has expired:

- **Stock still available:** re-reserve the stock, extend the hold and mark the order `paid`.
- **Stock sold out:** mark the order `needs_review`.

**Why:** a captured UPI payment cannot be undone from our side. Fulfilling the order, when possible, is the best outcome for everyone. When it isn't possible, we must not silently drop the webhook, or the customer is charged with no order and no record. `needs_review` puts it in front of a human attendant who can issue a refund.

### 2. Concurrency and stock integrity

Stock must never go negative or be sold twice.

- **Availability is derived:** physical stock minus the quantities held by live orders (unexpired `pending` orders and `paid` orders not yet collected).
- **Order creation** runs in a transaction and locks the product rows with `SELECT ... FOR UPDATE` in sorted ID order to avoid deadlocks. It recomputes held quantities under the lock, so concurrent orders cannot overbook.
- **Pickup claim** locks the order row and inserts into `pickup_claims`, which has a unique key on `order_id`. If two lockers race, the database rejects the second insert, so exactly-once is enforced by the schema and not only by application code. Stock is decremented only after the claim succeeds.

### 3. Clock skew (the countdown)

The customer's browser clock may be off by minutes, so the UI never trusts the absolute local time.

- The backend returns `serverNow` with every order response.
- The frontend stores the offset between its clock and the server's.
- The countdown is computed as `expiresAt - (clientNow + offset)`.

### 4. Idempotency

Webhooks are guarded by a `webhook_events` table whose primary key is `event_id`, inserted with `ON CONFLICT DO NOTHING`. If the provider sends the same event many times, only the first one changes the order.

---

## Security notes (OWASP)

- **A01, Access control:** state-changing endpoints require the order to be in the correct state (for example, pickup requires a paid, unclaimed order).
- **A02, Cryptography:** webhook signatures use HMAC-SHA256 verified with `crypto.timingSafeEqual`. The app refuses to boot in production with a default secret.
- **A03, Injection:** TypeORM query builders and parameterised migrations only. User input is never interpolated into SQL.
- **A05, Misconfiguration:** Helmet for standard security headers, strict CORS, and a `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` to prevent mass assignment.
- **A08, Integrity:** the webhook idempotency table and database constraints such as `CHECK (stock_units >= 0)`.

---

