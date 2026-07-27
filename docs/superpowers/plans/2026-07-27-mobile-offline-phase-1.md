# Offline-First Mobile App — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the existing Vue 3 frontend as a Capacitor Android app with a local SQLite store behind a repository seam, so every CRUD screen reads and writes on-device.

**Architecture:** A repository layer is inserted between the Pinia stores and their data. Two implementations exist — HTTP (today's axios calls, lifted verbatim) and SQLite — selected once at startup by `data/source.js`. Stores and pages never learn which is active. A three-backend database adapter (`node:sqlite` for tests, `@capacitor-community/sqlite` on device, jeep-sqlite for browser development) keeps the same SQL running everywhere.

**Tech Stack:** Vue 3, Pinia, Vite 6, Vitest 2, Capacitor 8, `@capacitor-community/sqlite`, `node:sqlite`, uuid v7.

**Spec:** `docs/superpowers/specs/2026-07-27-mobile-offline-phase-1-design.md`

## Global Constraints

- Node ≥ 22 required by Capacitor 8 (machine has 24.16). `node:sqlite` requires Node ≥ 22.5.
- Android Studio ≥ 2025.2.1; it bundles the JDK — do not install a separate one.
- Android `minSdkVersion 24`, `compileSdkVersion 36`, `targetSdkVersion 36`.
- appId `com.gabatino.whyamilikethis`, appName `Why Am I Like This`.
- Vitest runs with `globals: false` — every test file must `import { describe, it, expect } from 'vitest'`.
- Data-layer tests run under Node, not jsdom: put `// @vitest-environment node` on line 1 of those files.
- Dates in SQLite are `TEXT` as `YYYY-MM-DD`. Never construct a `Date` to bucket or compare them; use string comparison.
- Money columns are `REAL`, never integer cents — the API does float math then `Math.round(n*100)/100`, and local output must match it including rounding artifacts.
- `round2` is `(n) => Math.round(n * 100) / 100` and must be applied at exactly the same points the API applies it.
- **No backend file is modified in Phase 1.** If a task appears to require one, stop and raise it.
- Backend test suite must stay green; it is not touched.

## Prerequisites (human, before Task 1)

Install Android Studio ≥ 2025.2.1, then in its SDK Manager install the Android 36 SDK
platform and Platform-Tools. Either create an emulator (Device Manager → Pixel, API 36) or
enable USB debugging on a physical phone and connect it. Verify with:

```bash
adb devices
```

Expected: at least one device listed as `device` (not `unauthorized`).

## Scope note

Three small aggregations are ported in Phase 1 because their pages are empty without them:
**wallet balances** (`walletService.listWallets`), **savings rollups**
(`savingsService.listGoals`), and **debt paid/unpaid totals** (`debtService.listDebts`).
Only `statsService` — the dashboard and analytics endpoints — defers to Phase 2.

## File Structure

| File | Responsibility |
|------|----------------|
| `frontend/capacitor.config.ts` | Capacitor app id, name, webDir, plugin config |
| `frontend/src/data/db/types.js` | JSDoc contract for the adapter interface |
| `frontend/src/data/db/nodeDb.js` | `node:sqlite` adapter (tests) |
| `frontend/src/data/db/nativeDb.js` | `@capacitor-community/sqlite` adapter (device) |
| `frontend/src/data/db/webDb.js` | jeep-sqlite adapter (browser dev only) |
| `frontend/src/data/db/index.js` | Platform factory returning one adapter |
| `frontend/src/data/schema/migrations.js` | Ordered DDL migrations |
| `frontend/src/data/schema/migrate.js` | Runner keyed on `PRAGMA user_version` |
| `frontend/src/data/ids.js` | `newId()` — UUIDv7 |
| `frontend/src/data/mappers.js` | snake_case row ↔ camelCase domain object |
| `frontend/src/data/repos/http/*.js` | HTTP repositories (10 files) |
| `frontend/src/data/repos/sqlite/*.js` | SQLite repositories (10 files) |
| `frontend/src/data/source.js` | Holds the active repository set |
| `frontend/src/data/hydrate.js` | One-way pull from API into SQLite after login |
| `frontend/src/services/api.js` | Modified: env base URL, router redirect |
| `frontend/src/stores/*.js` | Modified: call `dataSource`, not `api` |

---

### Task 1: Capacitor scaffold and Android project

**Files:**
- Create: `frontend/capacitor.config.ts`
- Modify: `frontend/package.json`, `frontend/.gitignore`
- Generated: `frontend/android/`, `frontend/ios/`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run sync:android` — builds the web app and copies it into the Android project.

- [ ] **Step 1: Install Capacitor dependencies**

```bash
cd frontend && npm install @capacitor/core @capacitor/android @capacitor/ios && npm install -D @capacitor/cli
```

- [ ] **Step 2: Create the Capacitor config**

Create `frontend/capacitor.config.ts`:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gabatino.whyamilikethis',
  appName: 'Why Am I Like This',
  webDir: 'dist',
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
  },
};

export default config;
```

- [ ] **Step 3: Add the mobile build scripts**

In `frontend/package.json`, add to `"scripts"`:

```json
"build:mobile": "vite build --mode mobile",
"sync:android": "npm run build:mobile && cap sync android",
"open:android": "cap open android"
```

- [ ] **Step 4: Generate the native projects**

```bash
cd frontend && npm run build && npx cap add android && npx cap add ios
```

Expected: `android/` and `ios/` directories created. The `ios` step may warn that CocoaPods
is unavailable on Windows — that is expected and harmless; the project files are still written.

- [ ] **Step 5: Pin the Android SDK versions**

In `frontend/android/variables.gradle`, confirm or set:

```gradle
ext {
    minSdkVersion = 24
    compileSdkVersion = 36
    targetSdkVersion = 36
}
```

- [ ] **Step 6: Ignore native build output**

Append to `frontend/.gitignore`:

```
android/app/build/
android/build/
android/.gradle/
android/local.properties
android/app/src/main/assets/public/
ios/App/Pods/
ios/App/App/public/
```

- [ ] **Step 7: Build and install the debug APK**

```bash
cd frontend && npm run sync:android && cd android && ./gradlew assembleDebug && adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Expected: `BUILD SUCCESSFUL`, then `Success` from adb.

- [ ] **Step 8: Verify the app launches**

Open the app on the device. Expected: the login screen renders. Login will **not** work yet —
the app has no API base URL on device, which Task 2 fixes. Confirm no white screen and no
crash; that is the gate for this task.

- [ ] **Step 9: Commit**

```bash
git add frontend/capacitor.config.ts frontend/package.json frontend/package-lock.json frontend/.gitignore frontend/android frontend/ios
git commit -m "feat(mobile): add Capacitor with Android and iOS projects"
```

---

### Task 2: Native API base URL and WebView auth

**Files:**
- Modify: `frontend/src/services/api.js`
- Create: `frontend/.env.mobile`, `frontend/src/services/__tests__/api.test.js`
- Modify: `frontend/android/app/src/main/res/xml/network_security_config.xml`

**Interfaces:**
- Consumes: nothing.
- Produces: `resolveBaseUrl()` returning the API base for the current build.

This is the highest-risk task in Phase 1 (spec §1.2). The refresh token lives in an httpOnly
cookie; in a WebView the page origin is `https://localhost`, so that cookie is cross-origin
and may be dropped, breaking login entirely.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/services/__tests__/api.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { resolveBaseUrl } from '../api.js';

describe('resolveBaseUrl', () => {
  it('falls back to the proxy path when no env var is set', () => {
    expect(resolveBaseUrl(undefined)).toBe('/api');
  });

  it('uses the configured absolute URL when present', () => {
    expect(resolveBaseUrl('https://api.example.com')).toBe('https://api.example.com/api');
  });

  it('does not double up the /api suffix', () => {
    expect(resolveBaseUrl('https://api.example.com/api')).toBe('https://api.example.com/api');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/services/__tests__/api.test.js`
Expected: FAIL — `resolveBaseUrl is not a function`.

- [ ] **Step 3: Implement `resolveBaseUrl` and use it**

In `frontend/src/services/api.js`, replace the `axios.create` block:

```js
import axios from 'axios';
import { CapacitorHttp } from '@capacitor/core';

const TOKEN_KEY = 'et_token';

export function resolveBaseUrl(origin) {
  if (!origin) return '/api';
  return origin.endsWith('/api') ? origin : `${origin.replace(/\/$/, '')}/api`;
}

export const api = axios.create({
  baseURL: resolveBaseUrl(import.meta.env.VITE_API_ORIGIN),
  withCredentials: true,
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/services/__tests__/api.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Replace the hard redirect with a router navigation**

In `frontend/src/services/api.js`, the 401 handler currently calls `location.assign('/login')`
(line 47), which reloads the whole document — jarring inside a WebView. Replace the `catch`
block body with:

```js
      } catch {
        clearToken();
        const { router } = await import('../router/index.js');
        if (router.currentRoute.value.name !== 'login') router.push({ name: 'login' });
      }
```

The dynamic import avoids a circular dependency between `api.js` and the router.

- [ ] **Step 6: Point the mobile build at the API**

Create `frontend/.env.mobile` (replace the IP with the dev machine's LAN address):

```
VITE_API_ORIGIN=http://192.168.1.10:4000
```

- [ ] **Step 7: Allow cleartext to the dev server**

Create `frontend/android/app/src/main/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">192.168.1.10</domain>
    </domain-config>
</network-security-config>
```

Reference it from `android/app/src/main/AndroidManifest.xml` on the `<application>` tag:

```xml
android:networkSecurityConfig="@xml/network_security_config"
```

This permits plain HTTP to the dev machine only. Production uses HTTPS and needs neither.

- [ ] **Step 8: Enable native HTTP so cookies bypass WebView rules**

In `frontend/capacitor.config.ts`, add to the config object:

```ts
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
```

`CapacitorHttp` patches `fetch`/`XMLHttpRequest` to run natively, so axios requests leave the
WebView's cookie jar and its third-party restrictions behind.

- [ ] **Step 9: Verify login works on device**

```bash
cd frontend && npm run sync:android && cd android && ./gradlew assembleDebug && adb install -r app/build/outputs/apk/debug/app-debug.apk
```

With the backend running (`cd backend && npm run dev`), log in on the device as
`demo@example.com` / `Password123!`.

Expected: the dashboard loads. **If login fails**, capture the failure before changing
anything: `adb logcat | grep -i "chromium\|capacitor"`. A dropped `Set-Cookie` here is the
trigger for the backend proposal named in spec §1.2 — stop and raise it rather than editing
the backend.

- [ ] **Step 10: Run the full frontend suite**

Run: `cd frontend && npm test`
Expected: all existing tests plus the 3 new ones pass.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/services/api.js frontend/src/services/__tests__/api.test.js frontend/.env.mobile frontend/capacitor.config.ts frontend/android
git commit -m "feat(mobile): env-driven API base URL and native HTTP for WebView auth"
```

---

### Task 3: Database adapter interface and the node:sqlite backend

**Files:**
- Create: `frontend/src/data/db/types.js`, `frontend/src/data/db/nodeDb.js`
- Test: `frontend/src/data/db/__tests__/conformance.js`, `frontend/src/data/db/__tests__/nodeDb.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: an adapter object `{ exec(sql), query(sql, params) -> rows, run(sql, params) -> { changes }, transaction(fn), close() }`. **Every method is async**, because the native plugin is promise-based even though `node:sqlite` is synchronous. `createNodeDatabase(filename = ':memory:')` returns one.
- Produces: `runAdapterConformance(label, factory)` — a shared suite later reused by the native and web adapters.

- [ ] **Step 1: Write the conformance suite**

Create `frontend/src/data/db/__tests__/conformance.js`:

```js
import { describe, it, expect } from 'vitest';

// Shared contract every adapter must satisfy. `factory` returns a fresh adapter.
export function runAdapterConformance(label, factory) {
  describe(`${label} adapter`, () => {
    it('execs DDL and queries rows back', async () => {
      const db = await factory();
      await db.exec('CREATE TABLE t (id TEXT PRIMARY KEY, n REAL)');
      await db.run('INSERT INTO t (id, n) VALUES (?, ?)', ['a', 1.5]);
      expect(await db.query('SELECT * FROM t')).toEqual([{ id: 'a', n: 1.5 }]);
      await db.close();
    });

    it('reports the number of changed rows', async () => {
      const db = await factory();
      await db.exec('CREATE TABLE t (id TEXT PRIMARY KEY)');
      await db.run('INSERT INTO t (id) VALUES (?)', ['a']);
      const result = await db.run('DELETE FROM t WHERE id = ?', ['a']);
      expect(result.changes).toBe(1);
      await db.close();
    });

    it('rolls a failed transaction back', async () => {
      const db = await factory();
      await db.exec('CREATE TABLE t (id TEXT PRIMARY KEY)');
      await expect(
        db.transaction(async () => {
          await db.run('INSERT INTO t (id) VALUES (?)', ['a']);
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(await db.query('SELECT * FROM t')).toEqual([]);
      await db.close();
    });

    it('enforces foreign keys', async () => {
      const db = await factory();
      await db.exec('CREATE TABLE parent (id TEXT PRIMARY KEY)');
      await db.exec('CREATE TABLE child (id TEXT PRIMARY KEY, pid TEXT REFERENCES parent(id))');
      await expect(db.run('INSERT INTO child (id, pid) VALUES (?, ?)', ['c', 'missing'])).rejects.toThrow();
      await db.close();
    });
  });
}
```

- [ ] **Step 2: Write the node adapter test**

Create `frontend/src/data/db/__tests__/nodeDb.test.js`:

```js
// @vitest-environment node
import { createNodeDatabase } from '../nodeDb.js';
import { runAdapterConformance } from './conformance.js';

runAdapterConformance('node:sqlite', () => createNodeDatabase(':memory:'));
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/data/db/__tests__/nodeDb.test.js`
Expected: FAIL — cannot resolve `../nodeDb.js`.

- [ ] **Step 4: Implement the node adapter**

Create `frontend/src/data/db/nodeDb.js`:

```js
import { DatabaseSync } from 'node:sqlite';

// node:sqlite is synchronous; the interface is async because the native plugin is.
export async function createNodeDatabase(filename = ':memory:') {
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON');

  return {
    async exec(sql) {
      db.exec(sql);
    },
    async query(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
    async run(sql, params = []) {
      const result = db.prepare(sql).run(...params);
      return { changes: Number(result.changes) };
    },
    async transaction(fn) {
      db.exec('BEGIN');
      try {
        const out = await fn();
        db.exec('COMMIT');
        return out;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    async close() {
      db.close();
    },
  };
}
```

- [ ] **Step 5: Document the contract**

Create `frontend/src/data/db/types.js`:

```js
/**
 * @typedef {object} DbAdapter
 * @property {(sql: string) => Promise<void>} exec  Run DDL or multi-statement SQL.
 * @property {(sql: string, params?: unknown[]) => Promise<object[]>} query  Rows as plain objects.
 * @property {(sql: string, params?: unknown[]) => Promise<{changes: number}>} run  Single write.
 * @property {<T>(fn: () => Promise<T>) => Promise<T>} transaction  Commits, or rolls back on throw.
 * @property {() => Promise<void>} close
 */
export {};
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/data/db/__tests__/nodeDb.test.js`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/data/db
git commit -m "feat(data): database adapter contract and node:sqlite backend"
```

---

### Task 4: Native and web adapters, and the platform factory

**Files:**
- Create: `frontend/src/data/db/nativeDb.js`, `frontend/src/data/db/webDb.js`, `frontend/src/data/db/index.js`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: the adapter contract from Task 3.
- Produces: `createDatabase({ name })` → a `DbAdapter` chosen by platform.

- [ ] **Step 1: Install the SQLite plugin and the dev-only web driver**

```bash
cd frontend && npm install @capacitor-community/sqlite && npm install -D jeep-sqlite
```

`jeep-sqlite` is a devDependency on purpose — it is dynamically imported only in dev mode, so
it never enters the production web bundle.

- [ ] **Step 2: Implement the native adapter**

Create `frontend/src/data/db/nativeDb.js`:

```js
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

const sqlite = new SQLiteConnection(CapacitorSQLite);

export async function createNativeDatabase(name = 'whyamilikethis') {
  const db = await sqlite.createConnection(name, false, 'no-encryption', 1, false);
  await db.open();
  await db.execute('PRAGMA foreign_keys = ON');
  await db.execute('PRAGMA journal_mode = WAL');

  return {
    async exec(sql) {
      await db.execute(sql);
    },
    async query(sql, params = []) {
      const result = await db.query(sql, params);
      return result.values ?? [];
    },
    async run(sql, params = []) {
      const result = await db.run(sql, params);
      return { changes: result.changes?.changes ?? 0 };
    },
    async transaction(fn) {
      await db.execute('BEGIN');
      try {
        const out = await fn();
        await db.execute('COMMIT');
        return out;
      } catch (error) {
        await db.execute('ROLLBACK');
        throw error;
      }
    },
    async close() {
      await db.close();
      await sqlite.closeConnection(name, false);
    },
  };
}
```

- [ ] **Step 3: Implement the browser dev adapter**

Create `frontend/src/data/db/webDb.js`:

```js
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

const sqlite = new SQLiteConnection(CapacitorSQLite);

// Browser-only, dev-only. jeep-sqlite is a Stencil element wrapping sql.js that
// persists to IndexedDB; initWebStore() is mandatory before any other call.
export async function createWebDatabase(name = 'whyamilikethis') {
  const { defineCustomElements } = await import('jeep-sqlite/loader');
  defineCustomElements(window);

  if (!document.querySelector('jeep-sqlite')) {
    document.body.appendChild(document.createElement('jeep-sqlite'));
  }
  await customElements.whenDefined('jeep-sqlite');
  await sqlite.initWebStore();

  const db = await sqlite.createConnection(name, false, 'no-encryption', 1, false);
  await db.open();
  await db.execute('PRAGMA foreign_keys = ON');

  // sql.js is in-memory; every write must be flushed to IndexedDB explicitly.
  const save = () => sqlite.saveToStore(name);

  return {
    async exec(sql) {
      await db.execute(sql);
      await save();
    },
    async query(sql, params = []) {
      const result = await db.query(sql, params);
      return result.values ?? [];
    },
    async run(sql, params = []) {
      const result = await db.run(sql, params);
      await save();
      return { changes: result.changes?.changes ?? 0 };
    },
    async transaction(fn) {
      await db.execute('BEGIN');
      try {
        const out = await fn();
        await db.execute('COMMIT');
        await save();
        return out;
      } catch (error) {
        await db.execute('ROLLBACK');
        throw error;
      }
    },
    async close() {
      await save();
      await db.close();
      await sqlite.closeConnection(name, false);
    },
  };
}
```

- [ ] **Step 4: Implement the factory**

Create `frontend/src/data/db/index.js`:

```js
import { Capacitor } from '@capacitor/core';

export async function createDatabase(name = 'whyamilikethis') {
  if (Capacitor.isNativePlatform()) {
    const { createNativeDatabase } = await import('./nativeDb.js');
    return createNativeDatabase(name);
  }
  const { createWebDatabase } = await import('./webDb.js');
  return createWebDatabase(name);
}
```

Both imports are dynamic so neither driver is pulled into a bundle that will not use it.
`createNodeDatabase` is deliberately absent — tests import it directly.

- [ ] **Step 5: Verify the bundle still builds**

Run: `cd frontend && npm run build`
Expected: build succeeds. Confirm `jeep-sqlite` is only in a lazily-loaded chunk, not the
main entry.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/db frontend/package.json frontend/package-lock.json
git commit -m "feat(data): native and browser SQLite adapters behind a platform factory"
```

---

### Task 5: Local schema and migration runner

**Files:**
- Create: `frontend/src/data/schema/migrations.js`, `frontend/src/data/schema/migrate.js`
- Test: `frontend/src/data/schema/__tests__/migrate.test.js`

**Interfaces:**
- Consumes: `DbAdapter` from Task 3.
- Produces: `migrate(db)` — brings any database to the latest version, idempotently.
- Produces: `SCHEMA_VERSION` — the highest migration version number, currently `1`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/data/schema/__tests__/migrate.test.js`:

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createNodeDatabase } from '../../db/nodeDb.js';
import { migrate, SCHEMA_VERSION } from '../migrate.js';

const tableNames = (rows) => rows.map((r) => r.name).sort();

describe('migrate', () => {
  it('creates every domain table on a fresh database', async () => {
    const db = await createNodeDatabase(':memory:');
    await migrate(db);
    const rows = await db.query("SELECT name FROM sqlite_master WHERE type = 'table'");
    expect(tableNames(rows)).toEqual(
      [
        '_meta', 'budgets', 'categories', 'debts', 'expenses', 'incomes',
        'savings_contributions', 'savings_goals', 'transfers', 'users', 'wallets',
      ].sort(),
    );
    await db.close();
  });

  it('records the schema version', async () => {
    const db = await createNodeDatabase(':memory:');
    await migrate(db);
    const [{ user_version: version }] = await db.query('PRAGMA user_version');
    expect(version).toBe(SCHEMA_VERSION);
    await db.close();
  });

  it('is a no-op when run twice', async () => {
    const db = await createNodeDatabase(':memory:');
    await migrate(db);
    await expect(migrate(db)).resolves.not.toThrow();
    await db.close();
  });

  it('allows re-using a name after a soft delete', async () => {
    const db = await createNodeDatabase(':memory:');
    await migrate(db);
    const insert = (id, deletedAt) =>
      db.run(
        `INSERT INTO categories (id, user_id, name, color, created_at, updated_at, deleted_at)
         VALUES (?, 'u1', 'Food', '#fff', '2026-07-01T00:00:00Z', '2026-07-01T00:00:00Z', ?)`,
        [id, deletedAt],
      );
    await insert('c1', '2026-07-02T00:00:00Z');
    await expect(insert('c2', null)).resolves.toBeTruthy();
    await expect(insert('c3', null)).rejects.toThrow();
    await db.close();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/data/schema/__tests__/migrate.test.js`
Expected: FAIL — cannot resolve `../migrate.js`.

- [ ] **Step 3: Write the migrations**

Create `frontend/src/data/schema/migrations.js`:

```js
// Mirrors backend/prisma/schema.prisma. Four sync columns are present on every domain
// table; only updated_at is written in Phase 1 (see spec §4). Dates are TEXT YYYY-MM-DD;
// created_at/updated_at are full ISO instants. Money is REAL to match the API's float math.
const SYNC_COLUMNS = `
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  dirty INTEGER NOT NULL DEFAULT 0,
  synced_at TEXT
`;

const v1 = `
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar TEXT,
  created_at TEXT NOT NULL,
  ${SYNC_COLUMNS}
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ${SYNC_COLUMNS}
);
CREATE UNIQUE INDEX ux_categories_user_name ON categories(user_id, name) WHERE deleted_at IS NULL;
CREATE INDEX ix_categories_user ON categories(user_id);

CREATE TABLE wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  initial_balance REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  ${SYNC_COLUMNS}
);
CREATE UNIQUE INDEX ux_wallets_user_name ON wallets(user_id, name) WHERE deleted_at IS NULL;
CREATE INDEX ix_wallets_user ON wallets(user_id);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  wallet_id TEXT REFERENCES wallets(id),
  notes TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ${SYNC_COLUMNS}
);
CREATE INDEX ix_expenses_user_date ON expenses(user_id, date);

CREATE TABLE incomes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  amount REAL NOT NULL,
  wallet_id TEXT REFERENCES wallets(id),
  notes TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ${SYNC_COLUMNS}
);
CREATE INDEX ix_incomes_user_date ON incomes(user_id, date);

CREATE TABLE transfers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  from_wallet_id TEXT NOT NULL REFERENCES wallets(id),
  to_wallet_id TEXT NOT NULL REFERENCES wallets(id),
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  ${SYNC_COLUMNS}
);
CREATE INDEX ix_transfers_user_date ON transfers(user_id, date);

CREATE TABLE debts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  person TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  paid INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  ${SYNC_COLUMNS}
);
CREATE INDEX ix_debts_user_date ON debts(user_id, date);

CREATE TABLE savings_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  target REAL,
  created_at TEXT NOT NULL,
  ${SYNC_COLUMNS}
);
CREATE UNIQUE INDEX ux_savings_goals_user_name ON savings_goals(user_id, name) WHERE deleted_at IS NULL;
CREATE INDEX ix_savings_goals_user ON savings_goals(user_id);

CREATE TABLE savings_contributions (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  ${SYNC_COLUMNS}
);
CREATE INDEX ix_savings_contributions_goal_date ON savings_contributions(goal_id, date);

-- "limit" is a SQLite reserved word, so the column is limit_amount and the repo maps it.
CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT,
  limit_amount REAL NOT NULL,
  month TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ${SYNC_COLUMNS}
);
CREATE INDEX ix_budgets_user_month ON budgets(user_id, month);

