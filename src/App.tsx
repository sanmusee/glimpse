import "./styles.css";
import { useEffect, useRef, useState } from "react";
import {
  discoverCandidateTables,
  type DiscoverCandidateTablesInput,
} from "./candidateTableDiscovery";
import {
  generateSqlFromQueryNeed,
  type GenerateSqlFromQueryNeedInput,
  modifySqlFromIntent,
  type ModifySqlFromIntentInput,
  repairSqlFromExecutionError,
  type RepairSqlFromExecutionErrorInput,
} from "./sqlGeneration";
import {
  runStreamingAiProviderTest,
  type AiProviderTestResult,
} from "./aiProviderTestClient";
import {
  AI_PROVIDER_API_KEY_SECRET_ID,
  defaultLocalPersistence,
  type CandidateTable,
  type DatabaseConnection,
  type DatabaseConnectionInput,
  type DatabaseCatalogSnapshot,
  type ExecutionResultMetadata,
  type GlobalAiConfiguration,
  type LocalPersistence,
  type ModelProvider,
  type ModelProviderInput,
  type QuerySession,
  type SqlResultCellValue,
  type SqlResultRow,
  type ThemePreference,
} from "./platform/localPersistence";
import { validateSqlForExecution } from "./sqlExecution";

interface AppProps {
  localPersistence?: LocalPersistence;
  aiProviderTester?: (
    configuration: GlobalAiConfiguration,
    apiKey: string,
  ) => Promise<AiProviderTestResult>;
  candidateTableDiscoverer?: (
    input: DiscoverCandidateTablesInput,
  ) => Promise<CandidateTable[]>;
  sqlGenerator?: (input: GenerateSqlFromQueryNeedInput) => Promise<string>;
  sqlModifier?: (input: ModifySqlFromIntentInput) => Promise<string>;
  sqlRepairer?: (input: RepairSqlFromExecutionErrorInput) => Promise<string>;
}

interface AiConfigurationFormState {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: string;
  maxTokens: string;
}

interface ModelProviderFormState {
  id?: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  apiKeySecretId?: string;
  model: string;
  temperature: string;
  maxTokens: string;
  isDefault: boolean;
}

interface CurrentResultSet {
  columns: string[];
  rows: SqlResultRow[];
}

interface ConsoleExecutionState {
  status: string;
  warnings: string[];
  resultSet: CurrentResultSet | null;
}

const emptyConsoleExecutionState: ConsoleExecutionState = {
  status: "",
  warnings: [],
  resultSet: null,
};

const emptyAiConfigurationForm: AiConfigurationFormState = {
  baseUrl: "",
  apiKey: "",
  model: "",
  temperature: "0.2",
  maxTokens: "1000",
};

const emptyModelProviderForm: ModelProviderFormState = {
  name: "",
  baseUrl: "",
  apiKey: "",
  model: "",
  temperature: "0.2",
  maxTokens: "1000",
  isDefault: false,
};

const emptyDatabaseConnectionForm: DatabaseConnectionInput = {
  name: "",
  host: "",
  port: 4000,
  username: "",
  password: "",
  defaultDatabase: "",
};

