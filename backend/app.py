import os
import json
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, jsonify, g, request
from openpyxl import load_workbook
import pymysql
from pymysql.cursors import DictCursor
from pymysql.err import IntegrityError
from pymysql.err import OperationalError
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
load_dotenv(os.path.join(ROOT_DIR, ".env"))

OPPORTUNITY_TYPES = {"normal", "host"}
OPPORTUNITY_STATUSES = {"new", "assigned", "in_progress", "valid", "invalid"}
OPPORTUNITY_STAGES = {"cold", "interest", "need_defined", "bid_preparing", "ready_for_handoff"}
ORGANIZER_TYPES = {"foreign", "state_owned", "gov_joint", "government", "commercial"}
ACTIVITY_CHANNELS = {"phone", "email", "wechat", "onsite", "other"}
COMPANY_STATUSES = {"active", "inactive"}
USER_ROLES = {"group_admin", "subsidiary_admin", "sales", "marketing"}
USER_STATUSES = {"active", "inactive"}
DEFAULT_USER_PASSWORD = os.getenv("DEFAULT_USER_PASSWORD", "88888888")
DEFAULT_SEARCH_PROVIDER = os.getenv("SEARCH_PROVIDER", "")
DEFAULT_ANALYSIS_MODEL = os.getenv("AZURE_OPENAI_MODEL_ID", "gpt-5-chat")
DEFAULT_IMPORT_FILE = os.getenv("DEFAULT_IMPORT_FILE", "CPS参展商客户名单-分配表1219.xlsx")
UPLOAD_DIR = os.path.join(ROOT_DIR, "uploads")
ALLOWED_IMPORT_EXTENSIONS = {".xlsx"}
CONTACT_ROLE_COLUMN_READY = None

HOST_PERSONA_DEFAULTS = {
  "primary_roles": ["采购经理", "市场/品牌经理", "招商主管", "展会项目经理"],
  "decision_makers": ["总经理/副总经理", "市场负责人", "采购负责人"],
  "goals": ["提升参展商数量", "提高观众质量", "扩大品牌影响力", "增加展会收入（展位/赞助）"],
  "pain_points": ["招商周期长", "宣传渠道成本高", "观众质量不稳定", "预算审批不确定", "执行资源紧张"],
  "budget_signals": "年度展会预算/政府补贴/赞助意向",
  "procurement_cycle": "3-6个月（展会筹备期）"
}
NORMAL_PERSONA_DEFAULTS = {
  "primary_roles": ["采购经理", "业务负责人", "运营负责人"],
  "decision_makers": ["总经理/副总经理", "采购负责人", "业务负责人"],
  "goals": ["提升效率", "降低成本", "保障交付与服务质量", "拓展业务"],
  "pain_points": ["预算审批周期长", "需求不明确", "替换供应商阻力大", "交付周期紧"],
  "budget_signals": "年度/季度采购预算或项目立项",
  "procurement_cycle": "1-3个月（视项目复杂度）"
}
HOST_SALES_ANGLES_DEFAULTS = [
  "提供过往展会成效数据与案例",
  "协助招商推广与观众引流",
  "灵活的赞助/展位组合方案",
  "一体化执行与落地服务"
]
NORMAL_SALES_ANGLES_DEFAULTS = [
  "对标行业成功案例",
  "量化ROI与成本节省",
  "试点/分阶段交付方案"
]
HOST_RISK_FLAGS_DEFAULTS = ["预算未确认", "关键决策人不明确", "展会档期与资源冲突"]
NORMAL_RISK_FLAGS_DEFAULTS = ["需求不明确", "预算审批周期长", "关键决策链不完整"]


def hash_password(password: str) -> str:
  # Use pbkdf2 to avoid hashlib.scrypt dependency in older Python builds.
  return generate_password_hash(password, method="pbkdf2:sha256")

ANALYSIS_SCHEMA = (
  "{\n"
  '  "organizer_profile": {\n'
  '    "name": null,\n'
  '    "background": null,\n'
  '    "business_scope": null,\n'
  '    "scale": null,\n'
  '    "locations": [],\n'
  '    "official_sites": []\n'
  "  },\n"
  '  "event_profile": {\n'
  '    "name": null,\n'
  '    "city": null,\n'
  '    "time": null,\n'
  '    "venue": null,\n'
  '    "theme": null,\n'
  '    "scale": null\n'
  "  },\n"
  '  "customer_persona": {\n'
  '    "primary_roles": [],\n'
  '    "decision_makers": [],\n'
  '    "goals": [],\n'
  '    "pain_points": [],\n'
  '    "budget_signals": null,\n'
  '    "procurement_cycle": null\n'
  "  },\n"
  '  "form_suggestions": {\n'
  '    "organizer_name": null,\n'
  '    "organizer_type": null,\n'
  '    "exhibition_name": null,\n'
  '    "exhibition_time": null,\n'
  '    "exhibition_start_date": null,\n'
  '    "exhibition_end_date": null,\n'
  '    "venue_name": null,\n'
  '    "venue_address": null,\n'
  '    "booth_count": null,\n'
  '    "exhibition_area_sqm": null,\n'
  '    "expected_visitors": null,\n'
  '    "exhibition_theme": null,\n'
  '    "budget_range": null,\n'
  '    "city": null,\n'
  '    "industry": null,\n'
  '    "source": null,\n'
  '    "company_name": null,\n'
  '    "company_phone": null,\n'
  '    "company_email": null,\n'
  '    "contact_department": null,\n'
  '    "contact_person": null,\n'
  '    "contact_address": null,\n'
  '    "website": null,\n'
  '    "country": null,\n'
  '    "hall_no": null,\n'
  '    "booth_no": null,\n'
  '    "booth_type": null,\n'
  '    "booth_area_sqm": null\n'
  "  },\n"
  '  "sales_angles": [],\n'
  '  "risk_flags": [],\n'
  '  "assumptions": [],\n'
  '  "contacts": [\n'
  '    {\n'
  '      "name": "",\n'
  '      "title": null,\n'
  '      "organization": null,\n'
  '      "source_url": "",\n'
  '      "confidence": "medium"\n'
  "    }\n"
  "  ]\n"
  "}"
)


class _TextExtractor(HTMLParser):
  def __init__(self):
    super().__init__()
    self.parts = []

  def handle_data(self, data):
    text = data.strip()
    if text:
      self.parts.append(text)


def _strip_html(html):
  if not html:
    return ""
  cleaned = re.sub(r"<(script|style)[^>]*>.*?</\\1>", " ", html, flags=re.I | re.S)
  parser = _TextExtractor()
  parser.feed(cleaned)
  text = " ".join(parser.parts)
  text = re.sub(r"\\s+", " ", text).strip()
  return text


def _fetch_url_text(url, timeout=12, max_chars=12000):
  try:
    req = urllib.request.Request(
      url,
      headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0 Safari/537.36"
      }
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
      content_type = resp.headers.get("Content-Type", "")
      if "text/html" not in content_type:
        return ""
      raw = resp.read(600000)
      html = raw.decode("utf-8", errors="ignore")
      text = _strip_html(html)
      return text[:max_chars]
  except Exception:
    return ""


def _search_serper(query, num=5):
  api_key = os.getenv("SERPER_API_KEY")
  if not api_key:
    raise RuntimeError("missing_serper_api_key")
  payload = json.dumps({"q": query, "num": num}).encode("utf-8")
  req = urllib.request.Request(
    "https://google.serper.dev/search",
    data=payload,
    headers={"Content-Type": "application/json", "X-API-KEY": api_key}
  )
  with urllib.request.urlopen(req, timeout=12) as resp:
    body = json.loads(resp.read().decode("utf-8"))
  results = []
  for item in body.get("organic", [])[:num]:
    results.append(
      {
        "title": item.get("title"),
        "url": item.get("link"),
        "snippet": item.get("snippet")
      }
    )
  return results


def _search_serpapi(query, num=5):
  api_key = os.getenv("SERPAPI_API_KEY")
  if not api_key:
    raise RuntimeError("missing_serpapi_api_key")
  params = urllib.parse.urlencode({"q": query, "api_key": api_key, "num": num})
  url = f"https://serpapi.com/search.json?{params}"
  with urllib.request.urlopen(url, timeout=12) as resp:
    body = json.loads(resp.read().decode("utf-8"))
  results = []
  for item in body.get("organic_results", [])[:num]:
    results.append(
      {
        "title": item.get("title"),
        "url": item.get("link"),
        "snippet": item.get("snippet")
      }
    )
  return results


def _search_searxng(query, num=5):
  base_url = os.getenv("SEARXNG_URL", "").rstrip("/")
  if not base_url:
    raise RuntimeError("missing_searxng_url")
  lang = os.getenv("SEARXNG_LANG", "zh-CN")
  params = urllib.parse.urlencode({"q": query, "format": "json", "language": lang})
  url = f"{base_url}/search?{params}"
  headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0 Safari/537.36"
  }
  api_key = os.getenv("SEARXNG_API_KEY")
  if api_key:
    headers["X-API-Key"] = api_key
  req = urllib.request.Request(url, headers=headers)
  with urllib.request.urlopen(req, timeout=12) as resp:
    body = json.loads(resp.read().decode("utf-8"))
  results = []
  for item in body.get("results", [])[:num]:
    results.append(
      {
        "title": item.get("title"),
        "url": item.get("url"),
        "snippet": item.get("content") or item.get("snippet")
      }
    )
  return results


