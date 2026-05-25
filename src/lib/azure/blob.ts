import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";

/**
 * Azure Blob configuration mirrors askLio's setup:
 * - account URL: AZURE_STORAGE_ACCOUNT_URL (e.g. https://askliobackendstorage.blob.core.windows.net/)
 * - shared key: AZURE_STORAGE_ACCESS_KEY
 * - container: derived from ASKLIO_MONGO_STAGE as `${stage}-fileupload`
 */

let _serviceClient: BlobServiceClient | null = null;
let _credential: StorageSharedKeyCredential | null = null;
let _accountName: string | null = null;

function init() {
  if (_serviceClient && _credential && _accountName) return;
  const accountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL;
  const accessKey = process.env.AZURE_STORAGE_ACCESS_KEY;
  if (!accountUrl || !accessKey) {
    throw new Error(
      "AZURE_STORAGE_ACCOUNT_URL and AZURE_STORAGE_ACCESS_KEY must be set"
    );
  }
  const url = new URL(accountUrl);
  const accountName = url.hostname.split(".")[0];
  _credential = new StorageSharedKeyCredential(accountName, accessKey);
  _serviceClient = new BlobServiceClient(accountUrl, _credential);
  _accountName = accountName;
}

/**
 * Container that holds tenant assets (logos, etc.) reachable with our Azure key.
 *
 * Our Azure credentials are for the staging storage account. The *production*
 * file-upload container lives on a different storage account that we do not
 * have keys for, so we cannot read prod blob paths directly. Empirically the
 * staging container mirrors most prod tenants' `/common/customization/` folders
 * (just with different filenames), so we always look up logos there regardless
 * of which Mongo stage we read tenant metadata from.
 *
 * Override with `ASKLIO_LOGO_CONTAINER` if you ever wire in prod blob keys.
 */
export function getContainerName(): string {
  return process.env.ASKLIO_LOGO_CONTAINER || "staging-fileupload";
}

const LOGO_EXTENSION_PRIORITY = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
const LOGO_EXCLUDE_HINTS = [
  "background",
  "favicon",
  "icon",
  "splash",
  "banner",
  "test",
];

function scoreLogoCandidate(name: string): number {
  const base = name.toLowerCase().split("/").pop() ?? "";
  const ext = (base.match(/\.[a-z0-9]+$/)?.[0] ?? "").toLowerCase();
  const extRank = LOGO_EXTENSION_PRIORITY.indexOf(ext);
  if (extRank === -1) return -1;

  let score = 100 - extRank * 10;
  if (base.includes("logo")) score += 50;
  if (base.includes("company")) score += 20;
  if (base.includes("brand")) score += 10;
  for (const bad of LOGO_EXCLUDE_HINTS) {
    if (base.includes(bad)) score -= 30;
  }
  // Prefer shorter filenames (less likely to be variant N).
  score -= Math.min(base.length, 60) / 10;
  return score;
}

/**
 * Discover the best logo blob path for a tenant by listing
 * `<tenantSlug>/common/customization/` in our logo container and picking the
 * candidate whose filename most looks like a primary logo image.
 *
 * Returns null when the tenant has no customization folder or no image files.
 */
export async function resolveTenantLogoPath(
  tenantSlug: string
): Promise<string | null> {
  if (!tenantSlug) return null;
  try {
    init();
    if (!_serviceClient) return null;

    const container = _serviceClient.getContainerClient(getContainerName());
    const prefix = `${tenantSlug}/common/customization/`;
    let best: { name: string; score: number } | null = null;
    for await (const blob of container.listBlobsFlat({ prefix })) {
      const score = scoreLogoCandidate(blob.name);
      if (score < 0) continue;
      if (!best || score > best.score) best = { name: blob.name, score };
    }
    return best?.name ?? null;
  } catch (err) {
    console.warn(
      `Failed to resolve logo for ${tenantSlug}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Generate a read-only SAS URL for a blob inside the askLio file-upload container.
 * Default expiry is 7 days (logos are refreshed on each tenant-snapshot cron).
 */
export async function getLogoSasUrl(
  blobPath: string,
  expiryDays = 7
): Promise<string | null> {
  if (!blobPath) return null;
  try {
    init();
    if (!_credential || !_accountName) return null;

    const containerName = getContainerName();
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + expiryDays);

    const sas = generateBlobSASQueryParameters(
      {
        containerName,
        blobName: blobPath,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn: expiry,
        protocol: "https" as never,
      },
      _credential
    ).toString();

    return `https://${_accountName}.blob.core.windows.net/${containerName}/${encodeURI(
      blobPath
    )}?${sas}`;
  } catch (err) {
    console.warn(
      `Failed to generate SAS URL for ${blobPath}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
