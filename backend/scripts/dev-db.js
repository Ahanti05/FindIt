/**
 * Runs a real MongoDB server for local development without installing MongoDB.
 * The binary is downloaded once by mongodb-memory-server; data is kept in
 * backend/.data/db so it survives restarts.
 *
 *   npm run db         # listens on mongodb://127.0.0.1:27017
 */
const path = require('path');
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = parseInt(process.env.DEV_DB_PORT) || 27017;
const DB_PATH = path.join(__dirname, '..', '.data', 'db');

(async () => {
  fs.mkdirSync(DB_PATH, { recursive: true });
  const server = await MongoMemoryServer.create({
    instance: { port: PORT, dbPath: DB_PATH, storageEngine: 'wiredTiger' },
  });
  console.log(`MongoDB dev server ready at ${server.getUri()}`);
  console.log(`Data directory: ${DB_PATH}`);

  const stop = async () => {
    await server.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})().catch((err) => {
  console.error('Could not start the dev database:', err.message);
  process.exit(1);
});
