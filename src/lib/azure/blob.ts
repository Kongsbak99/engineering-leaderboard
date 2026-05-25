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

export function getContainerName(): string {
  const stage = process.env.ASKLIO_MONGO_STAGE || "production";
  return `${stage}-fileupload`;
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