CREATE TABLE _meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

export const migrations = [{ version: 1, up: v1 }];
```

- [ ] **Step 4: Write the runner**

Create `frontend/src/data/schema/migrate.js`:

```js
import { migrations } from './migrations.js';

export const SCHEMA_VERSION = migrations[migrations.length - 1].version;

export async function migrate(db) {
  const [row] = await db.query('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (const migration of migrations.filter((m) => m.version > current)) {
    await db.transaction(async () => {
      await db.exec(migration.up);
      // PRAGMA cannot be parameterised; the value is a controlled integer from this module.
      await db.exec(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/data/schema/__tests__/migrate.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/schema
git commit -m "feat(data): local SQLite schema and migration runner"
```

---

### Task 6: ID generation and row mappers

**Files:**
- Create: `frontend/src/data/ids.js`, `frontend/src/data/mappers.js`, `frontend/src/data/errors.js`
- Test: `frontend/src/data/__tests__/mappers.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `newId()` → UUIDv7 string; `nowIso()` → ISO instant; `round2(n)`.
- Produces: `toCategory`, `toWallet`, `toExpense`, `toIncome`, `toTransfer`, `toDebt`, `toSavingsGoal`, `toContribution`, `toBudget` — each takes a snake_case SQLite row and returns the camelCase object the stores and pages already expect.
- Produces: `OfflineUnsupportedError`.

- [ ] **Step 1: Install uuid**

```bash
cd frontend && npm install uuid
```

Requires uuid ≥ 10, which is where the `v7` export was added.

- [ ] **Step 2: Write the failing test**

Create `frontend/src/data/__tests__/mappers.test.js`:

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { toExpense, toDebt, toBudget, toTransfer, round2 } from '../mappers.js';
import { newId } from '../ids.js';

describe('mappers', () => {
  it('nests the joined wallet on an expense', () => {
    expect(
      toExpense({
        id: 'e1', user_id: 'u1', title: 'Lunch', amount: 12.5, category: 'Food',
        wallet_id: 'w1', notes: null, date: '2026-07-15',
        created_at: '2026-07-15T02:00:00.000Z', updated_at: '2026-07-15T02:00:00.000Z',
        wallet_name: 'Cash', wallet_color: '#1baf7a',
      }),
    ).toEqual({
      id: 'e1', userId: 'u1', title: 'Lunch', amount: 12.5, category: 'Food',
      walletId: 'w1', notes: null, date: '2026-07-15',
      createdAt: '2026-07-15T02:00:00.000Z', updatedAt: '2026-07-15T02:00:00.000Z',
      wallet: { id: 'w1', name: 'Cash', color: '#1baf7a' },
    });
  });

  it('returns a null wallet when the expense has none', () => {
    const expense = toExpense({
      id: 'e2', user_id: 'u1', title: 'Bus', amount: 2, category: 'Transport',
      wallet_id: null, notes: null, date: '2026-07-15',
      created_at: '2026-07-15T02:00:00.000Z', updated_at: '2026-07-15T02:00:00.000Z',
      wallet_name: null, wallet_color: null,
    });
    expect(expense.wallet).toBeNull();
  });

  it('maps the paid integer to a boolean', () => {
    expect(toDebt({ id: 'd1', user_id: 'u1', person: 'Ana', amount: 500, date: '2026-07-01', paid: 1, notes: null, created_at: 'x', updated_at: 'x' }).paid).toBe(true);
    expect(toDebt({ id: 'd2', user_id: 'u1', person: 'Bo', amount: 500, date: '2026-07-01', paid: 0, notes: null, created_at: 'x', updated_at: 'x' }).paid).toBe(false);
  });

  it('maps limit_amount back to limit', () => {
    expect(toBudget({ id: 'b1', user_id: 'u1', category: null, limit_amount: 9000, month: '2026-07', created_at: 'x', updated_at: 'x' })).toMatchObject({ limit: 9000, category: null });
  });

  it('nests both wallets on a transfer', () => {
    const transfer = toTransfer({
      id: 't1', user_id: 'u1', from_wallet_id: 'w1', to_wallet_id: 'w2', amount: 100,
      date: '2026-07-02', notes: null, created_at: 'x', updated_at: 'x',
      from_wallet_name: 'Cash', from_wallet_color: '#1baf7a',
      to_wallet_name: 'GCash', to_wallet_color: '#2a78d6',
    });
    expect(transfer.fromWallet).toEqual({ id: 'w1', name: 'Cash', color: '#1baf7a' });
    expect(transfer.toWallet).toEqual({ id: 'w2', name: 'GCash', color: '#2a78d6' });
  });

  it('rounds to two decimals the way the API does', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1234.5678)).toBe(1234.57);
  });

  it('mints sortable unique ids', () => {
    const a = newId();
    const b = newId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/data/__tests__/mappers.test.js`
Expected: FAIL — cannot resolve `../mappers.js`.

- [ ] **Step 4: Implement ids and errors**

Create `frontend/src/data/ids.js`:

```js
import { v7 as uuidv7 } from 'uuid';

// UUIDv7 is time-ordered, so ids created on device sort chronologically in local indexes.
export function newId() {
  return uuidv7();
}

export function nowIso() {
  return new Date().toISOString();
}
```

Create `frontend/src/data/errors.js`:

```js
export class OfflineUnsupportedError extends Error {
  constructor(what) {
    super(`${what} is not available offline`);
    this.name = 'OfflineUnsupportedError';
  }
}
```

- [ ] **Step 5: Implement the mappers**

Create `frontend/src/data/mappers.js`:

```js
export const round2 = (n) => Math.round(n * 100) / 100;

function wallet(id, name, color) {
  return name == null ? null : { id, name, color };
}

export function toCategory(row) {
  return {
    id: row.id, userId: row.user_id, name: row.name, color: row.color,
    createdAt: row.created_at,
  };
}

export function toWallet(row) {
  return {
    id: row.id, userId: row.user_id, name: row.name, color: row.color,
    initialBalance: row.initial_balance, createdAt: row.created_at,
  };
}

export function toExpense(row) {
  return {
    id: row.id, userId: row.user_id, title: row.title, amount: row.amount,
    category: row.category, walletId: row.wallet_id, notes: row.notes,
    date: row.date, createdAt: row.created_at, updatedAt: row.updated_at,
    wallet: wallet(row.wallet_id, row.wallet_name, row.wallet_color),
  };
}

export function toIncome(row) {
  return {
    id: row.id, userId: row.user_id, source: row.source, amount: row.amount,
    walletId: row.wallet_id, notes: row.notes, date: row.date,
    createdAt: row.created_at, updatedAt: row.updated_at,
    wallet: wallet(row.wallet_id, row.wallet_name, row.wallet_color),
  };
}

export function toTransfer(row) {
  return {
    id: row.id, userId: row.user_id, fromWalletId: row.from_wallet_id,
    toWalletId: row.to_wallet_id, amount: row.amount, date: row.date,
    notes: row.notes, createdAt: row.created_at,
    fromWallet: wallet(row.from_wallet_id, row.from_wallet_name, row.from_wallet_color),
    toWallet: wallet(row.to_wallet_id, row.to_wallet_name, row.to_wallet_color),
  };
}

export function toDebt(row) {
  return {
    id: row.id, userId: row.user_id, person: row.person, amount: row.amount,
    date: row.date, paid: row.paid === 1, notes: row.notes, createdAt: row.created_at,
  };
}

export function toSavingsGoal(row) {
  return {
    id: row.id, userId: row.user_id, name: row.name, target: row.target,
    createdAt: row.created_at,
  };
}

export function toContribution(row) {
  return {
    id: row.id, goalId: row.goal_id, amount: row.amount, date: row.date,
    notes: row.notes, createdAt: row.created_at,
  };
}

export function toBudget(row) {
  return {
    id: row.id, userId: row.user_id, category: row.category,
    limit: row.limit_amount, month: row.month,
  };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/data/__tests__/mappers.test.js`
Expected: PASS (7 tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/data/ids.js frontend/src/data/mappers.js frontend/src/data/errors.js frontend/src/data/__tests__ frontend/package.json frontend/package-lock.json
git commit -m "feat(data): UUIDv7 ids and SQLite row mappers"
```

---

### Task 7: HTTP repositories and the data source registry

**Files:**
- Create: `frontend/src/data/repos/http/{expenseRepo,incomeRepo,budgetRepo,categoryRepo,walletRepo,transferRepo,debtRepo,savingsRepo,statsRepo,authRepo,index}.js`
- Create: `frontend/src/data/source.js`
- Test: `frontend/src/data/repos/http/__tests__/httpRepos.test.js`

**Interfaces:**
- Consumes: `api`, `downloadFile` from `services/api.js`.
- Produces: `dataSource` — an object with `expenseRepo`, `incomeRepo`, `budgetRepo`, `categoryRepo`, `walletRepo`, `transferRepo`, `debtRepo`, `savingsRepo`, `statsRepo`, `authRepo`. Defaults to the HTTP set.
- Produces: `setDataSource(next)` — swaps implementations in place.
- Repositories return **unwrapped** data: `walletRepo.list()` resolves to an array, not `{ wallets }`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/data/repos/http/__tests__/httpRepos.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../../services/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  downloadFile: vi.fn(),
}));

import { api } from '../../../../services/api.js';
import { walletRepo } from '../walletRepo.js';
import { expenseRepo } from '../expenseRepo.js';
import { debtRepo } from '../debtRepo.js';

describe('http repositories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('unwraps the wallets envelope', async () => {
    api.get.mockResolvedValue({ data: { wallets: [{ id: 'w1' }] } });
    expect(await walletRepo.list()).toEqual([{ id: 'w1' }]);
    expect(api.get).toHaveBeenCalledWith('/wallets');
  });

  it('passes list params straight through', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 } });
    await expenseRepo.list({ page: 2, search: 'taxi' });
    expect(api.get).toHaveBeenCalledWith('/expenses', { params: { page: 2, search: 'taxi' } });
  });

  it('returns the debts page whole, totals included', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1, totals: { paid: 0, unpaid: 5 } } });
    expect((await debtRepo.list({ page: 1 })).totals).toEqual({ paid: 0, unpaid: 5 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/data/repos/http/__tests__/httpRepos.test.js`
Expected: FAIL — cannot resolve `../walletRepo.js`.

- [ ] **Step 3: Write the HTTP repositories**

Create `frontend/src/data/repos/http/expenseRepo.js`:

```js
import { api, downloadFile } from '../../../services/api.js';

export const expenseRepo = {
  async list(params) {
    const { data } = await api.get('/expenses', { params });
    return data;
  },
  async create(payload) {
    const { data } = await api.post('/expenses', payload);
    return data.expense;
  },
  async update(id, payload) {
    const { data } = await api.put(`/expenses/${id}`, payload);
    return data.expense;
  },
  async remove(id) {
    await api.delete(`/expenses/${id}`);
  },
  async duplicate(id) {
    const { data } = await api.post(`/expenses/${id}/duplicate`);
    return data.expense;
  },
  async exportFile(params, filename) {
    await downloadFile('/expenses/export', params, filename);
  },
};
```

Create `frontend/src/data/repos/http/incomeRepo.js`:

```js
import { api } from '../../../services/api.js';

export const incomeRepo = {
  async list(params) {
    const { data } = await api.get('/income', { params });
    return data;
  },
  async create(payload) {
    const { data } = await api.post('/income', payload);
    return data.income;
  },
  async update(id, payload) {
    const { data } = await api.put(`/income/${id}`, payload);
    return data.income;
  },
  async remove(id) {
    await api.delete(`/income/${id}`);
  },
};
```

Create `frontend/src/data/repos/http/budgetRepo.js`:

```js
import { api } from '../../../services/api.js';

export const budgetRepo = {
  async list(month) {
    const { data } = await api.get('/budgets', { params: { month } });
    return data.budgets;
  },
  async create(payload) {
    const { data } = await api.post('/budgets', payload);
    return data.budget;
  },
  async update(id, payload) {
    const { data } = await api.put(`/budgets/${id}`, payload);
    return data.budget;
  },
  async remove(id) {
    await api.delete(`/budgets/${id}`);
  },
};
```

Create `frontend/src/data/repos/http/categoryRepo.js`:

```js
import { api } from '../../../services/api.js';

export const categoryRepo = {
  async list() {
    const { data } = await api.get('/categories');
    return data.categories;
  },
  async create(payload) {
    const { data } = await api.post('/categories', payload);
    return data.category;
  },
  async update(id, payload) {
    const { data } = await api.put(`/categories/${id}`, payload);
    return data.category;
  },
  async remove(id) {
    await api.delete(`/categories/${id}`);
  },
};
```

Create `frontend/src/data/repos/http/walletRepo.js`:

```js
import { api } from '../../../services/api.js';

export const walletRepo = {
  async list() {
    const { data } = await api.get('/wallets');
    return data.wallets;
  },
  async create(payload) {
    const { data } = await api.post('/wallets', payload);
    return data.wallet;
  },
  async update(id, payload) {
    const { data } = await api.put(`/wallets/${id}`, payload);
    return data.wallet;
  },
  async remove(id) {
    await api.delete(`/wallets/${id}`);
  },
};
```

Create `frontend/src/data/repos/http/transferRepo.js`:

```js
import { api } from '../../../services/api.js';

export const transferRepo = {
  async list(params) {
    const { data } = await api.get('/transfers', { params });
    return data;
  },
  async create(payload) {
    const { data } = await api.post('/transfers', payload);
    return data.transfer;
  },
  async update(id, payload) {
    const { data } = await api.put(`/transfers/${id}`, payload);
    return data.transfer;
  },
  async remove(id) {
    await api.delete(`/transfers/${id}`);
  },
};
```

Create `frontend/src/data/repos/http/debtRepo.js`:

```js
import { api } from '../../../services/api.js';

export const debtRepo = {
  async list(params) {
    const { data } = await api.get('/debts', { params });
    return data;
  },
  async create(payload) {
    const { data } = await api.post('/debts', payload);
    return data.debt;
  },
  async update(id, payload) {
    const { data } = await api.put(`/debts/${id}`, payload);
    return data.debt;
  },
  async remove(id) {
    await api.delete(`/debts/${id}`);
  },
};
```

Create `frontend/src/data/repos/http/savingsRepo.js`:

```js
import { api } from '../../../services/api.js';

export const savingsRepo = {
  async listGoals() {
    const { data } = await api.get('/savings-goals');
    return data.goals;
  },
  async createGoal(payload) {
    const { data } = await api.post('/savings-goals', payload);
    return data.goal;
  },
  async updateGoal(id, payload) {
    const { data } = await api.put(`/savings-goals/${id}`, payload);
    return data.goal;
  },
  async removeGoal(id) {
    await api.delete(`/savings-goals/${id}`);
  },
  async addContribution(goalId, payload) {
    const { data } = await api.post(`/savings-goals/${goalId}/contributions`, payload);
    return data.contribution;
  },
  async removeContribution(goalId, contributionId) {
    await api.delete(`/savings-goals/${goalId}/contributions/${contributionId}`);
  },
};
```

Create `frontend/src/data/repos/http/statsRepo.js`:

```js
import { api } from '../../../services/api.js';

export const statsRepo = {
  async dashboard(month) {
    const { data } = await api.get('/dashboard', { params: month ? { month } : {} });
    return data;
  },
  async analytics(params) {
    const { data } = await api.get('/analytics', { params });
    return data;
  },
};
```

Create `frontend/src/data/repos/http/authRepo.js`:

```js
import { api } from '../../../services/api.js';

export const authRepo = {
  async register(payload) {
    const { data } = await api.post('/auth/register', payload);
    return data;
  },
  async login(payload) {
    const { data } = await api.post('/auth/login', payload);
    return data;
  },
  async me() {
    const { data } = await api.get('/auth/me');
    return data.user;
  },
  async updateProfile(payload) {
    const { data } = await api.put('/auth/profile', payload);
    return data.user;
  },
  async logout() {
    await api.post('/auth/logout');
  },
};
```

Create `frontend/src/data/repos/http/index.js`:

```js
export { expenseRepo } from './expenseRepo.js';
export { incomeRepo } from './incomeRepo.js';
export { budgetRepo } from './budgetRepo.js';
export { categoryRepo } from './categoryRepo.js';
export { walletRepo } from './walletRepo.js';
export { transferRepo } from './transferRepo.js';
export { debtRepo } from './debtRepo.js';
export { savingsRepo } from './savingsRepo.js';
export { statsRepo } from './statsRepo.js';
export { authRepo } from './authRepo.js';
```

- [ ] **Step 4: Write the data source registry**

Create `frontend/src/data/source.js`:

```js
import * as httpRepos from './repos/http/index.js';

// Mutated in place so importers keep a stable reference after a swap.
export const dataSource = { ...httpRepos };

export function setDataSource(next) {
  Object.assign(dataSource, next);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/data/repos/http/__tests__/httpRepos.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/repos frontend/src/data/source.js
git commit -m "feat(data): HTTP repositories and the data source registry"
```

---

### Task 8: Move expenses, income, budgets and categories stores onto repositories

**Files:**
- Modify: `frontend/src/stores/{expenses,income,budgets,categories}.js`
- Test: `frontend/src/stores/__tests__/expenses.test.js` (create)

**Interfaces:**
- Consumes: `dataSource` from Task 7.
- Produces: no new exports; the stores' public actions and state are unchanged.

The stores keep every action name, argument and state field. Only the data call changes.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/stores/__tests__/expenses.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../../data/source.js', () => ({
  dataSource: {
    expenseRepo: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), duplicate: vi.fn() },
  },
}));

import { dataSource } from '../../data/source.js';
import { useExpensesStore } from '../expenses.js';

const PAGE = { items: [{ id: 'e1' }], total: 1, page: 1, pageSize: 10, totalPages: 1 };

describe('expenses store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('fetch passes paging, sorting and non-empty filters', async () => {
    dataSource.expenseRepo.list.mockResolvedValue(PAGE);
    const store = useExpensesStore();
    store.filters.search = 'taxi';
    await store.fetch();
    expect(dataSource.expenseRepo.list).toHaveBeenCalledWith({
      page: 1, pageSize: 10, sortBy: 'date', sortDir: 'desc', search: 'taxi',
    });
    expect(store.items).toEqual([{ id: 'e1' }]);
  });

  it('restores the list when an optimistic delete fails', async () => {
    dataSource.expenseRepo.list.mockResolvedValue(PAGE);
    const store = useExpensesStore();
    await store.fetch();
    dataSource.expenseRepo.remove.mockRejectedValue(new Error('offline'));
    await expect(store.remove('e1')).rejects.toThrow('offline');
    expect(store.items).toEqual([{ id: 'e1' }]);
    expect(store.total).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/stores/__tests__/expenses.test.js`
Expected: FAIL — the store still calls `api`, so `dataSource.expenseRepo.list` is never called.

- [ ] **Step 3: Rewrite the expenses store actions**

In `frontend/src/stores/expenses.js`, replace the import on line 2 with:

```js
import { dataSource } from '../data/source.js';
```

Replace the `actions` block's data calls (leave `setSort`, `setPage`, `applyFilters`,
`resetFilters` untouched):

```js
    async fetch() {
      this.loading = true;
      try {
        const data = await dataSource.expenseRepo.list(activeParams(this));
        this.items = data.items;
        this.total = data.total;
        this.totalPages = data.totalPages;
      } finally {
        this.loading = false;
      }
    },

    async create(payload) {
      const expense = await dataSource.expenseRepo.create(payload);
      await this.fetch();
      return expense;
    },

    async update(id, payload) {
      const expense = await dataSource.expenseRepo.update(id, payload);
      const index = this.items.findIndex((e) => e.id === id);
      if (index !== -1) this.items[index] = expense;
      return expense;
    },

    // Optimistic delete: remove locally, restore on failure
    async remove(id) {
      const snapshot = this.items;
      this.items = this.items.filter((e) => e.id !== id);
      this.total -= 1;
      try {
        await dataSource.expenseRepo.remove(id);
        await this.fetch();
      } catch (error) {
        this.items = snapshot;
        this.total += 1;
        throw error;
      }
    },

    async duplicate(id) {
      const expense = await dataSource.expenseRepo.duplicate(id);
      await this.fetch();
      return expense;
    },

    async exportFile(format) {
      const params = { ...activeParams(this), format };
      delete params.page;
      delete params.pageSize;
      const stamp = new Date().toISOString().slice(0, 10);
      await dataSource.expenseRepo.exportFile(params, `expenses-${stamp}.${format}`);
    },
```

- [ ] **Step 4: Rewrite the income store actions**

In `frontend/src/stores/income.js`, swap the import for `dataSource` and replace:

```js
    async fetch() {
      this.loading = true;
      try {
        const params = { page: this.page, pageSize: this.pageSize };
        if (this.search) params.search = this.search;
        const data = await dataSource.incomeRepo.list(params);
        this.items = data.items;
        this.total = data.total;
        this.totalPages = data.totalPages;
      } finally {
        this.loading = false;
      }
    },

    async create(payload) {
      await dataSource.incomeRepo.create(payload);
      await this.fetch();
    },

    async update(id, payload) {
      const income = await dataSource.incomeRepo.update(id, payload);
      const index = this.items.findIndex((i) => i.id === id);
      if (index !== -1) this.items[index] = income;
    },

    async remove(id) {
      await dataSource.incomeRepo.remove(id);
      await this.fetch();
    },
```

- [ ] **Step 5: Rewrite the budgets store actions**

In `frontend/src/stores/budgets.js`, swap the import for `dataSource` and replace:

```js
    async fetch() {
      this.loading = true;
      try {
        this.budgets = await dataSource.budgetRepo.list(this.month);
      } finally {
        this.loading = false;
      }
    },

    async create(payload) {
      await dataSource.budgetRepo.create({ ...payload, month: this.month });
      await this.fetch();
    },

    async update(id, payload) {
      await dataSource.budgetRepo.update(id, payload);
      await this.fetch();
    },

    async remove(id) {
      await dataSource.budgetRepo.remove(id);
      await this.fetch();
    },
```

- [ ] **Step 6: Rewrite the categories store actions**

In `frontend/src/stores/categories.js`, swap the import for `dataSource` and replace:

```js
    async fetch() {
      this.loading = true;
      try {
        this.categories = await dataSource.categoryRepo.list();
        this.loaded = true;
      } finally {
        this.loading = false;
      }
    },

    async create(payload) {
      const category = await dataSource.categoryRepo.create(payload);
      await this.fetch();
      return category;
    },

    async update(id, payload) {
      const category = await dataSource.categoryRepo.update(id, payload);
      await this.fetch();
      return category;
    },

    async remove(id) {
      await dataSource.categoryRepo.remove(id);
      await this.fetch();
    },
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/stores`
Expected: the new expenses tests PASS. `wallets.test.js`, `debts.test.js`,
`savings.test.js` and `auth.test.js` still pass because those stores are untouched so far.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/stores/expenses.js frontend/src/stores/income.js frontend/src/stores/budgets.js frontend/src/stores/categories.js frontend/src/stores/__tests__/expenses.test.js
git commit -m "refactor(stores): expenses, income, budgets and categories read through repositories"
```

---

### Task 9: Move the remaining stores onto repositories

**Files:**
- Modify: `frontend/src/stores/{wallets,debts,savings,dashboard,analytics,auth}.js`
- Modify: `frontend/src/stores/__tests__/{wallets,debts,savings,auth}.test.js`

**Interfaces:**
- Consumes: `dataSource` from Task 7.
- Produces: no new exports.

The four existing store tests mock `services/api.js` and assert on axios calls. Those
assertions are now testing the wrong layer, so each mock moves to `data/source.js`.

- [ ] **Step 1: Rewrite the wallets store actions**

In `frontend/src/stores/wallets.js`, swap the import for `dataSource` and replace every
data call:

```js
    async fetch() {
      this.loading = true;
      try {
        this.wallets = await dataSource.walletRepo.list();
        this.loaded = true;
      } finally {
        this.loading = false;
      }
    },

    async create(payload) {
      const wallet = await dataSource.walletRepo.create(payload);
      await this.fetch();
      return wallet;
    },

    async update(id, payload) {
      const wallet = await dataSource.walletRepo.update(id, payload);
      await this.fetch();
      return wallet;
    },

    async remove(id) {
      await dataSource.walletRepo.remove(id);
      await this.fetch();
    },

    async fetchTransfers() {
      this.transfersLoading = true;
      try {
        const data = await dataSource.transferRepo.list({
          page: this.transfersPage,
          pageSize: this.transfersPageSize,
        });
        this.transfers = data.items;
        this.transfersTotal = data.total;
        this.transfersTotalPages = data.totalPages;
      } finally {
        this.transfersLoading = false;
      }
    },

    // Transfers move balances, so wallet totals refetch alongside the list.
    async createTransfer(payload) {
      await dataSource.transferRepo.create(payload);
      await Promise.all([this.fetchTransfers(), this.fetch()]);
    },

    async updateTransfer(id, payload) {
      await dataSource.transferRepo.update(id, payload);
      await Promise.all([this.fetchTransfers(), this.fetch()]);
    },

    async removeTransfer(id) {
      await dataSource.transferRepo.remove(id);
      await Promise.all([this.fetchTransfers(), this.fetch()]);
    },
```

- [ ] **Step 2: Update the wallets store test**

In `frontend/src/stores/__tests__/wallets.test.js`, replace lines 1–9 (the mock and imports) with:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../../data/source.js', () => ({
  dataSource: {
    walletRepo: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    transferRepo: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  },
}));

import { dataSource } from '../../data/source.js';
import { useWalletsStore } from '../wallets.js';
```

Then replace each test body's arrangement and assertions:

```js
  it('fetch loads wallets', async () => {
    dataSource.walletRepo.list.mockResolvedValue(WALLETS);
    const store = useWalletsStore();
    await store.fetch();
    expect(dataSource.walletRepo.list).toHaveBeenCalled();
    expect(store.wallets).toHaveLength(2);
    expect(store.loaded).toBe(true);
  });

  it('ensureLoaded only fetches once', async () => {
    dataSource.walletRepo.list.mockResolvedValue(WALLETS);
    const store = useWalletsStore();
    await store.ensureLoaded();
    await store.ensureLoaded();
    expect(dataSource.walletRepo.list).toHaveBeenCalledTimes(1);
  });

  it('options getter maps id/name pairs', async () => {
    dataSource.walletRepo.list.mockResolvedValue(WALLETS);
    const store = useWalletsStore();
    await store.fetch();
    expect(store.options).toEqual([
      { value: 'w1', label: 'Cash' },
      { value: 'w2', label: 'GCash' },
    ]);
    expect(store.nameOf('w2')).toBe('GCash');
  });

  it('create delegates then refetches', async () => {
    dataSource.walletRepo.create.mockResolvedValue(WALLETS[0]);
    dataSource.walletRepo.list.mockResolvedValue(WALLETS);
    const store = useWalletsStore();
    await store.create({ name: 'Cash' });
    expect(dataSource.walletRepo.create).toHaveBeenCalledWith({ name: 'Cash' });
    expect(dataSource.walletRepo.list).toHaveBeenCalled();
  });

  it('createTransfer refetches transfers and wallets', async () => {
    dataSource.transferRepo.create.mockResolvedValue({ id: 't1' });
    dataSource.transferRepo.list.mockResolvedValue({ items: [], total: 0, totalPages: 1 });
    dataSource.walletRepo.list.mockResolvedValue(WALLETS);
    const store = useWalletsStore();
    const payload = { fromWalletId: 'w1', toWalletId: 'w2', amount: 100, date: '2026-07-01' };
    await store.createTransfer(payload);
    expect(dataSource.transferRepo.create).toHaveBeenCalledWith(payload);
    expect(dataSource.transferRepo.list).toHaveBeenCalled();
    expect(dataSource.walletRepo.list).toHaveBeenCalled();
  });
```

- [ ] **Step 3: Rewrite the debts store actions**

In `frontend/src/stores/debts.js`, swap the import for `dataSource` and replace:

```js
    async fetch() {
      this.loading = true;
      try {
        const data = await dataSource.debtRepo.list({ page: this.page, pageSize: this.pageSize });
        this.items = data.items;
        this.total = data.total;
        this.totalPages = data.totalPages;
        this.totals = data.totals;
      } finally {
        this.loading = false;
      }
    },

    async create(payload) {
      await dataSource.debtRepo.create(payload);
      await this.fetch();
    },

    async update(id, payload) {
      await dataSource.debtRepo.update(id, payload);
      await this.fetch();
    },

    async remove(id) {
      await dataSource.debtRepo.remove(id);
      await this.fetch();
    },

    async togglePaid(debt) {
      await dataSource.debtRepo.update(debt.id, { paid: !debt.paid });
      await this.fetch();
    },
```

- [ ] **Step 4: Rewrite the savings store actions**

In `frontend/src/stores/savings.js`, swap the import for `dataSource` and replace:

```js
    async fetch() {
      this.loading = true;
      try {
        this.goals = await dataSource.savingsRepo.listGoals();
      } finally {
        this.loading = false;
      }
    },

    async create(payload) {
      await dataSource.savingsRepo.createGoal(payload);
      await this.fetch();
    },

    async update(id, payload) {
      await dataSource.savingsRepo.updateGoal(id, payload);
      await this.fetch();
    },

    async remove(id) {
      await dataSource.savingsRepo.removeGoal(id);
      await this.fetch();
    },

    async addContribution(goalId, payload) {
      await dataSource.savingsRepo.addContribution(goalId, payload);
      await this.fetch();
    },

    async removeContribution(goalId, contributionId) {
      await dataSource.savingsRepo.removeContribution(goalId, contributionId);
      await this.fetch();
    },
```

- [ ] **Step 5: Rewrite the dashboard and analytics stores**

In `frontend/src/stores/dashboard.js`, swap the import and replace the `fetch` body:

```js
    async fetch(month) {
      this.loading = true;
      try {
        this.data = await dataSource.statsRepo.dashboard(month);
      } finally {
        this.loading = false;
      }
    },
```

In `frontend/src/stores/analytics.js`, swap the import and replace the last two lines of
`fetch`'s `try` block:

```js
        this.data = await dataSource.statsRepo.analytics(params);
```

- [ ] **Step 6: Rewrite the auth store**

In `frontend/src/stores/auth.js`, replace the import on line 2 with:

```js
import { setToken, clearToken, getToken } from '../services/api.js';
import { dataSource } from '../data/source.js';
```

Replace the actions:

```js
    async register(payload) {
      const data = await dataSource.authRepo.register(payload);
      setToken(data.accessToken, true);
      this.user = data.user;
    },

    async login({ email, password, remember }) {
      const data = await dataSource.authRepo.login({ email, password, remember });
      setToken(data.accessToken, remember);
      this.user = data.user;
    },

    async fetchMe() {
      if (!getToken()) return;
      this.loading = true;
      try {
        this.user = await dataSource.authRepo.me();
      } catch {
        clearToken();
        this.user = null;
      } finally {
        this.loading = false;
      }
    },

    async updateProfile(payload) {
      this.user = await dataSource.authRepo.updateProfile(payload);
      return this.user;
    },

    async logout() {
      try {
        await dataSource.authRepo.logout();
      } catch {
        // Best-effort: clear local session regardless
      } finally {
        clearToken();
        this.user = null;
      }
    },
```

- [ ] **Step 7: Update the debts, savings and auth store tests**

Apply the same mock swap as Step 2 to `debts.test.js`, `savings.test.js` and `auth.test.js`:
replace the `vi.mock('../../services/api.js', …)` block with a `vi.mock('../../data/source.js', …)`
exposing the repo methods that store uses, and change every `expect(api.get)` /
`expect(api.post)` assertion to the corresponding repo method. `auth.test.js` keeps its
`services/api.js` mock **as well**, because the auth store still imports `setToken`,
`clearToken` and `getToken` from there:

```js
vi.mock('../../services/api.js', () => ({
  setToken: vi.fn(), clearToken: vi.fn(), getToken: vi.fn(() => 'token'),
}));
vi.mock('../../data/source.js', () => ({
  dataSource: {
    authRepo: { register: vi.fn(), login: vi.fn(), me: vi.fn(), updateProfile: vi.fn(), logout: vi.fn() },
  },
}));
```

- [ ] **Step 8: Run the full frontend suite**

Run: `cd frontend && npm test`
Expected: every test passes. No file under `src/stores/` should still import `api`
except `auth.js` for its token helpers — verify with:

```bash
cd frontend && grep -rn "services/api" src/stores
```

Expected: exactly one hit, in `auth.js`.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/stores
git commit -m "refactor(stores): remaining stores read through repositories"
```

---

### Task 10: SQLite category and wallet repositories

**Files:**
- Create: `frontend/src/data/repos/sqlite/context.js`, `categoryRepo.js`, `walletRepo.js`, `frontend/src/data/constants.js`
- Modify: `frontend/src/data/errors.js`
- Test: `frontend/src/data/repos/sqlite/__tests__/{helpers.js,categoryRepo.test.js,walletRepo.test.js}`

**Interfaces:**
- Consumes: `DbAdapter` (Task 3), `migrate` (Task 5), `newId`/`nowIso`/mappers (Task 6).
- Produces: `setSqliteContext({ db, userId })` and `sqliteContext()` — how every SQLite repo reaches the database and the signed-in user.
- Produces: `RepoError(status, message)` — carries `response.data.error.message`, so the existing `apiErrorMessage()` helper renders it unchanged.
- Produces: `categoryRepo`, `walletRepo` with the same method signatures as their HTTP twins.

Wallet balances are ported here (spec scope note). `walletService.listWallets` rounds each
component **before** combining them, then rounds the total — replicate that exactly.

- [ ] **Step 1: Add the error type and colour palette**

Append to `frontend/src/data/errors.js`:

```js
// Mirrors the API's error envelope so apiErrorMessage() works on local failures too.
export class RepoError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'RepoError';
    this.status = status;
    this.response = { data: { error: { message } } };
  }
}
```

Create `frontend/src/data/constants.js` (values copied from `backend/src/utils/constants.js`):

```js
// Cycled through when a user creates a category without picking a colour.
export const CATEGORY_COLOR_PALETTE = [
  '#eda100', '#2a78d6', '#1baf7a', '#e87ba4', '#4a3aa7', '#eb6834',
  '#e34948', '#008300', '#0891b2', '#4d7c0f', '#9333ea', '#64748b',
];
```

- [ ] **Step 2: Write the shared test helper**

Create `frontend/src/data/repos/sqlite/__tests__/helpers.js`:

```js
import { createNodeDatabase } from '../../../db/nodeDb.js';
import { migrate } from '../../../schema/migrate.js';
import { setSqliteContext } from '../context.js';

