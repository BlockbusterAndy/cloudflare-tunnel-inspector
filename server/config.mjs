/**
 * Configuration for the inspector proxy.
 *
 * Every value can be set three ways, in increasing order of precedence:
 *   defaults  <  environment variables  <  CLI flags
 *
 *   node server/proxy.mjs --target-port 8000 --redact
 *   TARGET_PORT=8000 node server/proxy.mjs
 */

export const DEFAULT_REDACTED_HEADERS = [
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
];

const DEFAULTS = {
  proxyHost: "127.0.0.1",
  proxyPort: 8080,
  inspectorHost: "127.0.0.1",
  inspectorPort: 4040,
  targetHost: "127.0.0.1",
  targetPort: 3000,
  maxEntries: 200,
  maxBodyBytes: 256 * 1024,
  redact: [],
  allowOrigin: [],
  rewriteHost: false,
};

const ENV_KEYS = {
  proxyHost: "PROXY_HOST",
  proxyPort: "PROXY_PORT",
  inspectorHost: "INSPECTOR_HOST",
  inspectorPort: "INSPECTOR_PORT",
  targetHost: "TARGET_HOST",
  targetPort: "TARGET_PORT",
  maxEntries: "MAX_ENTRIES",
  maxBodyBytes: "MAX_BODY_BYTES",
  redact: "REDACT_HEADERS",
  allowOrigin: "ALLOW_ORIGIN",
  rewriteHost: "REWRITE_HOST",
};

// --kebab-case flag -> config key
const FLAG_KEYS = {
  "proxy-host": "proxyHost",
  "proxy-port": "proxyPort",
  "inspector-host": "inspectorHost",
  "inspector-port": "inspectorPort",
  "target-host": "targetHost",
  "target-port": "targetPort",
  "max-entries": "maxEntries",
  "max-body-bytes": "maxBodyBytes",
  redact: "redact",
  "allow-origin": "allowOrigin",
  "rewrite-host": "rewriteHost",
};

const NUMERIC = new Set(["proxyPort", "inspectorPort", "targetPort", "maxEntries", "maxBodyBytes"]);
const LIST = new Set(["redact", "allowOrigin"]);
const BOOLEAN = new Set(["rewriteHost"]);

function parseList(value) {
  return String(value)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function coerce(key, value) {
  if (NUMERIC.has(key)) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 65535) {
      throw new Error(`Invalid value for ${key}: ${value}`);
    }
    return n;
  }
  if (BOOLEAN.has(key)) return value !== "false" && value !== "0";
  if (LIST.has(key)) return parseList(value);
  return String(value);
}

/** Bare `--redact` (no value) turns on the sensible default header list. */
function bareFlagValue(key) {
  if (key === "redact") return DEFAULT_REDACTED_HEADERS;
  if (BOOLEAN.has(key)) return true;
  return null;
}

/**
 * @param {string[]} [argv]
 * @param {Record<string, string | undefined>} [env]
 */
export function resolveConfig(argv = process.argv.slice(2), env = process.env) {
  const config = { ...DEFAULTS };

  for (const [key, envKey] of Object.entries(ENV_KEYS)) {
    const raw = env[envKey];
    if (raw !== undefined && raw !== "") config[key] = coerce(key, raw);
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;

    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    const key = FLAG_KEYS[name];
    if (!key) throw new Error(`Unknown flag: --${name}`);

    if (eq !== -1) {
      config[key] = coerce(key, arg.slice(eq + 1));
      continue;
    }

    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      const bare = bareFlagValue(key);
      if (bare === null) throw new Error(`Flag --${name} requires a value`);
      config[key] = bare;
      continue;
    }
    config[key] = coerce(key, next);
    i++;
  }

  return config;
}

/**
 * Origin check for the inspector API. With no explicit allowlist, any loopback
 * origin is accepted so the UI works on whatever port Next.js picked; anything
 * else on the network is refused.
 */
export function isAllowedOrigin(origin, allowlist = []) {
  if (!origin) return false;
  if (allowlist.length > 0) return allowlist.includes(origin.toLowerCase());
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "http:" && protocol !== "https:") return false;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
  } catch {
    return false;
  }
}