def _search_web(query, num=5):
  provider = DEFAULT_SEARCH_PROVIDER
  if not provider:
    if os.getenv("SERPER_API_KEY"):
      provider = "serper"
    elif os.getenv("SERPAPI_API_KEY"):
      provider = "serpapi"
    elif os.getenv("SEARXNG_URL"):
      provider = "searxng"
  if provider == "serper":
    return _search_serper(query, num=num)
  if provider == "serpapi":
    return _search_serpapi(query, num=num)
  if provider == "searxng":
    return _search_searxng(query, num=num)
  raise RuntimeError("search_provider_not_configured")


def _call_chat_completion(messages, temperature=0.2):
  use_azure = os.getenv("AZURE_OPENAI_DEFAULT_FLAG", "").upper() == "Y"
  if use_azure:
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
    if not endpoint or not api_key:
      raise RuntimeError("azure_openai_not_configured")
    if not endpoint.endswith("/chat/completions"):
      url = f"{endpoint}/chat/completions?api-version={api_version}"
    else:
      connector = "&" if "api-version=" in endpoint else "?"
      url = f"{endpoint}{connector}api-version={api_version}"
    payload = {
      "model": os.getenv("AZURE_OPENAI_MODEL_ID", DEFAULT_ANALYSIS_MODEL),
      "messages": messages,
      "temperature": temperature
    }
    headers = {"Content-Type": "application/json", "api-key": api_key}
  else:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
      raise RuntimeError("openai_not_configured")
    url = "https://api.openai.com/v1/chat/completions"
    payload = {"model": DEFAULT_ANALYSIS_MODEL, "messages": messages, "temperature": temperature}
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}

  req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers)
  with urllib.request.urlopen(req, timeout=30) as resp:
    body = json.loads(resp.read().decode("utf-8"))

  choices = body.get("choices") or []
  if not choices:
    raise RuntimeError("model_no_response")
  return (choices[0].get("message") or {}).get("content", "")


def _safe_json_load(raw):
  if raw is None:
    return {}
  if isinstance(raw, (dict, list)):
    return raw
  if isinstance(raw, (bytes, bytearray)):
    raw = raw.decode("utf-8", errors="ignore")
  if not isinstance(raw, str):
    return {}
  raw = raw.strip()
  if not raw:
    return {}
  try:
    return json.loads(raw)
  except Exception:
    candidates = []
    start_obj = raw.find("{")
    end_obj = raw.rfind("}")
    if start_obj != -1 and end_obj != -1 and end_obj > start_obj:
      candidates.append(raw[start_obj : end_obj + 1])
    start_arr = raw.find("[")
    end_arr = raw.rfind("]")
    if start_arr != -1 and end_arr != -1 and end_arr > start_arr:
      candidates.append(raw[start_arr : end_arr + 1])
    for candidate in candidates:
      try:
        return json.loads(candidate)
      except Exception:
        continue
    return {}


def _normalize_contacts(raw):
  if not isinstance(raw, list):
    return []
  normalized = []
  for item in raw:
    if not isinstance(item, dict):
      continue
    contact = {
      "name": item.get("name") or item.get("contact_name"),
      "role": item.get("role") or item.get("contact_role"),
      "title": item.get("title") or item.get("contact_title"),
      "phone": item.get("phone") or item.get("contact_phone"),
      "email": item.get("email") or item.get("contact_email"),
      "wechat": item.get("wechat") or item.get("contact_wechat")
    }
    if any(contact.values()):
      normalized.append(contact)
  return normalized


def _ensure_contact_role_column(db):
  global CONTACT_ROLE_COLUMN_READY
  if CONTACT_ROLE_COLUMN_READY is not None:
    return
  try:
    with db.cursor() as cur:
      cur.execute("SHOW COLUMNS FROM opportunity_contacts LIKE 'role'")
      if cur.fetchone():
        CONTACT_ROLE_COLUMN_READY = True
        return
      cur.execute("ALTER TABLE opportunity_contacts ADD COLUMN role VARCHAR(50) NULL AFTER title")
    CONTACT_ROLE_COLUMN_READY = True
  except Exception:
    CONTACT_ROLE_COLUMN_READY = False


def _normalize_header(value):
  if value is None:
    return ""
  return re.sub(r"\s+", "", str(value))


def _resolve_import_path(filename):
  safe_name = os.path.basename(filename or "")
  if not safe_name:
    return None
  root_path = os.path.join(ROOT_DIR, safe_name)
  upload_path = os.path.join(UPLOAD_DIR, safe_name)
  if os.path.exists(upload_path):
    return upload_path
  if os.path.exists(root_path):
    return root_path
  return None


def _find_header_row(sheet):
  for row_idx, row in enumerate(sheet.iter_rows(min_row=1, max_row=20, values_only=True), start=1):
    if not row:
      continue
    normalized = [_normalize_header(cell) for cell in row]
    if "公司名称_CN" in normalized or "CompanyName_EN" in normalized or "公司名称" in normalized:
      return row_idx, row
  return None, None


def _build_header_index_map(header_row):
  index_map = {}
  email_count = 0
  phone_count = 0
  for idx, value in enumerate(header_row):
    name = _normalize_header(value)
    if not name:
      continue
    if name in {"CompanyName_EN", "CompanyName_EN"} or name == "CompanyName_EN":
      index_map.setdefault("company_en", idx)
    elif name in {"公司名称_CN", "公司名称"}:
      index_map.setdefault("company_cn", idx)
    elif name == "联系人":
      index_map.setdefault("contact_name", idx)
    elif name == "电话号码":
      index_map.setdefault("contact_phone", idx)
    elif name == "手机号码":
      index_map.setdefault("contact_mobile", idx)
    elif name == "邮箱":
      email_count += 1
      if email_count == 1:
        index_map.setdefault("contact_email", idx)
      else:
        index_map.setdefault("contact_email_alt", idx)
    elif name in {"公司邮箱", "企业邮箱"}:
      index_map.setdefault("company_email", idx)
    elif name == "地区":
      index_map.setdefault("region", idx)
    elif name in {"官网", "网址", "网站"}:
      index_map.setdefault("website", idx)
    elif name in {"地址"}:
      index_map.setdefault("address", idx)
    elif name in {"联系地址"}:
      index_map.setdefault("contact_address", idx)
    elif name in {"联系部门"}:
      index_map.setdefault("contact_department", idx)
    elif name in {"公司电话", "联系电话"}:
      index_map.setdefault("company_phone", idx)
    elif name in {"国家", "国家/地区"}:
      index_map.setdefault("country", idx)
    elif name in {"展馆号", "展馆编号"}:
      index_map.setdefault("hall_no", idx)
    elif name in {"展位号", "展位编号"}:
      index_map.setdefault("booth_no", idx)
    elif name in {"展位类型"}:
      index_map.setdefault("booth_type", idx)
    elif name in {"展位面积"}:
      index_map.setdefault("booth_area_sqm", idx)
    elif name == "跟进人/PIC":
      index_map.setdefault("pic", idx)
    elif "电话/邮箱/陌拜" in name:
      index_map.setdefault("touch_method", idx)
    elif "是否取得联系" in name:
      index_map.setdefault("contacted", idx)
    elif name == "客户联系人":
      index_map.setdefault("contact_alt_name", idx)
    elif name == "职位":
      index_map.setdefault("contact_alt_title", idx)
    elif name == "电话":
      phone_count += 1
      if phone_count == 1:
        index_map.setdefault("contact_alt_phone", idx)
      else:
        index_map.setdefault("contact_phone_extra", idx)
    elif name == "现场反馈":
      index_map.setdefault("feedback", idx)
    elif name == "竞争对手公司":
      index_map.setdefault("competitor", idx)
    elif name == "备注":
      index_map.setdefault("remark", idx)
    elif name == "业务类型":
      index_map.setdefault("business_type", idx)
    elif name == "名称":
      index_map.setdefault("business_name", idx)
  return index_map


def _stringify_cell(value):
  if value is None:
    return None
  return str(value).strip()


def _parse_int(value):
  if value is None:
    return None
  if isinstance(value, bool):
    return None
  if isinstance(value, int):
    return value
  if isinstance(value, float):
    return int(value)
  text = str(value).strip()
  if not text:
    return None
  try:
    return int(float(text))
  except Exception:
    return None


def _build_notes(parts, max_len=255):
  notes = [item for item in parts if item]
  if not notes:
    return None
  text = "；".join(notes)
  if len(text) <= max_len:
    return text
  return text[: max_len - 1] + "…"


