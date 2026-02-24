import { BlobServiceClient, BlobSASPermissions } from "@azure/storage-blob";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER ?? "safety-documents";

function getClient() {
  if (!connectionString) throw new Error("AZURE_STORAGE_CONNECTION_STRING not configured");
  return BlobServiceClient.fromConnectionString(connectionString);
}

export const documentsStorageService = {
  async upload(file: Express.Multer.File, companyCode: string): Promise<string> {
    if (!connectionString) {
      // Dev fallback: store path only (no actual upload)
      return `${companyCode}/dev-${Date.now()}-${file.originalname}`;
    }
    const client = getClient();
    const container = client.getContainerClient(containerName);
    await container.createIfNotExists();
    const path = `${companyCode}/${crypto.randomUUID()}-${file.originalname}`;
    const blockBlob = container.getBlockBlobClient(path);
    await blockBlob.uploadData(file.buffer, { blobHTTPHeaders: { blobContentType: file.mimetype } });
    return path;
  },

  async getSignedUrl(blobPath: string, expiresInMinutes = 60): Promise<string> {
    if (!connectionString) return `#dev-placeholder-${blobPath}`;
    const client = getClient();
    const container = client.getContainerClient(containerName);
    const blob = container.getBlobClient(blobPath);
    const sas = await blob.generateSasUrl({
      expiresOn: new Date(Date.now() + expiresInMinutes * 60 * 1000),
      permissions: BlobSASPermissions.parse("r"),
    });
    return sas;
  },

  async getAnonymousShareUrl(blobPath: string, expiresInDays: number): Promise<string> {
    return this.getSignedUrl(blobPath, expiresInDays * 24 * 60);
  },
};
