/**
 * Shared types. The app-facing shapes (CatalogItem, Machine, SavedLocation,
 * RecentItem, account payload) mirror Source/src/data/*.ts — they are the
 * contract with the mobile app and must stay in sync.
 */

export type CatalogCategory = 'toner' | 'paper' | 'otros';

export type CatalogItem = {
  id: string;
  name: string;
  sku: string;
  detail: string;
  unit: string;
  /** Unit price in USD. Real: SAP price list per client (SAP_INTEGRATION.md §5.3). */
  price: number;
  /** Real: SAP Items.QuantityOnStock > 0. */
  inStock: boolean;
};

export type Machine = {
  id: string;
  model: string;
  serial: string;
  info: string;
};

export type SavedLocation = {
  id: string;
  label: string;
  address: string;
};

export type RecentItem = {
  ref: string;
  kind: 'eq' | 'sv' | 'ct';
  title: string;
};

export type Customer = {
  id: string;
  email: string;
  passwordHash: string;
  /** SAP BusinessPartners.CardCode — mock values until SAP is wired. */
  cardCode: string;
  name: string;
  company: string;
  /** Contact phone — autofills the service request form in the app. */
  phone?: string;
  isActive: boolean;
  machines: Machine[];
  locations: SavedLocation[];
  createdAt: string;
  lastLogin: string | null;
};

export type DocumentKind = 'eq' | 'sv' | 'ct';
export type DocumentStatus = 'nuevo' | 'procesado';

export type OrderLine = {
  itemId: string;
  name: string;
  sku: string;
  unit: string;
  qty: number;
  unitPrice: number;
};

/** A document created from the app: order (eq), service call (sv) or quote (ct). */
export type StoredDocument = {
  id: string;
  kind: DocumentKind;
  folio: string;
  status: DocumentStatus;
  customerId: string;
  cardCode: string;
  company: string;
  createdAt: string;
  /** eq */
  lines?: OrderLine[];
  total?: number;
  deliveryAddress?: string;
  /** sv — Solicitud de Servicio Técnico (wizard) */
  machine?: { id: string; model: string; serial: string } | null;
  /** Empresa o Institución as typed in the form (may differ from the account's company). */
  reportedCompany?: string;
  /** Sucursal / ubicación exacta del equipo. */
  branch?: string;
  branchLat?: number;
  branchLon?: number;
  reporterName?: string;
  phone?: string;
  brand?: EquipmentBrand;
  serviceType?: ServiceType;
  supplyType?: SupplyType;
  lowTonerAlert?: boolean;
  counter?: string;
  /** sv — legacy fields from the pre-wizard "Solicitar mantenimiento" form. */
  problem?: string;
  urgency?: 'Baja' | 'Media' | 'Alta';
  serviceAddress?: string;
  contractType?: ContractType;
  /** sv + ct */
  description?: string;
};

/** Legacy (pre-wizard tickets only). */
export const CONTRACT_TYPES = ['Renta', 'Venta', 'Leasing', 'Garantía', 'Sin contrato'] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const EQUIPMENT_BRANDS = ['HP', 'Lexmark', 'Toshiba'] as const;
export type EquipmentBrand = (typeof EQUIPMENT_BRANDS)[number];

export const SERVICE_TYPES = ['Incidencia Técnica / Correctivo', 'Insumo'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SUPPLY_TYPES = ['Tóner', 'Kit de mantenimiento', 'Unidad de imagen'] as const;
export type SupplyType = (typeof SUPPLY_TYPES)[number];

/** Detail of one document, shaped for the app's ticket screen. */
export type TicketDetail = {
  folio: string;
  kind: DocumentKind;
  status: DocumentStatus;
  createdAt: string;
  lines?: OrderLine[];
  total?: number;
  deliveryAddress?: string;
  machine?: { model: string; serial: string } | null;
  reportedCompany?: string;
  branch?: string;
  reporterName?: string;
  brand?: string;
  serviceType?: string;
  supplyType?: string;
  lowTonerAlert?: boolean;
  counter?: string;
  phone?: string;
  /** Legacy (pre-wizard tickets). */
  problem?: string;
  urgency?: string;
  serviceAddress?: string;
  contractType?: string;
  description?: string;
};

export type Db = {
  counters: Record<DocumentKind, number>;
  customers: Customer[];
  documents: StoredDocument[];
  /** Panel overrides of catalog stock, itemId → inStock. */
  catalogStock: Record<string, boolean>;
};

export type AccountPayload = {
  id: string;
  email: string;
  /** Always empty — the app's UserAccount type has the field; never send one. */
  password: '';
  name: string;
  company: string;
  phone?: string;
  machines: Machine[];
  locations: SavedLocation[];
  recent: RecentItem[];
};
