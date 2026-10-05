import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Pages are prerendered; API responses and provider caching use the existing
// application/Redis logic. No ISR, R2, or additional database is needed.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
