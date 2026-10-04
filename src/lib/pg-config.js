import dns from "node:dns";
import net from "node:net";
import { resolve4, resolve6 } from "node:dns/promises";

const FALLBACK_LOOKUP_ERRORS = new Set(["ENOTFOUND", "EAI_AGAIN"]);

async function resolveAddressRecords(hostname) {
  const results = await Promise.allSettled([resolve4(hostname), resolve6(hostname)]);
  const records = [];
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (result.status !== "fulfilled") continue;
    const family = index === 0 ? 4 : 6;
    for (const address of result.value) records.push({ address, family });
  }
  return records;
}

export function createResilientLookup({ systemLookup = dns.lookup, resolveRecords = resolveAddressRecords } = {}) {
  return function resilientLookup(hostname, options, callback) {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    const lookupOptions = options || {};
    systemLookup(hostname, lookupOptions, (error, address, family) => {
      if (!error || !FALLBACK_LOOKUP_ERRORS.has(error.code)) {
        callback(error, address, family);
        return;
      }
      resolveRecords(hostname).then((records) => {
        const candidates = lookupOptions.family
          ? records.filter((record) => record.family === lookupOptions.family)
          : records;
        if (!candidates.length) {
          callback(error);
        } else if (lookupOptions.all) {
          callback(null, candidates);
        } else {
          callback(null, candidates[0].address, candidates[0].family);
        }
      }).catch(() => callback(error));
    });
  };
}

const resilientLookup = createResilientLookup();

class ResilientSocket extends net.Socket {
  constructor(lookup) {
    super();
    this.resilientLookup = lookup;
  }

  connect(port, host) {
    return super.connect({ port, host, lookup: this.resilientLookup });
  }
}

// pg's TLS upgrade still receives the configured hostname after this socket
// connects, preserving Neon SNI and certificate hostname verification.
export function pgConfig(config, { lookup = resilientLookup } = {}) {
  return { ...config, stream: () => new ResilientSocket(lookup) };
}
