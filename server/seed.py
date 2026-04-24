"""
Financial Data Seeder
---------------------
Populates Azure SQL with realistic fake financial data spanning 2021-2025.

Tables created:
  accounts       — retail/institutional account holders
  transactions   — debits/credits per account
  portfolios     — brokerage/IRA portfolios
  positions      — current holdings per portfolio
  market_prices  — daily OHLCV for 20 symbols (geometric Brownian motion)
  dividends      — quarterly dividend events

Usage:
  python seed.py           # uses AZURE_SQL_CONNECTION_STRING from .env
  python seed.py --drop    # drop and recreate all tables first

Requirements:
  pip install pymssql faker pandas numpy python-dotenv
"""

import argparse
import logging
import os
import random
from datetime import date, timedelta

import numpy as np
import pandas as pd
import pymssql
from dotenv import load_dotenv
from faker import Faker

# Silence noisy library loggers so our output stays readable
logging.basicConfig(level=logging.ERROR)

load_dotenv()

# ---------------------------------------------------------------------------
# Reproducibility
# ---------------------------------------------------------------------------
SEED = 42
random.seed(SEED)
np.random.seed(SEED)
Faker.seed(SEED)
fake = Faker()

# ---------------------------------------------------------------------------
# Parameters
# ---------------------------------------------------------------------------
START_DATE   = date(2021, 1, 1)
END_DATE     = date(2025, 12, 31)
TRADING_DAYS = pd.bdate_range(start=START_DATE, end=END_DATE)

# (symbol, start_price, annual_drift, annual_volatility)
SYMBOLS: list[tuple[str, float, float, float]] = [
    ("AAPL",   130.0, 0.25, 0.28),
    ("MSFT",   220.0, 0.22, 0.26),
    ("GOOGL", 1750.0, 0.18, 0.30),
    ("AMZN",  3200.0, 0.15, 0.35),
    ("TSLA",   700.0, 0.40, 0.65),
    ("JPM",    130.0, 0.12, 0.22),
    ("BAC",     35.0, 0.10, 0.24),
    ("GS",     350.0, 0.14, 0.26),
    ("WFC",     40.0, 0.08, 0.23),
    ("V",      210.0, 0.18, 0.22),
    ("MA",     360.0, 0.20, 0.24),
    ("JNJ",    160.0, 0.06, 0.15),
    ("PFE",     40.0, 0.05, 0.20),
    ("UNH",    380.0, 0.22, 0.18),
    ("XOM",     55.0, 0.08, 0.30),
    ("CVX",     95.0, 0.10, 0.28),
    ("SPY",    370.0, 0.14, 0.18),
    ("QQQ",    320.0, 0.18, 0.22),
    ("BRK",    250.0, 0.10, 0.16),
    ("META",   260.0, 0.20, 0.40),
]

DIVIDEND_SYMBOLS = {"JPM", "BAC", "JNJ", "PFE", "XOM", "CVX", "V", "MA"}

N_ACCOUNTS   = 20
N_PORTFOLIOS = 12

CHECKING_CATEGORIES  = ["groceries", "utilities", "rent", "dining", "entertainment",
                         "salary", "transfer", "atm", "insurance", "healthcare", "subscription"]
SAVINGS_CATEGORIES   = ["transfer", "interest"]
BROKERAGE_CATEGORIES = ["trade_buy", "trade_sell", "dividend", "transfer", "margin_interest"]
IRA_CATEGORIES       = ["trade_buy", "trade_sell", "dividend", "contribution"]

# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

def _parse_ado(conn_str: str) -> dict:
    kv = {}
    for part in conn_str.split(";"):
        part = part.strip()
        if "=" in part:
            k, _, v = part.partition("=")
            kv[k.strip().lower()] = v.strip()
    return kv


def get_connection() -> pymssql.Connection:
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

    return pymssql.connect(server=server, user=user, password=password, database=database)


# ---------------------------------------------------------------------------
# Schema DDL
# ---------------------------------------------------------------------------

DDL_DROP = [
    "IF OBJECT_ID('dividends',     'U') IS NOT NULL DROP TABLE dividends",
    "IF OBJECT_ID('market_prices', 'U') IS NOT NULL DROP TABLE market_prices",
    "IF OBJECT_ID('positions',     'U') IS NOT NULL DROP TABLE positions",
    "IF OBJECT_ID('portfolios',    'U') IS NOT NULL DROP TABLE portfolios",
    "IF OBJECT_ID('transactions',  'U') IS NOT NULL DROP TABLE transactions",
    "IF OBJECT_ID('accounts',      'U') IS NOT NULL DROP TABLE accounts",
]

