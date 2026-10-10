import { LibSQLStore, LibSQLVector } from '@mastra/libsql';

export const storage = new LibSQLStore({ id: 'main-store', url: 'file:./mastra.db' });
export const vector = new LibSQLVector({ id: 'main-vector', url: 'file:./mastra.db' });
