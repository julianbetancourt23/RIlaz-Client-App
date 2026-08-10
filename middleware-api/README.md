# Rilaz Customer Middleware (mock mode)

Backend de la app de clientes de Rilaz. Por ahora corre en **modo MOCK** — simula
SAP con datos en `data/db.json` para poder previsualizar la app completa sin tocar
el sistema real. La guía para conectar SAP de verdad está en [`../SAP_INTEGRATION.md`](../SAP_INTEGRATION.md).

## Arrancar

```bash
cd middleware-api
npm install        # solo la primera vez
npm run dev        # http://localhost:3001  (se reinicia solo al editar código)
```

Al arrancar imprime la IP LAN — esa es la que usa la app desde un teléfono físico.

- **Panel IT:** http://localhost:3001/panel_it.html — contraseña dev: `000000`
- **Health:** http://localhost:3001/health

## Cuentas demo (app)

| Correo | Contraseña | Datos |
|---|---|---|
| `compras@elroble.sv` | `000000` | 2 equipos, 1 ubicación, actividad |
| `admin@rilaz.com.sv` | `000000` | sin datos |
| `julian.betancourt@rilaz.com.sv` | `000000` | sin datos |

Se pueden crear más clientes desde el panel (sección **Clientes**).

## Endpoints de la app (contrato = `Source/src/api/client.ts`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/auth/login` | — | → `{token, account}` |
| GET | `/catalog` | — | catálogo con stock (público, para invitados) |
| POST | `/orders/supplies` | JWT | pedido de insumos → `{folio}` (EQ-…) |
| POST | `/service/requests` | JWT | mantenimiento → `{folio}` (SV-…) |
| POST | `/quotes/equipment` | JWT | cotización → `{folio}` (CT-…) |
| GET | `/equipment` | JWT | equipos del cliente |
| GET | `/activity` | JWT | actividad reciente |
| GET | `/activity/:folio` | JWT | detalle de un ticket (pantalla de detalle en la app) |
| GET | `/geo/reverse?lat=&lon=` | — | dirección desde coordenadas vía OpenStreetMap Nominatim |

Los folios son secuenciales (como los DocNum reales de SAP) y todo lo que la app
crea aparece al instante en el panel.

## Reiniciar los datos de prueba

Detener el servidor y borrar `data/db.json` — al arrancar de nuevo se siembra
desde cero (3 clientes demo + 2 documentos de ejemplo).

## Estructura

```
src/
  config/env.ts               variables (.env) con defaults de desarrollo
  store/                      "base de datos" JSON (jsonStore + seed)
  providers/
    ISapCustomerProvider.ts   contrato del proveedor SAP
    MockSapProvider.ts        implementación mock (actual)
    RealSapProvider.ts        esqueleto para el Service Layer real (TODO)
    factory.ts                selecciona por USE_MOCK_SAP
  middleware/auth.ts          JWT de clientes y del panel
  routes/                     auth / app / it
public/                       panel_it.html + css + js
```

Cuando toque conectar SAP: implementar `RealSapProvider` siguiendo la guía
(§5–§6 de SAP_INTEGRATION.md), poner `USE_MOCK_SAP=false` y llenar las
credenciales en `.env`. Nada más cambia — la app y el panel usan el mismo contrato.