DDL_CREATE = [
    """
    IF OBJECT_ID('accounts', 'U') IS NULL
    CREATE TABLE accounts (
        account_id    INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        account_name  NVARCHAR(120) NOT NULL,
        account_type  NVARCHAR(20)  NOT NULL,
        currency      NCHAR(3)      NOT NULL DEFAULT 'USD',
        owner_name    NVARCHAR(100) NOT NULL,
        created_at    DATE          NOT NULL,
        balance       DECIMAL(15,2) NOT NULL DEFAULT 0
    )
    """,
    """
    IF OBJECT_ID('transactions', 'U') IS NULL
    CREATE TABLE transactions (
        transaction_id   INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        account_id       INT           NOT NULL REFERENCES accounts(account_id),
        transaction_date DATE          NOT NULL,
        amount           DECIMAL(15,2) NOT NULL,
        direction        NVARCHAR(6)   NOT NULL,
        category         NVARCHAR(30)  NOT NULL,
        description      NVARCHAR(200) NOT NULL,
        balance_after    DECIMAL(15,2) NOT NULL
    )
    """,
    """
    IF OBJECT_ID('portfolios', 'U') IS NULL
    CREATE TABLE portfolios (
        portfolio_id   INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        account_id     INT           NOT NULL REFERENCES accounts(account_id),
        portfolio_name NVARCHAR(100) NOT NULL,
        created_at     DATE          NOT NULL
    )
    """,
    """
    IF OBJECT_ID('positions', 'U') IS NULL
    CREATE TABLE positions (
        position_id  INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        portfolio_id INT           NOT NULL REFERENCES portfolios(portfolio_id),
        symbol       NVARCHAR(10)  NOT NULL,
        quantity     DECIMAL(15,4) NOT NULL,
        avg_cost     DECIMAL(15,4) NOT NULL,
        last_updated DATE          NOT NULL
    )
    """,
    """
    IF OBJECT_ID('market_prices', 'U') IS NULL
    CREATE TABLE market_prices (
        price_id    INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        symbol      NVARCHAR(10)  NOT NULL,
        price_date  DATE          NOT NULL,
        open_price  DECIMAL(15,4) NOT NULL,
        high_price  DECIMAL(15,4) NOT NULL,
        low_price   DECIMAL(15,4) NOT NULL,
        close_price DECIMAL(15,4) NOT NULL,
        volume      BIGINT        NOT NULL,
        UNIQUE (symbol, price_date)
    )
    """,
    """
    IF OBJECT_ID('dividends', 'U') IS NULL
    CREATE TABLE dividends (
        dividend_id      INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        symbol           NVARCHAR(10)  NOT NULL,
        ex_date          DATE          NOT NULL,
        amount_per_share DECIMAL(10,4) NOT NULL
    )
    """,
]

# ---------------------------------------------------------------------------
# Generators
# ---------------------------------------------------------------------------

def random_date(start: date, end: date) -> date:
    return start + timedelta(days=random.randint(0, (end - start).days))


def _gbm_prices(start_price: float, mu: float, sigma: float, n: int) -> np.ndarray:
    dt      = 1 / 252
    shocks  = np.random.normal((mu - 0.5 * sigma**2) * dt, sigma * np.sqrt(dt), n)
    return start_price * np.exp(np.cumsum(shocks))


def generate_market_prices() -> pd.DataFrame:
    frames = []
    for symbol, start_price, mu, sigma in SYMBOLS:
        n      = len(TRADING_DAYS)
        closes = _gbm_prices(start_price, mu, sigma, n)
        spread = closes * np.random.uniform(0.003, 0.015, n)
        highs  = closes + spread * np.random.uniform(0.3, 1.0, n)
        lows   = closes - spread * np.random.uniform(0.3, 1.0, n)
        opens  = lows + (highs - lows) * np.random.uniform(0, 1, n)
        vols   = (random.randint(5_000_000, 100_000_000) * np.random.lognormal(0, 0.4, n)).astype(int)
        frames.append(pd.DataFrame({
            "symbol":      symbol,
            "price_date":  TRADING_DAYS.date,
            "open_price":  np.round(opens,  4),
            "high_price":  np.round(highs,  4),
            "low_price":   np.round(lows,   4),
            "close_price": np.round(closes, 4),
            "volume":      vols,
        }))
    return pd.concat(frames, ignore_index=True)


