# SAP Business One Integration — Architecture Guide

**Project:** Rilaz App de Servicios (customer app) ↔ SAP Business One via Service Layer
**Status:** Middleware built and wired to the app in **mock mode** (`middleware-api\`, July 2026) — the app, IT panel and endpoints work end-to-end with simulated data. Real SAP connection pending: implement `middleware-api/src/providers/RealSapProvider.ts` per §5–§6 and set `USE_MOCK_SAP=false`.
**Companion doc:** `Source\CLAUDE.md` (app spec) · `middleware-api\README.md` (how to run) · Reference implementation: `C:\Users\jbeta\Desktop\rilaz-project` (field-technician backend)

---

## 1. Architecture overview

```
┌─────────────────────┐         ┌──────────────────────────────┐         ┌──────────────────────────────┐
│  Customer app        │  HTTPS  │  customer middleware (NEW)   │  HTTPS  │  SAP B1 Service Layer        │
│  (Expo/React Native, │────────▶│  Node/Express + TypeScript   │────────▶│  https://192.168.1.30:50000  │
│  phones, anywhere)   │  JWT    │  LAN host, port 3001         │ B1SESSION│  /b1s/v1                    │
└─────────────────────┘         │  MySQL (customers) + mock    │  cookie │  CompanyDB + SAP user creds  │
        ▲                        └──────────────────────────────┘         └──────────────────────────────┘
        │                                                                            ▲
   internet exposure via                 ┌──────────────────────────────┐            │
   tunnel / reverse proxy                │  technician middleware        │────────────┘
   (subdomain, like the                  │  (rilaz-project, port 3000)   │  unchanged, keeps running
   existing rilaz.bluefoxsv.com)         └──────────────────────────────┘
```

Two backends, side by side on the same LAN host (currently `192.168.1.147`):

- **`rilaz-project\middleware-api`** — the existing, production technician backend. **Not touched.**
- **`middleware-api\`** (new, sibling folder of `Source\` in this project) — the customer backend, built by **copying the proven patterns** from rilaz-project and using the **same SAP credentials** (in `rilaz-project\middleware-api\.env` — never committed, never printed in docs).

### Why the app must not call SAP directly

1. **Credentials** — the Service Layer login is a full SAP user (`CompanyDB` + `UserName` + `Password`). It can read/write *everything*. It must live only on the server.
2. **One shared SAP session** — SL sessions cost a login (heavy in B1) and time out in ~30 min. The middleware keeps a single cached session for all app users.
3. **Customer scoping** — the middleware injects the logged-in user's `CardCode` into every SAP query/document. A client can never query another client's orders, equipment, or prices.
4. **TLS** — the Service Layer uses a self-signed certificate. Phones should only ever see a proper public certificate on the middleware's domain.
5. **Validation & shaping** — the app's contract (5 functions in `Source\src\api\client.ts`) stays clean; SAP's verbose OData payloads are shaped server-side.

---

## 2. What you will need (checklist)

| Item | Where / status |
|---|---|
| SAP Service Layer URL | ✅ `https://192.168.1.30:50000/b1s/v1` (confirmed live — the API Reference HTML was served from it) |
| CompanyDB name | In `rilaz-project\middleware-api\.env` (`SAP_COMPANY_DB`). ⚠️ Confirm whether it points at **TEST2026** (test) or the production company DB — develop against test first |
| SAP user for the integration | Currently `manager` in rilaz-project. **Recommended:** create a dedicated, least-privilege SAP user for the customer app (see §8) |
| Node.js LTS on the LAN host | ✅ already runs the technician backend |
| MySQL | ✅ already runs for the technician backend (Docker `mysql:8` / Laragon). Add a new schema, e.g. `customer_middleware` |
| A free port on the LAN host | Use **3001** (3000 is taken by the technician API) |
| Public domain + exposure | A subdomain via the same mechanism that serves `rilaz.bluefoxsv.com` (reverse proxy/VPS — config lives outside these repos). E.g. `clientes-api.bluefoxsv.com` |
| Static IP / reserved DHCP for the SAP server | ⚠️ rilaz-project references **two** IPs: `192.168.1.28` (docker-compose `extra_hosts: solucionesr`) vs `192.168.1.30` (live `.env`). Reconcile — the live, working value is `.30` |

---

## 3. Reference implementation — what to copy from rilaz-project

The technician backend already solved every hard problem. Copy these patterns (not the files verbatim — trim technician-specific parts):

| rilaz-project file | What to reuse |
|---|---|
| `middleware-api/src/providers/RealSapProvider.ts` | The SAP client core: axios instance with `httpsAgent: new https.Agent({ rejectUnauthorized: false, family: 4 })` (self-signed cert + forces IPv4 because the `solucionesr` hostname resolves to IPv6 link-local), 30 s timeout, `ensureSession()` login flow, login retry with backoff, proactive session reset every 20 min |
| `middleware-api/src/providers/ISapProviders.ts` + `SapProviderFactory.ts` + `mockSapProvider.ts` | The **provider pattern**: `USE_MOCK_SAP=true` returns canned data with no network — lets app development continue when SAP is unreachable. Define a *new* customer-shaped interface (see §6); don't inherit the 8-method technician contract |
| `middleware-api/src/middleware/auth.middleware.ts` + `src/services/SessionService.ts` | JWT verification + Redis-backed session liveness + `is_active` check. For the customer app, Redis is optional at first — plain JWT expiry is enough to start |
| `middleware-api/src/config/env.validator.ts` | Zod-style env validation at boot |
| `app-mobile/src/services/api.ts` | The Expo client pattern for `Source\src\api\client.ts`: axios instance, request interceptor injecting `Authorization: Bearer <token>` from `expo-secure-store`, response interceptor that clears storage and redirects to login on 401 |
| `docker-compose.yml`, `start-rilaz.cmd`, `backup.bat` | Deployment/runbook patterns (see §9) |
| `middleware-api/.env` | The actual `SAP_BASE_URL`, `SAP_COMPANY_DB`, `SAP_USERNAME`, `SAP_PASSWORD` values. Copy into the new service's own `.env` |

### Improvements to make over the reference (gaps found during review)

1. **Reactive re-login.** The reference only resets the SAP session on a 20-minute timer. If SAP invalidates the session early, the in-flight request just fails. Add an axios **response interceptor**: on HTTP 401 with SAP error code `301` ("Invalid session or session already timeout"), re-login once and replay the request. Keep the timer as belt-and-suspenders.
2. **Capture `ROUTEID`.** The official guide states both `B1SESSION` **and** `ROUTEID` cookies are mandatory on every request (the ROUTEID drives load-balancer stickiness). The reference only stores `B1SESSION` — it works on single-node installs but breaks on load-balanced ones. Store and send both.
3. **Restrict CORS.** The reference uses `origin: '*'`. The customer API should allow only the app (native apps don't send Origin; lock it down for the web build).
4. **⚠️ Found in the existing project, fix there:** `rilaz-project\middleware-api\.env` currently has `MASTER_LOGIN_ENABLED=true` — the `admin`/`000000` master login is **active in production**. The `.env.example` itself says to keep it `false` in production. Disable it.

---

## 4. Service Layer fundamentals

Everything below is from the official guide (*Working with SAP Business One Service Layer* v1.22) and verified against this installation's own API Reference.

### 4.1 Login / session

```http
POST https://192.168.1.30:50000/b1s/v1/Login
Content-Type: application/json

{"CompanyDB": "<company db>", "UserName": "<sap user>", "Password": "<password>"}
```

Success (`200`):

```http
Set-Cookie: B1SESSION=PTRzIjYK-...; HttpOnly;
Set-Cookie: ROUTEID=.node1; path=/b1s

{"SessionId": "PTRzIjYK-...", "Version": "1000110", "SessionTimeout": 30}
```

- Send **both cookies on every subsequent request**: `Cookie: B1SESSION=...; ROUTEID=.node1`
- Session lifetime ≈ **30 minutes** (`SessionTimeout`), renewed by activity.
- Expired/invalid session → `401` with body:

```json
{"error": {"code": 301, "message": {"lang": "en-us", "value": "Invalid session or session already timeout."}}}
```

- `POST /b1s/v1/Logout` ends the session (`204`).

### 4.2 CRUD pattern (OData)

| Action | Verb | Example | Success |
|---|---|---|---|
| Create | `POST /Entity` + JSON body | `POST /Orders` | `201` + full entity |
| Read one | `GET /Entity(key)` | `GET /Items('56F4H00')`, `GET /Orders(22)` | `200` |
| Read many | `GET /Entity?$filter=...` | see §4.3 | `200`, `value: []` array |
| Update | `PATCH /Entity(key)` (partial — preferred over PUT) | `PATCH /BusinessPartners('C20000')` | `204` |
| Delete | `DELETE /Entity(key)` | (sales orders can't be deleted — use the `Cancel` action) | `204` |

String keys use quotes (`Items('A001')`), integer keys don't (`Orders(22)`). Add header `Prefer: return-no-content` on POST to skip the (large) entity echo when you only need success/failure. Errors always come in the envelope shown above (`error.code`, `error.message.value`).

### 4.3 Query options (the ones this integration needs)

```
GET /Items?$select=ItemCode,ItemName,QuantityOnStock,ItemsGroupCode,SalesUnit
          &$filter=SalesItem eq 'tYES' and Valid eq 'tYES' and ItemsGroupCode eq 105
          &$orderby=ItemName asc
          &$top=20&$skip=0
```

- `$select` — only the fields you need (payloads are huge otherwise).
- `$filter` — `eq/ne/gt/lt/and/or`, `contains(ItemName,'toner')`. Enum values as strings (`'tYES'`).
- `$top`/`$skip` — pagination (SL also caps page size server-side and returns `odata.nextLink`).
- `$orderby`, `$inlinecount=allpages` (total count for pagination UIs).

---

## 5. Data mapping — app concept → SAP object

Confirmed present in this installation's API Reference: `Items`, `Orders`, `ServiceCalls`, `BusinessPartners`, `CustomerEquipmentCards`, `ServiceContracts`, `SalesOpportunities`, `Activities`, `Quotations`, `Warehouses`, `PriceLists`, `ItemGroups`.

| App flow (client.ts) | SAP object | Key fields | Folio shown in app |
|---|---|---|---|
| `login` | middleware `customers` table → validates against `BusinessPartners.CardCode` | email, password_hash, card_code | — |
| `fetchCatalog` | `Items` + `ItemGroups` (→ Tóner/Papel/Otros tabs) + `ItemPrices` (price list) + `ItemWarehouseInfoCollection.InStock` (live stock) | ItemCode, ItemName, QuantityOnStock, SalesUnit | — |
| `submitSuppliesOrder` | **`Orders`** (Sales Order) | CardCode, DocDueDate, Comments, DocumentLines | **`DocNum`** → `EQ-{DocNum}` |
| `submitServiceRequest` | **`ServiceCalls`** | **CustomerCode** (⚠️ not CardCode here), Subject, Description, Priority, ItemCode, InternalSerialNum | **`ServiceCallID`** → `SV-{ID}` |
| `submitEquipmentQuote` | `Activities` (simplest: a note/task for sales) — upgrade path: `SalesOpportunities` | CardCode, Notes, ActivityDate | `ActivityCode` → `CT-{code}` |
| Home: *equipos en contrato* | `CustomerEquipmentCards` | CustomerCode, ItemCode, ItemDescription, InternalSerialNum, EquipmentCardNum | — |
| *Actividad reciente* | `Orders` + `ServiceCalls` filtered by CardCode, `$orderby` date desc, `$top=10` | — | — |

### 5.1 Create a Sales Order (supplies order)

```http
POST /b1s/v1/Orders
{
  "CardCode": "C20000",
  "DocDueDate": "2026-07-15",
  "Comments": "Pedido desde app Rilaz — entrega: Col. Escalón, San Salvador",
  "DocumentLines": [
    { "ItemCode": "56F4H00", "Quantity": 2 },
    { "ItemCode": "PP-CARTA75", "Quantity": 10 }
  ]
}
```

`201` → response contains `DocEntry` (internal key) and **`DocNum`** (the human number → folio). Notes:

- **Omit `UnitPrice`** — SAP applies the business partner's assigned price list automatically (this is how per-client pricing works with zero extra code; special negotiated prices come from SAP's `SpecialPrices` too).
- **Tax:** depending on the El Salvador localization setup, `TaxCode` per line may be required (IVA). Test with one order in the test DB; if SL rejects for missing tax, add the code the accounting team uses on manual orders.
- Delivery address: pass the saved app location either as `Comments` (simplest, shown above) or properly via `AddressExtension.ShipToStreet` / `ShipToCode`.

### 5.2 Create a Service Call (maintenance request)

```http
POST /b1s/v1/ServiceCalls
{
  "CustomerCode": "C20000",
  "Subject": "Atasco de papel — Lexmark MS421",
  "Description": "El equipo atasca cada 5 páginas. Urgencia: Alta.",
  "Priority": "scp_High",
  "ItemCode": "LEX-MS421",
  "InternalSerialNum": "SN-482913"
}
```

`201` → response contains **`ServiceCallID`** (→ folio). Mapping from the app's urgency: `Baja → scp_Low`, `Media → scp_Medium`, `Alta → scp_High`. `ItemCode` + `InternalSerialNum` link the call to the machine's equipment card — this is why the app's QR/serial capture should match `CustomerEquipmentCards.InternalSerialNum` (open item, §11). The technician backend already creates ServiceCalls (`RealSapProvider.createTicket`) — reuse its field mapping as a starting point.

The app's ticket form also collects (all mandatory, validated app- and server-side): **service
address** (map to the call's address fields or `Resolution`/remarks), **contact phone** (→
`TelNumber` / the BP contact person's phone), and **contract type** (Renta/Venta/Leasing/
Garantía/Sin contrato — informational until linked to `ServiceContracts`/`ContractID`).

### 5.3 Catalog & stock reads

```
GET /Items?$select=ItemCode,ItemName,ItemsGroupCode,SalesUnit,QuantityOnStock
          &$filter=SalesItem eq 'tYES' and Valid eq 'tYES'&$orderby=ItemName&$top=50

GET /Items('56F4H00')?$select=ItemCode,ItemPrices,ItemWarehouseInfoCollection
```

- `QuantityOnStock` = total on-hand → the app's `inStock` boolean (`> 0`), or per-warehouse via `ItemWarehouseInfoCollection[].InStock` if only some warehouses serve app orders.
- `ItemPrices[]` has one `{PriceList, Price}` entry per price list — pick the client's list (from `BusinessPartners('C20000').PriceListNum`) or one designated "app" list.
- `ItemsGroupCode` → app tabs. Get codes once via `GET /ItemGroups?$select=Number,GroupName` (open item: which groups = Tóner/Papel/Otros).
- The *"Para tus equipos"* section (model → compatible supplies, today a regex in `Source\src\data\compatibility.ts`) becomes a small mapping table in the middleware DB (§6.2) — or a SAP user-defined table if Rilaz prefers to maintain it inside SAP.

### 5.4 Rented equipment & recent activity

```
GET /CustomerEquipmentCards?$filter=CustomerCode eq 'C20000'
    &$select=EquipmentCardNum,ItemCode,ItemDescription,InternalSerialNum,StatusOfSerialNumber

GET /Orders?$select=DocNum,DocDate,DocTotal,DocumentStatus&$filter=CardCode eq 'C20000'
    &$orderby=DocDate desc&$top=10

GET /ServiceCalls?$select=ServiceCallID,Subject,CreationDate,Status
    &$filter=CustomerCode eq 'C20000'&$orderby=CreationDate desc&$top=10
```

These power Home's *equipos en contrato* and *actividad reciente* (both currently mocked in-session).

---

## 6. Customer middleware design

New folder: `Rilaz APP de Servicios\middleware-api\` (sibling of `Source\`). Node 18+ / Express / TypeScript, mirroring rilaz-project's layout (`src/routes`, `src/services`, `src/providers`, `src/middleware`, `src/config`, `src/models`).

### 6.1 HTTP contract (matches `Source\src\api\client.ts` 1:1)

| Endpoint | Auth | Maps to client.ts | Behind it |
|---|---|---|---|
| `POST /auth/login` `{email, password}` → `{token, account}` | — | `login()` | bcrypt check vs `customers`; JWT `{customerId, cardCode}`; account fields for the app (name, company, isGuest:false) |
| `GET /catalog` → `{toner: [], papel: [], otros: []}` | JWT | `fetchCatalog()` | `Items` query (§5.3), grouped by `ItemsGroupCode`, priced by the client's price list, cached ~5 min |
| `POST /orders/supplies` `{items:[{id,qty}], deliveryAddress?}` → `{folio}` | JWT | `submitSuppliesOrder()` | `POST /Orders` (§5.1) with `CardCode` from the JWT — never from the request body |
| `POST /service/requests` `{machineId, problem, urgency, description}` → `{folio}` | JWT | `submitServiceRequest()` | `POST /ServiceCalls` (§5.2) |
| `POST /quotes/equipment` `{description}` → `{folio}` | JWT | `submitEquipmentQuote()` | `POST /Activities` |
| `GET /equipment` → `[{model, serial, ...}]` | JWT | (Home, currently session-local) | `CustomerEquipmentCards` (§5.4) |
| `GET /activity` → `[{ref, kind, title, date}]` | JWT | (Home *actividad reciente*) | `Orders` + `ServiceCalls` merged (§5.4) |

The folio the app already renders (`EQ-…`, `SV-…`, `CT-…`) is formed server-side from the real SAP number, replacing `newFolio()`'s random values.

### 6.2 Database (MySQL, new schema `customer_middleware`)

```sql
CREATE TABLE customers (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,            -- bcrypt
  card_code     VARCHAR(15)  NOT NULL,            -- SAP BusinessPartners.CardCode
  contact_name  VARCHAR(100),
  company_name  VARCHAR(100),
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  last_login    DATETIME NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- replaces the regex in Source\src\data\compatibility.ts
CREATE TABLE machine_supplies (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  model_pattern VARCHAR(60) NOT NULL,             -- e.g. 'MS421', 'e-STUDIO 2515'
  item_code     VARCHAR(50) NOT NULL              -- SAP ItemCode of the compatible supply
);
```

Accounts are created by Rilaz (no self-signup): a tiny admin script or panel inserts `email + temp password + card_code`. This is the flexibility the middleware-database approach buys (vs. matching SAP contact emails): guest handling, password resets, and app users that don't need to exist as SAP contacts.

### 6.3 SAP session manager (the core class)

Singleton wrapping one axios instance:

```
state: sessionCookies (B1SESSION + ROUTEID) | null

ensureSession():  if no cookies → POST /Login, capture BOTH Set-Cookie values
request(config):  ensureSession → send with Cookie header
                  on 401 & error.code === 301 → clear cookies, re-login ONCE, replay
timer:            clear cookies every 20 min (proactive, as in rilaz-project)
mutex:            concurrent 401s must trigger a single re-login (queue the rest)
```

Plus the provider seam: `ISapCustomerProvider { getCatalog, createSalesOrder, createServiceCall, createActivity, getEquipment, getRecentActivity, healthCheck }` with a `RealProvider` and a `MockProvider` (fixtures shaped like `Source\src\data\mock.ts`), selected by `USE_MOCK_SAP` — so app development continues even without SAP network access.

### 6.4 Environment (`.env`, gitignored)

```
PORT=3001
SAP_BASE_URL=https://192.168.1.30:50000/b1s/v1/
SAP_COMPANY_DB=   ← copy from rilaz-project\middleware-api\.env  (confirm test vs prod!)
SAP_USERNAME=     ← idem (or the new dedicated user, §8)
SAP_PASSWORD=     ← idem
DB_HOST/PORT/USERNAME/PASSWORD/DATABASE (customer_middleware)
JWT_SECRET=       ← generate NEW, do not reuse the technician API's secret
JWT_EXPIRATION=30d
USE_MOCK_SAP=false
CATALOG_PRICE_LIST=   ← price list number for app clients (open item)
```

---

## 7. App-side changes (separate implementation session)

Only the bodies of the 5 stubs change — signatures stay (`Source\src\api\client.ts` is already the contract):

1. **Config**: add `app.config.js` exposing `apiUrl` via `expo-constants` (dev: `http://<LAN IP>:3001`, prod: the public subdomain). Pattern: `rilaz-project\app-mobile\app.json` + `api.ts`'s `guessDevApiUrl()`.
2. **HTTP client**: axios (or fetch wrapper) with the two interceptors from `app-mobile/src/services/api.ts` — inject `Bearer` token from `expo-secure-store`; on 401 clear storage → login.
3. **Token persistence**: `expo-secure-store` (add dependency); resolve the `TODO(SAP): restore session` in `Source\app\index.tsx` by validating a stored token on launch.
4. **Wire the stubs**: `login` → `/auth/login` (store token), `fetchCatalog` → `/catalog`, the three submits → their endpoints, rendering the returned real folio. Home's equipment/recent lists move from session-mock to `/equipment` + `/activity` when ready (Phase 4).

---

## 8. Security

- **Never expose port 50000** (Service Layer) or 3306 (MySQL) to the internet. Only the middleware's port goes public, via the reverse proxy/tunnel that already serves `rilaz.bluefoxsv.com` (suggest `clientes-api` subdomain with a proper certificate).
- **Dedicated SAP user** for this integration instead of `manager`: create a B1 user licensed for Service Layer with permissions limited to Items (read), Orders (add), Service Calls (add), Activities (add), Equipment Cards (read). If credentials ever leak, the blast radius is small and you can revoke without breaking the technician app.
- **JWT**: new `JWT_SECRET` (don't share with the technician API), expiry (30 d like the reference is fine for business clients), and the `CardCode` always taken from the verified token — request bodies never carry it.
- **Rate limiting** on `/auth/login` (the reference has `MAX_FAILED_ATTEMPTS` + lockout — copy it) and modest global limits.
- **TLS to SAP**: `rejectUnauthorized: false` is acceptable on the trusted LAN segment (it's what production runs today); the clean alternative is exporting the SL certificate and passing it via `NODE_EXTRA_CA_CERTS`.
- **Fix in rilaz-project** (pre-existing, unrelated to this build): set `MASTER_LOGIN_ENABLED=false` in its production `.env` — the `admin`/`000000` master login is currently active.

---

## 9. Deployment (LAN host, next to the technician backend)

- **Process**: same options as the reference — Docker Compose (add a `customer-backend` service on `3001:3001`, reusing the existing `db`/`redis` containers or its own) **or** the simpler `start-*.cmd` + Laragon MySQL pattern of `start-rilaz.cmd`. Match whichever is actually used in production today.
- **Keep SAP host resolution explicit**: use the IP (`192.168.1.30`) in `SAP_BASE_URL`, as the live `.env` does (the `solucionesr` hostname resolves to IPv6 link-local — that's why the reference forces `family: 4`). Reconcile the stale `192.168.1.28` in `docker-compose.yml` `extra_hosts`.
- **Backups**: clone `backup.bat` for the `customer_middleware` schema (mysqldump → zip → NAS `\\192.168.1.26`, 14-day retention).
- **Logs/health**: keep the reference's `/help/sap` health-check idea — a `GET /health` that pings SL `$metadata` and reports session state.

---

## 10. Phased roadmap & test plan

**Phase 0 — Verify access (no code).** From the LAN host:

```bash
# 1. Reachability (expects an OData error response — that's success)
curl -k https://192.168.1.30:50000/b1s/v1/

# 2. Login (values from rilaz-project\middleware-api\.env)
curl -k -i -X POST https://192.168.1.30:50000/b1s/v1/Login \
  -H "Content-Type: application/json" \
  -d '{"CompanyDB":"<db>","UserName":"<user>","Password":"<pass>"}'

# 3. Read items with the returned cookies
curl -k "https://192.168.1.30:50000/b1s/v1/Items?\$top=5&\$select=ItemCode,ItemName,QuantityOnStock" \
  -H "Cookie: B1SESSION=<SessionId>; ROUTEID=<routeid>"

# 4. Item groups (to map Tóner/Papel/Otros)
curl -k "https://192.168.1.30:50000/b1s/v1/ItemGroups?\$select=Number,GroupName" \
  -H "Cookie: B1SESSION=<SessionId>; ROUTEID=<routeid>"
```

**Phase 1 — Read-only catalog.** Scaffold middleware (SAP session manager + mock provider + `/auth/login` + `/catalog`), seed one customer row, wire the app's `login` + `fetchCatalog`. *Risk: zero (no writes).*

**Phase 2 — Sales orders.** `POST /orders/supplies` → `Orders` **against the test CompanyDB (TEST2026)**; verify the order appears correctly in the SAP client (lines, price list, tax); then wire the app's cart flow and real `EQ-` folios. Resolve the TaxCode question here.

**Phase 3 — Service calls + quotes.** `/service/requests` and `/quotes/equipment`; verify a ServiceCall lands with correct priority/serial linkage; wire maintenance + quote screens (`SV-`, `CT-` folios).

**Phase 4 — Live equipment & activity.** `/equipment` + `/activity`; Home shows real *equipos en contrato* and *actividad reciente*; QR serials validated against `CustomerEquipmentCards`.

Each phase ends with: middleware endpoint tested via curl/Postman → app flow tested in Expo Go against the LAN URL → (Phases 2–3) document visually verified inside SAP Business One.

---

## 11. Open items for Julián

1. **Company DB**: confirm the production company DB name, and that `TEST2026` is a usable test copy for Phases 0–3.
2. **Dedicated SAP user** (§8) — create it, or accept reusing the existing credentials initially.
3. **Price list**: which SAP price list applies to app clients (or per-client via `BusinessPartners.PriceListNum`)?
4. **Item groups**: which `ItemGroups` numbers correspond to Tóner / Papel / Otros (Phase 0 curl #4 answers this).
5. **Tax code** for app-created orders (ask accounting what manual orders use).
6. **Serials**: do the QR codes on machines (`https://rilaz.com.sv/equipos/{modelo}/{serie}`) match `CustomerEquipmentCards.InternalSerialNum` in SAP?
7. **Public subdomain** for the customer API on the existing `bluefoxsv.com` proxy/VPS.
8. **rilaz-project fixes** (pre-existing): disable `MASTER_LOGIN_ENABLED`, reconcile the `.28`/`.30` SAP IP mismatch.
