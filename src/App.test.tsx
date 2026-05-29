import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

  it("creates and lists a direct database connection without storing the password in metadata", async () => {
    const localPersistence = createInMemoryLocalPersistence();
    render(<App localPersistence={localPersistence} />);

    fireEvent.change(screen.getByLabelText(/connection name/i), {
      target: { value: "Analytics TiDB" },
    });
    fireEvent.change(screen.getByLabelText(/^host$/i), {
      target: { value: "analytics.internal" },
    });
    fireEvent.change(screen.getByLabelText(/^port$/i), {
      target: { value: "4000" },
    });
    fireEvent.change(screen.getByLabelText(/^username$/i), {
      target: { value: "analyst" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "not-in-sqlite" },
    });
    fireEvent.change(screen.getByLabelText(/default database/i), {
      target: { value: "warehouse" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save connection/i }));

    expect(await screen.findByText("Analytics TiDB")).toBeInTheDocument();
    expect(screen.getByText("analytics.internal:4000 / warehouse")).toBeInTheDocument();

    const [savedConnection] =
      await localPersistence.databaseConnections.listDatabaseConnections();
    expect(savedConnection).toMatchObject({
      name: "Analytics TiDB",
      host: "analytics.internal",
      port: 4000,
      username: "analyst",
      defaultDatabase: "warehouse",
    });
    expect(savedConnection).not.toHaveProperty("password");
    await expect(localPersistence.secrets.getSecret(savedConnection.passwordSecretId)).resolves.toBe(
      "not-in-sqlite",
    );
  });

  it("edits and deletes a saved database connection", async () => {
    const localPersistence = createInMemoryLocalPersistence({
      databaseConnections: [
        {
          id: "db-1",
          name: "Warehouse",
          host: "warehouse.internal",
          port: 3306,
          username: "readonly",
          passwordSecretId: "database-connection:db-1:password",
          defaultDatabase: "analytics",
        },
      ],
    });
    render(<App localPersistence={localPersistence} />);

    expect(await screen.findByText("Warehouse")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /edit warehouse/i }));
    fireEvent.change(screen.getByLabelText(/default database/i), {
      target: { value: "mart" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save connection/i }));

    expect(await screen.findByText("warehouse.internal:3306 / mart")).toBeInTheDocument();
    await expect(localPersistence.databaseConnections.listDatabaseConnections()).resolves.toEqual([
      expect.objectContaining({
        id: "db-1",
        defaultDatabase: "mart",
      }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: /delete warehouse/i }));

    await waitFor(() => expect(screen.queryByText("Warehouse")).not.toBeInTheDocument());
    await expect(localPersistence.databaseConnections.listDatabaseConnections()).resolves.toEqual(
      [],
    );
    await expect(
      localPersistence.secrets.getSecret("database-connection:db-1:password"),
    ).resolves.toBeNull();
  });

  it("manually tests a database connection and shows success or failure", async () => {
    const attempts: string[] = [];
    const localPersistence = createInMemoryLocalPersistence({
      testDatabaseConnection: (input) => {
        attempts.push(input.host);

        return attempts.length === 1
          ? { ok: false, message: "Authentication failed" }
          : { ok: true, message: "Connected to warehouse" };
      },
    });
    render(<App localPersistence={localPersistence} />);

    fireEvent.change(screen.getByLabelText(/connection name/i), {
      target: { value: "Warehouse" },
    });
    fireEvent.change(screen.getByLabelText(/^host$/i), {
      target: { value: "warehouse.internal" },
    });
    fireEvent.change(screen.getByLabelText(/^port$/i), {
      target: { value: "3306" },
    });
    fireEvent.change(screen.getByLabelText(/^username$/i), {
      target: { value: "readonly" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "secret" },
    });
    fireEvent.change(screen.getByLabelText(/default database/i), {
      target: { value: "warehouse" },
    });

    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));
    expect(await screen.findByRole("status")).toHaveTextContent("Authentication failed");

    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));
    expect(await screen.findByRole("status")).toHaveTextContent("Connected to warehouse");
    expect(attempts).toEqual(["warehouse.internal", "warehouse.internal"]);
    expect(screen.queryByText(/ssh tunnel/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/advanced ssl/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/bastion/i)).not.toBeInTheDocument();
  });
});