def generate_dividends() -> pd.DataFrame:
    rows = []
    for symbol, start_price, _, _ in SYMBOLS:
        if symbol not in DIVIDEND_SYMBOLS:
            continue
        base = round(start_price * random.uniform(0.015, 0.045) / 4, 4)
        for year in range(2021, 2026):
            for month in (2, 5, 8, 11):
                growth = (1 + random.uniform(0.01, 0.05)) ** (year - 2021)
                rows.append((symbol, date(year, month, random.randint(10, 20)), round(base * growth, 4)))
    return pd.DataFrame(rows, columns=["symbol", "ex_date", "amount_per_share"])


def generate_accounts() -> pd.DataFrame:
    types = (["checking"] * 8 + ["savings"] * 4 + ["brokerage"] * 5 + ["ira"] * 3)[:N_ACCOUNTS]
    rows  = []
    for acc_type in types:
        owner   = fake.name()
        balance = round(random.uniform(
            {"checking": 500, "savings": 5_000, "brokerage": 10_000, "ira": 20_000}[acc_type],
            {"checking": 25_000, "savings": 150_000, "brokerage": 500_000, "ira": 800_000}[acc_type],
        ), 2)
        rows.append((
            f"{owner}'s {acc_type.title()} Account",
            acc_type, "USD", owner,
            random_date(date(2018, 1, 1), date(2022, 12, 31)),
            balance,
        ))
    return pd.DataFrame(rows, columns=["account_name", "account_type", "currency",
                                       "owner_name", "created_at", "balance"])


def _txn_description(category: str) -> str:
    return {
        "groceries":       lambda: f"{fake.company()} Supermarket",
        "utilities":       lambda: random.choice(["Electric Bill", "Gas Bill", "Water Bill", "Internet"]),
        "rent":            lambda: f"Rent - {fake.street_address()}",
        "dining":          lambda: f"{fake.last_name()}'s {random.choice(['Bistro','Grill','Café','Kitchen'])}",
        "entertainment":   lambda: random.choice(["Netflix", "Spotify", "Cinema Ticket", "Concert"]),
        "salary":          lambda: f"Payroll Deposit - {fake.company()}",
        "transfer":        lambda: "Internal Transfer",
        "atm":             lambda: f"ATM Withdrawal {fake.city()}",
        "insurance":       lambda: f"{fake.company()} Insurance Premium",
        "healthcare":      lambda: random.choice(["Doctor Visit", "Pharmacy", "Lab Test", "Dental"]),
        "subscription":    lambda: random.choice(["Adobe CC", "Microsoft 365", "Amazon Prime", "Gym Membership"]),
        "interest":        lambda: "Savings Interest Credit",
        "dividend":        lambda: f"Dividend Credit {random.choice([s[0] for s in SYMBOLS])}",
        "trade_buy":       lambda: f"BUY {random.choice([s[0] for s in SYMBOLS])} {random.randint(1,50)} shares",
        "trade_sell":      lambda: f"SELL {random.choice([s[0] for s in SYMBOLS])} {random.randint(1,50)} shares",
        "margin_interest": lambda: "Margin Interest Charge",
        "contribution":    lambda: "IRA Contribution",
    }.get(category, lambda: category.replace("_", " ").title())()


def generate_transactions(account_ids: list[int], account_types: list[str]) -> pd.DataFrame:
    cat_map = {"checking": CHECKING_CATEGORIES, "savings": SAVINGS_CATEGORIES,
               "brokerage": BROKERAGE_CATEGORIES, "ira": IRA_CATEGORIES}
    credit_cats = {"salary", "interest", "dividend", "transfer", "trade_sell", "contribution"}
    rows = []
    for acc_id, acc_type in zip(account_ids, account_types):
        cats    = cat_map[acc_type]
        balance = round(random.uniform(1_000, 50_000), 2)
        for _ in range(random.randint(600, 1400)):
            cat       = random.choice(cats)
            is_credit = cat in credit_cats
            amount    = round(random.uniform(
                *{"salary": (3_000, 12_000), "rent": (800, 3_500),
                  "trade_buy": (500, 25_000), "trade_sell": (500, 25_000),
                  "contribution": (500, 6_500)}.get(cat, (5, 2_000))
            ), 2)
            balance = round(balance + amount if is_credit else balance - amount, 2)
            rows.append((acc_id, random_date(START_DATE, END_DATE), amount,
                         "credit" if is_credit else "debit",
                         cat, _txn_description(cat), balance))
    df = pd.DataFrame(rows, columns=["account_id", "transaction_date", "amount",
                                     "direction", "category", "description", "balance_after"])
    return df.sort_values("transaction_date").reset_index(drop=True)


