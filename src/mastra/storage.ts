import { LibSQLStore, LibSQLVector } from '@mastra/libsql';

// Local: file:./mastra.db · Producción (Workers): LIBSQL_URL remoto (Turso) + LIBSQL_AUTH_TOKEN
const libsqlUrl = process.env.LIBSQL_URL ?? 'file:./mastra.db';
const libsqlAuth = process.env.LIBSQL_AUTH_TOKEN;

export const storage = new LibSQLStore({
  id: 'main-store',
  url: libsqlUrl,
  ...(libsqlAuth ? { authToken: libsqlAuth } : {}),
});
export const vector = new LibSQLVector({
  id: 'main-vector',
  url: libsqlUrl,
  ...(libsqlAuth ? { authToken: libsqlAuth } : {}),
});
