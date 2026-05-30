import { describe, expect, it } from "vitest";
import { getSqlStatementsToRun, validateSqlForExecution } from "./sqlExecution";

describe("SQL execution safety validation", () => {
  it("allows read-only statements in Read-only Mode", () => {
    expect(validateSqlForExecution("select * from orders limit 10")).toMatchObject({
      safetyMode: "readOnly",
      canExecute: true,
      normalizedSql: "select * from orders limit 10",
      warnings: [],
    });
    expect(
      validateSqlForExecution(
        "with recent_orders as (select * from orders) select * from recent_orders limit 5",
      ),
    ).toMatchObject({
      canExecute: true,
    });
    expect(validateSqlForExecution("explain select * from orders")).toMatchObject({
      canExecute: true,
    });
  });

  it.each(["insert", "update", "delete", "drop", "alter", "truncate", "create"])(
    "blocks %s statements in Read-only Mode",
    (keyword) => {
      const validation = validateSqlForExecution(`${keyword} table orders`);

      expect(validation).toMatchObject({
        safetyMode: "readOnly",
        canExecute: false,
      });
      expect(validation.blockedReason).toMatch(new RegExp(keyword, "i"));
    },
  );

  it("blocks schema changes hidden after a read-only statement", () => {
    const validation = validateSqlForExecution(
      "select * from orders limit 10; drop table orders",
    );

    expect(validation).toMatchObject({
      safetyMode: "readOnly",
      canExecute: false,
      blockedReason: "Read-only Mode blocks DROP statements.",
    });
  });

  it("does not block write keywords inside comments or literals", () => {
    expect(
      validateSqlForExecution(
        "select 'drop table orders' as sample_note /* alter table orders */ limit 1",
      ),
    ).toMatchObject({
      safetyMode: "readOnly",
      canExecute: true,
      warnings: [],
    });
  });

  it("warns about missing LIMIT without changing or blocking SQL", () => {
    const sql = "select * from orders";

    expect(validateSqlForExecution(sql)).toEqual({
      safetyMode: "readOnly",
      canExecute: true,
      normalizedSql: sql,
      warnings: ["Missing LIMIT may return a large result set."],
    });
  });
});

describe("SQL execution statement selection", () => {
  it("returns the full multi-line SQL statement containing the cursor when no text is selected", () => {
    const sql = [
      "select id,",
      "  amount",
      "from orders",
      "where status = 'paid'",
      "limit 10;",
      "",
      "select count(*) from refunds limit 1;",
    ].join("\n");
    const cursor = sql.indexOf("where status");

    expect(getSqlStatementsToRun(sql, cursor, cursor)).toEqual([
      [
        "select id,",
        "  amount",
        "from orders",
        "where status = 'paid'",
        "limit 10",
      ].join("\n"),
    ]);
  });

  it("returns the previous complete statement when the cursor is at the end of a semicolon-terminated statement", () => {
    const sql = "select * from orders limit 10;";

    expect(getSqlStatementsToRun(sql, sql.length, sql.length)).toEqual([
      "select * from orders limit 10",
    ]);
  });

  it("splits selected SQL into ordered statements", () => {
    const sql = [
      "-- keep this unselected",
      "select * from orders limit 10;",
      "",
      "select * from customers limit 5;",
      "select * from refunds limit 2;",
    ].join("\n");
    const selectionStart = sql.indexOf("select * from orders");
    const selectionEnd = sql.indexOf("select * from refunds") - 1;

    expect(getSqlStatementsToRun(sql, selectionStart, selectionEnd)).toEqual([
      "select * from orders limit 10",
      "select * from customers limit 5",
    ]);
  });

  it("does not split selected statements on semicolons inside string literals", () => {
    const sql = [
      "select 'paid; settled' as status_label from orders limit 1;",
      "select * from customers limit 5;",
    ].join("\n");

    expect(getSqlStatementsToRun(sql, 0, sql.length)).toEqual([
      "select 'paid; settled' as status_label from orders limit 1",
      "select * from customers limit 5",
    ]);
  });
});