def generate_portfolios(inv_account_ids: list[int]) -> pd.DataFrame:
    styles = ["Growth Portfolio", "Income Portfolio", "Balanced Portfolio", "Tech Focus",
              "Dividend Growth", "Blue Chip", "ESG Portfolio", "Small Cap",
              "International", "Retirement Core"]
    rows, used = [], 0
    for acc_id in inv_account_ids:
        for _ in range(random.randint(1, 3)):
            if used >= N_PORTFOLIOS:
                break
            rows.append((acc_id, random.choice(styles),
                         random_date(date(2020, 1, 1), date(2023, 6, 30))))
            used += 1
    return pd.DataFrame(rows, columns=["account_id", "portfolio_name", "created_at"])


def generate_positions(portfolio_ids: list[int], price_df: pd.DataFrame) -> pd.DataFrame:
    latest = price_df.groupby("symbol")["close_price"].last().to_dict()
    rows   = []
    for port_id in portfolio_ids:
        for symbol in random.sample([s[0] for s in SYMBOLS], random.randint(3, 10)):
            last = latest.get(symbol, 100.0)
            rows.append((port_id, symbol,
                         round(random.uniform(1, 200), 4),
                         round(last * random.uniform(0.6, 1.2), 4),
                         END_DATE))
    return pd.DataFrame(rows, columns=["portfolio_id", "symbol", "quantity", "avg_cost", "last_updated"])


# ---------------------------------------------------------------------------
# Insert helpers (raw pymssql — no SQLAlchemy, no to_sql)
# ---------------------------------------------------------------------------

def _to_python(val):
    """Coerce numpy/pandas scalars to plain Python types for pymssql."""
    if isinstance(val, pd.Timestamp):
        return val.date()
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        return float(val)
    return val


def _rows(df: pd.DataFrame) -> list[tuple]:
    return [tuple(_to_python(v) for v in row) for row in df.itertuples(index=False, name=None)]


def bulk_insert(conn, table: str, df: pd.DataFrame, chunksize: int = 2000) -> None:
    cols  = ", ".join(f"[{c}]" for c in df.columns)
    phds  = ", ".join(["%s"] * len(df.columns))
    sql   = f"INSERT INTO [{table}] ({cols}) VALUES ({phds})"
    data  = _rows(df)
    with conn.cursor() as cur:
        for i in range(0, len(data), chunksize):
            cur.executemany(sql, data[i : i + chunksize])
    conn.commit()


def insert_and_get_ids(conn, table: str, id_col: str, df: pd.DataFrame) -> list[int]:
    with conn.cursor() as cur:
        cur.execute(f"SELECT ISNULL(MAX([{id_col}]), 0) FROM [{table}]")
        prev_max = cur.fetchone()[0]

    bulk_insert(conn, table, df)

    with conn.cursor() as cur:
        cur.execute(f"SELECT [{id_col}] FROM [{table}] WHERE [{id_col}] > %s ORDER BY [{id_col}]", (prev_max,))
        return [r[0] for r in cur.fetchall()]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(drop: bool = False) -> None:
    print("Connecting …")
    conn = get_connection()

    with conn.cursor() as cur:
        if drop:
            print("Dropping tables …")
            for stmt in DDL_DROP:
                cur.execute(stmt)
            conn.commit()

        print("Creating tables …")
        for stmt in DDL_CREATE:
            cur.execute(stmt)
        conn.commit()

    print("Seeding data …")

    price_df = generate_market_prices()
    bulk_insert(conn, "market_prices", price_df)
    print(f"  market_prices  {len(price_df):>7,}")

    div_df = generate_dividends()
    bulk_insert(conn, "dividends", div_df)
    print(f"  dividends      {len(div_df):>7,}")

    acc_df    = generate_accounts()
    acc_ids   = insert_and_get_ids(conn, "accounts", "account_id", acc_df)
    acc_types = acc_df["account_type"].tolist()
    print(f"  accounts       {len(acc_df):>7,}")

    txn_df = generate_transactions(acc_ids, acc_types)
    bulk_insert(conn, "transactions", txn_df)
    print(f"  transactions   {len(txn_df):>7,}")

    inv_ids  = [aid for aid, at in zip(acc_ids, acc_types) if at in ("brokerage", "ira")]
    port_df  = generate_portfolios(inv_ids)
    port_ids = insert_and_get_ids(conn, "portfolios", "portfolio_id", port_df)
    print(f"  portfolios     {len(port_df):>7,}")

    pos_df = generate_positions(port_ids, price_df)
    bulk_insert(conn, "positions", pos_df)
    print(f"  positions      {len(pos_df):>7,}")

    conn.close()
    print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--drop", action="store_true", help="Drop and recreate tables before seeding")
    main(drop=parser.parse_args().drop)
