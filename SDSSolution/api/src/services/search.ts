import { SearchClient, AzureKeyCredential } from "@azure/search-documents";
import type { Document } from "@prisma/client";

const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
const apiKey = process.env.AZURE_SEARCH_API_KEY;
const indexName = process.env.AZURE_SEARCH_INDEX ?? "safety-documents";

function getClient(): SearchClient<SearchDocument> | null {
  if (!endpoint || !apiKey) return null;
  return new SearchClient(endpoint, indexName, new AzureKeyCredential(apiKey));
}

interface SearchDocument {
  id: string;
  companyCode: string;
  filename: string;
  productName?: string;
  department?: string;
  site?: string;
  tags?: string[];
  content?: string;
}

export const searchService = {
  isConfigured(): boolean {
    return Boolean(endpoint && apiKey);
  },

  async search(opts: {
    query?: string;
    companyCode?: string;
    department?: string;
    site?: string;
    page: number;
    limit: number;
  }) {
    const client = getClient();
    if (!client) return { items: [], total: 0, page: opts.page, limit: opts.limit };

    const filterParts: string[] = [];
    if (opts.companyCode) filterParts.push(`companyCode eq '${opts.companyCode.replace(/'/g, "''")}'`);
    if (opts.department) filterParts.push(`department eq '${opts.department.replace(/'/g, "''")}'`);
    if (opts.site) filterParts.push(`site eq '${opts.site.replace(/'/g, "''")}'`);
    const filter = filterParts.length ? filterParts.join(" and ") : undefined;

    const result = await client.search(opts.query ?? "*", {
      filter,
      skip: (opts.page - 1) * opts.limit,
      top: opts.limit,
      includeTotalCount: true,
    });

    const items: SearchDocument[] = [];
    for await (const r of result.results) {
      if (r.document) items.push(r.document as SearchDocument);
    }
    return {
      items,
      total: result.count ?? 0,
      page: opts.page,
      limit: opts.limit,
    };
  },

  async indexDocument(doc: Document): Promise<void> {
    const client = getClient();
    if (!client) return;
    await client.uploadDocuments([
      {
        id: doc.id,
        companyCode: doc.companyCode,
        filename: doc.filename,
        productName: doc.productName ?? "",
        department: doc.department ?? "",
        site: doc.site ?? "",
        tags: (typeof doc.tags === "string" ? JSON.parse(doc.tags || "[]") : doc.tags) ?? [],
        content: doc.fullText ?? "",
      },
    ]);
  },
};
