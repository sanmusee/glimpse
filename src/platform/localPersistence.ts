import { invoke as tauriInvoke } from "@tauri-apps/api/core";

export type ThemePreference = "system" | "light" | "dark";
type TauriInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

export interface PreferenceStore {
  getThemePreference(): Promise<ThemePreference>;
  setThemePreference(themePreference: ThemePreference): Promise<void>;
}

export interface SecretStore {
  getSecret(secretId: string): Promise<string | null>;
  setSecret(secretId: string, secretValue: string): Promise<void>;
  deleteSecret(secretId: string): Promise<void>;
}

export interface LocalPersistence {
  preferences: PreferenceStore;
  secrets: SecretStore;
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function createInMemoryLocalPersistence(initial?: {
  themePreference?: ThemePreference;
}): LocalPersistence {
  let themePreference = initial?.themePreference ?? "system";
  const secrets = new Map<string, string>();

  return {
    preferences: {
      async getThemePreference() {
        return themePreference;
      },
      async setThemePreference(nextThemePreference) {
        themePreference = nextThemePreference;
      },
    },
    secrets: {
      async getSecret(secretId) {
        return secrets.get(secretId) ?? null;
      },
      async setSecret(secretId, secretValue) {
        secrets.set(secretId, secretValue);
      },
      async deleteSecret(secretId) {
        secrets.delete(secretId);
      },
    },
  };
}

export const browserPreviewLocalPersistence = createInMemoryLocalPersistence();

export function createTauriLocalPersistence(invoke: TauriInvoke = tauriInvoke): LocalPersistence {
  return {
    preferences: {
      async getThemePreference() {
        const storedThemePreference = await invoke("get_theme_preference");
        return isThemePreference(storedThemePreference) ? storedThemePreference : "system";
      },
      async setThemePreference(themePreference) {
        await invoke("set_theme_preference", { themePreference });
      },
    },
    secrets: {
      async getSecret(secretId) {
        const secretValue = await invoke("get_secret", { secretId });
        return typeof secretValue === "string" ? secretValue : null;
      },
      async setSecret(secretId, secretValue) {
        await invoke("set_secret", { secretId, secretValue });
      },
      async deleteSecret(secretId) {
        await invoke("delete_secret", { secretId });
      },
    },
  };
}

export function createDefaultLocalPersistence(): LocalPersistence {
  const isTauriRuntime =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  return isTauriRuntime ? createTauriLocalPersistence() : browserPreviewLocalPersistence;
}

export const defaultLocalPersistence = createDefaultLocalPersistence();
