export type ExecutionSafetyMode = "readOnly" | "dataModification" | "fullAccess";

export interface SqlValidationResult {
  safetyMode: ExecutionSafetyMode;
  canExecute: boolean;
  normalizedSql: string;
  warnings: string[];
  blockedReason?: string;
}

const readOnlyAllowedStatements = new Set(["select", "with", "explain"]);
const readOnlyBlockedStatements = new Set([
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "truncate",
  "create",
]);

export function validateSqlForExecution(
  sql: string,
  safetyMode: ExecutionSafetyMode = "readOnly",
): SqlValidationResult {
  const normalizedSql = sql.trim();
  const sanitizedSql = stripSqlCommentsAndLiterals(normalizedSql).toLowerCase();
  const statements = splitSqlStatements(sanitizedSql);
  const firstBlockedKeyword = statements
    .flatMap((statement) => Array.from(statement.matchAll(/\b[a-z_]+\b/g), ([match]) => match))
    .find((keyword) => readOnlyBlockedStatements.has(keyword));

  if (safetyMode === "readOnly" && firstBlockedKeyword) {
    return {
      safetyMode,
      canExecute: false,
      normalizedSql,
      warnings: [],
      blockedReason: `Read-only Mode blocks ${firstBlockedKeyword.toUpperCase()} statements.`,
    };
  }

  const firstStatements = statements.map((statement) => firstKeyword(statement)).filter(Boolean);
  const unsupportedStatement = firstStatements.find(
    (statement) => !readOnlyAllowedStatements.has(statement),
  );

  if (safetyMode === "readOnly" && unsupportedStatement) {
    return {
      safetyMode,
      canExecute: false,
      normalizedSql,
      warnings: [],
      blockedReason: `Read-only Mode only allows SELECT, WITH, and EXPLAIN statements.`,
    };
  }

  return {
    safetyMode,
    canExecute: true,
    normalizedSql,
    warnings: hasLimitClause(sanitizedSql)
      ? []
      : ["Missing LIMIT may return a large result set."],
  };
}

function firstKeyword(statement: string) {
  return statement.match(/\b[a-z_]+\b/)?.[0] ?? "";
}

function hasLimitClause(sql: string) {
  return /\blimit\b/.test(sql);
}

function splitSqlStatements(sql: string) {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function stripSqlCommentsAndLiterals(sql: string) {
  let sanitized = "";
  let index = 0;
  let quote: "'" | '"' | "`" | null = null;

  while (index < sql.length) {
    const current = sql[index];
    const next = sql[index + 1];

    if (quote) {
      sanitized += " ";

      if (current === "\\" && quote !== "`") {
        index += 2;
        continue;
      }

      if (current === quote) {
        quote = null;
      }

      index += 1;
      continue;
    }

    if (current === "-" && next === "-") {
      while (index < sql.length && sql[index] !== "\n") {
        sanitized += " ";
        index += 1;
      }
      continue;
    }

    if (current === "/" && next === "*") {
      sanitized += "  ";
      index += 2;

      while (index < sql.length && !(sql[index] === "*" && sql[index + 1] === "/")) {
        sanitized += " ";
        index += 1;
      }

      if (index < sql.length) {
        sanitized += "  ";
        index += 2;
      }
      continue;
    }

    if (current === "'" || current === '"' || current === "`") {
      quote = current;
      sanitized += " ";
      index += 1;
      continue;
    }

    sanitized += current;
    index += 1;
  }

  return sanitized;
}
