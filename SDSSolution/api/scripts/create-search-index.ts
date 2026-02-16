/**
 * Creates the Azure AI Search index for Safety Document Management.
 * Run: npx tsx scripts/create-search-index.ts
 * Requires: AZURE_SEARCH_ENDPOINT, AZURE_SEARCH_API_KEY in .env
 */
import "dotenv/config";
import { SearchIndexClient, AzureKeyCredential } from "@azure/search-documents";

const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
const apiKey = process.env.AZURE_SEARCH_API_KEY;
const indexName = process.env.AZURE_SEARCH_INDEX ?? "safety-documents";

if (!endpoint || !apiKey) {
  console.error("Missing AZURE_SEARCH_ENDPOINT or AZURE_SEARCH_API_KEY in .env");
  process.exit(1);
}

const indexDefinition = {
  name: indexName,
  fields: [
    {
      name: "id",
      type: "Edm.String" as const,
      key: true,
      filterable: false,
      sortable: false,
      searchable: false,
    },
    {
      name: "companyCode",
      type: "Edm.String" as const,
      filterable: true,
      sortable: true,
      searchable: true,
    },
    {
      name: "filename",
      type: "Edm.String" as const,
      filterable: false,
      sortable: true,
      searchable: true,
    },
    {
      name: "productName",
      type: "Edm.String" as const,
      filterable: false,
      sortable: true,
      searchable: true,
    },
    {
      name: "department",
      type: "Edm.String" as const,
      filterable: true,
      sortable: true,
      searchable: true,
    },
    {
      name: "site",
      type: "Edm.String" as const,
      filterable: true,
      sortable: true,
      searchable: true,
    },
    {
      name: "tags",
      type: "Collection(Edm.String)" as const,
      filterable: true,
      sortable: false,
      searchable: true,
    },
    {
      name: "content",
      type: "Edm.String" as const,
      filterable: false,
      sortable: false,
      searchable: true,
    },
  ],
};

async function main() {
  const client = new SearchIndexClient(endpoint, new AzureKeyCredential(apiKey));

  try {
    const existing = await client.getIndex(indexName);
    if (existing) {
      console.log(`Index "${indexName}" already exists.`);
      console.log("Skipping creation. Delete the index in Azure Portal first if you need to recreate it.");
      return;
    }
  } catch {
    // Index doesn't exist, proceed with creation
  }

  await client.createIndex(indexDefinition);
  console.log(`Index "${indexName}" created successfully.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
