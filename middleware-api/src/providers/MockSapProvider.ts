/**
 * Mock provider: simulates SAP with the JSON store, so the app and the IT
 * panel can be previewed end-to-end without touching the real system.
 * Documents "created in SAP" are persisted in data/db.json and show up in
 * the panel; folios are sequential like real DocNums.
 */
import { getDb, nextFolio, persist } from '../store/jsonStore';
import type {
  CatalogCategory,
  CatalogItem,
  Customer,
  Machine,
  RecentItem,
  StoredDocument,
  TicketDetail,
} from '../types';
import { CATALOG, findItem } from './catalogFixtures';
import type {
  ISapCustomerProvider,
  ServiceRequestInput,
  SuppliesOrderInput,
} from './ISapCustomerProvider';

const newId = () => `d-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

export class MockSapProvider implements ISapCustomerProvider {
  async getCatalog(): Promise<Record<CatalogCategory, CatalogItem[]>> {
    const overrides = getDb().catalogStock;
    const withStock = (items: CatalogItem[]) =>
      items.map((it) => ({ ...it, inStock: overrides[it.id] ?? it.inStock }));
    return {
      toner: withStock(CATALOG.toner),
      paper: withStock(CATALOG.paper),
      otros: withStock(CATALOG.otros),
    };
  }

  async createSalesOrder(customer: Customer, input: SuppliesOrderInput): Promise<{ folio: string }> {
    const lines = input.items.map(({ id, qty }) => {
      const item = findItem(id);
      if (!item) throw Object.assign(new Error(`Artículo desconocido: ${id}`), { status: 400 });
      if (!Number.isInteger(qty) || qty <= 0) {
        throw Object.assign(new Error(`Cantidad inválida para ${id}`), { status: 400 });
      }
      return { itemId: id, name: item.name, sku: item.sku, unit: item.unit, qty, unitPrice: item.price };
    });
    const doc: StoredDocument = {
      id: newId(),
      kind: 'eq',
      folio: nextFolio('eq'),
      status: 'nuevo',
      customerId: customer.id,
      cardCode: customer.cardCode,
      company: customer.company,
      createdAt: new Date().toISOString(),
      lines,
      total: Math.round(lines.reduce((a, l) => a + l.unitPrice * l.qty, 0) * 100) / 100,
      deliveryAddress: input.deliveryAddress,
    };
    getDb().documents.push(doc);
    persist();
    return { folio: doc.folio };
  }

  async createServiceCall(customer: Customer, input: ServiceRequestInput): Promise<{ folio: string }> {
    const doc: StoredDocument = {
      id: newId(),
      kind: 'sv',
      folio: nextFolio('sv'),
      status: 'nuevo',
      customerId: customer.id,
      cardCode: customer.cardCode,
      company: customer.company,
      createdAt: new Date().toISOString(),
      reportedCompany: input.company,
      branch: input.branch,
      branchLat: input.branchLat,
      branchLon: input.branchLon,
      reporterName: input.reporterName,
      phone: input.phone,
      brand: input.brand,
      machine: { id: '', model: input.model, serial: input.serial },
      serviceType: input.serviceType,
      supplyType: input.supplyType,
      lowTonerAlert: input.lowTonerAlert,
      counter: input.counter,
      description: input.description,
    };
    getDb().documents.push(doc);
    persist();
    return { folio: doc.folio };
  }

  async createActivity(customer: Customer, description: string): Promise<{ folio: string }> {
    const doc: StoredDocument = {
      id: newId(),
      kind: 'ct',
      folio: nextFolio('ct'),
      status: 'nuevo',
      customerId: customer.id,
      cardCode: customer.cardCode,
      company: customer.company,
      createdAt: new Date().toISOString(),
      description,
    };
    getDb().documents.push(doc);
    persist();
    return { folio: doc.folio };
  }

  async getEquipment(customer: Customer): Promise<Machine[]> {
    return customer.machines;
  }

  async getRecentActivity(customer: Customer): Promise<RecentItem[]> {
    return getDb()
      .documents.filter((d) => d.customerId === customer.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10)
      .map((d) => ({
        ref: d.folio,
        kind: d.kind,
        title:
          d.kind === 'eq'
            ? 'Solicitud de insumos'
            : d.kind === 'sv'
              ? d.serviceType === 'Insumo'
                ? `Servicio · Insumo${d.supplyType ? ` (${d.supplyType})` : ''}`
                : d.serviceType
                  ? 'Servicio · Incidencia técnica'
                  : `Servicio · ${d.problem ?? 'Mantenimiento'}`
              : 'Cotización de equipos',
      }));
  }

  async getTicketDetail(customer: Customer, folio: string): Promise<TicketDetail | null> {
    const d = getDb().documents.find(
      (x) => x.folio === folio && x.customerId === customer.id,
    );
    if (!d) return null;
    return {
      folio: d.folio,
      kind: d.kind,
      status: d.status,
      createdAt: d.createdAt,
      lines: d.lines,
      total: d.total,
      deliveryAddress: d.deliveryAddress,
      machine: d.machine ? { model: d.machine.model, serial: d.machine.serial } : d.machine,
      reportedCompany: d.reportedCompany,
      branch: d.branch,
      reporterName: d.reporterName,
      brand: d.brand,
      serviceType: d.serviceType,
      supplyType: d.supplyType,
      lowTonerAlert: d.lowTonerAlert,
      counter: d.counter,
      phone: d.phone,
      problem: d.problem,
      urgency: d.urgency,
      serviceAddress: d.serviceAddress,
      contractType: d.contractType,
      description: d.description,
    };
  }

  async healthCheck() {
    return { mode: 'mock' as const, ok: true, detail: 'Datos simulados (sin SAP)' };
  }
}
