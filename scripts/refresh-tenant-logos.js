#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

// Re-resolves every dashboard tenant's logo against the configured Azure
// container (defaults to `staging-fileupload`) and refreshes its SAS URL.
//
// We previously trusted whatever path lived in prod Mongo's
// `common.customization.company_logo_url`, but those paths point at the *prod*
// storage account, which our keys can't open. Empirically the staging container
// has `<tenant>/common/customization/` folders for ~90% of prod tenants, with
// different filenames, so we list and pick the best image instead.
//
// Run after deploying the snapshot change to backfill existing records without
// waiting for the next snapshot cron.

const { MongoClient } = require("mongodb");
const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
} = require("@azure/storage-blob");
require("dotenv").config({ path: ".env.local", quiet: true });

const LOGO_EXTENSION_PRIORITY = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
const LOGO_EXCLUDE_HINTS = [
  "background",
  "favicon",
  "icon",
  "splash",
  "banner",
  "test",
];

function scoreLogoCandidate(name) {
  const base = name.toLowerCase().split("/").pop() || "";
  const extMatch = base.match(/\.[a-z0-9]+$/);
  const ext = (extMatch ? extMatch[0] : "").toLowerCase();
  const extRank = LOGO_EXTENSION_PRIORITY.indexOf(ext);
  if (extRank === -1) return -1;

  let score = 100 - extRank * 10;
  if (base.includes("logo")) score += 50;
  if (base.includes("company")) score += 20;
  if (base.includes("brand")) score += 10;
  for (const bad of LOGO_EXCLUDE_HINTS) {
    if (base.includes(bad)) score -= 30;
  }
  score -= Math.min(base.length, 60) / 10;
  return score;
}

async function main() {
  const accountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL;
  const accessKey = process.env.AZURE_STORAGE_ACCESS_KEY;
  const containerName =
    process.env.ASKLIO_LOGO_CONTAINER || "staging-fileupload";
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || "implementation-dashboard";
  const stage = process.env.ASKLIO_MONGO_STAGE || "production";

  if (!accountUrl || !accessKey) {
    throw new Error("AZURE_STORAGE_ACCOUNT_URL/ACCESS_KEY missing");
  }
  if (!mongoUri) throw new Error("MONGODB_URI missing");

  const accountName = new URL(accountUrl).hostname.split(".")[0];
  const cred = new StorageSharedKeyCredential(accountName, accessKey);
  const svc = new BlobServiceClient(accountUrl, cred);
  const container = svc.getContainerClient(containerName);

  const mongo = new MongoClient(mongoUri);
  await mongo.connect();
  const tenants = await mongo
    .db(dbName)
    .collection("tenants")
    .find({}, { projection: { tenantId: 1, displayName: 1 } })
    .toArray();

  console.log(`Refreshing logos for ${tenants.length} tenants...`);

  let resolved = 0;
  let unchanged = 0;
  let missing = 0;
  const missingList = [];

  for (const t of tenants) {
    const slug = t.tenantId.replace(new RegExp(`-${stage}$`), "");
    const prefix = `${slug}/common/customization/`;
    let best = null;
    try {
      for await (const blob of container.listBlobsFlat({ prefix })) {
        const score = scoreLogoCandidate(blob.name);
        if (score < 0) continue;
        if (!best || score > best.score) best = { name: blob.name, score };
      }
    } catch (err) {
      console.warn(`  ${slug}: list failed -`, err.message);
    }

    if (!best) {
      missing++;
      missingList.push(slug);
      await mongo
        .db(dbName)
        .collection("tenants")
        .updateOne(
          { tenantId: t.tenantId },
          { $set: { logoBlobPath: null, logoUrl: null, logoUpdatedAt: null } }
        );
      continue;
    }

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    const sas = generateBlobSASQueryParameters(
      {
        containerName,
        blobName: best.name,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn: expiry,
        protocol: "https",
      },
      cred
    ).toString();
    const logoUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURI(
      best.name
    )}?${sas}`;

    const res = await mongo
      .db(dbName)
      .collection("tenants")
      .updateOne(
        { tenantId: t.tenantId },
        {
          $set: {
            logoBlobPath: best.name,
            logoUrl,
            logoUpdatedAt: new Date(),
          },
        }
      );
    if (res.modifiedCount > 0) resolved++;
    else unchanged++;
  }

  console.log(`\nResolved (or refreshed): ${resolved}`);
  console.log(`Already up to date:      ${unchanged}`);
  console.log(`No logo blobs found:     ${missing}`);
  if (missing) {
    console.log(`  -> ${missingList.join(", ")}`);
  }

  await mongo.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
