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

export function getSqlStatementsToRun(
  sql: string,
  selectionStart: number,
  selectionEnd: number,
) {
  if (selectionStart !== selectionEnd) {
    return splitSqlStatements(sql.slice(selectionStart, selectionEnd));
  }

  const cursorPosition = getStatementCursorPosition(sql, selectionStart);
  return splitSqlStatementRanges(sql)
    .filter((range) => range.start <= cursorPosition && cursorPosition <= range.end)
    .map((range) => sql.slice(range.start, range.end).trim())
    .filter(Boolean);
}

function getStatementCursorPosition(sql: string, selectionStart: number) {
  let cursorPosition = Math.min(selectionStart, sql.length);

  while (cursorPosition > 0 && /\s/.test(sql[cursorPosition - 1] ?? "")) {
    cursorPosition -= 1;
  }

  if (cursorPosition > 0 && sql[cursorPosition - 1] === ";") {
    cursorPosition -= 1;
  }

  return cursorPosition;
}

function firstKeyword(statement: string) {
  return statement.match(/\b[a-z_]+\b/)?.[0] ?? "";
}

function hasLimitClause(sql: string) {
  return /\blimit\b/.test(sql);
}

function splitSqlStatements(sql: string) {
  return splitSqlStatementRanges(sql)
    .map((range) => sql.slice(range.start, range.end).trim())
    .filter(Boolean);
}

function splitSqlStatementRanges(sql: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  let statementStart = 0;
  let index = 0;
  let quote: "'" | '"' | "`" | null = null;

  while (index < sql.length) {
    const current = sql[index];
    const next = sql[index + 1];

    if (quote) {
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
      index += 2;
      while (index < sql.length && sql[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (current === "/" && next === "*") {
      index += 2;
      while (index < sql.length && !(sql[index] === "*" && sql[index + 1] === "/")) {
        index += 1;
      }
      index = Math.min(index + 2, sql.length);
      continue;
    }

    if (current === "'" || current === '"' || current === "`") {
      quote = current;
      index += 1;
      continue;
    }

    if (current === ";") {
      ranges.push({ start: statementStart, end: index });
      statementStart = index + 1;
    }

    index += 1;
  }

  ranges.push({ start: statementStart, end: sql.length });
  return ranges;
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