def _insert_contacts(cur, opportunity_id, contacts):
  if not contacts:
    return 0
  use_role = CONTACT_ROLE_COLUMN_READY is True
  cur.execute(
    "SELECT name, phone, email FROM opportunity_contacts WHERE opportunity_id = %s",
    (opportunity_id,)
  )
  existing = {(row.get("name"), row.get("phone"), row.get("email")) for row in cur.fetchall()}
  inserted = 0
  for contact in contacts:
    name = contact.get("name")
    role = contact.get("role")
    title = contact.get("title")
    phone = contact.get("phone")
    email = contact.get("email")
    wechat = contact.get("wechat")
    key = (name, phone, email)
    if key in existing:
      continue
    if use_role:
      cur.execute(
        "INSERT INTO opportunity_contacts (opportunity_id, name, role, title, phone, email, wechat) VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (opportunity_id, name, role, title, phone, email, wechat)
      )
    else:
      cur.execute(
        "INSERT INTO opportunity_contacts (opportunity_id, name, title, phone, email, wechat) VALUES (%s, %s, %s, %s, %s, %s)",
        (opportunity_id, name, title, phone, email, wechat)
      )
    existing.add(key)
    inserted += 1
  return inserted

def _apply_analysis_defaults(analysis_data, opportunity):
  if not isinstance(analysis_data, dict):
    return analysis_data
  opportunity_type = opportunity.get("type")
  persona_defaults = HOST_PERSONA_DEFAULTS if opportunity_type == "host" else NORMAL_PERSONA_DEFAULTS
  sales_defaults = HOST_SALES_ANGLES_DEFAULTS if opportunity_type == "host" else NORMAL_SALES_ANGLES_DEFAULTS
  risk_defaults = HOST_RISK_FLAGS_DEFAULTS if opportunity_type == "host" else NORMAL_RISK_FLAGS_DEFAULTS

  persona = analysis_data.get("customer_persona")
  if not isinstance(persona, dict):
    persona = {}
  filled = False
  for key, default in persona_defaults.items():
    current = persona.get(key)
    if isinstance(default, list):
      if not isinstance(current, list) or not current:
        persona[key] = default
        filled = True
    else:
      if not current:
        persona[key] = default
        filled = True
  analysis_data["customer_persona"] = persona

  if not isinstance(analysis_data.get("sales_angles"), list) or not analysis_data.get("sales_angles"):
    analysis_data["sales_angles"] = sales_defaults
    filled = True
  if not isinstance(analysis_data.get("risk_flags"), list) or not analysis_data.get("risk_flags"):
    analysis_data["risk_flags"] = risk_defaults
    filled = True

  assumptions = analysis_data.get("assumptions")
  if not isinstance(assumptions, list):
    assumptions = []
  if filled:
    note = (
      "以下为展会型商机行业通用推测，需进一步确认"
      if opportunity_type == "host"
      else "以下为一般B2B商机行业通用推测，需进一步确认"
    )
    if note not in assumptions:
      assumptions.append(note)
    analysis_data["assumptions"] = assumptions
  return analysis_data


def _build_analysis_query(opportunity):
  parts = [
    opportunity.get("name"),
    opportunity.get("company_name"),
    opportunity.get("organizer_name"),
    opportunity.get("exhibition_name"),
    opportunity.get("city"),
    opportunity.get("industry"),
    opportunity.get("source"),
    opportunity.get("contact_name"),
    opportunity.get("contact_person"),
    opportunity.get("website"),
    "客户画像 联系方式 联系人 公司"
  ]
  return " ".join([part for part in parts if part])


def _build_analysis_messages(opportunity, sources):
  context = {
    "opportunity": {
      "name": opportunity.get("name"),
      "type": opportunity.get("type"),
      "organizer_name": opportunity.get("organizer_name"),
      "organizer_type": opportunity.get("organizer_type"),
      "exhibition_name": opportunity.get("exhibition_name"),
      "exhibition_start_date": str(opportunity.get("exhibition_start_date"))
      if opportunity.get("exhibition_start_date")
      else None,
      "exhibition_end_date": str(opportunity.get("exhibition_end_date"))
      if opportunity.get("exhibition_end_date")
      else None,
      "venue_name": opportunity.get("venue_name"),
      "venue_address": opportunity.get("venue_address"),
      "city": opportunity.get("city"),
      "industry": opportunity.get("industry"),
      "budget_range": opportunity.get("budget_range"),
      "contact_name": opportunity.get("contact_name"),
      "contact_title": opportunity.get("contact_title"),
      "contact_phone": opportunity.get("contact_phone"),
      "contact_email": opportunity.get("contact_email"),
      "company_name": opportunity.get("company_name"),
      "company_phone": opportunity.get("company_phone"),
      "company_email": opportunity.get("company_email"),
      "contact_department": opportunity.get("contact_department"),
      "contact_person": opportunity.get("contact_person"),
      "contact_address": opportunity.get("contact_address"),
      "website": opportunity.get("website"),
      "country": opportunity.get("country"),
      "hall_no": opportunity.get("hall_no"),
      "booth_no": opportunity.get("booth_no"),
      "booth_type": opportunity.get("booth_type"),
      "booth_area_sqm": opportunity.get("booth_area_sqm")
    }
  }

  blocks = []
  for idx, source in enumerate(sources, 1):
    blocks.append(
      f"[{idx}] {source.get('title') or ''}\n"
      f"URL: {source.get('url') or ''}\n"
      f"摘要: {source.get('snippet') or ''}\n"
      f"内容: {source.get('content') or ''}"
    )

  system_prompt = (
    "你是B2B展会销售的研究助手。基于提供的公开网页内容输出严格JSON，"
    "不要输出多余文字或Markdown。只能使用给定来源，无法确定就填null或空数组。"
    "允许输出公开姓名+职位+机构，并在contacts中写明source_url。"
  )
  sources_text = "\n\n".join(blocks) if blocks else "无有效来源内容"

  user_prompt = (
    f"商机信息（字段可能为空）:\n{json.dumps(context, ensure_ascii=False)}\n\n"
    f"网页来源:\n{sources_text}\n\n"
    "请返回JSON，结构如下:\n"
    f"{ANALYSIS_SCHEMA}\n"
  )
  return [
    {"role": "system", "content": system_prompt},
    {"role": "user", "content": user_prompt}
  ]


def _serialize_insight(row):
  if not row:
    return None
  analysis = _safe_json_load(row.get("analysis_json"))
  contacts = _safe_json_load(row.get("contacts_json"))
  sources = _safe_json_load(row.get("sources_json"))
  if not isinstance(contacts, list):
    contacts = []
  if not isinstance(sources, list):
    sources = []
  return {
    "analysis": analysis if isinstance(analysis, dict) else {},
    "contacts": contacts,
    "sources": sources,
    "provider": row.get("provider"),
    "model": row.get("model"),
    "updated_at": row.get("updated_at"),
    "created_at": row.get("created_at")
  }


def get_db():
  if "db" not in g:
    g.db = pymysql.connect(
      host=os.getenv("DB_HOST"),
      user=os.getenv("DB_USER"),
      password=os.getenv("DB_PASSWORD"),
      database=os.getenv("DB_NAME"),
      port=int(os.getenv("DB_PORT", "3306")),
      autocommit=True,
      connect_timeout=6,
      read_timeout=10,
      write_timeout=10,
      cursorclass=DictCursor
    )
    _ensure_contact_role_column(g.db)
  else:
    try:
      g.db.ping(reconnect=True)
    except OperationalError:
      g.db = pymysql.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        port=int(os.getenv("DB_PORT", "3306")),
        autocommit=True,
        connect_timeout=6,
        read_timeout=10,
        write_timeout=10,
        cursorclass=DictCursor
      )
      _ensure_contact_role_column(g.db)
  return g.db


def close_db(_error=None):
  db = g.pop("db", None)
  if db:
    db.close()


def is_group_admin(user):
  return user and user.get("role") == "group_admin"


def is_sub_admin(user):
  return user and user.get("role") == "subsidiary_admin"


def ensure_group_admin():
  if not is_group_admin(g.user):
    return jsonify({"error": "forbidden"}), 403
  return None


def ensure_org_access():
  if not (is_group_admin(g.user) or is_sub_admin(g.user)):
    return jsonify({"error": "forbidden"}), 403
  return None


def require_user(fn):
  @wraps(fn)
  def wrapper(*args, **kwargs):
    if request.method == "OPTIONS":
      return "", 204

    raw_user_id = request.headers.get("x-user-id")
    try:
      user_id = int(raw_user_id)
    except (TypeError, ValueError):
      return jsonify({"error": "missing_x_user_id"}), 401

    db = get_db()
    with db.cursor() as cur:
      cur.execute(
        "SELECT id, name, role, company_id FROM users WHERE id = %s AND status = 'active'",
        (user_id,)
      )
      user = cur.fetchone()

    if not user:
      return jsonify({"error": "invalid_user"}), 401

    g.user = user
    return fn(*args, **kwargs)

  return wrapper


app = Flask(__name__)
app.teardown_appcontext(close_db)

@app.after_request
def add_cors_headers(response):
  response.headers["Access-Control-Allow-Origin"] = os.getenv("CORS_ORIGIN", "*")
  response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-User-Id"
  response.headers["Access-Control-Allow-Methods"] = "GET,POST,PATCH,PUT,DELETE,OPTIONS"
  return response


