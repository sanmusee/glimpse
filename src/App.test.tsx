import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { createInMemoryLocalPersistence } from "./platform/localPersistence";

describe("Glimpse app shell", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("opens directly into the SQL editor-first workbench with setup empty states", () => {
    render(<App localPersistence={createInMemoryLocalPersistence()} />);

    expect(screen.getByRole("main", { name: /glimpse workbench/i })).toBeInTheDocument();
    expect(screen.queryByText(/first-run wizard/i)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /sql editor/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /query results/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /ai assistant/i })).toBeInTheDocument();
    expect(screen.getByText(/configure global ai provider/i)).toBeInTheDocument();
    expect(screen.getByText(/create database connection/i)).toBeInTheDocument();
  });

  it.each(["light", "dark", "system"] as const)(
    "persists and restores the %s theme preference",
    async (themePreference) => {
      const localPersistence = createInMemoryLocalPersistence();
      const { unmount } = render(<App localPersistence={localPersistence} />);

      const themeSelect = screen.getByRole("combobox", { name: /theme preference/i });

      if (themePreference === "system") {
        fireEvent.change(themeSelect, { target: { value: "light" } });
        await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "light"));
      }

      fireEvent.change(themeSelect, {
        target: { value: themePreference },
      });

      await waitFor(() =>
        expect(document.documentElement).toHaveAttribute("data-theme", themePreference),
      );
      await expect(localPersistence.preferences.getThemePreference()).resolves.toBe(themePreference);
      expect(window.localStorage.getItem("glimpse.themePreference")).toBeNull();

      unmount();
      render(<App localPersistence={localPersistence} />);

      await waitFor(() =>
        expect(screen.getByRole("combobox", { name: /theme preference/i })).toHaveValue(
          themePreference,
        ),
      );
      expect(document.documentElement).toHaveAttribute("data-theme", themePreference);
    },
  );

  it("saves and restores the global AI provider configuration", async () => {
    const localPersistence = createInMemoryLocalPersistence();
    const { unmount } = render(<App localPersistence={localPersistence} />);

    fireEvent.change(screen.getByLabelText(/base url/i), {
      target: { value: "https://api.example.test/v1" },
    });
    fireEvent.change(screen.getByLabelText(/api key/i), {
      target: { value: "sk-test-secret" },
    });
    fireEvent.change(screen.getByLabelText(/^model$/i), {
      target: { value: "gpt-4.1-mini" },
    });
    fireEvent.change(screen.getByLabelText(/temperature/i), {
      target: { value: "0.2" },
    });
    fireEvent.change(screen.getByLabelText(/max tokens/i), {
      target: { value: "1200" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save ai configuration/i }));

    await screen.findByText(/ai configuration saved/i);
    expect(screen.getByText(/api key saved/i)).toBeInTheDocument();

    unmount();
    render(<App localPersistence={localPersistence} />);

    await waitFor(() =>
      expect(screen.getByLabelText(/base url/i)).toHaveValue("https://api.example.test/v1"),
    );
    expect(screen.getByLabelText(/^model$/i)).toHaveValue("gpt-4.1-mini");
    expect(screen.getByLabelText(/temperature/i)).toHaveValue(0.2);
    expect(screen.getByLabelText(/max tokens/i)).toHaveValue(1200);
    expect(screen.getByText(/api key saved/i)).toBeInTheDocument();
  });

  it("runs the AI provider test manually and retries only when the user clicks again", async () => {
    const localPersistence = createInMemoryLocalPersistence();
    const aiProviderTester = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "invalid api key" })
      .mockResolvedValueOnce({ ok: true, content: "Streaming AI response" });

    render(<App localPersistence={localPersistence} aiProviderTester={aiProviderTester} />);

    fireEvent.change(screen.getByLabelText(/base url/i), {
      target: { value: "https://api.example.test/v1" },
    });
    fireEvent.change(screen.getByLabelText(/api key/i), {
      target: { value: "sk-test-secret" },
    });
    fireEvent.change(screen.getByLabelText(/^model$/i), {
      target: { value: "gpt-4.1-mini" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save ai configuration/i }));
    await screen.findByText(/ai configuration saved/i);

    fireEvent.click(screen.getByRole("button", { name: /test ai provider/i }));

    await screen.findByText(/ai request failed: invalid api key/i);
    expect(aiProviderTester).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /test ai provider/i }));

    await screen.findByText(/streaming ai response/i);
    expect(aiProviderTester).toHaveBeenCalledTimes(2);
  });
});
