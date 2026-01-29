import os
from dotenv import load_dotenv
import pymysql
from pymysql.constants import CLIENT

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(os.path.dirname(BASE_DIR))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

sql_path = os.path.join(os.path.dirname(__file__), "..", "migrations", "001_init.sql")
with open(sql_path, "r", encoding="utf-8") as file:
  sql = file.read()

conn = pymysql.connect(
  host=os.getenv("DB_HOST"),
  user=os.getenv("DB_USER"),
  password=os.getenv("DB_PASSWORD"),
  database=os.getenv("DB_NAME"),
  port=int(os.getenv("DB_PORT", "3306")),
  autocommit=True,
  client_flag=CLIENT.MULTI_STATEMENTS
)

with conn.cursor() as cur:
  cur.execute(sql)

conn.close()
print("Migration completed")
