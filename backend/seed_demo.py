import os
from datetime import datetime, timedelta

import pymysql
from dotenv import load_dotenv
from pymysql.cursors import DictCursor
from werkzeug.security import generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
load_dotenv(os.path.join(ROOT_DIR, ".env"))


def get_db():
  return pymysql.connect(
    host=os.getenv("DB_HOST"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    database=os.getenv("DB_NAME"),
    port=int(os.getenv("DB_PORT", "3306")),
    autocommit=True,
    cursorclass=DictCursor
  )


def ensure_company(cur, name, code, parent_id=None):
  cur.execute("SELECT id FROM companies WHERE code = %s", (code,))
  row = cur.fetchone()
  if row:
    return row["id"]
  cur.execute(
    "INSERT INTO companies (name, code, parent_id, status) VALUES (%s, %s, %s, 'active')",
    (name, code, parent_id)
  )
  return cur.lastrowid


def ensure_user(cur, name, role, company_id=None, email=None):
  default_password = os.getenv("DEFAULT_USER_PASSWORD", "88888888")
  password_hash = generate_password_hash(default_password)
  if company_id is None:
    cur.execute(
      "SELECT id FROM users WHERE name = %s AND role = %s AND company_id IS NULL",
      (name, role)
    )
  else:
    cur.execute(
      "SELECT id FROM users WHERE name = %s AND role = %s AND company_id = %s",
      (name, role, company_id)
    )
  row = cur.fetchone()
  if row:
    return row["id"]
  cur.execute(
    "INSERT INTO users (name, email, role, company_id, status, password_hash) VALUES (%s, %s, %s, %s, 'active', %s)",
    (name, email, role, company_id, password_hash)
  )
  return cur.lastrowid


def ensure_opportunity(cur, payload):
  cur.execute(
    "SELECT id FROM opportunities WHERE name = %s AND company_id = %s LIMIT 1",
    (payload["name"], payload["company_id"])
  )
  row = cur.fetchone()
  if row:
    return row["id"]

  columns = [
    "name",
    "type",
    "source",
    "industry",
    "city",
    "status",
    "stage",
    "owner_id",
    "company_id",
    "organizer_name",
    "organizer_type",
    "exhibition_name",
    "exhibition_start_date",
    "exhibition_end_date",
    "venue_name",
    "venue_address",
    "booth_count",
    "exhibition_area_sqm",
    "expected_visitors",
    "exhibition_theme",
    "budget_range",
    "risk_notes",
    "contact_name",
    "contact_title",
    "contact_phone",
    "contact_email",
    "contact_wechat"
  ]
  values = [payload.get(col) for col in columns]
  placeholders = ", ".join(["%s"] * len(columns))
  cur.execute(
    f"INSERT INTO opportunities ({', '.join(columns)}) VALUES ({placeholders})",
    values
  )
  return cur.lastrowid


def ensure_activity(cur, opportunity_id, user_id, channel, result, next_step, offset_days=0):
  cur.execute(
    "SELECT id FROM activities WHERE opportunity_id = %s AND result = %s AND next_step = %s LIMIT 1",
    (opportunity_id, result, next_step)
  )
  row = cur.fetchone()
  if row:
    return row["id"]
  follow_up_at = datetime.utcnow() + timedelta(days=offset_days)
  cur.execute(
    "INSERT INTO activities (opportunity_id, user_id, channel, result, next_step, follow_up_at) "
    "VALUES (%s, %s, %s, %s, %s, %s)",
    (opportunity_id, user_id, channel, result, next_step, follow_up_at)
  )
  return cur.lastrowid


def ensure_tag(cur, name, tag_type):
  cur.execute("INSERT IGNORE INTO tags (name, type) VALUES (%s, %s)", (name, tag_type))
  cur.execute("SELECT id FROM tags WHERE name = %s AND type = %s", (name, tag_type))
  row = cur.fetchone()
  return row["id"] if row else None


def ensure_tag_link(cur, opportunity_id, tag_id):
  if not tag_id:
    return
  cur.execute(
    "INSERT IGNORE INTO opportunity_tags (opportunity_id, tag_id) VALUES (%s, %s)",
    (opportunity_id, tag_id)
  )


def main():
  db = get_db()
  with db.cursor() as cur:
    group_id = ensure_company(cur, "集团总部", "GROUP-HQ")
    east_id = ensure_company(cur, "华东子公司", "SUB-EAST", group_id)
    south_id = ensure_company(cur, "华南子公司", "SUB-SOUTH", group_id)
    bj_id = ensure_company(cur, "北京办事处", "OFFICE-BJ", east_id)
    sz_id = ensure_company(cur, "深圳办事处", "OFFICE-SZ", south_id)

    admin_name = os.getenv("ADMIN_USERNAME", "admin-pico")
    ensure_user(cur, admin_name, "group_admin", None, "admin@pico.local")

    east_admin = ensure_user(cur, "华东管理员", "subsidiary_admin", east_id, "admin.east@pico.local")
    south_admin = ensure_user(cur, "华南管理员", "subsidiary_admin", south_id, "admin.south@pico.local")

    east_sales = ensure_user(cur, "华东销售-林晓", "sales", east_id, "sales.east@pico.local")
    east_marketing = ensure_user(cur, "华东市场-许佳", "marketing", east_id, "mkt.east@pico.local")
    south_sales = ensure_user(cur, "华南销售-陈浩", "sales", south_id, "sales.south@pico.local")
    south_marketing = ensure_user(cur, "华南市场-李瑶", "marketing", south_id, "mkt.south@pico.local")
    bj_sales = ensure_user(cur, "北京销售-周宁", "sales", bj_id, "sales.bj@pico.local")
    sz_sales = ensure_user(cur, "深圳销售-王珂", "sales", sz_id, "sales.sz@pico.local")

    opportunities = [
      {
        "name": "星辰科技年度采购合作",
        "type": "normal",
        "source": "推荐",
        "industry": "制造业",
        "city": "上海",
        "status": "in_progress",
        "stage": "need_defined",
        "owner_id": east_sales,
        "company_id": east_id,
        "contact_name": "王雪",
        "contact_title": "采购经理",
        "contact_phone": "13800001111",
        "contact_email": "wangxue@example.com"
      },
      {
        "name": "远航集团展会主场合作",
        "type": "host",
        "source": "市场活动",
        "industry": "会展",
        "city": "杭州",
        "status": "valid",
        "stage": "ready_for_handoff",
        "owner_id": east_sales,
        "company_id": east_id,
        "organizer_name": "远航集团",
        "organizer_type": "commercial",
        "exhibition_name": "未来智造展",
        "exhibition_start_date": "2026-03-20",
        "exhibition_end_date": "2026-03-23",
        "venue_name": "杭州国际博览中心",
        "venue_address": "钱江新城 9 号馆",
        "booth_count": 320,
        "exhibition_area_sqm": 18000,
        "expected_visitors": 26000,
        "exhibition_theme": "智能制造与产业升级",
        "budget_range": "80-120 万",
        "risk_notes": "需提前确认消防批文",
        "contact_name": "叶秋",
        "contact_title": "市场总监",
        "contact_phone": "13900002222",
        "contact_email": "yeqiu@example.com"
      },
      {
        "name": "星河医药营销支持",
        "type": "normal",
        "source": "电话",
        "industry": "医药",
        "city": "广州",
        "status": "new",
        "stage": "cold",
        "owner_id": south_sales,
        "company_id": south_id,
        "contact_name": "吴晨",
        "contact_title": "招商主管",
        "contact_phone": "13700003333"
      },
      {
        "name": "湾区智能装备主场项目",
        "type": "host",
        "source": "合作伙伴",
        "industry": "工业设备",
        "city": "深圳",
        "status": "in_progress",
        "stage": "bid_preparing",
        "owner_id": south_sales,
        "company_id": south_id,
        "organizer_name": "湾区会展中心",
        "organizer_type": "government",
        "exhibition_name": "智能装备博览会",
        "exhibition_start_date": "2026-05-10",
        "exhibition_end_date": "2026-05-12",
        "venue_name": "深圳国际会展中心",
        "venue_address": "宝安区福海街道 1 号馆",
        "booth_count": 480,
        "exhibition_area_sqm": 26000,
        "expected_visitors": 42000,
        "exhibition_theme": "智能装备与自动化",
        "budget_range": "120-160 万",
        "risk_notes": "需要协调政府联合宣传",
        "contact_name": "赵倩",
        "contact_title": "招商主管"
      },
      {
        "name": "北京新零售渠道拓展",
        "type": "normal",
        "source": "邮件",
        "industry": "零售",
        "city": "北京",
        "status": "assigned",
        "stage": "interest",
        "owner_id": bj_sales,
        "company_id": bj_id,
        "contact_name": "刘洋",
        "contact_title": "招商主管"
      },
      {
        "name": "华南新能源展示主场",
        "type": "host",
        "source": "展会线索",
        "industry": "新能源",
        "city": "深圳",
        "status": "valid",
        "stage": "need_defined",
        "owner_id": sz_sales,
        "company_id": sz_id,
        "organizer_name": "鹏城会展",
        "organizer_type": "gov_joint",
        "exhibition_name": "新能源论坛",
        "exhibition_start_date": "2026-04-18",
        "exhibition_end_date": "2026-04-20",
        "venue_name": "深圳会展中心",
        "venue_address": "福田区会展路 138 号",
        "booth_count": 260,
        "exhibition_area_sqm": 14000,
        "expected_visitors": 18000,
        "exhibition_theme": "新能源生态与投资",
        "budget_range": "60-90 万",
        "risk_notes": "赞助商权益需进一步确认",
        "contact_name": "林梓",
        "contact_title": "招商主管"
      }
    ]

    opportunity_ids = []
    for item in opportunities:
      opportunity_ids.append(ensure_opportunity(cur, item))

    if opportunity_ids:
      ensure_activity(
        cur,
        opportunity_ids[0],
        east_sales,
        "phone",
        "已确认需求范围",
        "准备报价清单",
        3
      )
      ensure_activity(
        cur,
        opportunity_ids[0],
        east_marketing,
        "email",
        "发送案例资料",
        "等待客户反馈",
        7
      )
      ensure_activity(
        cur,
        opportunity_ids[1],
        east_sales,
        "onsite",
        "完成场地踏勘",
        "整理风险清单",
        5
      )
      ensure_activity(
        cur,
        opportunity_ids[3],
        south_marketing,
        "wechat",
        "收到预算区间",
        "安排下一次会面",
        4
      )

    tag_city_sh = ensure_tag(cur, "上海", "city")
    tag_city_sz = ensure_tag(cur, "深圳", "city")
    tag_industry_manu = ensure_tag(cur, "制造业", "industry")
    tag_industry_energy = ensure_tag(cur, "新能源", "industry")
    tag_status_hot = ensure_tag(cur, "重点推进", "business")

    if opportunity_ids:
      ensure_tag_link(cur, opportunity_ids[0], tag_city_sh)
      ensure_tag_link(cur, opportunity_ids[0], tag_industry_manu)
      ensure_tag_link(cur, opportunity_ids[0], tag_status_hot)
      ensure_tag_link(cur, opportunity_ids[3], tag_city_sz)
      ensure_tag_link(cur, opportunity_ids[3], tag_industry_energy)

  print("✅ 已写入/更新 demo 数据（可重复执行）。")


if __name__ == "__main__":
  main()