@app.route("/health")
def health():
  return jsonify({"status": "ok"})


@app.route("/me", methods=["GET"])
@require_user
def get_me():
  return jsonify({"data": g.user})


@app.route("/login", methods=["POST"])
def login():
  body = request.get_json(silent=True) or {}
  username = body.get("username")
  password = body.get("password")

  if not username or not password:
    return jsonify({"error": "missing_credentials"}), 400

  db = get_db()
  admin_username = os.getenv("ADMIN_USERNAME", "admin-pico")
  admin_password = os.getenv("ADMIN_PASSWORD", "pico@2026")

  if username == admin_username and password == admin_password:
    with db.cursor() as cur:
      cur.execute(
        "SELECT id, name, role, company_id, status FROM users WHERE name = %s AND role = 'group_admin' LIMIT 1",
        (username,)
      )
      user = cur.fetchone()

      if not user:
        cur.execute(
          "INSERT INTO users (name, role, status) VALUES (%s, 'group_admin', 'active')",
          (username,)
        )
        user_id = cur.lastrowid
        cur.execute(
          "SELECT id, name, role, company_id, status FROM users WHERE id = %s",
          (user_id,)
        )
        user = cur.fetchone()

    if not user or user.get("status") != "active":
      return jsonify({"error": "user_inactive"}), 403

    return jsonify({"data": user})

  with db.cursor() as cur:
    cur.execute(
      "SELECT id, name, role, company_id, status, password_hash "
      "FROM users WHERE name = %s OR email = %s LIMIT 1",
      (username, username)
    )
    user = cur.fetchone()

  if not user:
    return jsonify({"error": "invalid_credentials"}), 401
  if user.get("status") != "active":
    return jsonify({"error": "user_inactive"}), 403

  password_hash = user.get("password_hash")
  if password_hash:
    if not check_password_hash(password_hash, password):
      return jsonify({"error": "invalid_credentials"}), 401
  else:
    if password != DEFAULT_USER_PASSWORD:
      return jsonify({"error": "invalid_credentials"}), 401
    hashed = hash_password(DEFAULT_USER_PASSWORD)
    with db.cursor() as cur:
      cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (hashed, user["id"]))

  user.pop("password_hash", None)
  return jsonify({"data": user})


@app.route("/companies", methods=["GET"])
@require_user
def list_companies():
  guard = ensure_org_access()
  if guard:
    return guard

  filters = []
  params = []

  if is_sub_admin(g.user):
    if not g.user.get("company_id"):
      return jsonify({"error": "user_missing_company"}), 400
    filters.append("id = %s")
    params.append(g.user["company_id"])

  parent_id = request.args.get("parent_id", type=int)
  if parent_id is not None:
    if parent_id == 0:
      filters.append("parent_id IS NULL")
    else:
      filters.append("parent_id = %s")
      params.append(parent_id)

  status = request.args.get("status")
  if status:
    if status not in COMPANY_STATUSES:
      return jsonify({"error": "invalid_status"}), 400
    filters.append("status = %s")
    params.append(status)

  name = request.args.get("name")
  if name:
    filters.append("name LIKE %s")
    params.append(f"%{name}%")

  code = request.args.get("code")
  if code:
    filters.append("code = %s")
    params.append(code)

  where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""

  db = get_db()
  with db.cursor() as cur:
    cur.execute(f"SELECT * FROM companies {where_clause} ORDER BY id ASC", params)
    rows = cur.fetchall()

  return jsonify({"data": rows})


@app.route("/companies", methods=["POST"])
@require_user
def create_company():
  guard = ensure_group_admin()
  if guard:
    return guard

  body = request.get_json(silent=True) or {}
  name = body.get("name")
  code = body.get("code") or None
  parent_id = body.get("parent_id")
  if parent_id == 0:
    parent_id = None
  status = body.get("status", "active")

  if not name:
    return jsonify({"error": "missing_name"}), 400
  if status not in COMPANY_STATUSES:
    return jsonify({"error": "invalid_status"}), 400

  if parent_id:
    db = get_db()
    with db.cursor() as cur:
      cur.execute("SELECT id FROM companies WHERE id = %s", (parent_id,))
      if not cur.fetchone():
        return jsonify({"error": "invalid_parent"}), 400

  db = get_db()
  try:
    with db.cursor() as cur:
      cur.execute(
        "INSERT INTO companies (name, code, parent_id, status) VALUES (%s, %s, %s, %s)",
        (name, code, parent_id, status)
      )
      company_id = cur.lastrowid
      cur.execute("SELECT * FROM companies WHERE id = %s", (company_id,))
      created = cur.fetchone()
  except IntegrityError:
    return jsonify({"error": "company_code_exists"}), 409

  return jsonify({"data": created}), 201


@app.route("/companies/<int:company_id>", methods=["PATCH"])
@require_user
def update_company(company_id):
  guard = ensure_group_admin()
  if guard:
    return guard

  body = request.get_json(silent=True) or {}
  allowed = {"name", "code", "parent_id", "status"}

  db = get_db()
  with db.cursor() as cur:
    cur.execute("SELECT * FROM companies WHERE id = %s", (company_id,))
    existing = cur.fetchone()

  if not existing:
    return jsonify({"error": "not_found"}), 404

  updates = []
  params = []

  for key in allowed:
    if key not in body:
      continue
    value = body.get(key)
    if key == "status":
      if value not in COMPANY_STATUSES:
        return jsonify({"error": "invalid_status"}), 400
    if key == "parent_id":
      if value == 0:
        value = None
      if value == company_id:
        return jsonify({"error": "invalid_parent"}), 400
      if value:
        with db.cursor() as cur:
          cur.execute("SELECT id FROM companies WHERE id = %s", (value,))
          if not cur.fetchone():
            return jsonify({"error": "invalid_parent"}), 400
    updates.append(f"{key} = %s")
    params.append(value)

  if not updates:
    return jsonify({"error": "no_updates"}), 400

  params.append(company_id)
  try:
    with db.cursor() as cur:
      cur.execute(f"UPDATE companies SET {', '.join(updates)} WHERE id = %s", params)
      cur.execute("SELECT * FROM companies WHERE id = %s", (company_id,))
      updated = cur.fetchone()
  except IntegrityError:
    return jsonify({"error": "company_code_exists"}), 409

  return jsonify({"data": updated})


@app.route("/companies/<int:company_id>", methods=["DELETE"])
@require_user
def delete_company(company_id):
  guard = ensure_group_admin()
  if guard:
    return guard

  db = get_db()
  with db.cursor() as cur:
    cur.execute("SELECT id FROM companies WHERE id = %s", (company_id,))
    existing = cur.fetchone()

  if not existing:
    return jsonify({"error": "not_found"}), 404

  with db.cursor() as cur:
    cur.execute("SELECT id FROM companies WHERE parent_id = %s LIMIT 1", (company_id,))
    if cur.fetchone():
      return jsonify({"error": "company_has_children"}), 400
    cur.execute("SELECT id FROM users WHERE company_id = %s LIMIT 1", (company_id,))
    if cur.fetchone():
      return jsonify({"error": "company_has_users"}), 400
    cur.execute("SELECT id FROM opportunities WHERE company_id = %s LIMIT 1", (company_id,))
    if cur.fetchone():
      return jsonify({"error": "company_has_opportunities"}), 400
    cur.execute("DELETE FROM companies WHERE id = %s", (company_id,))

  return jsonify({"data": {"id": company_id}})


@app.route("/users", methods=["GET"])
@require_user
def list_users():
  guard = ensure_org_access()
  if guard:
    return guard

  filters = []
  params = []

  if is_sub_admin(g.user):
    if not g.user.get("company_id"):
      return jsonify({"error": "user_missing_company"}), 400
    filters.append("company_id = %s")
    params.append(g.user["company_id"])
  else:
    company_id = request.args.get("company_id", type=int)
    if company_id is not None:
      if company_id == 0:
        filters.append("company_id IS NULL")
      elif company_id:
        filters.append("company_id = %s")
        params.append(company_id)

  role = request.args.get("role")
  if role:
    if role not in USER_ROLES:
      return jsonify({"error": "invalid_role"}), 400
    filters.append("role = %s")
    params.append(role)

  status = request.args.get("status")
  if status:
    if status not in USER_STATUSES:
      return jsonify({"error": "invalid_status"}), 400
    filters.append("status = %s")
    params.append(status)

  name = request.args.get("name")
  if name:
    filters.append("name LIKE %s")
    params.append(f"%{name}%")

  where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""

  db = get_db()
  with db.cursor() as cur:
    cur.execute(
      f"SELECT id, name, email, role, company_id, status, created_at FROM users {where_clause} ORDER BY id ASC",
      params
    )
    rows = cur.fetchall()

  return jsonify({"data": rows})


