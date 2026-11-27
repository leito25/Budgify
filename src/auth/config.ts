export interface AuthConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

export class ConfigError extends Error {
  constructor() {
    super("The app settings could not be loaded.");
    this.name = "ConfigError";
  }
}

function isAuthConfig(value: unknown): value is AuthConfig {
  if (typeof value !== "object" || value === null) return false;
  const config = value as Partial<AuthConfig>;
  return (
    typeof config.supabaseUrl === "string" &&
    typeof config.supabasePublishableKey === "string"
  );
}

/** The Supabase address and publishable key, served by the app's own backend. */
export async function loadConfig(): Promise<AuthConfig> {
  let config: unknown;
  try {
    const response = await fetch("/config.json");
    if (!response.ok) throw new ConfigError();
    config = await response.json();
  } catch {
    throw new ConfigError();
  }
  if (!isAuthConfig(config)) throw new ConfigError();
  return config;
}
