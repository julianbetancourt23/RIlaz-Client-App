/**
 * Real SAP B1 Service Layer provider — NOT IMPLEMENTED YET.
 *
 * When it's time to connect (../SAP_INTEGRATION.md is the guide):
 *  - Session manager: POST {SAP_BASE_URL}/Login {CompanyDB, UserName, Password},
 *    capture BOTH Set-Cookie values (B1SESSION and ROUTEID), send them on every
 *    request, re-login once on 401 with error.code 301 and replay (§4.1, §6.3).
 *  - HTTPS agent with the self-signed cert: rejectUnauthorized:false + family:4
 *    (same as rilaz-project/middleware-api/src/providers/RealSapProvider.ts).
 *  - getCatalog       → GET /Items (+ ItemGroups, price list, stock)      §5.3
 *  - createSalesOrder → POST /Orders (CardCode from customer, no UnitPrice) §5.1
 *  - createServiceCall→ POST /ServiceCalls (CustomerCode, scp_* priority)  §5.2
 *  - createActivity   → POST /Activities
 *  - getEquipment     → GET /CustomerEquipmentCards?$filter=CustomerCode…  §5.4
 *  - getRecentActivity→ GET /Orders + /ServiceCalls by CardCode            §5.4
 */
import { ENV } from '../config/env';
import type { CatalogCategory, CatalogItem, Customer, Machine, RecentItem, TicketDetail } from '../types';
import type {
  ISapCustomerProvider,
  ServiceRequestInput,
  SuppliesOrderInput,
} from './ISapCustomerProvider';

const notImplemented = () =>
  Object.assign(
    new Error('RealSapProvider aún no está implementado — usa USE_MOCK_SAP=true. Guía: SAP_INTEGRATION.md'),
    { status: 501 },
  );

export class RealSapProvider implements ISapCustomerProvider {
  constructor() {
    if (!ENV.SAP_COMPANY_DB || !ENV.SAP_USERNAME || !ENV.SAP_PASSWORD) {
      console.warn('[sap] Credenciales SAP incompletas en .env (SAP_COMPANY_DB / SAP_USERNAME / SAP_PASSWORD)');
    }
  }

  async getCatalog(): Promise<Record<CatalogCategory, CatalogItem[]>> {
    throw notImplemented();
  }
  async createSalesOrder(_c: Customer, _i: SuppliesOrderInput): Promise<{ folio: string }> {
    throw notImplemented();
  }
  async createServiceCall(_c: Customer, _i: ServiceRequestInput): Promise<{ folio: string }> {
    throw notImplemented();
  }
  async createActivity(_c: Customer, _d: string): Promise<{ folio: string }> {
    throw notImplemented();
  }
  async getEquipment(_c: Customer): Promise<Machine[]> {
    throw notImplemented();
  }
  async getRecentActivity(_c: Customer): Promise<RecentItem[]> {
    throw notImplemented();
  }
  async getTicketDetail(_c: Customer, _folio: string): Promise<TicketDetail | null> {
    throw notImplemented();
  }
  async healthCheck() {
    return { mode: 'sap' as const, ok: false, detail: 'RealSapProvider no implementado' };
  }
}