export const USER_ID = 'u1';

export async function freshDb() {
  const db = await createNodeDatabase(':memory:');
  await migrate(db);
  setSqliteContext({ db, userId: USER_ID });
  return db;
}

export async function seedWallet(db, { id, name, initialBalance = 0 }) {
  await db.run(
    `INSERT INTO wallets (id, user_id, name, color, initial_balance, created_at, updated_at)
     VALUES (?, ?, ?, '#1baf7a', ?, '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z')`,
    [id, USER_ID, name, initialBalance],
  );
}

export async function seedExpense(db, { id, amount, walletId = null, category = 'Food', date = '2026-07-15' }) {
  await db.run(
    `INSERT INTO expenses (id, user_id, title, amount, category, wallet_id, date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, '2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z')`,
    [id, USER_ID, `t-${id}`, amount, category, walletId, date],
  );
}
```

- [ ] **Step 3: Write the failing tests**

Create `frontend/src/data/repos/sqlite/__tests__/categoryRepo.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { categoryRepo } from '../categoryRepo.js';
import { freshDb, seedExpense } from './helpers.js';

let db;
beforeEach(async () => {
  db = await freshDb();
});

describe('sqlite categoryRepo', () => {
  it('creates and lists in creation order', async () => {
    await categoryRepo.create({ name: 'Needs', color: '#2a78d6' });
    await categoryRepo.create({ name: 'Wants', color: '#eda100' });
    expect((await categoryRepo.list()).map((c) => c.name)).toEqual(['Needs', 'Wants']);
  });

  it('assigns a palette colour when none is given', async () => {
    const category = await categoryRepo.create({ name: 'Needs' });
    expect(category.color).toBe('#eda100');
  });

  it('rejects a duplicate name with 409', async () => {
    await categoryRepo.create({ name: 'Needs', color: '#2a78d6' });
    await expect(categoryRepo.create({ name: 'Needs' })).rejects.toMatchObject({ status: 409 });
  });

  it('cascades a rename onto expenses and budgets', async () => {
    const category = await categoryRepo.create({ name: 'Needs', color: '#2a78d6' });
    await seedExpense(db, { id: 'e1', amount: 10, category: 'Needs' });
    await categoryRepo.update(category.id, { name: 'Essentials' });
    const [expense] = await db.query('SELECT category FROM expenses WHERE id = ?', ['e1']);
    expect(expense.category).toBe('Essentials');
  });

  it('blocks deleting a category still in use', async () => {
    const category = await categoryRepo.create({ name: 'Needs', color: '#2a78d6' });
    await seedExpense(db, { id: 'e1', amount: 10, category: 'Needs' });
    await expect(categoryRepo.remove(category.id)).rejects.toMatchObject({ status: 409 });
  });
});
```

Create `frontend/src/data/repos/sqlite/__tests__/walletRepo.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { walletRepo } from '../walletRepo.js';
import { freshDb, seedWallet, seedExpense, USER_ID } from './helpers.js';