export function App({
  localPersistence = defaultLocalPersistence,
  aiProviderTester = runStreamingAiProviderTest,
  candidateTableDiscoverer = discoverCandidateTables,
  sqlGenerator = generateSqlFromQueryNeed,
  sqlModifier = modifySqlFromIntent,
  sqlRepairer = repairSqlFromExecutionError,
}: AppProps) {
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [databaseConnections, setDatabaseConnections] = useState<DatabaseConnection[]>([]);
  const [querySessions, setQuerySessions] = useState<QuerySession[]>([]);
  const [currentQuerySession, setCurrentQuerySession] = useState<QuerySession | null>(null);
  const [databaseConnectionForm, setDatabaseConnectionForm] =
    useState<DatabaseConnectionInput>(emptyDatabaseConnectionForm);
  const [connectionTestMessage, setConnectionTestMessage] = useState<string | null>(null);
  const [activeCatalog, setActiveCatalog] = useState<DatabaseCatalogSnapshot | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<string | null>(null);
  const [expandedCatalogConnectionId, setExpandedCatalogConnectionId] = useState<string | null>(
    null,
  );
  const [aiConfigurationForm, setAiConfigurationForm] = useState<AiConfigurationFormState>(
    emptyAiConfigurationForm,
  );
  const [aiConfigurationStatus, setAiConfigurationStatus] = useState("Not configured");
  const [aiProviderTestStatus, setAiProviderTestStatus] = useState("");
  const [modelProviders, setModelProviders] = useState<ModelProvider[]>([]);
  const [selectedModelProviderId, setSelectedModelProviderId] = useState<string | null>(null);
  const [modelProviderForm, setModelProviderForm] =
    useState<ModelProviderFormState>(emptyModelProviderForm);
  const [modelProviderStatus, setModelProviderStatus] = useState("");
  const [queryNeed, setQueryNeed] = useState("");
  const [modificationIntent, setModificationIntent] = useState("");
  const [candidateTableStatus, setCandidateTableStatus] = useState("");
  const [sqlGenerationStatus, setSqlGenerationStatus] = useState("");
  const [executionStatus, setExecutionStatus] = useState("");
  const [executionWarnings, setExecutionWarnings] = useState<string[]>([]);
  const [currentResultSet, setCurrentResultSet] = useState<CurrentResultSet | null>(null);
  const [consoleExecutionStates, setConsoleExecutionStates] = useState<
    Record<string, ConsoleExecutionState>
  >({});
  const [hasGeneratedSql, setHasGeneratedSql] = useState(false);
  const [selectedCandidateTableName, setSelectedCandidateTableName] = useState("");
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  const [selectedDataSourceId, setSelectedDataSourceId] = useState<string | null>(null);
  const [selectedDatabaseConnectionId, setSelectedDatabaseConnectionId] = useState<string | null>(
    null,
  );
  const [activeDialog, setActiveDialog] = useState<
    "dataSources" | "modelProviders" | "preferences" | null
  >(null);
  const userSelectedThemePreference = useRef(false);
  const selectedDatabaseConnection =
    databaseConnections.find((connection) => connection.id === selectedDatabaseConnectionId) ?? null;
  const activeConsoleExecutionState = currentQuerySession
    ? (consoleExecutionStates[currentQuerySession.id] ?? emptyConsoleExecutionState)
    : {
        ...emptyConsoleExecutionState,
        status: executionStatus,
        warnings: executionWarnings,
        resultSet: currentResultSet,
      };

  useEffect(() => {
    let isCurrent = true;

    localPersistence.preferences.getThemePreference().then((storedThemePreference) => {
      if (!isCurrent || userSelectedThemePreference.current) {
        return;
      }

      setThemePreference(storedThemePreference);
      document.documentElement.setAttribute("data-theme", storedThemePreference);
    });

    return () => {
      isCurrent = false;
    };
  }, [localPersistence]);

  useEffect(() => {
    let isCurrent = true;

    localPersistence.modelProviders.listModelProviders().then((providers) => {
      if (!isCurrent) {
        return;
      }

      setModelProviders(providers);
      const selectedProvider =
        providers.find((provider) => provider.isDefault) ?? providers[0] ?? null;
      setSelectedModelProviderId(selectedProvider?.id ?? null);
      setModelProviderForm(
        selectedProvider ? modelProviderToForm(selectedProvider) : emptyModelProviderForm,
      );
    });

    return () => {
      isCurrent = false;
    };
  }, [localPersistence]);

  useEffect(() => {
    let isCurrent = true;

    Promise.all([
      localPersistence.querySessions.listQuerySessions(),
      localPersistence.querySessions.getRestoredQuerySession(),
    ]).then(([sessions, restoredSession]) => {
      if (!isCurrent) {
        return;
      }

      setQuerySessions(sessions);
      setCurrentQuerySession(restoredSession);
    });

    return () => {
      isCurrent = false;
    };
  }, [localPersistence]);

  useEffect(() => {
    let isCurrent = true;

    localPersistence.databaseConnections.listDatabaseConnections().then((connections) => {
      if (isCurrent) {
        setDatabaseConnections(connections);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [localPersistence]);

  useEffect(() => {
    let isCurrent = true;

    Promise.all([
      localPersistence.aiConfiguration.getGlobalAiConfiguration(),
      localPersistence.secrets.getSecret(AI_PROVIDER_API_KEY_SECRET_ID),
    ]).then(([storedConfiguration, storedApiKey]) => {
      if (!isCurrent) {
        return;
      }

      if (storedConfiguration) {
        setAiConfigurationForm({
          baseUrl: storedConfiguration.baseUrl,
          apiKey: "",
          model: storedConfiguration.model,
          temperature: String(storedConfiguration.temperature),
          maxTokens: String(storedConfiguration.maxTokens),
        });
        setAiConfigurationStatus("AI configuration loaded");
      }

      setHasSavedApiKey(Boolean(storedApiKey));
    });

    return () => {
      isCurrent = false;
    };
  }, [localPersistence]);

  const updateThemePreference = (nextThemePreference: ThemePreference) => {
    userSelectedThemePreference.current = true;
    setThemePreference(nextThemePreference);
    document.documentElement.setAttribute("data-theme", nextThemePreference);
    localPersistence.preferences.setThemePreference(nextThemePreference);
  };

  const updateDatabaseConnectionForm = (
    field: keyof DatabaseConnectionInput,
    value: string,
  ) => {
    setDatabaseConnectionForm((currentForm) => ({
      ...currentForm,
      [field]: field === "port" ? Number(value) : value,
    }));
  };

  const saveDatabaseConnection = async () => {
    const savedConnection =
      await localPersistence.databaseConnections.saveDatabaseConnection(databaseConnectionForm);
    const refreshedConnections =
      await localPersistence.databaseConnections.listDatabaseConnections();

    setDatabaseConnections(refreshedConnections);
    setSelectedDataSourceId(savedConnection.id);
    setSelectedDatabaseConnectionId(savedConnection.id);
    setDatabaseConnectionForm({
      id: savedConnection.id,
      name: savedConnection.name,
      host: savedConnection.host,
      port: savedConnection.port,
      username: savedConnection.username,
      passwordSecretId: savedConnection.passwordSecretId,
      password: "",
      defaultDatabase: savedConnection.defaultDatabase,
    });
  };

  const testDatabaseConnection = async () => {
    const result =
      await localPersistence.databaseConnections.testDatabaseConnection(databaseConnectionForm);
    setConnectionTestMessage(result.message);
  };

  const copyText = async (text: string) => {
    await navigator.clipboard?.writeText(text);
  };

  const editDatabaseConnection = (connection: DatabaseConnection) => {
    setSelectedDataSourceId(connection.id);
    setDatabaseConnectionForm({
      id: connection.id,
      name: connection.name,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      passwordSecretId: connection.passwordSecretId,
      password: "",
      defaultDatabase: connection.defaultDatabase,
    });
  };

  const addDatabaseConnection = () => {
    setSelectedDataSourceId(null);
    setDatabaseConnectionForm(emptyDatabaseConnectionForm);
    setConnectionTestMessage(null);
  };

  const deleteDatabaseConnection = async (connection: DatabaseConnection) => {
    await localPersistence.databaseConnections.deleteDatabaseConnection(connection.id);
    setDatabaseConnections((currentConnections) =>
      currentConnections.filter((currentConnection) => currentConnection.id !== connection.id),
    );

    if (activeCatalog?.connectionId === connection.id) {
      setActiveCatalog(null);
    }
    if (expandedCatalogConnectionId === connection.id) {
      setExpandedCatalogConnectionId(null);
    }
    if (selectedDatabaseConnectionId === connection.id) {
      setSelectedDatabaseConnectionId(null);
    }
  };

  const openCatalog = async (connection: DatabaseConnection) => {
    setExpandedCatalogConnectionId(connection.id);
    setCatalogStatus(`Reading catalog for ${connection.defaultDatabase}`);

    try {
      const catalog = await localPersistence.databaseCatalogs.openConnectionCatalog(connection.id);
      setActiveCatalog(catalog);
      setCatalogStatus(`Catalog loaded from ${catalog.database}`);
    } catch (error) {
      setCatalogStatus(formatCatalogError(error));
    }
  };

  const refreshCatalog = async () => {
    if (!activeCatalog) {
      return;
    }

    setCatalogStatus(`Refreshing catalog for ${activeCatalog.database}`);

    try {
      const catalog = await localPersistence.databaseCatalogs.refreshCatalog(
        activeCatalog.connectionId,
      );
      setActiveCatalog(catalog);
      setCatalogStatus(`Catalog refreshed from ${catalog.database}`);
    } catch (error) {
      setCatalogStatus(formatCatalogError(error));
    }
  };

  const createQuerySession = async (connection: DatabaseConnection) => {
    const createdSession = await localPersistence.querySessions.createQuerySession({
      databaseConnectionId: connection.id,
    });

    openCreatedQuerySession(createdSession);
    setQuerySessions((currentSessions) => [
      createdSession,
      ...currentSessions.filter((session) => session.id !== createdSession.id),
    ]);
  };

  const openCreatedQuerySession = (session: QuerySession) => {
    setCurrentQuerySession(session);
    setExecutionStatus("");
    setExecutionWarnings([]);
    setCurrentResultSet(null);
  };

  const getDefaultAiProviderCredentials = async () => {
    const defaultProvider = await localPersistence.modelProviders.getDefaultModelProvider();

    if (defaultProvider) {
      return {
        configuration: modelProviderToConfiguration(defaultProvider),
        apiKey: await localPersistence.secrets.getSecret(defaultProvider.apiKeySecretId),
      };
    }

    return {
      configuration: {
        baseUrl: aiConfigurationForm.baseUrl.trim(),
        model: aiConfigurationForm.model.trim(),
        temperature: Number(aiConfigurationForm.temperature),
        maxTokens: Number(aiConfigurationForm.maxTokens),
      },
      apiKey:
        aiConfigurationForm.apiKey ||
        (await localPersistence.secrets.getSecret(AI_PROVIDER_API_KEY_SECRET_ID)),
    };
  };

  const openQuerySession = async (session: QuerySession) => {
    const openedSession = await localPersistence.querySessions.openQuerySession(session.id);

    setCurrentQuerySession(openedSession);
    setQuerySessions((currentSessions) => [
      openedSession,
      ...currentSessions.filter((currentSession) => currentSession.id !== openedSession.id),
    ]);
    setExecutionStatus("");
    setExecutionWarnings([]);
    setCurrentResultSet(null);
  };

  const openLatestQuerySessionForConnection = async (connection: DatabaseConnection) => {
    setSelectedDatabaseConnectionId(connection.id);
    const sessions = await localPersistence.querySessions.listQuerySessions();
    const latestConnectionSession = sessions.find(
      (session) => session.databaseConnectionId === connection.id,
    );

    if (latestConnectionSession) {
      await openQuerySession(latestConnectionSession);
      return;
    }

    await createQuerySession(connection);
  };

  const deleteQuerySession = async (session: QuerySession) => {
    await localPersistence.querySessions.deleteQuerySession(session.id);
    const remainingSessions = await localPersistence.querySessions.listQuerySessions();

    setQuerySessions(remainingSessions);
    if (currentQuerySession?.id === session.id) {
      const restoredSession = await localPersistence.querySessions.getRestoredQuerySession();
      setCurrentQuerySession(restoredSession);
      setExecutionStatus("");
      setExecutionWarnings([]);
      setCurrentResultSet(null);
    }
  };

  const updateCurrentQuerySession = (updatedSession: QuerySession) => {
    setCurrentQuerySession(updatedSession);
    setQuerySessions((currentSessions) => [
      updatedSession,
      ...currentSessions.filter((session) => session.id !== updatedSession.id),
    ]);
  };

  const updateQuerySessionInState = (updatedSession: QuerySession) => {
    setCurrentQuerySession((currentSession) =>
      currentSession?.id === updatedSession.id ? updatedSession : currentSession,
    );
    setQuerySessions((currentSessions) => [
      updatedSession,
      ...currentSessions.filter((session) => session.id !== updatedSession.id),
    ]);
  };

  const updateConsoleExecutionState = (
    sessionId: string,
    nextState: Partial<ConsoleExecutionState>,
  ) => {
    setConsoleExecutionStates((currentStates) => ({
      ...currentStates,
      [sessionId]: {
        ...(currentStates[sessionId] ?? emptyConsoleExecutionState),
        ...nextState,
      },
    }));
  };

  const updateSqlDraftInState = (sessionId: string, sqlDraft: string) => {
    setCurrentQuerySession((currentSession) =>
      currentSession?.id === sessionId ? { ...currentSession, sqlDraft } : currentSession,
    );
    setQuerySessions((currentSessions) =>
      currentSessions.map((session) =>
        session.id === sessionId ? { ...session, sqlDraft } : session,
      ),
    );
  };

  const updateSqlDraft = async (sqlDraft: string) => {
    if (!currentQuerySession) {
      return;
    }

    updateSqlDraftInState(currentQuerySession.id, sqlDraft);
    setHasGeneratedSql(false);

    const savedSession = await localPersistence.querySessions.saveSqlDraft(
      currentQuerySession.id,
      sqlDraft,
    );
    updateCurrentQuerySession(savedSession);
  };

  const saveCandidateTables = async (candidateTables: CandidateTable[]) => {
    if (!currentQuerySession) {
      return;
    }

    const optimisticSession = { ...currentQuerySession, candidateTables };
    setCurrentQuerySession(optimisticSession);
    setQuerySessions((currentSessions) =>
      currentSessions.map((session) =>
        session.id === optimisticSession.id ? optimisticSession : session,
      ),
    );

    const savedSession = await localPersistence.querySessions.saveCandidateTables(
      currentQuerySession.id,
      candidateTables,
    );
    updateCurrentQuerySession(savedSession);
  };

  const runCandidateTableDiscovery = async () => {
    if (!currentQuerySession || !activeCatalog) {
      setCandidateTableStatus("Open a catalog and create a Query Session first");
      return;
    }

    const trimmedQueryNeed = queryNeed.trim();
    if (!trimmedQueryNeed) {
      setCandidateTableStatus("Query need is required");
      return;
    }

    const { configuration, apiKey } = await getDefaultAiProviderCredentials();

    if (!configuration.baseUrl || !configuration.model || !apiKey) {
      setCandidateTableStatus("AI configuration and API key are required");
      return;
    }

    setCandidateTableStatus("Discovering candidate tables");
    try {
      const candidateTables = await candidateTableDiscoverer({
        queryNeed: trimmedQueryNeed,
        session: currentQuerySession,
        catalog: activeCatalog,
        configuration,
        apiKey,
      });
      await saveCandidateTables(candidateTables);
      setCandidateTableStatus(
        `${candidateTables.length} candidate table${
          candidateTables.length === 1 ? "" : "s"
        } discovered`,
      );
    } catch (error) {
      setCandidateTableStatus(formatCandidateTableError(error));
    }
  };

  const runSqlGeneration = async () => {
    if (!currentQuerySession || !activeCatalog) {
      setSqlGenerationStatus("Open a catalog and create a Query Session first");
      return;
    }

    const trimmedQueryNeed = queryNeed.trim();
    if (!trimmedQueryNeed) {
      setSqlGenerationStatus("Query need is required");
      return;
    }

    const { configuration, apiKey } = await getDefaultAiProviderCredentials();

    if (!configuration.baseUrl || !configuration.model || !apiKey) {
      setSqlGenerationStatus("AI configuration and API key are required");
      return;
    }

    const generationSession = currentQuerySession;
    let streamedSql = "";
    setHasGeneratedSql(false);
    setSqlGenerationStatus("Generating SQL");

    try {
      const generatedSql = await sqlGenerator({
        queryNeed: trimmedQueryNeed,
        session: generationSession,
        catalog: activeCatalog,
        configuration,
        apiKey,
        onPartialSql: (partialSql) => {
          streamedSql = partialSql;
          updateSqlDraftInState(generationSession.id, partialSql);
        },
      });
      const finalSql = generatedSql || streamedSql;
      updateSqlDraftInState(generationSession.id, finalSql);

      const savedDraftSession = await localPersistence.querySessions.saveSqlDraft(
        generationSession.id,
        finalSql,
      );
      const savedConversationSession =
        await localPersistence.querySessions.saveAiConversationHistory(
          generationSession.id,
          [
            ...generationSession.aiConversationHistory,
            {
              id: createUiLocalId(),
              role: "user",
              content: trimmedQueryNeed,
              createdAt: new Date().toISOString(),
            },
            {
              id: createUiLocalId(),
              role: "assistant",
              content: finalSql,
              createdAt: new Date().toISOString(),
            },
          ],
        );

      updateCurrentQuerySession({
        ...savedConversationSession,
        sqlDraft: savedDraftSession.sqlDraft,
      });
      setHasGeneratedSql(true);
      setSqlGenerationStatus("SQL generated. Review it before manual execution.");
    } catch (error) {
      setSqlGenerationStatus(formatSqlGenerationError(error));
    }
  };

  const runSqlModification = async () => {
    if (!currentQuerySession || !activeCatalog) {
      setSqlGenerationStatus("Open a catalog and create a Query Session first");
      return;
    }

    const trimmedModificationIntent = modificationIntent.trim();
    if (!trimmedModificationIntent) {
      setSqlGenerationStatus("Modification intent is required");
      return;
    }

    const currentSql = currentQuerySession.sqlDraft.trim();
    if (!currentSql) {
      setSqlGenerationStatus("Current SQL is required before modification");
      return;
    }

    const { configuration, apiKey } = await getDefaultAiProviderCredentials();

    if (!configuration.baseUrl || !configuration.model || !apiKey) {
      setSqlGenerationStatus("AI configuration and API key are required");
      return;
    }

    const modificationSession = currentQuerySession;
    let streamedSql = "";
    setHasGeneratedSql(false);
    setSqlGenerationStatus("Modifying SQL");

    try {
      const modifiedSql = await sqlModifier({
        modificationIntent: trimmedModificationIntent,
        currentSql,
        session: modificationSession,
        catalog: activeCatalog,
        configuration,
        apiKey,
        onPartialSql: (partialSql) => {
          streamedSql = partialSql;
          updateSqlDraftInState(modificationSession.id, partialSql);
        },
      });
      const finalSql = modifiedSql || streamedSql;
      updateSqlDraftInState(modificationSession.id, finalSql);

      const savedDraftSession = await localPersistence.querySessions.saveSqlDraft(
        modificationSession.id,
        finalSql,
      );
      const savedConversationSession =
        await localPersistence.querySessions.saveAiConversationHistory(
          modificationSession.id,
          [
            ...modificationSession.aiConversationHistory,
            {
              id: createUiLocalId(),
              role: "user",
              content: trimmedModificationIntent,
              createdAt: new Date().toISOString(),
            },
            {
              id: createUiLocalId(),
              role: "assistant",
              content: finalSql,
              createdAt: new Date().toISOString(),
            },
          ],
        );

      updateCurrentQuerySession({
        ...savedConversationSession,
        sqlDraft: savedDraftSession.sqlDraft,
      });
      setHasGeneratedSql(true);
      setSqlGenerationStatus("SQL modified. Review it before manual execution.");
    } catch (error) {
      setSqlGenerationStatus(formatSqlGenerationError(error));
    }
  };

  const runSqlExecution = async () => {
    if (!currentQuerySession) {
      setExecutionStatus("Create a Query Session before running SQL");
      return;
    }

    const validation = validateSqlForExecution(currentQuerySession.sqlDraft, "readOnly");
    updateConsoleExecutionState(currentQuerySession.id, { warnings: validation.warnings });

    if (!validation.normalizedSql) {
      updateConsoleExecutionState(currentQuerySession.id, { status: "SQL draft is required" });
      return;
    }

    if (!validation.canExecute) {
      updateConsoleExecutionState(currentQuerySession.id, {
        status: validation.blockedReason ?? "SQL is blocked in Read-only Mode",
      });
      return;
    }

    const executionSession = currentQuerySession;
    updateConsoleExecutionState(executionSession.id, {
      status: "Running SQL in Read-only Mode",
      resultSet: null,
    });

    try {
      const result = await localPersistence.sqlExecution.executeSql({
        connectionId: executionSession.databaseConnectionId,
        sql: validation.normalizedSql,
        safetyMode: validation.safetyMode,
      });
      const metadata: ExecutionResultMetadata =
        result.ok
          ? {
              id: createUiLocalId(),
              sql: validation.normalizedSql,
              rowCount: result.rowCount,
              columns: result.columns,
              executedAt: new Date().toISOString(),
            }
          : {
              id: createUiLocalId(),
              sql: validation.normalizedSql,
              rowCount: 0,
              columns: [],
              executedAt: new Date().toISOString(),
              errorMessage: result.errorMessage,
            };
      const savedSession = await localPersistence.querySessions.saveExecutionResultMetadata(
        executionSession.id,
        [...executionSession.executionResultMetadata, metadata],
      );

      updateQuerySessionInState(savedSession);
      updateConsoleExecutionState(executionSession.id, {
        resultSet: result.ok ? { columns: result.columns, rows: result.rows } : null,
        status: result.ok
          ? `Execution succeeded: ${result.rowCount} rows, ${result.columns.length} columns`
          : `Execution failed: ${result.errorMessage}`,
      });
    } catch (error) {
      const message = formatSqlExecutionError(error);
      const metadata: ExecutionResultMetadata = {
        id: createUiLocalId(),
        sql: validation.normalizedSql,
        rowCount: 0,
        columns: [],
        executedAt: new Date().toISOString(),
        errorMessage: message,
      };
      const savedSession = await localPersistence.querySessions.saveExecutionResultMetadata(
        executionSession.id,
        [...executionSession.executionResultMetadata, metadata],
      );

      updateQuerySessionInState(savedSession);
      updateConsoleExecutionState(executionSession.id, {
        resultSet: null,
        status: `Execution failed: ${message}`,
      });
    }
  };

  const runSqlRepair = async () => {
    if (!currentQuerySession) {
      setSqlGenerationStatus("Create a Query Session before repairing SQL");
      return;
    }

    const failedExecution = getLatestFailedExecution(currentQuerySession);
    if (!failedExecution) {
      setSqlGenerationStatus("Run SQL and capture an execution error before repair");
      return;
    }

    const repairCatalog =
      activeCatalog ??
      (await localPersistence.databaseCatalogs.getCatalogForSqlGeneration(
        currentQuerySession.databaseConnectionId,
      ));
    if (!repairCatalog) {
      setSqlGenerationStatus("Open a catalog before repairing SQL");
      return;
    }

    const { configuration, apiKey } = await getDefaultAiProviderCredentials();

    if (!configuration.baseUrl || !configuration.model || !apiKey) {
      setSqlGenerationStatus("AI configuration and API key are required");
      return;
    }

    const repairSession = currentQuerySession;
    let streamedSql = "";
    setHasGeneratedSql(false);
    setSqlGenerationStatus("Repairing SQL");

    try {
      const repairedSql = await sqlRepairer({
        currentSql: failedExecution.sql,
        errorMessage: failedExecution.errorMessage,
        dialect: "mysql",
        session: repairSession,
        catalog: repairCatalog,
        configuration,
        apiKey,
        onPartialSql: (partialSql) => {
          streamedSql = partialSql;
          updateSqlDraftInState(repairSession.id, partialSql);
        },
      });
      const finalSql = repairedSql || streamedSql;
      updateSqlDraftInState(repairSession.id, finalSql);

      const savedDraftSession = await localPersistence.querySessions.saveSqlDraft(
        repairSession.id,
        finalSql,
      );
      const savedConversationSession =
        await localPersistence.querySessions.saveAiConversationHistory(repairSession.id, [
          ...repairSession.aiConversationHistory,
          {
            id: createUiLocalId(),
            role: "user",
            content: `Repair SQL after execution error: ${failedExecution.errorMessage}`,
            createdAt: new Date().toISOString(),
          },
          {
            id: createUiLocalId(),
            role: "assistant",
            content: finalSql,
            createdAt: new Date().toISOString(),
          },
        ]);

      updateCurrentQuerySession({
        ...savedConversationSession,
        sqlDraft: savedDraftSession.sqlDraft,
      });
      setHasGeneratedSql(true);
      setSqlGenerationStatus("SQL repaired. Review it before manual execution.");
    } catch (error) {
      setSqlGenerationStatus(formatSqlRepairError(error));
    }
  };

  const copyCurrentSql = async () => {
    if (!currentQuerySession) {
      return;
    }

    await copyText(currentQuerySession.sqlDraft);
  };

  const copyVisibleResults = async () => {
    if (!activeConsoleExecutionState.resultSet) {
      return;
    }

    await copyText(formatResultSetForCopy(activeConsoleExecutionState.resultSet));
  };

  const addCandidateTable = async () => {
    if (!selectedCandidateTableName || !currentQuerySession) {
      return;
    }

    await saveCandidateTables([
      ...currentQuerySession.candidateTables,
      { name: selectedCandidateTableName, reason: "Added by user" },
    ]);
    setSelectedCandidateTableName("");
  };

  const removeCandidateTable = async (tableName: string) => {
    if (!currentQuerySession) {
      return;
    }

    await saveCandidateTables(
      currentQuerySession.candidateTables.filter((table) => table.name !== tableName),
    );
  };

  const updateAiConfigurationField = (
    field: keyof AiConfigurationFormState,
    value: string,
  ) => {
    setAiConfigurationForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const updateModelProviderForm = (
    field: keyof ModelProviderFormState,
    value: string | boolean,
  ) => {
    setModelProviderForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const addModelProvider = () => {
    setSelectedModelProviderId(null);
    setModelProviderForm(emptyModelProviderForm);
    setModelProviderStatus("");
  };

  const selectModelProvider = (provider: ModelProvider) => {
    setSelectedModelProviderId(provider.id);
    setModelProviderForm(modelProviderToForm(provider));
    setModelProviderStatus("");
  };

  const saveModelProvider = async () => {
    const input: ModelProviderInput = {
      id: modelProviderForm.id,
      name: modelProviderForm.name.trim(),
      baseUrl: modelProviderForm.baseUrl.trim(),
      model: modelProviderForm.model.trim(),
      temperature: Number(modelProviderForm.temperature),
      maxTokens: Number(modelProviderForm.maxTokens),
      apiKeySecretId: modelProviderForm.apiKeySecretId,
      apiKey: modelProviderForm.apiKey.trim(),
      isDefault: modelProviderForm.isDefault,
    };
    const savedProvider = await localPersistence.modelProviders.saveModelProvider(input);

    if (savedProvider.isDefault) {
      await localPersistence.modelProviders.setDefaultModelProvider(savedProvider.id);
    }

    const refreshedProviders = await localPersistence.modelProviders.listModelProviders();
    setModelProviders(refreshedProviders);
    setSelectedModelProviderId(savedProvider.id);
    setModelProviderForm(modelProviderToForm(savedProvider));
    setModelProviderStatus("Model provider saved");
  };

  const setSelectedModelProviderAsDefault = async () => {
    if (!selectedModelProviderId) {
      return;
    }

    await localPersistence.modelProviders.setDefaultModelProvider(selectedModelProviderId);
    const refreshedProviders = await localPersistence.modelProviders.listModelProviders();
    const selectedProvider =
      refreshedProviders.find((provider) => provider.id === selectedModelProviderId) ?? null;

    setModelProviders(refreshedProviders);
    if (selectedProvider) {
      setModelProviderForm(modelProviderToForm(selectedProvider));
    }
    setModelProviderStatus("Default model provider updated");
  };

  const saveAiConfiguration = async () => {
    const configuration: GlobalAiConfiguration = {
      baseUrl: aiConfigurationForm.baseUrl.trim(),
      model: aiConfigurationForm.model.trim(),
      temperature: Number(aiConfigurationForm.temperature),
      maxTokens: Number(aiConfigurationForm.maxTokens),
    };

    await localPersistence.aiConfiguration.saveGlobalAiConfiguration(configuration);

    if (aiConfigurationForm.apiKey.trim()) {
      await localPersistence.secrets.setSecret(
        AI_PROVIDER_API_KEY_SECRET_ID,
        aiConfigurationForm.apiKey,
      );
      setHasSavedApiKey(true);
      setAiConfigurationForm((currentForm) => ({ ...currentForm, apiKey: "" }));
    }

    setAiConfigurationStatus("AI configuration saved");
  };

  const testAiProvider = async () => {
    setAiProviderTestStatus("Testing AI provider");

    const configuration: GlobalAiConfiguration = {
      baseUrl: aiConfigurationForm.baseUrl.trim(),
      model: aiConfigurationForm.model.trim(),
      temperature: Number(aiConfigurationForm.temperature),
      maxTokens: Number(aiConfigurationForm.maxTokens),
    };
    const apiKey =
      aiConfigurationForm.apiKey ||
      (await localPersistence.secrets.getSecret(AI_PROVIDER_API_KEY_SECRET_ID));

    if (!apiKey) {
      setAiProviderTestStatus("AI request failed: API key is missing");
      return;
    }

    const result = await aiProviderTester(configuration, apiKey);
    setAiProviderTestStatus(
      result.ok ? `Streaming AI response: ${result.content}` : `AI request failed: ${result.error}`,
    );
  };

  return (
    <main aria-label="Glimpse V0.2 workbench" className="app-shell">
      <header className="workbench-toolbar" role="toolbar" aria-label="V0.2 workbench toolbar">
        <button type="button" onClick={() => setActiveDialog("dataSources")}>
          Data Source Management
        </button>
        <button type="button" onClick={() => setActiveDialog("modelProviders")}>
          Model Provider Management
        </button>
        <button
          type="button"
          onClick={() =>
            selectedDatabaseConnection && createQuerySession(selectedDatabaseConnection)
          }
          disabled={!selectedDatabaseConnection}
        >
          New Console
        </button>
        <button type="button" onClick={() => setActiveDialog("preferences")}>
          Preferences
        </button>
        <button type="button" onClick={runSqlExecution} disabled={!currentQuerySession}>
          SQL Run
        </button>
      </header>

      <section className="sidebar sidebar-left" aria-label="Database Connection Tree">
        <header className="brand-bar">
          <div className="brand-mark">G</div>
          <div>
            <strong>Glimpse</strong>
            <span>V0.2 Workbench</span>
          </div>
        </header>

        <section className="panel">
          <div className="panel-title">Database</div>
          <div className="connection-tree" role="tree" aria-label="Database Connection Tree">
            {databaseConnections.length === 0 ? (
              <div className="placeholder-row">No saved connections yet</div>
            ) : (
              databaseConnections.map((connection) => {
                const isExpanded = expandedCatalogConnectionId === connection.id;
                const treeCatalog =
                  activeCatalog?.connectionId === connection.id ? activeCatalog : null;

                return (
                  <article className="connection-tree-row" key={connection.id}>
                    <div
                      aria-label={`${connection.name} ${connection.defaultDatabase}${
                        selectedDatabaseConnectionId === connection.id ? " selected" : ""
                      }`}
                      aria-selected={selectedDatabaseConnectionId === connection.id}
                      className="connection-tree-item"
                      aria-expanded={isExpanded}
                      role="treeitem"
                      onClick={() => setSelectedDatabaseConnectionId(connection.id)}
                      onDoubleClick={() => openLatestQuerySessionForConnection(connection)}
                    >
                      <strong>{connection.name}</strong>
                      <span>{connection.defaultDatabase}</span>
                    </div>
                    {isExpanded && treeCatalog ? (
                      <div
                        aria-label={`Default schema ${treeCatalog.database}`}
                        className="connection-tree-schema"
                        role="treeitem"
                      >
                        <strong>Default Schema</strong>
                        <span>{treeCatalog.database}</span>
                        {treeCatalog.tables.length ? (
                          <div className="connection-tree-table-list" role="group">
                            {treeCatalog.tables.map((table) => (
                              <div
                                aria-label={`Table ${table.name}`}
                                className="connection-tree-table"
                                key={table.name}
                                role="treeitem"
                              >
                                {table.name}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="connection-tree-empty">
                            No tables available in {treeCatalog.database}
                          </div>
                        )}
                      </div>
                    ) : null}
                    {isExpanded && !treeCatalog && catalogStatus ? (
                      <div className="connection-tree-status" role="status">
                        {catalogStatus}
                      </div>
                    ) : null}
                    <div className="connection-tree-actions">
                      <button
                        aria-label={`Expand ${connection.name} open catalog ${connection.name}`}
                        type="button"
                        onClick={() => openCatalog(connection)}
                      >
                        Expand {connection.name}
                      </button>
                      <button type="button" onClick={() => createQuerySession(connection)}>
                        New session for {connection.name}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">Query Sessions</div>
          {querySessions.length === 0 ? (
            <div className="placeholder-row">No saved sessions yet</div>
          ) : (
            <div className="session-list" aria-label="Saved query sessions">
              {querySessions.map((session) => (
                <article className="session-row" key={session.id}>
                  <button
                    className="session-open-button"
                    type="button"
                    aria-label={`Open query session ${session.connectionName} ${session.defaultDatabase} ${formatSessionSqlPreview(session)}`}
                    onClick={() => openQuerySession(session)}
                  >
                    <strong>{session.connectionName}</strong>
                    <span>
                      {session.connectionName} / {session.defaultDatabase}
                    </span>
                    <small>{formatSessionSqlPreview(session)}</small>
                  </button>
                  <button
                    className="session-delete-button"
                    type="button"
                    aria-label={`Delete query session ${session.connectionName} ${session.defaultDatabase} ${formatSessionSqlPreview(session)}`}
                    onClick={() => deleteQuerySession(session)}
                  >
                    Delete
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="workspace">
        <section aria-label="SQL editor" className="panel editor-panel">
          <div className="panel-title">SQL Draft</div>
          <textarea
            aria-label="SQL Draft"
            className="editor-surface"
            disabled={!currentQuerySession}
            onChange={(event) => updateSqlDraft(event.target.value)}
            placeholder={`-- AI-generated SQL will appear here.
-- Review it before running in Read-only Mode.`}
            value={currentQuerySession?.sqlDraft ?? ""}
          />
          <div className="editor-actions">
            <button
              type="button"
              onClick={copyCurrentSql}
              disabled={!currentQuerySession}
            >
              Copy current SQL
            </button>
            <button
              className="primary-action"
              type="button"
              onClick={runSqlExecution}
              disabled={!currentQuerySession}
            >
              Run SQL in Read-only Mode
            </button>
          </div>
        </section>

        <section aria-label="Active Console Result Set" className="panel results-panel">
          <div className="panel-title">Result</div>
          {activeConsoleExecutionState.warnings.length ? (
            <div className="execution-warning" role="status">
              {activeConsoleExecutionState.warnings.join(" ")}
            </div>
          ) : null}
          {activeConsoleExecutionState.status ? (
            <div className="execution-status" role="status">
              {activeConsoleExecutionState.status}
            </div>
          ) : (
            <div className="empty-state">
              <strong>No query has run</strong>
              <p>Results will appear here after manual read-only execution.</p>
            </div>
          )}
          {currentQuerySession && getLatestFailedExecution(currentQuerySession) ? (
            <button
              className="secondary-button"
              type="button"
              onClick={runSqlRepair}
            >
              Repair SQL
            </button>
          ) : null}
          {activeConsoleExecutionState.resultSet ? (
            <>
              <div className="result-actions">
                <button type="button" onClick={copyVisibleResults}>
                  Copy visible results
                </button>
              </div>
              <ResultTable
                resultSet={activeConsoleExecutionState.resultSet}
                onCopyText={copyText}
              />
            </>
          ) : null}
          {currentQuerySession?.executionResultMetadata.length ? (
            <div className="execution-metadata-list" aria-label="Execution result metadata">
              {currentQuerySession.executionResultMetadata.map((metadata) => (
                <article className="execution-metadata-row" key={metadata.id}>
                  <strong>
                    {metadata.errorMessage
                      ? `Failed: ${metadata.errorMessage}`
                      : `Succeeded: ${metadata.rowCount} rows`}
                  </strong>
                  <span>
                    {metadata.columns.length} column
                    {metadata.columns.length === 1 ? "" : "s"} at {metadata.executedAt}
                  </span>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </section>

      <section className="sidebar sidebar-right" aria-label="Right-side Content Switcher">
        <div className="right-side-switcher" role="tablist" aria-label="Right-side views">
          <button type="button" role="tab" aria-selected="true">
            SQL Console List
          </button>
          <button type="button" role="tab" aria-selected="false">
            AI Conversation View
          </button>
        </div>
        <section aria-label="SQL Console List" className="panel">
          <div className="panel-title">SQL Console List</div>
          {querySessions.length === 0 ? (
            <div className="placeholder-row">No SQL Consoles yet</div>
          ) : (
            <div className="session-list" role="list" aria-label="SQL Console List">
              {querySessions.map((session) => (
                <article className="session-row" key={session.id}>
                  <button
                    className="session-open-button"
                    type="button"
                    aria-label={`Open SQL Console ${session.connectionName} ${session.defaultDatabase} ${formatSessionSqlPreview(session)}${
                      currentQuerySession?.id === session.id ? " active" : ""
                    }`}
                    aria-pressed={currentQuerySession?.id === session.id}
                    onClick={() => openQuerySession(session)}
                  >
                    <strong>{session.connectionName}</strong>
                    <span>
                      {session.connectionName} / {session.defaultDatabase}
                    </span>
                    <small>{formatSessionSqlPreview(session)}</small>
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section aria-label="AI assistant" className="panel">
          <div className="panel-title">AI Assistant</div>
          <label className="field">
            <span>Query need</span>
            <textarea
              className="query-need-input"
              value={queryNeed}
              onChange={(event) => setQueryNeed(event.target.value)}
              placeholder="Find monthly revenue by customer segment"
            />
          </label>
          <label className="field">
            <span>Modification intent</span>
            <textarea
              className="query-need-input"
              value={modificationIntent}
              onChange={(event) => setModificationIntent(event.target.value)}
              placeholder="Add a filter for the last 30 days"
            />
          </label>
          <button
            className="primary-button"
            type="button"
            onClick={runCandidateTableDiscovery}
            disabled={!currentQuerySession || !activeCatalog}
          >
            Discover candidate tables
          </button>
          {candidateTableStatus ? (
            <div className="status-line">{candidateTableStatus}</div>
          ) : null}
          <button
            className="primary-button"
            type="button"
            onClick={runSqlGeneration}
            disabled={!currentQuerySession || !activeCatalog}
          >
            Generate SQL
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={runSqlModification}
            disabled={!currentQuerySession || !activeCatalog}
          >
            Modify current SQL
          </button>
          {sqlGenerationStatus ? (
            <div className="status-line">{sqlGenerationStatus}</div>
          ) : null}
          {hasGeneratedSql ? (
            <button className="secondary-button" type="button" onClick={runSqlExecution}>
              Run generated SQL manually
            </button>
          ) : null}
          <div className="empty-state">
            <strong>Configure global AI provider</strong>
            <p>Add an OpenAI-compatible provider before generating SQL.</p>
          </div>
          <form
            className="ai-config-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveAiConfiguration();
            }}
          >
            <label className="field">
              <span>Base URL</span>
              <input
                value={aiConfigurationForm.baseUrl}
                onChange={(event) => updateAiConfigurationField("baseUrl", event.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </label>
            <label className="field">
              <span>API key</span>
              <input
                type="password"
                value={aiConfigurationForm.apiKey}
                onChange={(event) => updateAiConfigurationField("apiKey", event.target.value)}
                placeholder={hasSavedApiKey ? "Stored in Keychain" : "Paste API key"}
              />
            </label>
            <label className="field">
              <span>Model</span>
              <input
                value={aiConfigurationForm.model}
                onChange={(event) => updateAiConfigurationField("model", event.target.value)}
                placeholder="gpt-4.1-mini"
              />
            </label>
            <div className="field-grid">
              <label className="field compact-field">
                <span>Temperature</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={aiConfigurationForm.temperature}
                  onChange={(event) =>
                    updateAiConfigurationField("temperature", event.target.value)
                  }
                />
              </label>
              <label className="field compact-field">
                <span>Max tokens</span>
                <input
                  type="number"
                  min="1"
                  value={aiConfigurationForm.maxTokens}
                  onChange={(event) => updateAiConfigurationField("maxTokens", event.target.value)}
                />
              </label>
            </div>
            <button className="primary-button" type="submit">
              Save AI configuration
            </button>
            <button className="secondary-button" type="button" onClick={testAiProvider}>
              Test AI provider
            </button>
            <div className="status-line">{aiConfigurationStatus}</div>
            {aiProviderTestStatus ? (
              <div className="status-line">{aiProviderTestStatus}</div>
            ) : null}
            {hasSavedApiKey ? <div className="status-line">API key saved</div> : null}
          </form>
        </section>

        <section aria-label="AI conversation history" className="panel">
          <div className="panel-title">AI Conversation History</div>
          {currentQuerySession?.aiConversationHistory.length ? (
            <div className="conversation-list">
              {currentQuerySession.aiConversationHistory.map((entry) => (
                <article className="conversation-row" key={entry.id}>
                  <strong>{entry.role === "user" ? "User" : "Assistant"}</strong>
                  <span>{entry.createdAt}</span>
                  <p>{entry.content}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="placeholder-row">No AI conversation yet</div>
          )}
        </section>

        <section className="panel">
          <section aria-label="Database catalog" className="catalog-panel">
            <div className="panel-title">Database Catalog</div>
            <div className="catalog-toolbar">
              <button
                className="secondary-button"
                type="button"
                onClick={refreshCatalog}
                disabled={!activeCatalog}
              >
                Refresh catalog
              </button>
              {catalogStatus ? <div className="status-line">{catalogStatus}</div> : null}
            </div>
            {activeCatalog ? (
              <div className="catalog-content">
                <div className="catalog-summary">
                  <strong>{activeCatalog.database}</strong>
                  <span>
                    {activeCatalog.tables.length} table
                    {activeCatalog.tables.length === 1 ? "" : "s"} loaded
                  </span>
                </div>
                {activeCatalog.tables.map((table) => (
                  <article className="catalog-table" key={table.name}>
                    <header>
                      <strong>{table.name}</strong>
                      {table.comment ? <span>{table.comment}</span> : null}
                    </header>
                    <div className="catalog-subtitle">Fields</div>
                    <ul>
                      {table.columns.map((column) => (
                        <li key={column.name}>
                          <span>
                            {column.name} {column.dataType}{" "}
                            {column.nullable ? "nullable" : "not null"}
                            {column.isPrimaryKey ? " primary key" : ""}
                            {column.defaultValue ? ` default ${column.defaultValue}` : ""}
                          </span>
                          {column.comment ? <small>{column.comment}</small> : null}
                        </li>
                      ))}
                    </ul>
                    <div className="catalog-subtitle">Indexes</div>
                    <ul>
                      {table.indexes.map((index) => (
                        <li key={index.name}>
                          {index.name} {index.kind} {index.columns.join(", ")}
                        </li>
                      ))}
                    </ul>
                    {table.createTableDdl ? (
                      <pre className="ddl-block">{table.createTableDdl}</pre>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="placeholder-row">Open a connection to inspect its default schema.</div>
            )}
          </section>
        </section>

        <section aria-label="Candidate Table Set" className="panel">
          <div className="panel-title">Candidate Table Set</div>
          {currentQuerySession?.candidateTables.length ? (
            <div className="candidate-table-list">
              {currentQuerySession.candidateTables.map((table) => (
                <article className="candidate-table-row" key={table.name}>
                  <div>
                    <strong>{table.name}</strong>
                    {table.reason ? <span>{table.reason}</span> : null}
                  </div>
                  <button type="button" onClick={() => removeCandidateTable(table.name)}>
                    Remove {table.name}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="placeholder-row">No candidate tables yet</div>
          )}
          <div className="candidate-table-controls">
            <label className="field">
              <span>Add candidate table</span>
              <select
                value={selectedCandidateTableName}
                onChange={(event) => setSelectedCandidateTableName(event.target.value)}
                disabled={!activeCatalog || !currentQuerySession}
              >
                <option value="">Select table</option>
                {activeCatalog && currentQuerySession
                  ? activeCatalog.tables
                      .filter(
                        (table) =>
                          !currentQuerySession.candidateTables.some(
                            (candidateTable) => candidateTable.name === table.name,
                          ),
                      )
                      .map((table) => (
                        <option value={table.name} key={table.name}>
                          {table.name}
                        </option>
                      ))
                  : null}
              </select>
            </label>
            <button
              className="secondary-button"
              type="button"
              onClick={addCandidateTable}
              disabled={!selectedCandidateTableName}
            >
              Add candidate table
            </button>
          </div>
        </section>
      </section>

      {activeDialog === "dataSources" ? (
        <div className="dialog-backdrop">
          <section
            aria-label="Data Source Management"
            role="dialog"
            aria-modal="true"
            className="dialog data-source-dialog panel"
          >
            <div className="panel-title">
              <span>Data Source Management</span>
              <button type="button" onClick={() => setActiveDialog(null)}>
                Close
              </button>
            </div>
            <div className="management-dialog-body">
              <aside className="management-list-pane">
                <div className="management-pane-title">Saved data sources</div>
                <button type="button" className="secondary-button" onClick={addDatabaseConnection}>
                  Add Database Connection
                </button>
                <div className="management-list" role="list" aria-label="Saved data sources">
                  {databaseConnections.length === 0 ? (
                    <div className="placeholder-row">No saved connections yet</div>
                  ) : (
                    databaseConnections.map((connection) => (
                      <button
                        aria-label={`${connection.name} ${connection.defaultDatabase}${
                          selectedDataSourceId === connection.id ? " selected" : ""
                        }`}
                        aria-selected={selectedDataSourceId === connection.id}
                        className="management-list-item"
                        key={connection.id}
                        type="button"
                        onClick={() => editDatabaseConnection(connection)}
                      >
                        <strong>{connection.name}</strong>
                        <span>
                          {connection.host}:{connection.port} / {connection.defaultDatabase}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </aside>
              <form
                aria-label="Database connection details"
                className="connection-form management-form-pane"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveDatabaseConnection();
                }}
              >
                <div className="empty-state">
                  <strong>
                    {databaseConnectionForm.id
                      ? "Edit database connection"
                      : "Create database connection"}
                  </strong>
                  <p>Connect a MySQL/TiDB database to load the default schema catalog.</p>
                </div>
                <label className="field">
                  <span>Connection name</span>
                  <input
                    value={databaseConnectionForm.name}
                    onChange={(event) =>
                      updateDatabaseConnectionForm("name", event.target.value)
                    }
                  />
                </label>
                <label className="field">
                  <span>Host</span>
                  <input
                    value={databaseConnectionForm.host}
                    onChange={(event) =>
                      updateDatabaseConnectionForm("host", event.target.value)
                    }
                  />
                </label>
                <label className="field">
                  <span>Port</span>
                  <input
                    inputMode="numeric"
                    value={databaseConnectionForm.port}
                    onChange={(event) =>
                      updateDatabaseConnectionForm("port", event.target.value)
                    }
                  />
                </label>
                <label className="field">
                  <span>Username</span>
                  <input
                    value={databaseConnectionForm.username}
                    onChange={(event) =>
                      updateDatabaseConnectionForm("username", event.target.value)
                    }
                  />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={databaseConnectionForm.password}
                    onChange={(event) =>
                      updateDatabaseConnectionForm("password", event.target.value)
                    }
                  />
                </label>
                <label className="field">
                  <span>Default Database/Schema</span>
                  <input
                    value={databaseConnectionForm.defaultDatabase}
                    onChange={(event) =>
                      updateDatabaseConnectionForm("defaultDatabase", event.target.value)
                    }
                  />
                </label>
                <div className="form-actions">
                  <button type="button" onClick={testDatabaseConnection}>
                    Test connection
                  </button>
                  <button className="primary-action" type="submit">
                    Save connection
                  </button>
                  {databaseConnectionForm.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        const connection = databaseConnections.find(
                          (currentConnection) =>
                            currentConnection.id === databaseConnectionForm.id,
                        );

                        if (connection) {
                          deleteDatabaseConnection(connection);
                          addDatabaseConnection();
                        }
                      }}
                    >
                      Delete {databaseConnectionForm.name}
                    </button>
                  ) : null}
                </div>
                {connectionTestMessage ? (
                  <div className="connection-test-status" role="status">
                    {connectionTestMessage}
                  </div>
                ) : null}
              </form>
            </div>
          </section>
        </div>
      ) : null}

      {activeDialog === "modelProviders" ? (
        <div className="dialog-backdrop">
          <section
            aria-label="Model Provider Management"
            role="dialog"
            aria-modal="true"
            className="dialog model-provider-dialog panel"
          >
            <div className="panel-title">
              <span>Model Provider Management</span>
              <button type="button" onClick={() => setActiveDialog(null)}>
                Close
              </button>
            </div>
            <div className="management-layout">
              <aside className="management-list-pane">
                <div className="management-toolbar">
                  <button type="button" onClick={addModelProvider}>
                    Add model provider
                  </button>
                </div>
                <div className="provider-list" role="list" aria-label="Saved model providers">
                  {modelProviders.length === 0 ? (
                    <div className="placeholder-row">No saved model providers yet</div>
                  ) : (
                    modelProviders.map((provider) => (
                      <button
                        className="provider-list-item"
                        type="button"
                        aria-label={`${provider.name}${provider.isDefault ? " default" : ""}${
                          provider.id === selectedModelProviderId ? " selected" : ""
                        }`}
                        aria-pressed={provider.id === selectedModelProviderId}
                        key={provider.id}
                        onClick={() => selectModelProvider(provider)}
                      >
                        <strong>{provider.name}</strong>
                        <span>{provider.model}</span>
                        {provider.isDefault ? <small>Default</small> : null}
                      </button>
                    ))
                  )}
                </div>
              </aside>
              <form
                className="management-form"
                aria-label="Model provider form"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveModelProvider();
                }}
              >
                <label className="field">
                  <span>Provider name</span>
                  <input
                    value={modelProviderForm.name}
                    onChange={(event) => updateModelProviderForm("name", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Base URL</span>
                  <input
                    value={modelProviderForm.baseUrl}
                    onChange={(event) => updateModelProviderForm("baseUrl", event.target.value)}
                    placeholder="https://api.openai.com/v1"
                  />
                </label>
                <label className="field">
                  <span>API key</span>
                  <input
                    type="password"
                    value={modelProviderForm.apiKey}
                    onChange={(event) => updateModelProviderForm("apiKey", event.target.value)}
                    placeholder={
                      modelProviderForm.apiKeySecretId ? "Stored in Keychain" : "Paste API key"
                    }
                  />
                </label>
                <label className="field">
                  <span>Model</span>
                  <input
                    value={modelProviderForm.model}
                    onChange={(event) => updateModelProviderForm("model", event.target.value)}
                    placeholder="gpt-5.5"
                  />
                </label>
                <div className="field-grid">
                  <label className="field compact-field">
                    <span>Temperature</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={modelProviderForm.temperature}
                      onChange={(event) =>
                        updateModelProviderForm("temperature", event.target.value)
                      }
                    />
                  </label>
                  <label className="field compact-field">
                    <span>Max tokens</span>
                    <input
                      type="number"
                      min="1"
                      value={modelProviderForm.maxTokens}
                      onChange={(event) =>
                        updateModelProviderForm("maxTokens", event.target.value)
                      }
                    />
                  </label>
                </div>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={modelProviderForm.isDefault}
                    onChange={(event) =>
                      updateModelProviderForm("isDefault", event.target.checked)
                    }
                  />
                  <span>Default model provider</span>
                </label>
                <div className="form-actions">
                  <button className="primary-action" type="submit">
                    Save model provider
                  </button>
                  <button
                    type="button"
                    onClick={setSelectedModelProviderAsDefault}
                    disabled={!selectedModelProviderId}
                  >
                    Set as default
                  </button>
                </div>
                {modelProviderStatus ? (
                  <div className="status-line">{modelProviderStatus}</div>
                ) : null}
              </form>
            </div>
          </section>
        </div>
      ) : null}

      {activeDialog === "preferences" ? (
        <div className="dialog-backdrop">
          <section
            aria-label="Preferences"
            role="dialog"
            aria-modal="true"
            className="dialog panel"
          >
            <div className="panel-title">
              <span>Preferences</span>
              <button type="button" onClick={() => setActiveDialog(null)}>
                Close
              </button>
            </div>
            <label className="field">
              <span>Theme preference</span>
              <select
                value={themePreference}
                onChange={(event) => updateThemePreference(event.target.value as ThemePreference)}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function ResultTable({
  resultSet,
  onCopyText,
}: {
  resultSet: CurrentResultSet;
  onCopyText: (text: string) => Promise<void>;
}) {
  return (
    <div
      aria-label="Scroll current result set horizontally"
      className="result-table-scroll"
      tabIndex={0}
    >
      <table aria-label="Current result set" className="result-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            {resultSet.columns.map((column, columnIndex) => (
              <th scope="col" key={`${column}-${columnIndex}`}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resultSet.rows.length === 0 ? (
            <tr>
              <td className="result-table-empty-cell" colSpan={resultSet.columns.length + 1}>
                No rows returned
              </td>
            </tr>
          ) : (
            resultSet.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th
                  className="copyable-result-cell"
                  scope="row"
                  tabIndex={0}
                  title={`Copy row ${rowIndex + 1}`}
                  onClick={() => onCopyText(formatResultRowForCopy(row))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onCopyText(formatResultRowForCopy(row));
                    }
                  }}
                >
                  {rowIndex + 1}
                </th>
                {resultSet.columns.map((column, columnIndex) => (
                  <td
                    className="copyable-result-cell"
                    key={`${column}-${columnIndex}`}
                    tabIndex={0}
                    title={`Copy ${column}`}
                    onClick={() => onCopyText(formatResultCell(row[columnIndex]))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onCopyText(formatResultCell(row[columnIndex]));
                      }
                    }}
                  >
                    {formatResultCell(row[columnIndex])}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatResultSetForCopy(resultSet: CurrentResultSet) {
  return [
    resultSet.columns.join("\t"),
    ...resultSet.rows.map((row) => formatResultRowForCopy(row)),
  ].join("\n");
}

function modelProviderToForm(provider: ModelProvider): ModelProviderFormState {
  return {
    id: provider.id,
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiKey: "",
    apiKeySecretId: provider.apiKeySecretId,
    model: provider.model,
    temperature: String(provider.temperature),
    maxTokens: String(provider.maxTokens),
    isDefault: provider.isDefault,
  };
}

function modelProviderToConfiguration(provider: ModelProvider): GlobalAiConfiguration {
  return {
    baseUrl: provider.baseUrl,
    model: provider.model,
    temperature: provider.temperature,
    maxTokens: provider.maxTokens,
  };
}

function formatResultRowForCopy(row: SqlResultRow) {
  return row.map((value) => formatResultCell(value)).join("\t");
}

function formatResultCell(value: SqlResultCellValue | undefined) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  return String(value);
}

function formatSessionSqlPreview(session: QuerySession) {
  const normalizedDraft = session.sqlDraft.trim().replace(/\s+/g, " ");

  return normalizedDraft ? normalizedDraft.slice(0, 80) : "Empty SQL draft";
}

function formatCatalogError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("permission")
    ? `Metadata Permission Failure: ${message}`
    : `Catalog read failed: ${message}`;
}

function formatCandidateTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return `Candidate table discovery failed: ${message}`;
}

function formatSqlGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return `SQL generation failed: ${message}`;
}

function formatSqlRepairError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return `SQL repair failed: ${message}`;
}

function formatSqlExecutionError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getLatestFailedExecution(
  session: QuerySession,
): (ExecutionResultMetadata & { errorMessage: string }) | null {
  return (
    session.executionResultMetadata
      .slice()
      .reverse()
      .find(
        (metadata): metadata is ExecutionResultMetadata & { errorMessage: string } =>
          Boolean(metadata.errorMessage),
      ) ?? null
  );
}

function createUiLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
