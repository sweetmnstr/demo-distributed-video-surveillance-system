import { TpmDevice } from './tpm-device';

// Deferred real-hardware path: on Windows 11 this would bind to a CNG key in the
// Platform Crypto Provider (NCryptOpenKey / NCryptDecrypt with a non-exportable
// key). Until the Windows PCP/CNG native binding is implemented on a Windows
// machine, selecting this device throws — the software device is used in CI.
export const createWindowsTpmDevice = (): TpmDevice => {
  throw new Error(
    'WindowsTpmDevice (PCP/CNG) is not available in this environment; use the software TPM device on Linux',
  );
};