let db;
beforeEach(async () => {
  db = await freshDb();
});

describe('sqlite walletRepo', () => {
  it('computes balance as initial + income - expenses + in - out', async () => {
    await seedWallet(db, { id: 'w1', name: 'Cash', initialBalance: 1000 });
    await seedWallet(db, { id: 'w2', name: 'GCash', initialBalance: 0 });
    await seedExpense(db, { id: 'e1', amount: 250.5, walletId: 'w1' });
    await db.run(
      `INSERT INTO incomes (id, user_id, source, amount, wallet_id, date, created_at, updated_at)
       VALUES ('i1', ?, 'Salary', 500, 'w1', '2026-07-10', 'x', 'x')`,
      [USER_ID],
    );
    await db.run(
      `INSERT INTO transfers (id, user_id, from_wallet_id, to_wallet_id, amount, date, created_at, updated_at)
       VALUES ('t1', ?, 'w1', 'w2', 100, '2026-07-11', 'x', 'x')`,
      [USER_ID],
    );

    const wallets = await walletRepo.list();
    const cash = wallets.find((w) => w.id === 'w1');
    expect(cash).toMatchObject({
      totalIncome: 500, totalExpenses: 250.5, transfersIn: 0, transfersOut: 100,
      balance: 1149.5,
    });
    expect(wallets.find((w) => w.id === 'w2').balance).toBe(100);
  });

  it('rejects a duplicate wallet name with 409', async () => {
    await walletRepo.create({ name: 'Cash', initialBalance: 0 });
    await expect(walletRepo.create({ name: 'Cash' })).rejects.toMatchObject({ status: 409 });
  });

  it('blocks deleting a wallet that is referenced', async () => {
    await seedWallet(db, { id: 'w1', name: 'Cash' });
    await seedExpense(db, { id: 'e1', amount: 5, walletId: 'w1' });
    await expect(walletRepo.remove('w1')).rejects.toMatchObject({ status: 409 });
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/data/repos/sqlite`
Expected: FAIL — cannot resolve `../context.js`.

- [ ] **Step 5: Implement the context**

Create `frontend/src/data/repos/sqlite/context.js`:

```js
let state = { db: null, userId: null };

export function setSqliteContext(next) {
  state = { ...state, ...next };
}

export function sqliteContext() {
  if (!state.db) throw new Error('SQLite context has not been initialised');
  return state;
}
```

- [ ] **Step 6: Implement the category repository**

Create `frontend/src/data/repos/sqlite/categoryRepo.js`:

```js
import { sqliteContext } from './context.js';
import { newId, nowIso } from '../../ids.js';
import { toCategory } from '../../mappers.js';
import { RepoError } from '../../errors.js';
import { CATEGORY_COLOR_PALETTE } from '../../constants.js';

const LIVE = 'deleted_at IS NULL';

async function findByName(db, userId, name) {
  const [row] = await db.query(
    `SELECT * FROM categories WHERE user_id = ? AND name = ? AND ${LIVE}`,
    [userId, name],
  );
  return row ?? null;
}

export const categoryRepo = {
  async list() {
    const { db, userId } = sqliteContext();
    const rows = await db.query(
      `SELECT * FROM categories WHERE user_id = ? AND ${LIVE} ORDER BY created_at ASC`,
      [userId],
    );
    return rows.map(toCategory);
  },

  async create({ name, color }) {
    const { db, userId } = sqliteContext();
    if (await findByName(db, userId, name)) {
      throw new RepoError(409, 'A category with this name already exists');
    }
    const [{ count }] = await db.query(
      `SELECT COUNT(*) AS count FROM categories WHERE user_id = ? AND ${LIVE}`,
      [userId],
    );
    const now = nowIso();
    const row = {
      id: newId(),
      color: color || CATEGORY_COLOR_PALETTE[count % CATEGORY_COLOR_PALETTE.length],
    };
    await db.run(
      `INSERT INTO categories (id, user_id, name, color, created_at, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [row.id, userId, name, row.color, now, now],
    );
    return toCategory({ id: row.id, user_id: userId, name, color: row.color, created_at: now });
  },

  async update(id, { name, color }) {
    const { db, userId } = sqliteContext();
    const [existing] = await db.query(
      `SELECT * FROM categories WHERE id = ? AND user_id = ? AND ${LIVE}`,
      [id, userId],
    );
    if (!existing) throw new RepoError(404, 'Category not found');

    const nextName = name === undefined ? existing.name : name;
    if (nextName !== existing.name && (await findByName(db, userId, nextName))) {
      throw new RepoError(409, 'A category with this name already exists');
    }
    const nextColor = color === undefined ? existing.color : color;

    await db.transaction(async () => {
      await db.run(
        'UPDATE categories SET name = ?, color = ?, updated_at = ?, dirty = 1 WHERE id = ?',
        [nextName, nextColor, nowIso(), id],
      );
      // Category names are not a real FK — rename the string wherever it was used.
      if (nextName !== existing.name) {
        await db.run(
          'UPDATE expenses SET category = ?, updated_at = ?, dirty = 1 WHERE user_id = ? AND category = ?',
          [nextName, nowIso(), userId, existing.name],
        );
        await db.run(
          'UPDATE budgets SET category = ?, updated_at = ?, dirty = 1 WHERE user_id = ? AND category = ?',
          [nextName, nowIso(), userId, existing.name],
        );
      }
    });

    return toCategory({ ...existing, name: nextName, color: nextColor });
  },

  async remove(id) {
    const { db, userId } = sqliteContext();
    const [existing] = await db.query(
      `SELECT * FROM categories WHERE id = ? AND user_id = ? AND ${LIVE}`,
      [id, userId],
    );
    if (!existing) throw new RepoError(404, 'Category not found');

    const [{ count: expenseCount }] = await db.query(
      `SELECT COUNT(*) AS count FROM expenses WHERE user_id = ? AND category = ? AND ${LIVE}`,
      [userId, existing.name],
    );
    const [{ count: budgetCount }] = await db.query(
      `SELECT COUNT(*) AS count FROM budgets WHERE user_id = ? AND category = ? AND ${LIVE}`,
      [userId, existing.name],
    );
    if (expenseCount > 0 || budgetCount > 0) {
      throw new RepoError(
        409,
        `"${existing.name}" is used by ${expenseCount} expense(s) and ${budgetCount} budget(s) — reassign or remove those first`,
      );
    }
    await db.run('DELETE FROM categories WHERE id = ?', [id]);
  },
};
```

- [ ] **Step 7: Implement the wallet repository**

Create `frontend/src/data/repos/sqlite/walletRepo.js`:

```js
import { sqliteContext } from './context.js';
import { newId, nowIso } from '../../ids.js';
import { toWallet, round2 } from '../../mappers.js';
import { RepoError } from '../../errors.js';

const LIVE = 'deleted_at IS NULL';

async function sumsByWallet(db, userId, table, column) {
  const rows = await db.query(
    `SELECT ${column} AS wallet_id, SUM(amount) AS total FROM ${table}
     WHERE user_id = ? AND ${column} IS NOT NULL AND ${LIVE} GROUP BY ${column}`,
    [userId],
  );
  return new Map(rows.map((r) => [r.wallet_id, r.total ?? 0]));
}

export const walletRepo = {
  async list() {
    const { db, userId } = sqliteContext();
    const rows = await db.query(
      `SELECT * FROM wallets WHERE user_id = ? AND ${LIVE} ORDER BY created_at ASC`,
      [userId],
    );
    const [expenses, incomes, out, tin] = await Promise.all([
      sumsByWallet(db, userId, 'expenses', 'wallet_id'),
      sumsByWallet(db, userId, 'incomes', 'wallet_id'),
      sumsByWallet(db, userId, 'transfers', 'from_wallet_id'),
      sumsByWallet(db, userId, 'transfers', 'to_wallet_id'),
    ]);

    // Each component is rounded before combining, exactly as walletService.listWallets does.
    return rows.map((row) => {
      const wallet = toWallet(row);
      const totalIncome = round2(incomes.get(row.id) ?? 0);
      const totalExpenses = round2(expenses.get(row.id) ?? 0);
      const transfersIn = round2(tin.get(row.id) ?? 0);
      const transfersOut = round2(out.get(row.id) ?? 0);
      return {
        ...wallet,
        totalIncome,
        totalExpenses,
        transfersIn,
        transfersOut,
        balance: round2(
          wallet.initialBalance + totalIncome - totalExpenses + transfersIn - transfersOut,
        ),
      };
    });
  },

  async create({ name, color, initialBalance }) {
    const { db, userId } = sqliteContext();
    const [clash] = await db.query(
      `SELECT id FROM wallets WHERE user_id = ? AND name = ? AND ${LIVE}`,
      [userId, name],
    );
    if (clash) throw new RepoError(409, 'A wallet with this name already exists');

    const id = newId();
    const now = nowIso();
    await db.run(
      `INSERT INTO wallets (id, user_id, name, color, initial_balance, created_at, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, userId, name, color ?? null, initialBalance ?? 0, now, now],
    );
    return toWallet({
      id, user_id: userId, name, color: color ?? null,
      initial_balance: initialBalance ?? 0, created_at: now,
    });
  },

  async update(id, { name, color, initialBalance }) {
    const { db, userId } = sqliteContext();
    const [existing] = await db.query(
      `SELECT * FROM wallets WHERE id = ? AND user_id = ? AND ${LIVE}`,
      [id, userId],
    );
    if (!existing) throw new RepoError(404, 'Wallet not found');

    const nextName = name === undefined ? existing.name : name;
    if (nextName !== existing.name) {
      const [clash] = await db.query(
        `SELECT id FROM wallets WHERE user_id = ? AND name = ? AND ${LIVE}`,
        [userId, nextName],
      );
      if (clash) throw new RepoError(409, 'A wallet with this name already exists');
    }
    const next = {
      name: nextName,
      color: color === undefined ? existing.color : color,
      initial_balance: initialBalance === undefined ? existing.initial_balance : initialBalance,
    };
    await db.run(
      'UPDATE wallets SET name = ?, color = ?, initial_balance = ?, updated_at = ?, dirty = 1 WHERE id = ?',
      [next.name, next.color, next.initial_balance, nowIso(), id],
    );
    return toWallet({ ...existing, ...next });
  },

  async remove(id) {
    const { db, userId } = sqliteContext();
    const [existing] = await db.query(
      `SELECT * FROM wallets WHERE id = ? AND user_id = ? AND ${LIVE}`,
      [id, userId],
    );
    if (!existing) throw new RepoError(404, 'Wallet not found');

    const count = async (sql, params) => (await db.query(sql, params))[0].count;
    const expenseCount = await count(
      `SELECT COUNT(*) AS count FROM expenses WHERE wallet_id = ? AND ${LIVE}`, [id],
    );
    const incomeCount = await count(
      `SELECT COUNT(*) AS count FROM incomes WHERE wallet_id = ? AND ${LIVE}`, [id],
    );
    const transferCount = await count(
      `SELECT COUNT(*) AS count FROM transfers WHERE (from_wallet_id = ? OR to_wallet_id = ?) AND ${LIVE}`,
      [id, id],
    );
    if (expenseCount + incomeCount + transferCount > 0) {
      throw new RepoError(
        409,
        `"${existing.name}" is used by ${expenseCount} expense(s), ${incomeCount} income record(s) and ${transferCount} transfer(s) — reassign or remove those first`,
      );
    }
    await db.run('DELETE FROM wallets WHERE id = ?', [id]);
  },
};
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/data/repos/sqlite`
Expected: PASS (8 tests).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/data/repos/sqlite frontend/src/data/constants.js frontend/src/data/errors.js
git commit -m "feat(data): SQLite category and wallet repositories with computed balances"
```

---

### Task 11: SQLite expense and income repositories

**Files:**
- Create: `frontend/src/data/repos/sqlite/{expenseRepo,incomeRepo}.js`
- Test: `frontend/src/data/repos/sqlite/__tests__/expenseRepo.test.js`

**Interfaces:**
- Consumes: `sqliteContext`, mappers, `RepoError`.
- Produces: `expenseRepo` (`list`, `create`, `update`, `remove`, `duplicate`, `exportFile`) and `incomeRepo` (`list`, `create`, `update`, `remove`), matching the HTTP signatures.

The spec's §2.1 also lists `listAllForExport` on `expenseRepo`. It is **not** implemented in
Phase 1: nothing calls it (the store's export path goes through `exportFile`), and adding it
to only one implementation would break the parity test in Task 13. It arrives in Phase 5
with on-device exports, on both implementations at once.

Filters, sorting and pagination all happen in SQL. `sortBy` is whitelisted — never
interpolate it raw.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/data/repos/sqlite/__tests__/expenseRepo.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { expenseRepo } from '../expenseRepo.js';
import { freshDb, seedWallet, seedExpense } from './helpers.js';

let db;
beforeEach(async () => {
  db = await freshDb();
  await seedWallet(db, { id: 'w1', name: 'Cash' });
  await seedExpense(db, { id: 'e1', amount: 100, walletId: 'w1', category: 'Food', date: '2026-07-01' });
  await seedExpense(db, { id: 'e2', amount: 50, walletId: null, category: 'Transport', date: '2026-07-20' });
  await seedExpense(db, { id: 'e3', amount: 75, walletId: 'w1', category: 'Food', date: '2026-06-15' });
});

describe('sqlite expenseRepo', () => {
  it('sorts by date descending and pages', async () => {
    const page = await expenseRepo.list({ page: 1, pageSize: 2, sortBy: 'date', sortDir: 'desc' });
    expect(page.items.map((e) => e.id)).toEqual(['e2', 'e1']);
    expect(page).toMatchObject({ total: 3, page: 1, pageSize: 2, totalPages: 2 });
  });

  it('nests the joined wallet', async () => {
    const page = await expenseRepo.list({ page: 1, pageSize: 10 });
    expect(page.items.find((e) => e.id === 'e1').wallet).toEqual({ id: 'w1', name: 'Cash', color: '#1baf7a' });
    expect(page.items.find((e) => e.id === 'e2').wallet).toBeNull();
  });

  it('filters by category, wallet, date range and amount range', async () => {
    expect((await expenseRepo.list({ category: 'Food' })).total).toBe(2);
    expect((await expenseRepo.list({ walletId: 'w1' })).total).toBe(2);
    expect((await expenseRepo.list({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })).total).toBe(2);
    expect((await expenseRepo.list({ minAmount: 60, maxAmount: 100 })).total).toBe(2);
  });

  it('searches title and notes case-insensitively', async () => {
    await db.run(
      `INSERT INTO expenses (id, user_id, title, amount, category, date, notes, created_at, updated_at)
       VALUES ('e4', 'u1', 'Groceries', 10, 'Food', '2026-07-05', 'weekly RUN', 'x', 'x')`,
    );
    expect((await expenseRepo.list({ search: 'grocer' })).total).toBe(1);
    expect((await expenseRepo.list({ search: 'run' })).total).toBe(1);
  });

  it('duplicates an expense onto today with a new id', async () => {
    const copy = await expenseRepo.duplicate('e1');
    expect(copy.id).not.toBe('e1');
    expect(copy).toMatchObject({ title: 't-e1', amount: 100, category: 'Food', walletId: 'w1' });
    expect(copy.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await expenseRepo.list({})).total).toBe(4);
  });

  it('rejects an unknown category', async () => {
    await expect(
      expenseRepo.create({ title: 'x', amount: 1, category: 'Nope', date: '2026-07-01' }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/data/repos/sqlite/__tests__/expenseRepo.test.js`
Expected: FAIL — cannot resolve `../expenseRepo.js`.

- [ ] **Step 3: Implement the expense repository**

Create `frontend/src/data/repos/sqlite/expenseRepo.js`:

```js
import { sqliteContext } from './context.js';
import { newId, nowIso } from '../../ids.js';
import { toExpense } from '../../mappers.js';
import { RepoError, OfflineUnsupportedError } from '../../errors.js';

const LIVE = 'e.deleted_at IS NULL';

const SORT_COLUMNS = {
  date: 'e.date', amount: 'e.amount', title: 'e.title',
  category: 'e.category', createdAt: 'e.created_at',
};

const SELECT = `
  SELECT e.*, w.name AS wallet_name, w.color AS wallet_color
  FROM expenses e LEFT JOIN wallets w ON w.id = e.wallet_id
`;

// LIKE is case-insensitive for ASCII in SQLite, matching Prisma's mode:'insensitive'.
function buildWhere(userId, query = {}) {
  const clauses = [`e.user_id = ?`, LIVE];
  const params = [userId];

  if (query.search) {
    clauses.push('(e.title LIKE ? OR e.notes LIKE ?)');
    params.push(`%${query.search}%`, `%${query.search}%`);
  }
  if (query.category) {
    clauses.push('e.category = ?');
    params.push(query.category);
  }
  if (query.walletId) {
    clauses.push('e.wallet_id = ?');
    params.push(query.walletId);
  }
  if (query.dateFrom) {
    clauses.push('e.date >= ?');
    params.push(query.dateFrom);
  }
  if (query.dateTo) {
    clauses.push('e.date <= ?');
    params.push(query.dateTo);
  }
  if (query.minAmount !== undefined && query.minAmount !== '') {
    clauses.push('e.amount >= ?');
    params.push(Number(query.minAmount));
  }
  if (query.maxAmount !== undefined && query.maxAmount !== '') {
    clauses.push('e.amount <= ?');
    params.push(Number(query.maxAmount));
  }
  return { where: clauses.join(' AND '), params };
}

async function assertCategoryExists(db, userId, name) {
  if (name == null) return;
  const [row] = await db.query(
    'SELECT id FROM categories WHERE user_id = ? AND name = ? AND deleted_at IS NULL',
    [userId, name],
  );
  if (!row) throw new RepoError(400, `Unknown category: ${name}`);
}

async function assertWalletExists(db, userId, walletId) {
  if (walletId == null) return;
  const [row] = await db.query(
    'SELECT id FROM wallets WHERE user_id = ? AND id = ? AND deleted_at IS NULL',
    [userId, walletId],
  );
  if (!row) throw new RepoError(400, 'Unknown wallet');
}

async function findOne(db, userId, id) {
  const [row] = await db.query(`${SELECT} WHERE e.id = ? AND e.user_id = ? AND ${LIVE}`, [id, userId]);
  if (!row) throw new RepoError(404, 'Expense not found');
  return row;
}

export const expenseRepo = {
  async list(query = {}) {
    const { db, userId } = sqliteContext();
    const { where, params } = buildWhere(userId, query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const sortColumn = SORT_COLUMNS[query.sortBy] ?? SORT_COLUMNS.date;
    const sortDir = query.sortDir === 'asc' ? 'ASC' : 'DESC';

    const rows = await db.query(
      `${SELECT} WHERE ${where} ORDER BY ${sortColumn} ${sortDir} LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize],
    );
    const [{ count: total }] = await db.query(
      `SELECT COUNT(*) AS count FROM expenses e WHERE ${where}`,
      params,
    );

    return {
      items: rows.map(toExpense),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  async create(payload) {
    const { db, userId } = sqliteContext();
    await assertCategoryExists(db, userId, payload.category);
    await assertWalletExists(db, userId, payload.walletId);

    const id = newId();
    const now = nowIso();
    await db.run(
      `INSERT INTO expenses (id, user_id, title, amount, category, wallet_id, notes, date, created_at, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, userId, payload.title, payload.amount, payload.category,
        payload.walletId ?? null, payload.notes ?? null, payload.date, now, now],
    );
    return toExpense(await findOne(db, userId, id));
  },

  async update(id, payload) {
    const { db, userId } = sqliteContext();
    const existing = await findOne(db, userId, id);
    await assertCategoryExists(db, userId, payload.category);
    await assertWalletExists(db, userId, payload.walletId);

    const next = {
      title: payload.title ?? existing.title,
      amount: payload.amount ?? existing.amount,
      category: payload.category ?? existing.category,
      wallet_id: payload.walletId === undefined ? existing.wallet_id : payload.walletId,
      notes: payload.notes === undefined ? existing.notes : payload.notes,
      date: payload.date ?? existing.date,
    };
    await db.run(
      `UPDATE expenses SET title = ?, amount = ?, category = ?, wallet_id = ?, notes = ?,
       date = ?, updated_at = ?, dirty = 1 WHERE id = ?`,
      [next.title, next.amount, next.category, next.wallet_id, next.notes, next.date, nowIso(), id],
    );
    return toExpense(await findOne(db, userId, id));
  },

  async remove(id) {
    const { db, userId } = sqliteContext();
    await findOne(db, userId, id);
    await db.run('DELETE FROM expenses WHERE id = ?', [id]);
  },

  async duplicate(id) {
    const { db, userId } = sqliteContext();
    const source = await findOne(db, userId, id);
    return this.create({
      title: source.title,
      amount: source.amount,
      category: source.category,
      walletId: source.wallet_id,
      notes: source.notes,
      date: nowIso().slice(0, 10),
    });
  },

  async exportFile() {
    throw new OfflineUnsupportedError('Exporting');
  },
};
```

- [ ] **Step 4: Implement the income repository**

Create `frontend/src/data/repos/sqlite/incomeRepo.js`:

```js
import { sqliteContext } from './context.js';
import { newId, nowIso } from '../../ids.js';
import { toIncome } from '../../mappers.js';
import { RepoError } from '../../errors.js';

const LIVE = 'i.deleted_at IS NULL';

const SELECT = `
  SELECT i.*, w.name AS wallet_name, w.color AS wallet_color
  FROM incomes i LEFT JOIN wallets w ON w.id = i.wallet_id
`;

function buildWhere(userId, query = {}) {
  const clauses = ['i.user_id = ?', LIVE];
  const params = [userId];
  if (query.search) {
    clauses.push('(i.source LIKE ? OR i.notes LIKE ?)');
    params.push(`%${query.search}%`, `%${query.search}%`);
  }
  if (query.dateFrom) {
    clauses.push('i.date >= ?');
    params.push(query.dateFrom);
  }
  if (query.dateTo) {
    clauses.push('i.date <= ?');
    params.push(query.dateTo);
  }
  return { where: clauses.join(' AND '), params };
}

async function assertWalletExists(db, userId, walletId) {
  if (walletId == null) return;
  const [row] = await db.query(
    'SELECT id FROM wallets WHERE user_id = ? AND id = ? AND deleted_at IS NULL',
    [userId, walletId],
  );
  if (!row) throw new RepoError(400, 'Unknown wallet');
}

async function findOne(db, userId, id) {
  const [row] = await db.query(`${SELECT} WHERE i.id = ? AND i.user_id = ? AND ${LIVE}`, [id, userId]);
  if (!row) throw new RepoError(404, 'Income record not found');
  return row;
}

export const incomeRepo = {
  async list(query = {}) {
    const { db, userId } = sqliteContext();
    const { where, params } = buildWhere(userId, query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const sortDir = query.sortDir === 'asc' ? 'ASC' : 'DESC';

    const rows = await db.query(
      `${SELECT} WHERE ${where} ORDER BY i.date ${sortDir} LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize],
    );
    const [{ count: total }] = await db.query(
      `SELECT COUNT(*) AS count FROM incomes i WHERE ${where}`,
      params,
    );
    return {
      items: rows.map(toIncome),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  async create(payload) {
    const { db, userId } = sqliteContext();
    await assertWalletExists(db, userId, payload.walletId);
    const id = newId();
    const now = nowIso();
    await db.run(
      `INSERT INTO incomes (id, user_id, source, amount, wallet_id, notes, date, created_at, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, userId, payload.source, payload.amount, payload.walletId ?? null,
        payload.notes ?? null, payload.date, now, now],
    );
    return toIncome(await findOne(db, userId, id));
  },

  async update(id, payload) {
    const { db, userId } = sqliteContext();
    const existing = await findOne(db, userId, id);
    await assertWalletExists(db, userId, payload.walletId);
    const next = {
      source: payload.source ?? existing.source,
      amount: payload.amount ?? existing.amount,
      wallet_id: payload.walletId === undefined ? existing.wallet_id : payload.walletId,
      notes: payload.notes === undefined ? existing.notes : payload.notes,
      date: payload.date ?? existing.date,
    };
    await db.run(
      `UPDATE incomes SET source = ?, amount = ?, wallet_id = ?, notes = ?, date = ?,
       updated_at = ?, dirty = 1 WHERE id = ?`,
      [next.source, next.amount, next.wallet_id, next.notes, next.date, nowIso(), id],
    );
    return toIncome(await findOne(db, userId, id));
  },

  async remove(id) {
    const { db, userId } = sqliteContext();
    await findOne(db, userId, id);
    await db.run('DELETE FROM incomes WHERE id = ?', [id]);
  },
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/data/repos/sqlite`
Expected: PASS (14 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/repos/sqlite
git commit -m "feat(data): SQLite expense and income repositories with filters and paging"
```

---

### Task 12: SQLite transfer, debt, savings and budget repositories

**Files:**
- Create: `frontend/src/data/dates.js`, `frontend/src/data/repos/sqlite/{transferRepo,debtRepo,savingsRepo,budgetRepo}.js`
- Modify: `frontend/src/data/repos/sqlite/expenseRepo.js`
- Test: `frontend/src/data/repos/sqlite/__tests__/{budgetRepo.test.js,savingsRepo.test.js}`

**Interfaces:**
- Consumes: `sqliteContext`, mappers, `RepoError`.
- Produces: `todayKey()`, `monthBounds(month)`, `addMonths(month, delta)` in `data/dates.js`.
- Produces: `transferRepo`, `debtRepo`, `savingsRepo`, `budgetRepo`.

Two more aggregations land here: debt paid/unpaid totals and savings rollups. Budget
progress (`spent`/`remaining`/`percentUsed`) is ported from `budgetService.listBudgets`.

- [ ] **Step 1: Write the date helpers**

Create `frontend/src/data/dates.js`:

```js
// All local dates are YYYY-MM-DD strings. These helpers do string arithmetic only,
// so no timezone ever participates in bucketing (spec §4).

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function currentMonth() {
  return todayKey().slice(0, 7);
}

export function addMonths(month, delta) {
  const [year, m] = month.split('-').map(Number);
  const total = year * 12 + (m - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

// Half-open range [start, end) matching budgetService.monthRange.
export function monthBounds(month) {
  return { start: `${month}-01`, end: `${addMonths(month, 1)}-01` };
}
```

- [ ] **Step 2: Use the device-local date when duplicating**

In `frontend/src/data/repos/sqlite/expenseRepo.js`, add the import:

```js
import { todayKey } from '../../dates.js';
```

and in `duplicate`, replace `date: nowIso().slice(0, 10)` with:

```js
      date: todayKey(),
```

`nowIso()` is UTC; a user east of UTC duplicating an expense late at night would otherwise
get tomorrow's date.

- [ ] **Step 3: Write the failing tests**

Create `frontend/src/data/repos/sqlite/__tests__/budgetRepo.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { budgetRepo } from '../budgetRepo.js';
import { freshDb, seedExpense, USER_ID } from './helpers.js';

let db;
const seedCategory = (name) =>
  db.run(
    `INSERT INTO categories (id, user_id, name, color, created_at, updated_at)
     VALUES (?, ?, ?, '#eda100', 'x', 'x')`,
    [`c-${name}`, USER_ID, name],
  );

beforeEach(async () => {
  db = await freshDb();
  await seedCategory('Food');
  await seedExpense(db, { id: 'e1', amount: 300, category: 'Food', date: '2026-07-05' });
  await seedExpense(db, { id: 'e2', amount: 200, category: 'Transport', date: '2026-07-06' });
  await seedExpense(db, { id: 'e3', amount: 999, category: 'Food', date: '2026-08-01' });
});

describe('sqlite budgetRepo', () => {
  it('computes spend for a category budget within the month only', async () => {
    await budgetRepo.create({ category: 'Food', limit: 1000, month: '2026-07' });
    const [budget] = await budgetRepo.list('2026-07');
    expect(budget).toMatchObject({ spent: 300, remaining: 700, percentUsed: 30 });
  });

  it('computes the overall budget against every category', async () => {
    await budgetRepo.create({ category: null, limit: 1000, month: '2026-07' });
    const [budget] = await budgetRepo.list('2026-07');
    expect(budget).toMatchObject({ category: null, spent: 500, remaining: 500, percentUsed: 50 });
  });

  it('reports zero percent when the limit is zero', async () => {
    await budgetRepo.create({ category: 'Food', limit: 0, month: '2026-07' });
    expect((await budgetRepo.list('2026-07'))[0].percentUsed).toBe(0);
  });

  it('blocks a second overall budget for the same month', async () => {
    await budgetRepo.create({ category: null, limit: 1000, month: '2026-07' });
    await expect(budgetRepo.create({ category: null, limit: 2000, month: '2026-07' }))
      .rejects.toMatchObject({ status: 409 });
  });
});
```

Create `frontend/src/data/repos/sqlite/__tests__/savingsRepo.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { savingsRepo } from '../savingsRepo.js';
import { freshDb } from './helpers.js';
import { currentMonth, addMonths } from '../../../dates.js';

beforeEach(async () => {
  await freshDb();
});

describe('sqlite savingsRepo', () => {
  it('rolls contributions up by total, this month and last month', async () => {
    const goal = await savingsRepo.createGoal({ name: 'Japan 2027', target: 100000 });
    await savingsRepo.addContribution(goal.id, { amount: 500, date: `${currentMonth()}-05` });
    await savingsRepo.addContribution(goal.id, { amount: 250, date: `${addMonths(currentMonth(), -1)}-10` });
    await savingsRepo.addContribution(goal.id, { amount: 125, date: `${addMonths(currentMonth(), -5)}-10` });

    const [rolled] = await savingsRepo.listGoals();
    expect(rolled).toMatchObject({ total: 875, thisMonth: 500, lastMonth: 250 });
    expect(rolled.contributions).toHaveLength(3);
  });

  it('rejects a duplicate goal name with 409', async () => {
    await savingsRepo.createGoal({ name: 'Japan 2027' });
    await expect(savingsRepo.createGoal({ name: 'Japan 2027' })).rejects.toMatchObject({ status: 409 });
  });

  it('removes contributions with the goal', async () => {
    const goal = await savingsRepo.createGoal({ name: 'Emergency' });
    await savingsRepo.addContribution(goal.id, { amount: 100, date: `${currentMonth()}-01` });
    await savingsRepo.removeGoal(goal.id);
    expect(await savingsRepo.listGoals()).toEqual([]);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/data/repos/sqlite`
Expected: FAIL — cannot resolve `../budgetRepo.js`.

- [ ] **Step 5: Implement the budget repository**

Create `frontend/src/data/repos/sqlite/budgetRepo.js`:

```js
import { sqliteContext } from './context.js';
import { newId, nowIso } from '../../ids.js';
import { toBudget, round2 } from '../../mappers.js';
import { RepoError } from '../../errors.js';
import { monthBounds } from '../../dates.js';

const LIVE = 'deleted_at IS NULL';

async function assertCategoryExists(db, userId, name) {
  if (name == null) return;
  const [row] = await db.query(
    `SELECT id FROM categories WHERE user_id = ? AND name = ? AND ${LIVE}`,
    [userId, name],
  );
  if (!row) throw new RepoError(400, `Unknown category: ${name}`);
}

export const budgetRepo = {
  async list(month) {
    const { db, userId } = sqliteContext();
    const { start, end } = monthBounds(month);

    const rows = await db.query(
      `SELECT * FROM budgets WHERE user_id = ? AND month = ? AND ${LIVE} ORDER BY category ASC`,
      [userId, month],
    );
    const grouped = await db.query(
      `SELECT category, SUM(amount) AS total FROM expenses
       WHERE user_id = ? AND date >= ? AND date < ? AND ${LIVE} GROUP BY category`,
      [userId, start, end],
    );
    const spentByCategory = new Map(grouped.map((g) => [g.category, g.total ?? 0]));
    const totalSpent = grouped.reduce((sum, g) => sum + (g.total ?? 0), 0);

    return rows.map((row) => {
      const budget = toBudget(row);
      const spent = round2(
        budget.category === null ? totalSpent : (spentByCategory.get(budget.category) ?? 0),
      );
      return {
        ...budget,
        spent,
        remaining: round2(budget.limit - spent),
        percentUsed: budget.limit > 0 ? Math.round((spent / budget.limit) * 100) : 0,
      };
    });
  },

  async create({ category, limit, month }) {
    const { db, userId } = sqliteContext();
    const normalised = category ?? null;
    await assertCategoryExists(db, userId, normalised);

    // NULLs compare as distinct in a unique index, so the overall budget needs an
    // explicit check — same reason budgetService.createBudget does a findFirst.
    const [clash] = await db.query(
      `SELECT id FROM budgets WHERE user_id = ? AND month = ? AND ${LIVE}
       AND ((category IS NULL AND ? IS NULL) OR category = ?)`,
      [userId, month, normalised, normalised],
    );
    if (clash) throw new RepoError(409, 'A budget for this category and month already exists');

    const id = newId();
    const now = nowIso();
    await db.run(
      `INSERT INTO budgets (id, user_id, category, limit_amount, month, created_at, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, userId, normalised, limit, month, now, now],
    );
    return toBudget({ id, user_id: userId, category: normalised, limit_amount: limit, month });
  },

  async update(id, payload) {
    const { db, userId } = sqliteContext();
    const [existing] = await db.query(
      `SELECT * FROM budgets WHERE id = ? AND user_id = ? AND ${LIVE}`,
      [id, userId],
    );
    if (!existing) throw new RepoError(404, 'Budget not found');
    if (payload.category !== undefined) await assertCategoryExists(db, userId, payload.category);

    const next = {
      category: payload.category === undefined ? existing.category : payload.category,
      limit_amount: payload.limit ?? existing.limit_amount,
      month: payload.month ?? existing.month,
    };
    await db.run(
      'UPDATE budgets SET category = ?, limit_amount = ?, month = ?, updated_at = ?, dirty = 1 WHERE id = ?',
      [next.category, next.limit_amount, next.month, nowIso(), id],
    );
    return toBudget({ ...existing, ...next });
  },

  async remove(id) {
    const { db, userId } = sqliteContext();
    const result = await db.run('DELETE FROM budgets WHERE id = ? AND user_id = ?', [id, userId]);
    if (result.changes === 0) throw new RepoError(404, 'Budget not found');
  },
};
```

- [ ] **Step 6: Implement the savings repository**

Create `frontend/src/data/repos/sqlite/savingsRepo.js`:

```js
import { sqliteContext } from './context.js';
import { newId, nowIso } from '../../ids.js';
import { toSavingsGoal, toContribution, round2 } from '../../mappers.js';
import { RepoError } from '../../errors.js';
import { currentMonth, addMonths } from '../../dates.js';

const LIVE = 'deleted_at IS NULL';

export const savingsRepo = {
  async listGoals() {
    const { db, userId } = sqliteContext();
    const goals = await db.query(
      `SELECT * FROM savings_goals WHERE user_id = ? AND ${LIVE} ORDER BY created_at ASC`,
      [userId],
    );
    const thisStart = `${currentMonth()}-01`;
    const lastStart = `${addMonths(currentMonth(), -1)}-01`;

    return Promise.all(
      goals.map(async (row) => {
        const contributions = await db.query(
          `SELECT * FROM savings_contributions WHERE goal_id = ? AND ${LIVE} ORDER BY date DESC`,
          [row.id],
        );
        const sum = (filter) =>
          round2(contributions.filter(filter).reduce((acc, c) => acc + c.amount, 0));
        return {
          ...toSavingsGoal(row),
          contributions: contributions.map(toContribution),
          total: sum(() => true),
          thisMonth: sum((c) => c.date >= thisStart),
          lastMonth: sum((c) => c.date >= lastStart && c.date < thisStart),
        };
      }),
    );
  },

  async createGoal({ name, target }) {
    const { db, userId } = sqliteContext();
    const [clash] = await db.query(
      `SELECT id FROM savings_goals WHERE user_id = ? AND name = ? AND ${LIVE}`,
      [userId, name],
    );
    if (clash) throw new RepoError(409, 'A savings goal with this name already exists');

    const id = newId();
    const now = nowIso();
    await db.run(
      `INSERT INTO savings_goals (id, user_id, name, target, created_at, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [id, userId, name, target ?? null, now, now],
    );
    return toSavingsGoal({ id, user_id: userId, name, target: target ?? null, created_at: now });
  },

  async updateGoal(id, { name, target }) {
    const { db, userId } = sqliteContext();
    const [existing] = await db.query(
      `SELECT * FROM savings_goals WHERE id = ? AND user_id = ? AND ${LIVE}`,
      [id, userId],
    );
    if (!existing) throw new RepoError(404, 'Savings goal not found');

    const nextName = name === undefined ? existing.name : name;
    if (nextName !== existing.name) {
      const [clash] = await db.query(
        `SELECT id FROM savings_goals WHERE user_id = ? AND name = ? AND ${LIVE}`,
        [userId, nextName],
      );
      if (clash) throw new RepoError(409, 'A savings goal with this name already exists');
    }
    const nextTarget = target === undefined ? existing.target : target;
    await db.run(
      'UPDATE savings_goals SET name = ?, target = ?, updated_at = ?, dirty = 1 WHERE id = ?',
      [nextName, nextTarget, nowIso(), id],
    );
    return toSavingsGoal({ ...existing, name: nextName, target: nextTarget });
  },

  async removeGoal(id) {
    const { db, userId } = sqliteContext();
    const [existing] = await db.query(
      `SELECT id FROM savings_goals WHERE id = ? AND user_id = ? AND ${LIVE}`,
      [id, userId],
    );
    if (!existing) throw new RepoError(404, 'Savings goal not found');
    // ON DELETE CASCADE removes the contributions.
    await db.run('DELETE FROM savings_goals WHERE id = ?', [id]);
  },

  async addContribution(goalId, { amount, date, notes }) {
    const { db, userId } = sqliteContext();
    const [goal] = await db.query(
      `SELECT id FROM savings_goals WHERE id = ? AND user_id = ? AND ${LIVE}`,
      [goalId, userId],
    );
    if (!goal) throw new RepoError(404, 'Savings goal not found');

    const id = newId();
    const now = nowIso();
    await db.run(
      `INSERT INTO savings_contributions (id, goal_id, amount, date, notes, created_at, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, goalId, amount, date, notes ?? null, now, now],
    );
    return toContribution({ id, goal_id: goalId, amount, date, notes: notes ?? null, created_at: now });
  },

  async removeContribution(goalId, contributionId) {
    const { db, userId } = sqliteContext();
    const [goal] = await db.query(
      `SELECT id FROM savings_goals WHERE id = ? AND user_id = ? AND ${LIVE}`,
      [goalId, userId],
    );
    if (!goal) throw new RepoError(404, 'Savings goal not found');
    const result = await db.run(
      'DELETE FROM savings_contributions WHERE id = ? AND goal_id = ?',
      [contributionId, goalId],
    );
    if (result.changes === 0) throw new RepoError(404, 'Contribution not found');
  },
};
```

- [ ] **Step 7: Implement the debt repository**

Create `frontend/src/data/repos/sqlite/debtRepo.js`:

```js
import { sqliteContext } from './context.js';
import { newId, nowIso } from '../../ids.js';
import { toDebt, round2 } from '../../mappers.js';
import { RepoError } from '../../errors.js';

const LIVE = 'deleted_at IS NULL';

export const debtRepo = {
  async list(query = {}) {
    const { db, userId } = sqliteContext();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const rows = await db.query(
      `SELECT * FROM debts WHERE user_id = ? AND ${LIVE} ORDER BY date DESC LIMIT ? OFFSET ?`,
      [userId, pageSize, (page - 1) * pageSize],
    );
    const [{ count: total }] = await db.query(
      `SELECT COUNT(*) AS count FROM debts WHERE user_id = ? AND ${LIVE}`,
      [userId],
    );
    const groups = await db.query(
      `SELECT paid, SUM(amount) AS total FROM debts WHERE user_id = ? AND ${LIVE} GROUP BY paid`,
      [userId],
    );
    const totalFor = (paid) => round2(groups.find((g) => g.paid === paid)?.total ?? 0);

    return {
      items: rows.map(toDebt),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      totals: { unpaid: totalFor(0), paid: totalFor(1) },
    };
  },

  async create({ person, amount, date, paid, notes }) {
    const { db, userId } = sqliteContext();
    const id = newId();
    const now = nowIso();
    await db.run(
      `INSERT INTO debts (id, user_id, person, amount, date, paid, notes, created_at, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, userId, person, amount, date, paid ? 1 : 0, notes ?? null, now, now],
    );
    return toDebt({ id, user_id: userId, person, amount, date, paid: paid ? 1 : 0, notes: notes ?? null, created_at: now });
  },

  async update(id, payload) {
    const { db, userId } = sqliteContext();
    const [existing] = await db.query(
      `SELECT * FROM debts WHERE id = ? AND user_id = ? AND ${LIVE}`,
      [id, userId],
    );
    if (!existing) throw new RepoError(404, 'Debt not found');

    const next = {
      person: payload.person ?? existing.person,
      amount: payload.amount ?? existing.amount,
      date: payload.date ?? existing.date,
      paid: payload.paid === undefined ? existing.paid : (payload.paid ? 1 : 0),
      notes: payload.notes === undefined ? existing.notes : payload.notes,
    };
    await db.run(
      'UPDATE debts SET person = ?, amount = ?, date = ?, paid = ?, notes = ?, updated_at = ?, dirty = 1 WHERE id = ?',
      [next.person, next.amount, next.date, next.paid, next.notes, nowIso(), id],
    );
    return toDebt({ ...existing, ...next });
  },

  async remove(id) {
    const { db, userId } = sqliteContext();
    const result = await db.run('DELETE FROM debts WHERE id = ? AND user_id = ?', [id, userId]);
    if (result.changes === 0) throw new RepoError(404, 'Debt not found');
  },
};
```

- [ ] **Step 8: Implement the transfer repository**

Create `frontend/src/data/repos/sqlite/transferRepo.js`:

```js
import { sqliteContext } from './context.js';
import { newId, nowIso } from '../../ids.js';
import { toTransfer } from '../../mappers.js';
import { RepoError } from '../../errors.js';

const LIVE = 't.deleted_at IS NULL';

const SELECT = `
  SELECT t.*,
         f.name AS from_wallet_name, f.color AS from_wallet_color,
         d.name AS to_wallet_name,   d.color AS to_wallet_color
  FROM transfers t
  LEFT JOIN wallets f ON f.id = t.from_wallet_id
  LEFT JOIN wallets d ON d.id = t.to_wallet_id
`;

async function assertOwnedWallet(db, userId, walletId) {
  const [row] = await db.query(
    'SELECT id FROM wallets WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [walletId, userId],
  );
  if (!row) throw new RepoError(400, 'Unknown wallet');
}

async function findOne(db, userId, id) {
  const [row] = await db.query(`${SELECT} WHERE t.id = ? AND t.user_id = ? AND ${LIVE}`, [id, userId]);
  if (!row) throw new RepoError(404, 'Transfer not found');
  return row;
}

export const transferRepo = {
  async list(query = {}) {
    const { db, userId } = sqliteContext();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const rows = await db.query(
      `${SELECT} WHERE t.user_id = ? AND ${LIVE} ORDER BY t.date DESC LIMIT ? OFFSET ?`,
      [userId, pageSize, (page - 1) * pageSize],
    );
    const [{ count: total }] = await db.query(
      'SELECT COUNT(*) AS count FROM transfers t WHERE t.user_id = ? AND t.deleted_at IS NULL',
      [userId],
    );
    return {
      items: rows.map(toTransfer),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  async create({ fromWalletId, toWalletId, amount, date, notes }) {
    const { db, userId } = sqliteContext();
    if (fromWalletId === toWalletId) throw new RepoError(400, 'Cannot transfer to the same wallet');
    await assertOwnedWallet(db, userId, fromWalletId);
    await assertOwnedWallet(db, userId, toWalletId);

    const id = newId();
    const now = nowIso();
    await db.run(
      `INSERT INTO transfers (id, user_id, from_wallet_id, to_wallet_id, amount, date, notes, created_at, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, userId, fromWalletId, toWalletId, amount, date, notes ?? null, now, now],
    );
    return toTransfer(await findOne(db, userId, id));
  },

  async update(id, payload) {
    const { db, userId } = sqliteContext();
    const existing = await findOne(db, userId, id);
    const from = payload.fromWalletId ?? existing.from_wallet_id;
    const to = payload.toWalletId ?? existing.to_wallet_id;
    if (from === to) throw new RepoError(400, 'Cannot transfer to the same wallet');
    if (payload.fromWalletId) await assertOwnedWallet(db, userId, payload.fromWalletId);
    if (payload.toWalletId) await assertOwnedWallet(db, userId, payload.toWalletId);

    await db.run(
      `UPDATE transfers SET from_wallet_id = ?, to_wallet_id = ?, amount = ?, date = ?,
       notes = ?, updated_at = ?, dirty = 1 WHERE id = ?`,
      [from, to, payload.amount ?? existing.amount, payload.date ?? existing.date,
        payload.notes === undefined ? existing.notes : payload.notes, nowIso(), id],
    );
    return toTransfer(await findOne(db, userId, id));
  },

  async remove(id) {
    const { db, userId } = sqliteContext();
    await findOne(db, userId, id);
    await db.run('DELETE FROM transfers WHERE id = ?', [id]);
  },
};
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/data/repos/sqlite`
Expected: PASS (21 tests).

- [ ] **Step 10: Commit**

```bash
git add frontend/src/data
git commit -m "feat(data): SQLite transfer, debt, savings and budget repositories"
```

---

### Task 13: Complete the SQLite repository set

**Files:**
- Create: `frontend/src/data/repos/sqlite/{statsRepo,authRepo,index}.js`

**Interfaces:**
- Consumes: the HTTP repos from Task 7.
- Produces: `frontend/src/data/repos/sqlite/index.js` exporting all ten repos, shaped
  identically to `repos/http/index.js`, so `setDataSource` can swap the whole set.

Two repos have no local implementation in Phase 1 and delegate to HTTP by design:
`statsRepo` (the `statsService` port is Phase 2) and `authRepo` (offline unlock is Phase 2).
Delegating rather than throwing keeps the dashboard, analytics and login working online.

- [ ] **Step 1: Delegate stats to HTTP**

Create `frontend/src/data/repos/sqlite/statsRepo.js`:

```js
// Phase 1 has no local aggregation engine — the statsService port lands in Phase 2.
// Until then the dashboard and analytics screens are online-only.
export { statsRepo } from '../http/statsRepo.js';
```

- [ ] **Step 2: Delegate auth to HTTP**

Create `frontend/src/data/repos/sqlite/authRepo.js`:

```js
// Offline unlock is Phase 2. Phase 1 requires network for login and profile changes.
export { authRepo } from '../http/authRepo.js';
```

- [ ] **Step 3: Export the set**

Create `frontend/src/data/repos/sqlite/index.js`:

```js
export { expenseRepo } from './expenseRepo.js';
export { incomeRepo } from './incomeRepo.js';
export { budgetRepo } from './budgetRepo.js';
export { categoryRepo } from './categoryRepo.js';
export { walletRepo } from './walletRepo.js';
export { transferRepo } from './transferRepo.js';
export { debtRepo } from './debtRepo.js';
export { savingsRepo } from './savingsRepo.js';
export { statsRepo } from './statsRepo.js';
export { authRepo } from './authRepo.js';
```

- [ ] **Step 4: Verify both sets expose the same keys**

Create `frontend/src/data/repos/__tests__/parity.test.js`:

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import * as http from '../http/index.js';
import * as sqlite from '../sqlite/index.js';

describe('repository sets', () => {
  it('expose the same repositories', () => {
    expect(Object.keys(sqlite).sort()).toEqual(Object.keys(http).sort());
  });

  it('expose the same methods on every repository', () => {
    for (const name of Object.keys(http)) {
      expect(Object.keys(sqlite[name]).sort(), name).toEqual(Object.keys(http[name]).sort());
    }
  });
});
```

- [ ] **Step 5: Run the test**

Run: `cd frontend && npx vitest run src/data/repos/__tests__/parity.test.js`
Expected: PASS. If it fails, a method is missing from one side — add it rather than
loosening the assertion.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/repos
git commit -m "feat(data): complete the SQLite repository set"
```

---

### Task 14: Hydration, session wiring and on-device verification

**Files:**
- Create: `frontend/src/data/hydrate.js`, `frontend/src/data/session.js`
- Modify: `frontend/src/stores/auth.js`
- Test: `frontend/src/data/__tests__/hydrate.test.js`

**Interfaces:**
- Consumes: HTTP repos (Task 7), SQLite repos (Task 13), `migrate` (Task 5).
- Produces: `hydrate(db, user)` — pulls every resource from the API into SQLite.
- Produces: `onSignedIn(user)` / `onSignedOut()` — no-ops on web, full local setup on device.

**Known limitation to record in the commit message:** the API has no bulk budget endpoint —
`GET /budgets` takes a single `month`. Hydration therefore pulls the current month plus the
previous 11. Budgets outside that window appear empty offline until Phase 3 adds a batch
endpoint. Do not add one now; it is a backend change reserved for Phase 3.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/data/__tests__/hydrate.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repos/http/index.js', () => ({
  categoryRepo: { list: vi.fn() },
  walletRepo: { list: vi.fn() },
  expenseRepo: { list: vi.fn() },
  incomeRepo: { list: vi.fn() },
  transferRepo: { list: vi.fn() },
  debtRepo: { list: vi.fn() },
  savingsRepo: { listGoals: vi.fn() },
  budgetRepo: { list: vi.fn() },
}));

import * as http from '../repos/http/index.js';
import { createNodeDatabase } from '../db/nodeDb.js';
import { migrate } from '../schema/migrate.js';
import { hydrate } from '../hydrate.js';

const USER = { id: 'u1', name: 'Demo', email: 'demo@example.com', createdAt: '2026-01-01T00:00:00.000Z' };
const emptyPage = { items: [], total: 0, page: 1, pageSize: 100, totalPages: 1 };

let db;
beforeEach(async () => {
  db = await createNodeDatabase(':memory:');
  await migrate(db);
  vi.clearAllMocks();
  http.categoryRepo.list.mockResolvedValue([]);
  http.walletRepo.list.mockResolvedValue([]);
  http.expenseRepo.list.mockResolvedValue(emptyPage);
  http.incomeRepo.list.mockResolvedValue(emptyPage);
  http.transferRepo.list.mockResolvedValue(emptyPage);
  http.debtRepo.list.mockResolvedValue({ ...emptyPage, totals: { paid: 0, unpaid: 0 } });
  http.savingsRepo.listGoals.mockResolvedValue([]);
  http.budgetRepo.list.mockResolvedValue([]);
});

describe('hydrate', () => {
  it('stores the signed-in user', async () => {
    await hydrate(db, USER);
    const [row] = await db.query('SELECT * FROM users');
    expect(row).toMatchObject({ id: 'u1', email: 'demo@example.com' });
  });

  it('converts API instants to date-only columns', async () => {
    http.walletRepo.list.mockResolvedValue([
      { id: 'w1', name: 'Cash', color: '#1baf7a', initialBalance: 0, createdAt: '2026-07-01T00:00:00.000Z' },
    ]);
    http.expenseRepo.list.mockResolvedValue({
      ...emptyPage,
      total: 1,
      items: [{
        id: 'e1', title: 'Lunch', amount: 12.5, category: 'Food', walletId: 'w1', notes: null,
        date: '2026-07-15T00:00:00.000Z',
        createdAt: '2026-07-15T02:00:00.000Z', updatedAt: '2026-07-15T02:00:00.000Z',
      }],
    });
    await hydrate(db, USER);
    const [row] = await db.query('SELECT date, created_at FROM expenses');
    expect(row.date).toBe('2026-07-15');
    expect(row.created_at).toBe('2026-07-15T02:00:00.000Z');
  });

  it('follows pagination until every page is pulled', async () => {
    http.expenseRepo.list
      .mockResolvedValueOnce({ items: [{ id: 'e1', title: 'a', amount: 1, category: 'F', date: '2026-07-01T00:00:00.000Z', createdAt: 'x', updatedAt: 'x' }], total: 2, page: 1, pageSize: 1, totalPages: 2 })
      .mockResolvedValueOnce({ items: [{ id: 'e2', title: 'b', amount: 1, category: 'F', date: '2026-07-02T00:00:00.000Z', createdAt: 'x', updatedAt: 'x' }], total: 2, page: 2, pageSize: 1, totalPages: 2 });
    await hydrate(db, USER);
    const [{ count }] = await db.query('SELECT COUNT(*) AS count FROM expenses');
    expect(count).toBe(2);
  });

  it('replaces previous local rows rather than duplicating them', async () => {
    http.categoryRepo.list.mockResolvedValue([
      { id: 'c1', name: 'Food', color: '#eda100', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
    await hydrate(db, USER);
    await hydrate(db, USER);
    const [{ count }] = await db.query('SELECT COUNT(*) AS count FROM categories');
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/data/__tests__/hydrate.test.js`
Expected: FAIL — cannot resolve `../hydrate.js`.

- [ ] **Step 3: Implement hydration**

Create `frontend/src/data/hydrate.js`:

```js
import * as http from './repos/http/index.js';
import { currentMonth, addMonths } from './dates.js';

// The API serialises date-only values as UTC-midnight instants, so slicing the raw ISO
// string returns the original calendar date. Never route this through `new Date()` —
// that would shift the day for anyone west of UTC.
const dateOnly = (value) => (value ? String(value).slice(0, 10) : null);

const BUDGET_MONTHS = 12;

async function pullAll(list, params = {}) {
  const items = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await list({ ...params, page, pageSize: 100 });
    items.push(...result.items);
    totalPages = result.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);
  return items;
}

export async function hydrate(db, user) {
  const months = Array.from({ length: BUDGET_MONTHS }, (_, i) => addMonths(currentMonth(), -i));

  const [categories, wallets, expenses, incomes, transfers, debts, goals, budgetPages] =
    await Promise.all([
      http.categoryRepo.list(),
      http.walletRepo.list(),
      pullAll(http.expenseRepo.list),
      pullAll(http.incomeRepo.list),
      pullAll(http.transferRepo.list),
      pullAll(http.debtRepo.list),
      http.savingsRepo.listGoals(),
      Promise.all(months.map((month) => http.budgetRepo.list(month))),
    ]);

  await db.transaction(async () => {
    for (const table of [
      'expenses', 'incomes', 'transfers', 'debts', 'savings_contributions',
      'savings_goals', 'budgets', 'categories', 'wallets', 'users',
    ]) {
      await db.exec(`DELETE FROM ${table}`);
    }

    // Server rows are clean by definition: dirty = 0, synced_at = now.
    const synced = new Date().toISOString();
    const stamps = (row) => [row.updatedAt ?? row.createdAt, synced];

    await db.run(
      `INSERT INTO users (id, name, email, avatar, created_at, updated_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.name, user.email, user.avatar ?? null, user.createdAt, user.createdAt, synced],
    );

    for (const c of categories) {
      await db.run(
        `INSERT INTO categories (id, user_id, name, color, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [c.id, user.id, c.name, c.color, c.createdAt, ...stamps(c)],
      );
    }

    for (const w of wallets) {
      await db.run(
        `INSERT INTO wallets (id, user_id, name, color, initial_balance, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [w.id, user.id, w.name, w.color ?? null, w.initialBalance, w.createdAt, ...stamps(w)],
      );
    }

    for (const e of expenses) {
      await db.run(
        `INSERT INTO expenses (id, user_id, title, amount, category, wallet_id, notes, date, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [e.id, user.id, e.title, e.amount, e.category, e.walletId ?? null, e.notes ?? null,
          dateOnly(e.date), e.createdAt, ...stamps(e)],
      );
    }

    for (const i of incomes) {
      await db.run(
        `INSERT INTO incomes (id, user_id, source, amount, wallet_id, notes, date, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [i.id, user.id, i.source, i.amount, i.walletId ?? null, i.notes ?? null,
          dateOnly(i.date), i.createdAt, ...stamps(i)],
      );
    }

    for (const t of transfers) {
      await db.run(
        `INSERT INTO transfers (id, user_id, from_wallet_id, to_wallet_id, amount, date, notes, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.id, user.id, t.fromWalletId, t.toWalletId, t.amount, dateOnly(t.date),
          t.notes ?? null, t.createdAt, ...stamps(t)],
      );
    }

    for (const d of debts) {
      await db.run(
        `INSERT INTO debts (id, user_id, person, amount, date, paid, notes, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [d.id, user.id, d.person, d.amount, dateOnly(d.date), d.paid ? 1 : 0,
          d.notes ?? null, d.createdAt, ...stamps(d)],
      );
    }

    for (const g of goals) {
      await db.run(
        `INSERT INTO savings_goals (id, user_id, name, target, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [g.id, user.id, g.name, g.target ?? null, g.createdAt, ...stamps(g)],
      );
      for (const c of g.contributions ?? []) {
        await db.run(
          `INSERT INTO savings_contributions (id, goal_id, amount, date, notes, created_at, updated_at, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [c.id, g.id, c.amount, dateOnly(c.date), c.notes ?? null, c.createdAt, ...stamps(c)],
        );
      }
    }

    for (const budgets of budgetPages) {
      for (const b of budgets) {
        await db.run(
          `INSERT INTO budgets (id, user_id, category, limit_amount, month, created_at, updated_at, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [b.id, user.id, b.category, b.limit, b.month, synced, synced, synced],
        );
      }
    }

    await db.run(
      "INSERT OR REPLACE INTO _meta (key, value) VALUES ('hydrated_at', ?)",
      [synced],
    );
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/data/__tests__/hydrate.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire the session lifecycle**

Create `frontend/src/data/session.js`:

```js
import { Capacitor } from '@capacitor/core';
import { setDataSource } from './source.js';
import * as httpRepos from './repos/http/index.js';

let db = null;

// On web nothing changes: the HTTP repos stay active and no database is opened.
export async function onSignedIn(user) {
  if (!Capacitor.isNativePlatform()) return;

  const [{ createDatabase }, { migrate }, { setSqliteContext }, { hydrate }, sqliteRepos] =
    await Promise.all([
      import('./db/index.js'),
      import('./schema/migrate.js'),
      import('./repos/sqlite/context.js'),
      import('./hydrate.js'),
      import('./repos/sqlite/index.js'),
    ]);

  db = await createDatabase();
  await migrate(db);
  setSqliteContext({ db, userId: user.id });

  // Hydration runs while the HTTP repos are still active, then reads go local.
  await hydrate(db, user);
  setDataSource(sqliteRepos);
}

export async function onSignedOut() {
  setDataSource(httpRepos);
  if (db) {
    await db.close();
    db = null;
  }
}
```

- [ ] **Step 6: Call the lifecycle hooks from the auth store**

In `frontend/src/stores/auth.js`, add the import:

```js
import { onSignedIn, onSignedOut } from '../data/session.js';
```

Then append `await onSignedIn(this.user);` as the last line of both `register` and `login`,
and add `await onSignedOut();` inside `logout`'s `finally` block after `this.user = null;`.

- [ ] **Step 7: Run the full suite**

Run: `cd frontend && npm test`
Expected: every test passes. Then confirm the backend is untouched:

```bash
git status --short backend
```

Expected: no output.

- [ ] **Step 8: Verify offline CRUD on the device**

```bash
cd frontend && npm run sync:android && cd android && ./gradlew assembleDebug && adb install -r app/build/outputs/apk/debug/app-debug.apk
```

With the backend running, log in on the device and let the dashboard load. Then **enable
airplane mode** and check each of these:

1. Expenses list renders, filters, sorts and pages.
2. Creating, editing, duplicating and deleting an expense all work.
3. Wallets page shows balances that match what was on screen before airplane mode.
4. Debts toggle paid; savings goals accept a contribution and the rollups update.
5. Budgets page shows the current month's progress bars.
6. Dashboard and Analytics fail to load — **this is expected in Phase 1** and is what
   Phase 2 fixes.

Then disable airplane mode, force-stop the app and relaunch it. Expected: the app requires
network to sign in again, which is the Phase 1 limitation offline auth removes in Phase 2.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/data frontend/src/stores/auth.js
git commit -m "feat(data): hydrate local SQLite after login and swap the data source

The API has no bulk budget endpoint, so hydration pulls the current month
plus the previous 11. Budgets outside that window are empty offline until
Phase 3 adds a batch endpoint."
```

---

## Phase 1 completion checklist

- [ ] `cd frontend && npm test` passes.
- [ ] `cd backend && npm test` passes, and `git status --short backend` is empty.
- [ ] `cd frontend && npm run build` produces a web bundle with no SQLite driver in the main chunk.
- [ ] The Android debug APK installs and the airplane-mode checks in Task 14 Step 8 pass.
- [ ] `grep -rn "services/api" frontend/src/stores` returns only `auth.js`.

## Deliberately not done in Phase 1

| Gap | Lands in |
|-----|----------|
| Dashboard and analytics offline (`statsService` port) | Phase 2 |
| Offline login / cold start without network | Phase 2 |
| Local writes reaching the server | Phase 3 |
| Budgets older than 12 months available offline | Phase 3 |
| CSV/XLSX export offline (`expenseRepo.exportFile` throws) | Phase 5 |
| `expenseRepo.listAllForExport` on either implementation | Phase 5 |
| iOS build verification (impossible on Windows) | needs a Mac |