@app.route("/users", methods=["POST"])
@require_user
def create_user():
  body = request.get_json(silent=True) or {}
  name = body.get("name")
  role = body.get("role")
  email = body.get("email")
  status = body.get("status", "active")
  company_id = body.get("company_id")
  password = body.get("password")
  if company_id == 0:
    company_id = None

  if not name:
    return jsonify({"error": "missing_name"}), 400
  if not role or role not in USER_ROLES:
    return jsonify({"error": "invalid_role"}), 400
  if status not in USER_STATUSES:
    return jsonify({"error": "invalid_status"}), 400

  db = get_db()
  if is_group_admin(g.user):
    if role != "group_admin":
      if not company_id:
        return jsonify({"error": "company_id_required"}), 400
    if company_id:
      with db.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE id = %s", (company_id,))
        if not cur.fetchone():
          return jsonify({"error": "invalid_company"}), 400
  elif is_sub_admin(g.user):
    if role == "group_admin":
      return jsonify({"error": "invalid_role"}), 400
    if not g.user.get("company_id"):
      return jsonify({"error": "user_missing_company"}), 400
    company_id = g.user.get("company_id")
  else:
    return jsonify({"error": "forbidden"}), 403

  password_hash = hash_password(password or DEFAULT_USER_PASSWORD)

  with db.cursor() as cur:
    cur.execute(
      "INSERT INTO users (name, email, role, company_id, status, password_hash) VALUES (%s, %s, %s, %s, %s, %s)",
      (name, email, role, company_id, status, password_hash)
    )
    user_id = cur.lastrowid
    cur.execute(
      "SELECT id, name, email, role, company_id, status, created_at FROM users WHERE id = %s",
      (user_id,)
    )
    created = cur.fetchone()

  return jsonify({"data": created}), 201


@app.route("/users/<int:user_id>", methods=["PATCH"])
@require_user
def update_user(user_id):
  body = request.get_json(silent=True) or {}
  allowed = {"name", "email", "role", "company_id", "status", "password"}

  db = get_db()
  with db.cursor() as cur:
    cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    existing = cur.fetchone()

  if not existing:
    return jsonify({"error": "not_found"}), 404

  if not (is_group_admin(g.user) or is_sub_admin(g.user)):
    return jsonify({"error": "forbidden"}), 403

  if is_sub_admin(g.user):
    if existing.get("role") == "group_admin":
      return jsonify({"error": "forbidden"}), 403
    if not g.user.get("company_id") or existing.get("company_id") != g.user.get("company_id"):
      return jsonify({"error": "forbidden"}), 403

  updates = []
  params = []

  next_role = body.get("role", existing.get("role"))
  next_company_id = body.get("company_id", existing.get("company_id"))

  if is_sub_admin(g.user):
    if next_role == "group_admin":
      return jsonify({"error": "invalid_role"}), 400
    if next_company_id not in (None, 0, g.user.get("company_id")):
      return jsonify({"error": "invalid_company"}), 400
    next_company_id = g.user.get("company_id")

  if next_role not in USER_ROLES:
    return jsonify({"error": "invalid_role"}), 400
  if next_role != "group_admin" and not next_company_id:
    return jsonify({"error": "company_id_required"}), 400

  if "status" in body:
    status_value = body.get("status")
    if status_value not in USER_STATUSES:
      return jsonify({"error": "invalid_status"}), 400

  if "company_id" in body:
    if next_company_id == 0:
      next_company_id = None
    if not is_sub_admin(g.user):
      with db.cursor() as cur:
        if next_company_id:
          cur.execute("SELECT id FROM companies WHERE id = %s", (next_company_id,))
          if not cur.fetchone():
            return jsonify({"error": "invalid_company"}), 400

  for key in allowed:
    if key not in body:
      continue
    if key == "password":
      password_value = body.get("password")
      if not password_value:
        continue
      updates.append("password_hash = %s")
      params.append(hash_password(password_value))
      continue
    value = body.get(key)
    if key == "company_id":
      if is_sub_admin(g.user):
        value = g.user.get("company_id")
      elif value == 0:
        value = None
    updates.append(f"{key} = %s")
    params.append(value)

  if not updates:
    return jsonify({"error": "no_updates"}), 400

  params.append(user_id)
  with db.cursor() as cur:
    cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s", params)
    cur.execute(
      "SELECT id, name, email, role, company_id, status, created_at FROM users WHERE id = %s",
      (user_id,)
    )
    updated = cur.fetchone()

  return jsonify({"data": updated})


@app.route("/me/password", methods=["PATCH"])
@require_user
def update_my_password():
  body = request.get_json(silent=True) or {}
  current_password = body.get("current_password")
  new_password = body.get("new_password")

  if not current_password or not new_password:
    return jsonify({"error": "missing_password"}), 400

  db = get_db()
  with db.cursor() as cur:
    cur.execute("SELECT id, password_hash FROM users WHERE id = %s", (g.user["id"],))
    user = cur.fetchone()

  if not user:
    return jsonify({"error": "not_found"}), 404

  password_hash = user.get("password_hash")
  if password_hash:
    if not check_password_hash(password_hash, current_password):
      return jsonify({"error": "invalid_password"}), 400
  else:
    if current_password != DEFAULT_USER_PASSWORD:
      return jsonify({"error": "invalid_password"}), 400

  new_hash = hash_password(new_password)
  with db.cursor() as cur:
    cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hash, g.user["id"]))

  return jsonify({"data": {"id": g.user["id"]}})


@app.route("/opportunities", methods=["GET"])
@require_user
def list_opportunities():
  user = g.user
  filters = []
  params = []

  company_id = request.args.get("company_id", type=int)
  if is_group_admin(user):
    if company_id:
      filters.append("company_id = %s")
      params.append(company_id)
  else:
    if not user.get("company_id"):
      return jsonify({"error": "user_missing_company"}), 400
    filters.append("company_id = %s")
    params.append(user["company_id"])

  for field in ["type", "status", "stage", "source", "city", "industry"]:
    value = request.args.get(field)
    if value:
      filters.append(f"{field} = %s")
      params.append(value)

  owner_id = request.args.get("owner_id", type=int)
  if owner_id:
    filters.append("owner_id = %s")
    params.append(owner_id)

  name = request.args.get("name")
  if name:
    filters.append("name LIKE %s")
    params.append(f"%{name}%")

  where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
  page = max(request.args.get("page", default=1, type=int), 1)
  page_size = request.args.get("page_size", type=int)
  if page_size:
    limit = min(max(page_size, 1), 500)
  else:
    limit = min(request.args.get("limit", default=200, type=int), 500)
  offset = (page - 1) * limit

  db = get_db()
  with db.cursor() as cur:
    cur.execute(
      f"SELECT COUNT(*) AS total, "
      "SUM(CASE WHEN status = 'valid' THEN 1 ELSE 0 END) AS valid_count, "
      "SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count, "
      "SUM(CASE WHEN stage = 'ready_for_handoff' THEN 1 ELSE 0 END) AS ready_for_handoff_count, "
      "SUM(CASE WHEN type = 'host' THEN 1 ELSE 0 END) AS host_count "
      f"FROM opportunities {where_clause}",
      params
    )
    summary_row = cur.fetchone() or {}
    total = summary_row.get("total", 0)
    cur.execute(
      f"SELECT * FROM opportunities {where_clause} ORDER BY updated_at DESC LIMIT %s OFFSET %s",
      params + [limit, offset]
    )
    rows = cur.fetchall()

  summary = {
    "total": total,
    "valid": summary_row.get("valid_count", 0) or 0,
    "in_progress": summary_row.get("in_progress_count", 0) or 0,
    "ready_for_handoff": summary_row.get("ready_for_handoff_count", 0) or 0,
    "host": summary_row.get("host_count", 0) or 0
  }

  return jsonify(
    {
      "data": rows,
      "total": total,
      "page": page,
      "page_size": limit,
      "summary": summary
    }
  )


