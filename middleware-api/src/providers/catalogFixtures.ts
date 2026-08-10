/**
 * Mock catalog — same data as the app's Source/src/data/mock.ts so the UI
 * looks identical whether it loads locally or from this API.
 * TODO(SAP): replaced by Items/ItemGroups/price-list queries (§5.3).
 */
import type { CatalogCategory, CatalogItem } from '../types';

export const CATALOG: Record<CatalogCategory, CatalogItem[]> = {
  toner: [
    { id: 't1', name: 'Tóner negro — Alto rendimiento', sku: 'Lexmark 56F4H00', detail: 'MS421/MS521 · ≈ 15,000 páginas', unit: 'unidad', price: 215.0, inStock: true },
    { id: 't2', name: 'Tóner negro — Estándar', sku: 'Lexmark 56F4000', detail: 'MS321/MS421 · ≈ 6,000 páginas', unit: 'unidad', price: 96.0, inStock: true },
    { id: 't3', name: 'Tóner cian', sku: 'Lexmark 71B10C0', detail: 'CS317/CX317 · ≈ 2,300 páginas', unit: 'unidad', price: 92.5, inStock: true },
    { id: 't4', name: 'Tóner magenta', sku: 'Lexmark 71B10M0', detail: 'CS317/CX317 · ≈ 2,300 páginas', unit: 'unidad', price: 92.5, inStock: false },
    { id: 't5', name: 'Tóner amarillo', sku: 'Lexmark 71B10Y0', detail: 'CS317/CX317 · ≈ 2,300 páginas', unit: 'unidad', price: 92.5, inStock: true },
    { id: 't6', name: 'Tóner negro', sku: 'Toshiba T-FC505U-K', detail: 'e-STUDIO 2505AC–5005AC · ≈ 38,400 páginas', unit: 'unidad', price: 85.0, inStock: true },
    { id: 't7', name: 'Tóner cian', sku: 'Toshiba T-FC505U-C', detail: 'e-STUDIO 2505AC–5005AC · ≈ 33,600 páginas', unit: 'unidad', price: 110.0, inStock: true },
    { id: 't8', name: 'Tóner magenta', sku: 'Toshiba T-FC505U-M', detail: 'e-STUDIO 2505AC–5005AC · ≈ 33,600 páginas', unit: 'unidad', price: 110.0, inStock: true },
    { id: 't9', name: 'Tóner amarillo', sku: 'Toshiba T-FC505U-Y', detail: 'e-STUDIO 2505AC–5005AC · ≈ 33,600 páginas', unit: 'unidad', price: 110.0, inStock: false },
    { id: 't10', name: 'Tóner negro', sku: 'Toshiba T-4590', detail: 'e-STUDIO 256–456 · ≈ 36,600 páginas', unit: 'unidad', price: 75.0, inStock: true },
  ],
  paper: [
    { id: 'p1', name: 'Papel bond Carta · 75g', sku: 'PP-CARTA75', detail: 'Resma · 500 hojas', unit: 'resma', price: 4.9, inStock: true },
    { id: 'p2', name: 'Papel bond Oficio · 75g', sku: 'PP-OFICIO75', detail: 'Resma · 500 hojas', unit: 'resma', price: 5.4, inStock: true },
    { id: 'p3', name: 'Papel bond A4 · 80g', sku: 'PP-A480', detail: 'Resma · 500 hojas', unit: 'resma', price: 5.25, inStock: true },
    { id: 'p4', name: 'Papel A3 · 80g', sku: 'PP-A380', detail: 'Resma · 500 hojas', unit: 'resma', price: 9.8, inStock: true },
    { id: 'p5', name: 'Papel fotográfico Carta', sku: 'PP-FOTO', detail: 'Paquete · 50 hojas', unit: 'paquete', price: 12.5, inStock: false },
    { id: 'p6', name: 'Cartulina Carta', sku: 'PP-CARD', detail: 'Paquete · 250 hojas', unit: 'paquete', price: 11.25, inStock: true },
  ],
  otros: [
    { id: 'o1', name: 'Unidad de imagen', sku: 'Lexmark 56F0Z00', detail: 'MS/MX series · ≈ 60,000 páginas', unit: 'unidad', price: 145.0, inStock: true },
    { id: 'o2', name: 'Caja de tóner residual', sku: 'Toshiba TB-FC505', detail: 'e-STUDIO 2505AC–5005AC', unit: 'unidad', price: 18.5, inStock: true },
  ],
};

export const ALL_ITEMS: CatalogItem[] = Object.values(CATALOG).flat();

export const findItem = (id: string): CatalogItem | undefined =>
  ALL_ITEMS.find((x) => x.id === id);
