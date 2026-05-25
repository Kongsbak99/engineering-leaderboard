import { MongoClient, type Db } from "mongodb";

const DEFAULT_DASHBOARD_DB = "implementation-dashboard";

let _dashboardClient: MongoClient | null = null;
let _prodClient: MongoClient | null = null;

function buildClient(uri: string): MongoClient {
  return new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10_000,
  });
}

function getDashboardClient(): MongoClient {
  if (!_dashboardClient) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI not set");
    }
    _dashboardClient = buildClient(uri);
  }
  return _dashboardClient;
}

function getProdClient(): MongoClient {
  const prodUri = process.env.MONGODB_PROD;
  // If MONGODB_PROD isn't set, we read tenants from the same cluster the
  // dashboard writes to.
  if (!prodUri) return getDashboardClient();

  if (!_prodClient) {
    _prodClient = buildClient(prodUri);
  }
  return _prodClient;
}

export async function getDashboardDb(): Promise<Db> {
  const client = getDashboardClient();
  await client.connect();
  const dbName = process.env.MONGODB_DB_NAME ?? DEFAULT_DASHBOARD_DB;
  return client.db(dbName);
}

export async function getAsklioDb(tenantId: string): Promise<Db> {
  const client = getProdClient();
  await client.connect();
  const stage = process.env.ASKLIO_MONGO_STAGE ?? "production";
  return client.db(`${tenantId}-${stage}`);
}

export async function listAllDatabases(): Promise<string[]> {
  const client = getProdClient();
  await client.connect();
  const admin = client.db().admin();
  const { databases } = await admin.listDatabases();
  return databases.map((d) => d.name);
}

export async function listDatabaseCollections(
  dbName: string
): Promise<string[]> {
  const client = getProdClient();
  await client.connect();
  const collections = await client
    .db(dbName)
    .listCollections({}, { nameOnly: true })
    .toArray();
  return collections.map((c) => c.name);
}

export function isMongoConfigured(): boolean {
  return !!process.env.MONGODB_URI;
}

export function getDashboardDbName(): string {
  return process.env.MONGODB_DB_NAME ?? DEFAULT_DASHBOARD_DB;
}

export function isUsingSeparateProdCluster(): boolean {
  return !!process.env.MONGODB_PROD;
}
