import { ENV } from '../config/env';
import type { ISapCustomerProvider } from './ISapCustomerProvider';
import { MockSapProvider } from './MockSapProvider';
import { RealSapProvider } from './RealSapProvider';

let instance: ISapCustomerProvider | null = null;

export function getSapProvider(): ISapCustomerProvider {
  if (!instance) {
    instance = ENV.USE_MOCK_SAP ? new MockSapProvider() : new RealSapProvider();
    console.log(`[sap] Proveedor: ${ENV.USE_MOCK_SAP ? 'MOCK (datos simulados)' : 'REAL (Service Layer)'}`);
  }
  return instance;
}
