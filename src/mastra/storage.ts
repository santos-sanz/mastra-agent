import { LibSQLStore, LibSQLVector } from '@mastra/libsql';

// Local: file:./mastra.db (por defecto) · Producción (Workers): LIBSQL_URL remoto (Turso) + LIBSQL_AUTH_TOKEN
// En Workers sin LIBSQL_URL se degrada a in-memory (no duradero) hasta configurar la BD remota.
const isWorkers = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';
const libsqlUrl = process.env.LIBSQL_URL ?? (isWorkers ? undefined : 'file:./mastra.db');
const libsqlAuth = process.env.LIBSQL_AUTH_TOKEN;

export const storage = libsqlUrl
  ? new LibSQLStore({ id: 'main-store', url: libsqlUrl, ...(libsqlAuth ? { authToken: libsqlAuth } : {}) })
  : undefined;
export const vector = libsqlUrl
  ? new LibSQLVector({ id: 'main-vector', url: libsqlUrl, ...(libsqlAuth ? { authToken: libsqlAuth } : {}) })
  : undefined;

export function getVector(): LibSQLVector {
  if (!vector) {
    throw new Error('Vector store no disponible: configura LIBSQL_URL (remoto) para usar RAG en este entorno');
  }
  return vector;
}
