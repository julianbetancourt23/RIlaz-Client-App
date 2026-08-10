/**
 * Provider seam: everything the customer app needs from "SAP".
 * MockSapProvider (current) fakes it with the JSON store; RealSapProvider
 * will implement it against the B1 Service Layer (../SAP_INTEGRATION.md §5–6).
 */
import type {
  CatalogCategory,
  CatalogItem,
  Customer,
  EquipmentBrand,
  Machine,
  RecentItem,
  ServiceType,
  SupplyType,
  TicketDetail,
} from '../types';

export type SuppliesOrderInput = {
  items: { id: string; qty: number }[];
  deliveryAddress?: string;
};

/** Solicitud de Servicio Técnico (4-page wizard in the app). */
export type ServiceRequestInput = {
  /** Empresa o Institución — prefilled with the account's company but editable. */
  company: string;
  /** Sucursal / ubicación exacta del equipo (free text, optionally picked on a map). */
  branch: string;
  branchLat?: number;
  branchLon?: number;
  reporterName: string;
  phone: string;
  brand: EquipmentBrand;
  model: string;
  serial: string;
  serviceType: ServiceType;
  /** Optional problem description (incidencia técnica). */
  description?: string;
  /** Insumo-only fields. */
  supplyType?: SupplyType;
  lowTonerAlert?: boolean;
  counter?: string;
};

export interface ISapCustomerProvider {
  /** Real: Items + ItemGroups + price list + QuantityOnStock (§5.3). */
  getCatalog(): Promise<Record<CatalogCategory, CatalogItem[]>>;
  /** Real: POST /Orders → DocNum (§5.1). */
  createSalesOrder(customer: Customer, input: SuppliesOrderInput): Promise<{ folio: string }>;
  /** Real: POST /ServiceCalls → ServiceCallID (§5.2). */
  createServiceCall(customer: Customer, input: ServiceRequestInput): Promise<{ folio: string }>;
  /** Real: POST /Activities → ActivityCode. */
  createActivity(customer: Customer, description: string): Promise<{ folio: string }>;
  /** Real: CustomerEquipmentCards by CustomerCode (§5.4). */
  getEquipment(customer: Customer): Promise<Machine[]>;
  /** Real: recent Orders + ServiceCalls by CardCode (§5.4). */
  getRecentActivity(customer: Customer): Promise<RecentItem[]>;
  /**
   * One document by its folio, scoped to the customer — null if not found.
   * Real: Orders?$filter=DocNum eq X and CardCode eq '…' / ServiceCalls(id).
   */
  getTicketDetail(customer: Customer, folio: string): Promise<TicketDetail | null>;
  healthCheck(): Promise<{ mode: 'mock' | 'sap'; ok: boolean; detail: string }>;
}
