"""
MCP SQL Analytics Server
------------------------
Exposes Azure SQL tools for LLM-driven chart generation.

Tools:
  list_tables           — table names in the database
  get_table_schema      — columns, types, nullability for one table
  get_database_overview — all tables + schemas in one call (preferred for LLM context)
  execute_query         — run a read-only SELECT; returns column metadata + full rows

Transport: HTTP — connect via http://localhost:<PORT>/mcp
"""

import os
import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import pymssql
from dotenv import load_dotenv
from fastmcp import FastMCP
logging.basicConfig(level=logging.ERROR)
load_dotenv()  # no-op in Docker; works locally when run from project root

# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

def _parse_ado(conn_str: str) -> dict:
    kv = {}
    for part in conn_str.split(";"):
        if "=" in part:
            k, _, v = part.partition("=")
            kv[k.strip().lower()] = v.strip()
    return kv


def _get_conn() -> pymssql.Connection:
    conn_str = os.getenv("AZURE_SQL_CONNECTION_STRING")
    if conn_str:
        kv       = _parse_ado(conn_str)
        server   = kv.get("server", "").removeprefix("tcp:").split(",")[0]
        database = kv.get("initial catalog") or kv.get("database", "")
        user     = kv.get("user id") or kv.get("uid", "")
        password = kv.get("password") or kv.get("pwd", "")
    else:
        server   = os.environ["AZURE_SQL_SERVER"]
        database = os.environ["AZURE_SQL_DATABASE"]
        user     = os.environ["AZURE_SQL_USERNAME"]
        password = os.environ["AZURE_SQL_PASSWORD"]

    if not server:
        raise RuntimeError("Azure SQL server not found — check AZURE_SQL_CONNECTION_STRING in .env")

    return pymssql.connect(server=server, user=user, password=password,
                           database=database, autocommit=True)


def _serialize(val: Any) -> Any:
    """Convert DB types that aren't JSON-serializable."""
    if isinstance(val, (date, datetime)):
        return val.isoformat()
    if isinstance(val, Decimal):
        return float(val)
    return val


# ---------------------------------------------------------------------------
# MCP server
# ---------------------------------------------------------------------------

mcp = FastMCP("sql-analytics-server")


@mcp.tool()
def list_tables() -> list[str]:
    """Return the names of all user tables in the database."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES "
                "WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
            )
            return [r[0] for r in cur.fetchall()]


@mcp.tool()
def get_table_schema(table_name: str) -> dict[str, Any]:
    """
    Return column-level metadata for a single table.

    Result shape:
      {
        "table": "...",
        "columns": [{"name": "...", "type": "...", "nullable": bool, "primary_key": bool}, ...],
        "row_count": int
      }
    """
    with _get_conn() as conn:
        with conn.cursor(as_dict=True) as cur:
            cur.execute("""
                SELECT
                    c.COLUMN_NAME        AS name,
                    c.DATA_TYPE          AS type,
                    c.IS_NULLABLE        AS nullable,
                    CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS primary_key
                FROM INFORMATION_SCHEMA.COLUMNS c
                LEFT JOIN (
                    SELECT ku.COLUMN_NAME
                    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                      ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                    WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                      AND tc.TABLE_NAME = %s
                ) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
                WHERE c.TABLE_NAME = %s
                ORDER BY c.ORDINAL_POSITION
            """, (table_name, table_name))
            columns = [
                {
                    "name":        r["name"],
                    "type":        r["type"],
                    "nullable":    r["nullable"] == "YES",
                    "primary_key": bool(r["primary_key"]),
                }
                for r in cur.fetchall()
            ]

        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM [{table_name}]")
            count = cur.fetchone()[0]

    return {"table": table_name, "columns": columns, "row_count": count}


@mcp.tool()
def get_database_overview() -> dict[str, Any]:
    """
    Return schema metadata for every table in one call.
    Use this to understand the full database before writing SQL.

    Result shape:
      { "tables": { "<table_name>": { "columns": [...], "row_count": int }, ... } }
    """
    tables   = list_tables()
    overview = {}
    for table in tables:
        schema = get_table_schema(table)
        overview[table] = {"columns": schema["columns"], "row_count": schema["row_count"]}
    return {"tables": overview}


@mcp.tool()
def execute_query(sql: str) -> dict[str, Any]:
    """
    Execute a read-only SELECT query and return results.

    The 'columns' field describes the result schema — use this for reasoning.
    The 'rows' field contains the full dataset for the client to render charts.
    Max 10 000 rows are returned.

    Args:
        sql: A valid T-SQL SELECT statement. Must not contain DML or DDL.

    Result shape:
      {
        "columns": [{"name": "...","type": "..."}, ...],
        "row_count": int,
        "rows": [[val, ...], ...]
      }
    """
    normalized = sql.strip().upper()
    if not normalized.startswith("SELECT"):
        raise ValueError("Only SELECT statements are allowed.")
    for kw in ("INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE", "EXEC", "EXECUTE"):
        if kw in normalized:
            raise ValueError(f"Statement contains forbidden keyword: {kw}")

    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            col_names = [d[0] for d in cur.description]
            raw_rows  = cur.fetchmany(10_000)

    columns = [{"name": name} for name in col_names]
    rows    = [[_serialize(v) for v in row] for row in raw_rows]

    return {"columns": columns, "row_count": len(rows), "rows": rows}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    mcp.run(transport="http", host="0.0.0.0", port=port)