@app.route("/opportunities", methods=["POST"])
@require_user
def create_opportunity():
  user = g.user
  body = request.get_json(silent=True) or {}

  if not body.get("name") or not body.get("type") or not body.get("source"):
    return jsonify({"error": "missing_required_fields"}), 400
  if body["type"] not in OPPORTUNITY_TYPES:
    return jsonify({"error": "invalid_type"}), 400
  if body.get("status") and body["status"] not in OPPORTUNITY_STATUSES:
    return jsonify({"error": "invalid_status"}), 400
  if body.get("stage") and body["stage"] not in OPPORTUNITY_STAGES:
    return jsonify({"error": "invalid_stage"}), 400
  if body.get("organizer_type") and body["organizer_type"] not in ORGANIZER_TYPES:
    return jsonify({"error": "invalid_organizer_type"}), 400

  if is_group_admin(user):
    company_id = int(body.get("company_id") or 0)
    if not company_id:
      return jsonify({"error": "company_id_required"}), 400
    owner_id = int(body.get("owner_id") or user["id"])
  else:
    company_id = user.get("company_id")
    if not company_id:
      return jsonify({"error": "user_missing_company"}), 400
    owner_id = user["id"]

  contacts = _normalize_contacts(body.get("contacts"))
  if contacts:
    primary = contacts[0]
    body.setdefault("contact_name", primary.get("name"))
    body.setdefault("contact_title", primary.get("title"))
    body.setdefault("contact_phone", primary.get("phone"))
    body.setdefault("contact_email", primary.get("email"))
    body.setdefault("contact_wechat", primary.get("wechat"))
  if body.get("contact_person") and not body.get("contact_name"):
    body["contact_name"] = body.get("contact_person")

  sql = (
    "INSERT INTO opportunities ("
    "name, type, source, industry, city, status, stage, "
    "owner_id, company_id, "
    "organizer_name, organizer_type, exhibition_name, "
    "exhibition_start_date, exhibition_end_date, venue_name, venue_address, "
    "booth_count, exhibition_area_sqm, expected_visitors, exhibition_theme, budget_range, "
    "risk_notes, "
    "contact_name, contact_title, contact_phone, contact_email, contact_wechat, "
    "company_name, company_phone, company_email, contact_department, contact_person, "
    "contact_address, website, country, hall_no, booth_no, booth_type, booth_area_sqm, "
    "invalid_reason"
    ") VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
  )
  params = (
    body["name"],
    body["type"],
    body["source"],
    body.get("industry"),
    body.get("city"),
    body.get("status", "new"),
    body.get("stage", "cold"),
    owner_id,
    company_id,
    body.get("organizer_name"),
    body.get("organizer_type"),
    body.get("exhibition_name"),
    body.get("exhibition_start_date"),
    body.get("exhibition_end_date"),
    body.get("venue_name"),
    body.get("venue_address"),
    body.get("booth_count"),
    body.get("exhibition_area_sqm"),
    body.get("expected_visitors"),
    body.get("exhibition_theme"),
    body.get("budget_range"),
    body.get("risk_notes"),
    body.get("contact_name"),
    body.get("contact_title"),
    body.get("contact_phone"),
    body.get("contact_email"),
    body.get("contact_wechat"),
    body.get("company_name"),
    body.get("company_phone"),
    body.get("company_email"),
    body.get("contact_department"),
    body.get("contact_person"),
    body.get("contact_address"),
    body.get("website"),
    body.get("country"),
    body.get("hall_no"),
    body.get("booth_no"),
    body.get("booth_type"),
    body.get("booth_area_sqm"),
    body.get("invalid_reason")
  )

  db = get_db()
  with db.cursor() as cur:
    cur.execute(sql, params)
    new_id = cur.lastrowid
    if contacts:
      _insert_contacts(cur, new_id, contacts)
    cur.execute("SELECT * FROM opportunities WHERE id = %s", (new_id,))
    created = cur.fetchone()

  return jsonify({"data": created}), 201


@app.route("/opportunities/<int:opportunity_id>", methods=["GET"])
@require_user
def get_opportunity(opportunity_id):
  user = g.user
  db = get_db()
  with db.cursor() as cur:
    cur.execute("SELECT * FROM opportunities WHERE id = %s", (opportunity_id,))
    opportunity = cur.fetchone()

  if not opportunity:
    return jsonify({"error": "not_found"}), 404

  if not is_group_admin(user) and opportunity.get("company_id") != user.get("company_id"):
    return jsonify({"error": "not_found"}), 404

  return jsonify({"data": opportunity})


@app.route("/opportunities/<int:opportunity_id>", methods=["PATCH"])
@require_user
def update_opportunity(opportunity_id):
  user = g.user
  db = get_db()

  with db.cursor() as cur:
    cur.execute("SELECT * FROM opportunities WHERE id = %s", (opportunity_id,))
    opportunity = cur.fetchone()

  if not opportunity:
    return jsonify({"error": "not_found"}), 404

  if not is_group_admin(user) and opportunity.get("company_id") != user.get("company_id"):
    return jsonify({"error": "not_found"}), 404

  body = request.get_json(silent=True) or {}
  contacts_in_body = "contacts" in body
  contacts = _normalize_contacts(body.get("contacts"))
  allowed = {
    "name",
    "type",
    "source",
    "industry",
    "city",
    "status",
    "stage",
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
    "contact_wechat",
    "company_name",
    "company_phone",
    "company_email",
    "contact_department",
    "contact_person",
    "contact_address",
    "website",
    "country",
    "hall_no",
    "booth_no",
    "booth_type",
    "booth_area_sqm",
    "invalid_reason",
    "owner_id"
  }

  updates = []
  params = []

  for key in allowed:
    if key not in body:
      continue
    if key == "type" and body[key] not in OPPORTUNITY_TYPES:
      return jsonify({"error": "invalid_type"}), 400
    if key == "status" and body[key] not in OPPORTUNITY_STATUSES:
      return jsonify({"error": "invalid_status"}), 400
    if key == "stage" and body[key] not in OPPORTUNITY_STAGES:
      return jsonify({"error": "invalid_stage"}), 400
    if key == "organizer_type" and body[key] and body[key] not in ORGANIZER_TYPES:
      return jsonify({"error": "invalid_organizer_type"}), 400
    if key == "owner_id" and not is_group_admin(user):
      continue

    updates.append(f"{key} = %s")
    params.append(body[key])

  if not updates:
    if not contacts_in_body:
      return jsonify({"error": "no_updates"}), 400

  params.append(opportunity_id)

  with db.cursor() as cur:
    if updates:
      cur.execute(f"UPDATE opportunities SET {', '.join(updates)} WHERE id = %s", params)
    if contacts_in_body:
      cur.execute("DELETE FROM opportunity_contacts WHERE opportunity_id = %s", (opportunity_id,))
      _insert_contacts(cur, opportunity_id, contacts)
    cur.execute("SELECT * FROM opportunities WHERE id = %s", (opportunity_id,))
    updated = cur.fetchone()

  return jsonify({"data": updated})


@app.route("/opportunities/<int:opportunity_id>/analysis", methods=["GET"])
@require_user
def get_opportunity_analysis(opportunity_id):
  user = g.user
  db = get_db()
  with db.cursor() as cur:
    cur.execute("SELECT * FROM opportunities WHERE id = %s", (opportunity_id,))
    opportunity = cur.fetchone()

  if not opportunity:
    return jsonify({"error": "not_found"}), 404

  if not is_group_admin(user) and opportunity.get("company_id") != user.get("company_id"):
    return jsonify({"error": "not_found"}), 404

  with db.cursor() as cur:
    cur.execute("SELECT * FROM opportunity_insights WHERE opportunity_id = %s", (opportunity_id,))
    insight = cur.fetchone()

  return jsonify({"data": _serialize_insight(insight)})


@app.route("/opportunities/<int:opportunity_id>/analysis", methods=["POST"])
@require_user
def analyze_opportunity(opportunity_id):
  user = g.user
  db = get_db()

  with db.cursor() as cur:
    cur.execute("SELECT * FROM opportunities WHERE id = %s", (opportunity_id,))
    opportunity = cur.fetchone()

  if not opportunity:
    return jsonify({"error": "not_found"}), 404

  if not is_group_admin(user) and opportunity.get("company_id") != user.get("company_id"):
    return jsonify({"error": "not_found"}), 404

  if not opportunity.get("name"):
    return jsonify({"error": "missing_opportunity_name"}), 400

  query = _build_analysis_query(opportunity)
  try:
    search_results = _search_web(query, num=6)
  except RuntimeError as err:
    return jsonify({"error": str(err)}), 400
  except Exception:
    return jsonify({"error": "search_failed"}), 500

  if not search_results:
    fallback_terms = [
      opportunity.get("exhibition_name"),
      opportunity.get("organizer_name"),
      opportunity.get("name")
    ]
    for term in fallback_terms:
      if not term:
        continue
      try:
        search_results = _search_web(str(term), num=6)
      except Exception:
        continue
      if search_results:
        break

  if not search_results:
    return jsonify({"error": "no_search_results"}), 400

  sources_payload = []
  sources_context = []
  seen_urls = set()

  for item in search_results:
    url = item.get("url")
    if not url or url in seen_urls:
      continue
    seen_urls.add(url)
    title = item.get("title") or ""
    snippet = item.get("snippet") or ""
    sources_payload.append({"title": title, "url": url, "snippet": snippet})

    if len(sources_context) < 4:
      content = _fetch_url_text(url)
      sources_context.append(
        {
          "title": title,
          "url": url,
          "snippet": snippet,
          "content": content or ""
        }
      )

  messages = _build_analysis_messages(opportunity, sources_context or sources_payload)
  try:
    raw = _call_chat_completion(messages, temperature=0.1)
  except Exception:
    return jsonify({"error": "analysis_failed"}), 500

  analysis_data = _safe_json_load(raw)
  if not isinstance(analysis_data, dict) or not analysis_data:
    try:
      fix_messages = [
        {
          "role": "system",
          "content": "你是JSON修复助手。将输入转换为严格JSON，只输出JSON，不要解释。"
        },
        {
          "role": "user",
          "content": f"请转换为以下结构的JSON：\n{ANALYSIS_SCHEMA}\n\n原始内容:\n{raw}"
        }
      ]
      fixed = _call_chat_completion(fix_messages, temperature=0.0)
      analysis_data = _safe_json_load(fixed)
    except Exception:
      analysis_data = {}

  if not isinstance(analysis_data, dict) or not analysis_data:
    analysis_data = {"_parse_warning": "model_output_invalid_json"}

  contacts = analysis_data.get("contacts")
  if not isinstance(contacts, list):
    contacts = []
  analysis_data["contacts"] = contacts
  analysis_data = _apply_analysis_defaults(analysis_data, opportunity)

  use_azure = os.getenv("AZURE_OPENAI_DEFAULT_FLAG", "").upper() == "Y"
  provider = "azure_openai" if use_azure else "openai"
  model = (
    os.getenv("AZURE_OPENAI_MODEL_ID", DEFAULT_ANALYSIS_MODEL)
    if use_azure
    else os.getenv("OPENAI_MODEL_ID", DEFAULT_ANALYSIS_MODEL)
  )

  with db.cursor() as cur:
    cur.execute(
      "INSERT INTO opportunity_insights (opportunity_id, analysis_json, contacts_json, sources_json, provider, model) "
      "VALUES (%s, %s, %s, %s, %s, %s) "
      "ON DUPLICATE KEY UPDATE analysis_json = VALUES(analysis_json), contacts_json = VALUES(contacts_json), "
      "sources_json = VALUES(sources_json), provider = VALUES(provider), model = VALUES(model), "
      "updated_at = CURRENT_TIMESTAMP",
      (
        opportunity_id,
        json.dumps(analysis_data, ensure_ascii=False),
        json.dumps(contacts, ensure_ascii=False),
        json.dumps(sources_payload, ensure_ascii=False),
        provider,
        model
      )
    )
    cur.execute("SELECT * FROM opportunity_insights WHERE opportunity_id = %s", (opportunity_id,))
    insight = cur.fetchone()

  return jsonify({"data": _serialize_insight(insight)})


