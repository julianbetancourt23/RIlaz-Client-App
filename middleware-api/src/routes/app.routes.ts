/**
 * App-facing endpoints. Contract mirrors Source/src/api/client.ts 1:1.
 * CardCode/customer always comes from the verified JWT — never from the body.
 */
import { Router } from 'express';

import { customerAuth } from '../middleware/auth';
import { getSapProvider } from '../providers/factory';
import { reverseGeocode } from '../services/geocode';
import { EQUIPMENT_BRANDS, SERVICE_TYPES, SUPPLY_TYPES } from '../types';

export const appRouter = Router();

/** Public: guests browse the shared catalog without an account. */
appRouter.get('/catalog', async (_req, res, next) => {
  try {
    res.json(await getSapProvider().getCatalog());
  } catch (e) {
    next(e);
  }
});

appRouter.post('/orders/supplies', customerAuth, async (req, res, next) => {
  try {
    const { items, deliveryAddress } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El pedido no tiene artículos' });
    }
    const folio = await getSapProvider().createSalesOrder(req.customer!, {
      items,
      deliveryAddress: typeof deliveryAddress === 'string' ? deliveryAddress : undefined,
    });
    return res.status(201).json(folio);
  } catch (e) {
    return next(e);
  }
});

/** Solicitud de Servicio Técnico (4-page wizard). */
appRouter.post('/service/requests', customerAuth, async (req, res, next) => {
  try {
    const {
      company,
      branch,
      branchLat,
      branchLon,
      reporterName,
      phone,
      brand,
      model,
      serial,
      serviceType,
      description,
      supplyType,
      lowTonerAlert,
      counter,
    } = req.body ?? {};

    // Una solicitud no se crea incompleta: se valida página por página.
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    if (!str(company)) return res.status(400).json({ error: 'La empresa o institución es requerida' });
    if (!str(branch)) {
      return res.status(400).json({ error: 'La sucursal / ubicación del equipo es requerida' });
    }
    if (!str(reporterName)) {
      return res.status(400).json({ error: 'El nombre de quien reporta es requerido' });
    }
    if (str(phone).replace(/\D/g, '').length < 8) {
      return res.status(400).json({ error: 'El teléfono de contacto es requerido (mínimo 8 dígitos)' });
    }
    if (!EQUIPMENT_BRANDS.includes(brand)) {
      return res.status(400).json({ error: 'Marca inválida (HP/Lexmark/Toshiba)' });
    }
    if (!str(model)) return res.status(400).json({ error: 'El modelo del equipo es requerido' });
    if (!str(serial)) return res.status(400).json({ error: 'El número de serie es requerido' });
    if (!SERVICE_TYPES.includes(serviceType)) {
      return res.status(400).json({ error: 'El tipo de servicio es requerido' });
    }
    const isInsumo = serviceType === 'Insumo';
    if (isInsumo) {
      if (!SUPPLY_TYPES.includes(supplyType)) {
        return res.status(400).json({ error: 'El insumo solicitado es requerido' });
      }
      if (typeof lowTonerAlert !== 'boolean') {
        return res.status(400).json({ error: 'Indica si el equipo muestra alerta de bajo nivel' });
      }
      if (!str(counter)) {
        return res.status(400).json({ error: 'El contador actual del equipo es requerido' });
      }
    }
    const coord = (v: unknown, max: number) =>
      typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max ? v : undefined;

    const folio = await getSapProvider().createServiceCall(req.customer!, {
      company: str(company),
      branch: str(branch),
      branchLat: coord(branchLat, 90),
      branchLon: coord(branchLon, 180),
      reporterName: str(reporterName),
      phone: str(phone),
      brand,
      model: str(model),
      serial: str(serial),
      serviceType,
      description: str(description) || undefined,
      supplyType: isInsumo ? supplyType : undefined,
      lowTonerAlert: isInsumo ? lowTonerAlert : undefined,
      counter: isInsumo ? str(counter) : undefined,
    });
    return res.status(201).json(folio);
  } catch (e) {
    return next(e);
  }
});

appRouter.post('/quotes/equipment', customerAuth, async (req, res, next) => {
  try {
    const { description } = req.body ?? {};
    if (typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'La descripción es requerida' });
    }
    const folio = await getSapProvider().createActivity(req.customer!, description.trim());
    return res.status(201).json(folio);
  } catch (e) {
    return next(e);
  }
});

appRouter.get('/equipment', customerAuth, async (req, res, next) => {
  try {
    res.json(await getSapProvider().getEquipment(req.customer!));
  } catch (e) {
    next(e);
  }
});

appRouter.get('/activity', customerAuth, async (req, res, next) => {
  try {
    res.json(await getSapProvider().getRecentActivity(req.customer!));
  } catch (e) {
    next(e);
  }
});

/** Detail of one order/service call/quote, by folio, scoped to the customer. */
appRouter.get('/activity/:folio', customerAuth, async (req, res, next) => {
  try {
    const detail = await getSapProvider().getTicketDetail(req.customer!, req.params.folio);
    if (!detail) return res.status(404).json({ error: 'Solicitud no encontrada' });
    return res.json(detail);
  } catch (e) {
    return next(e);
  }
});

/**
 * Reverse geocoding vía OpenStreetMap Nominatim (proxy con User-Agent propio,
 * como pide su política de uso). Público: la app lo usa antes de tener sesión
 * y no expone nada sensible.
 */
appRouter.get('/geo/reverse', async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return res.status(400).json({ error: 'lat y lon son requeridos' });
    }
    const address = await reverseGeocode(lat, lon);
    if (!address) return res.status(502).json({ error: 'No se pudo obtener la dirección' });
    return res.json({ address });
  } catch (e) {
    return next(e);
  }
});
