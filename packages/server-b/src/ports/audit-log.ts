// Append a tamper-evident entry to commands.log.
export interface AuditLog {
  append(user: string, message: string): Promise<void>;
}