@app.route("/imports/sheets", methods=["GET"])
@require_user
def list_import_sheets():
  filename = request.args.get("filename") or DEFAULT_IMPORT_FILE
  path = _resolve_import_path(filename)
  if not path:
    return jsonify({"error": "file_not_found"}), 404
  try:
    workbook = load_workbook(path, read_only=True, data_only=True)
    return jsonify({"data": {"sheets": workbook.sheetnames}})
  except Exception:
    return jsonify({"error": "invalid_excel"}), 400


@app.route("/imports/upload", methods=["POST"])
@require_user
def upload_import_file():
  if "file" not in request.files:
    return jsonify({"error": "file_required"}), 400
  file = request.files["file"]
  if not file or not file.filename:
    return jsonify({"error": "file_required"}), 400
  ext = os.path.splitext(file.filename)[1].lower()
  if ext not in ALLOWED_IMPORT_EXTENSIONS:
    return jsonify({"error": "invalid_file_type"}), 400

  os.makedirs(UPLOAD_DIR, exist_ok=True)
  safe_name = secure_filename(file.filename)
  timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
  stored_name = f"{timestamp}_{safe_name}" if safe_name else f"{timestamp}.xlsx"
  stored_path = os.path.join(UPLOAD_DIR, stored_name)
  file.save(stored_path)

  return jsonify({"data": {"filename": stored_name}})


@app.route("/imports/opportunities", methods=["POST"])
@require_user
def import_opportunities():
  user = g.user
  body = request.get_json(silent=True) or {}
  filename = body.get("filename") or DEFAULT_IMPORT_FILE
  sheet_name = body.get("sheet") or "总表"
  company_id = body.get("company_id") if "company_id" in body else user.get("company_id")
  if company_id == "":
    company_id = None
  if company_id is None and is_group_admin(user):
    company_id = 0

  if company_id is None:
    return jsonify({"error": "company_required"}), 400

  if str(company_id) == "0":
    with get_db().cursor() as cur:
      cur.execute("SELECT id FROM companies WHERE parent_id IS NULL ORDER BY id ASC LIMIT 1")
      root = cur.fetchone()
    if not root:
      return jsonify({"error": "group_company_not_found"}), 400
    company_id = root["id"]

  default_company_id = company_id

  path = _resolve_import_path(filename)
  if not path:
    return jsonify({"error": "file_not_found"}), 404

  try:
    workbook = load_workbook(path, read_only=True, data_only=True)
  except Exception:
    return jsonify({"error": "invalid_excel"}), 400

  if sheet_name not in workbook.sheetnames:
    return jsonify({"error": "sheet_not_found"}), 404

  sheet = workbook[sheet_name]
  header_row_index, header_row = _find_header_row(sheet)
  if not header_row_index:
    return jsonify({"error": "header_not_found"}), 400

  header_map = _build_header_index_map(header_row)
  inserted = 0
  updated = 0
  skipped = 0
  contacts_added = 0

  def cell_value(row, key):
    idx = header_map.get(key)
    if idx is None or idx >= len(row):
      return None
    return _stringify_cell(row[idx])

  with get_db().cursor() as cur:
    for row in sheet.iter_rows(min_row=header_row_index + 1, values_only=True):
      if not row or not any(row):
        continue
      company_cn = cell_value(row, "company_cn")
      company_en = cell_value(row, "company_en")
      name = company_cn or company_en
      if not name:
        skipped += 1
        continue

      city = cell_value(row, "region")
      industry = cell_value(row, "business_type")
      source = f"Excel导入:{sheet_name}"
      pic = cell_value(row, "pic")

      target_company_id = default_company_id
      target_owner_id = user.get("id")
      if is_group_admin(user) and pic:
        cur.execute(
          "SELECT id, company_id FROM users WHERE name = %s AND status = 'active' LIMIT 1",
          (pic,)
        )
        pic_user = cur.fetchone()
        if pic_user and pic_user.get("company_id"):
          target_company_id = pic_user["company_id"]
          target_owner_id = pic_user["id"]

      primary_contact_name = cell_value(row, "contact_name")
      primary_phone = cell_value(row, "contact_mobile") or cell_value(row, "contact_phone")
      primary_email = cell_value(row, "contact_email")

      secondary_contact_name = cell_value(row, "contact_alt_name")
      secondary_contact_title = cell_value(row, "contact_alt_title")
      secondary_contact_email = cell_value(row, "contact_email_alt")
      secondary_contact_phone = cell_value(row, "contact_alt_phone")

      company_name = name
      company_phone = cell_value(row, "company_phone") or primary_phone
      company_email = cell_value(row, "company_email") or primary_email
      contact_department = cell_value(row, "contact_department")
      contact_person = cell_value(row, "contact_person") or primary_contact_name
      contact_address = cell_value(row, "contact_address") or cell_value(row, "address")
      website = cell_value(row, "website")
      country = cell_value(row, "country")
      hall_no = cell_value(row, "hall_no")
      booth_no = cell_value(row, "booth_no")
      booth_type = cell_value(row, "booth_type")
      booth_area_sqm = _parse_int(cell_value(row, "booth_area_sqm"))

      notes = _build_notes(
        [
          f"英文名: {company_en}" if company_en and company_en != company_cn else None,
          f"官网: {cell_value(row, 'website')}" if cell_value(row, "website") else None,
          f"地址: {cell_value(row, 'address')}" if cell_value(row, "address") else None,
          f"跟进人/PIC: {cell_value(row, 'pic')}" if cell_value(row, "pic") else None,
          f"触达方式: {cell_value(row, 'touch_method')}" if cell_value(row, "touch_method") else None,
          f"是否取得联系: {cell_value(row, 'contacted')}" if cell_value(row, "contacted") else None,
          f"现场反馈: {cell_value(row, 'feedback')}" if cell_value(row, "feedback") else None,
          f"竞争对手: {cell_value(row, 'competitor')}" if cell_value(row, "competitor") else None,
          f"备注: {cell_value(row, 'remark')}" if cell_value(row, "remark") else None,
          f"业务名称: {cell_value(row, 'business_name')}" if cell_value(row, "business_name") else None
        ]
      )

      if is_group_admin(user):
        cur.execute(
          "SELECT * FROM opportunities WHERE name = %s ORDER BY id DESC LIMIT 1",
          (name,)
        )
      else:
        cur.execute(
          "SELECT * FROM opportunities WHERE name = %s AND company_id = %s ORDER BY id DESC LIMIT 1",
          (name, target_company_id)
        )
      existing = cur.fetchone()

      if existing:
        updates = {}
        if is_group_admin(user) and target_company_id and existing.get("company_id") != target_company_id:
          updates["company_id"] = target_company_id
        if is_group_admin(user) and target_owner_id and existing.get("owner_id") != target_owner_id:
          updates["owner_id"] = target_owner_id
        if city and not existing.get("city"):
          updates["city"] = city
        if industry and not existing.get("industry"):
          updates["industry"] = industry
        if primary_contact_name and not existing.get("contact_name"):
          updates["contact_name"] = primary_contact_name
        if primary_phone and not existing.get("contact_phone"):
          updates["contact_phone"] = primary_phone
        if primary_email and not existing.get("contact_email"):
          updates["contact_email"] = primary_email
        if company_name and not existing.get("company_name"):
          updates["company_name"] = company_name
        if company_phone and not existing.get("company_phone"):
          updates["company_phone"] = company_phone
        if company_email and not existing.get("company_email"):
          updates["company_email"] = company_email
        if contact_department and not existing.get("contact_department"):
          updates["contact_department"] = contact_department
        if contact_person and not existing.get("contact_person"):
          updates["contact_person"] = contact_person
        if contact_address and not existing.get("contact_address"):
          updates["contact_address"] = contact_address
        if website and not existing.get("website"):
          updates["website"] = website
        if country and not existing.get("country"):
          updates["country"] = country
        if hall_no and not existing.get("hall_no"):
          updates["hall_no"] = hall_no
        if booth_no and not existing.get("booth_no"):
          updates["booth_no"] = booth_no
        if booth_type and not existing.get("booth_type"):
          updates["booth_type"] = booth_type
        if booth_area_sqm and not existing.get("booth_area_sqm"):
          updates["booth_area_sqm"] = booth_area_sqm
        if notes and not existing.get("risk_notes"):
          updates["risk_notes"] = notes
        if updates:
          set_clause = ", ".join([f"{key} = %s" for key in updates.keys()])
          cur.execute(
            f"UPDATE opportunities SET {set_clause} WHERE id = %s",
            (*updates.values(), existing["id"])
          )
          updated += 1
        opportunity_id = existing["id"]
      else:
        cur.execute(
          "INSERT INTO opportunities (name, type, source, industry, city, owner_id, company_id, contact_name, contact_phone, contact_email, "
          "company_name, company_phone, company_email, contact_department, contact_person, contact_address, website, country, hall_no, booth_no, booth_type, booth_area_sqm, "
          "risk_notes) "
          "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
          (
            name,
            "normal",
            source,
            industry,
            city,
            target_owner_id,
            target_company_id,
            primary_contact_name,
            primary_phone,
            primary_email,
            company_name,
            company_phone,
            company_email,
            contact_department,
            contact_person,
            contact_address,
            website,
            country,
            hall_no,
            booth_no,
            booth_type,
            booth_area_sqm,
            notes
          )
        )
        opportunity_id = cur.lastrowid
        inserted += 1

      contacts = []
      if primary_contact_name or primary_phone or primary_email:
        contacts.append(
          {
            "name": primary_contact_name,
            "title": None,
            "phone": primary_phone,
            "email": primary_email,
            "wechat": None
          }
        )
      if secondary_contact_name or secondary_contact_title or secondary_contact_phone or secondary_contact_email:
        contacts.append(
          {
            "name": secondary_contact_name,
            "title": secondary_contact_title,
            "phone": secondary_contact_phone,
            "email": secondary_contact_email,
            "wechat": None
          }
        )
      contacts_added += _insert_contacts(cur, opportunity_id, contacts)

  return jsonify(
    {
      "data": {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "contacts_added": contacts_added
      }
    }
  )


