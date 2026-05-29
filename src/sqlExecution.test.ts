import { describe, expect, it } from "vitest";
import { validateSqlForExecution } from "./sqlExecution";

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