@app.route("/opportunities/<int:opportunity_id>/activities", methods=["POST"])
@require_user
def add_activity(opportunity_id):
  user = g.user
  db = get_db()
  with db.cursor() as cur:
    cur.execute("SELECT * FROM opportunities WHERE id = %s", (opportunity_id,))
    opportunity = cur.fetchone()

  if not opportunity:
    return jsonify({"error": "not_found"}), 404

  if not is_group_admin(user) and opportunity.get("company_id") != user.get("company_id"):
    return jsonify({"error": "not_found"}), 404

  body = request.get_json(silent=True) or {}
  comment = body.get("comment")
  channel = body.get("channel")
  if comment and not channel:
    channel = "other"
  if channel not in ACTIVITY_CHANNELS:
    return jsonify({"error": "invalid_channel"}), 400

  result = body.get("result")
  next_step = body.get("next_step")
  if comment:
    result = comment
    next_step = None

  with db.cursor() as cur:
    cur.execute(
      "INSERT INTO activities (opportunity_id, user_id, channel, result, next_step, follow_up_at) VALUES (%s, %s, %s, %s, %s, %s)",
      (
        opportunity_id,
        user["id"],
        channel,
        result,
        next_step,
        body.get("follow_up_at")
      )
    )
    activity_id = cur.lastrowid
    cur.execute(
      "UPDATE opportunities SET last_follow_up_at = CURRENT_TIMESTAMP WHERE id = %s",
      (opportunity_id,)
    )
    cur.execute("SELECT * FROM activities WHERE id = %s", (activity_id,))
    created = cur.fetchone()

  return jsonify({"data": created}), 201


@app.route("/opportunities/<int:opportunity_id>/activities", methods=["GET"])
@require_user
def list_activities(opportunity_id):
  user = g.user
  db = get_db()
  with db.cursor() as cur:
    cur.execute("SELECT * FROM opportunities WHERE id = %s", (opportunity_id,))
    opportunity = cur.fetchone()

  if not opportunity:
    return jsonify({"error": "not_found"}), 404

  if not is_group_admin(user) and opportunity.get("company_id") != user.get("company_id"):
    return jsonify({"error": "not_found"}), 404

  with db.cursor() as cur:
    cur.execute(
      "SELECT * FROM activities WHERE opportunity_id = %s ORDER BY created_at DESC",
      (opportunity_id,)
    )
    rows = cur.fetchall()

  return jsonify({"data": rows})


@app.route("/opportunities/<int:opportunity_id>/contacts", methods=["GET"])
@require_user
def list_contacts(opportunity_id):
  user = g.user
  db = get_db()
  with db.cursor() as cur:
    cur.execute("SELECT * FROM opportunities WHERE id = %s", (opportunity_id,))
    opportunity = cur.fetchone()

  if not opportunity:
    return jsonify({"error": "not_found"}), 404

  if not is_group_admin(user) and opportunity.get("company_id") != user.get("company_id"):
    return jsonify({"error": "not_found"}), 404

  with db.cursor() as cur:
    if CONTACT_ROLE_COLUMN_READY is True:
      cur.execute(
        "SELECT id, name, role, title, phone, email, wechat, created_at FROM opportunity_contacts "
        "WHERE opportunity_id = %s ORDER BY id ASC",
        (opportunity_id,)
      )
    else:
      cur.execute(
        "SELECT id, name, title, phone, email, wechat, created_at FROM opportunity_contacts "
        "WHERE opportunity_id = %s ORDER BY id ASC",
        (opportunity_id,)
      )
    rows = cur.fetchall()

  return jsonify({"data": rows})


@app.route("/opportunities/<int:opportunity_id>/tags", methods=["PUT"])
@require_user
def replace_tags(opportunity_id):
  user = g.user
  db = get_db()
  with db.cursor() as cur:
    cur.execute("SELECT * FROM opportunities WHERE id = %s", (opportunity_id,))
    opportunity = cur.fetchone()

  if not opportunity:
    return jsonify({"error": "not_found"}), 404

  if not is_group_admin(user) and opportunity.get("company_id") != user.get("company_id"):
    return jsonify({"error": "not_found"}), 404

  body = request.get_json(silent=True) or {}
  tag_ids = body.get("tag_ids")
  if not isinstance(tag_ids, list):
    return jsonify({"error": "tag_ids_required"}), 400

  unique_ids = sorted({int(tag_id) for tag_id in tag_ids if tag_id})

  with db.cursor() as cur:
    cur.execute("DELETE FROM opportunity_tags WHERE opportunity_id = %s", (opportunity_id,))
    if unique_ids:
      cur.executemany(
        "INSERT INTO opportunity_tags (opportunity_id, tag_id) VALUES (%s, %s)",
        [(opportunity_id, tag_id) for tag_id in unique_ids]
      )

  return jsonify({"ok": True})


@app.route("/tags", methods=["GET"])
@require_user
def list_tags():
  filters = []
  params = []

  tag_type = request.args.get("type")
  if tag_type:
    filters.append("type = %s")
    params.append(tag_type)

  where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""

  db = get_db()
  with db.cursor() as cur:
    cur.execute(f"SELECT * FROM tags {where_clause} ORDER BY name ASC", params)
    rows = cur.fetchall()

  return jsonify({"data": rows})


@app.route("/tags", methods=["POST"])
@require_user
def create_tag():
  body = request.get_json(silent=True) or {}
  name = body.get("name")
  tag_type = body.get("type", "custom")

  if not name:
    return jsonify({"error": "missing_name"}), 400

  db = get_db()
  try:
    with db.cursor() as cur:
      cur.execute("INSERT INTO tags (name, type) VALUES (%s, %s)", (name, tag_type))
      tag_id = cur.lastrowid
      cur.execute("SELECT * FROM tags WHERE id = %s", (tag_id,))
      created = cur.fetchone()
    return jsonify({"data": created}), 201
  except IntegrityError:
    with db.cursor() as cur:
      cur.execute("SELECT * FROM tags WHERE name = %s AND type = %s", (name, tag_type))
      existing = cur.fetchone()
    return jsonify({"data": existing}), 200


if __name__ == "__main__":
  port = int(os.getenv("PORT", "3000"))
  app.run(host="0.0.0.0", port=port)
