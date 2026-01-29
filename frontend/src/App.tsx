import { useEffect, useMemo, useRef, useState, type Key } from "react";
import moment from "moment";
import {
  Layout,
  Menu,
  Card,
  Row,
  Col,
  Statistic,
  Form,
  Input,
  Select,
  InputNumber,
  DatePicker,
  Upload,
  Button,
  Table,
  Tree,
  Tag,
  Space,
  Avatar,
  Dropdown,
  Drawer,
  Descriptions,
  List,
  Divider,
  Modal,
  message,
  Typography,
  Tooltip
} from "antd";
import {
  PlusOutlined,
  UserAddOutlined,
  LogoutOutlined,
  FilterOutlined,
  UndoOutlined,
  CloseOutlined,
  SaveOutlined,
  MessageOutlined,
  CheckOutlined,
  KeyOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  EyeOutlined,
  EditOutlined,
  StopOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  LinkOutlined,
  ClearOutlined,
  IdcardOutlined,
  UploadOutlined
} from "@ant-design/icons";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { MenuProps } from "antd";
import "./App.css";

const { Header, Sider, Content } = Layout;
const { Option } = Select;
const { Text } = Typography;
const { Search } = Input;

const STATUS_COLORS: Record<string, string> = {
  new: "blue",
  assigned: "cyan",
  in_progress: "gold",
  valid: "green",
  invalid: "red"
};

const STAGE_COLORS: Record<string, string> = {
  cold: "default",
  interest: "processing",
  need_defined: "geekblue",
  bid_preparing: "orange",
  ready_for_handoff: "purple"
};

const TYPE_LABELS: Record<string, string> = {
  normal: "普通商机",
  host: "主场商机"
};

const ORGANIZER_TYPE_LABELS: Record<string, string> = {
  foreign: "外资",
  state_owned: "国企",
  gov_joint: "政企合办",
  government: "政府类",
  commercial: "纯商业"
};

const COMPANY_STATUS_LABELS: Record<string, string> = {
  active: "启用",
  inactive: "停用"
};

const USER_STATUS_LABELS: Record<string, string> = {
  active: "启用",
  inactive: "停用"
};

const USER_ROLE_LABELS: Record<string, string> = {
  group_admin: "集团管理员",
  subsidiary_admin: "子公司管理员",
  sales: "销售",
  marketing: "市场支持"
};

const GROUP_LABEL = "Pico Group";

const DEFAULT_IMPORT_FILE = "CPS参展商客户名单-分配表1219.xlsx";
const CONTACT_ROLE_OPTIONS = [
  { value: "decision_maker", label: "决策者" },
  { value: "procurement", label: "采购" },
  { value: "finance", label: "财务" },
  { value: "marketing", label: "市场主管" },
  { value: "brand", label: "品牌事务对接" },
  { value: "other", label: "其他" }
];
const CONTACT_ROLE_LABELS: Record<string, string> = {
  decision_maker: "决策者",
  procurement: "采购",
  finance: "财务",
  marketing: "市场主管",
  brand: "品牌事务对接",
  other: "其他"
};

const STATUS_LABELS: Record<string, string> = {
  new: "新建",
  assigned: "已分配",
  in_progress: "跟进中",
  valid: "有效",
  invalid: "无效"
};

const STAGE_LABELS: Record<string, string> = {
  cold: "冷淡",
  interest: "意向",
  need_defined: "需求明确",
  bid_preparing: "投标准备",
  ready_for_handoff: "待移交"
};

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:3000").replace(/\/$/, "");

const USER_STORAGE_KEY = "crm_user_id";

const AiCuteIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="4" y="6" width="16" height="12" rx="4" />
    <path d="M9 4v2" />
    <path d="M15 4v2" />
    <circle cx="10" cy="12" r="1" />
    <circle cx="14" cy="12" r="1" />
    <path d="M9.5 15c1 .8 4 .8 5 0" />
  </svg>
);

type ActiveView = "org" | "opportunities" | "normal" | "host";
type OverviewType = "all" | "normal" | "host";

type Opportunity = {
  id: number;
  name: string;
  type: string;
  status?: string | null;
  stage?: string | null;
  source?: string | null;
  organizer_name?: string | null;
  organizer_type?: string | null;
  exhibition_name?: string | null;
  exhibition_start_date?: string | null;
  exhibition_end_date?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  booth_count?: number | null;
  exhibition_area_sqm?: number | null;
  expected_visitors?: number | null;
  exhibition_theme?: string | null;
  budget_range?: string | null;
  risk_notes?: string | null;
  contact_name?: string | null;
  contact_title?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  contact_wechat?: string | null;
  company_name?: string | null;
  company_phone?: string | null;
  company_email?: string | null;
  contact_department?: string | null;
  contact_person?: string | null;
  contact_address?: string | null;
  website?: string | null;
  country?: string | null;
  hall_no?: string | null;
  booth_no?: string | null;
  booth_type?: string | null;
  booth_area_sqm?: number | null;
  city?: string | null;
  industry?: string | null;
  owner_id?: number | null;
  updated_at?: string | null;
  company_id?: number | null;
};

type CurrentUser = {
  id: number;
  name: string;
  role: string;
  company_id?: number | null;
};

type Activity = {
  id: number;
  channel: string;
  result?: string | null;
  next_step?: string | null;
  created_at?: string | null;
};

type OpportunityInsight = {
  analysis?: Record<string, any> | null;
  contacts?: any[] | null;
  sources?: any[] | null;
  updated_at?: string | null;
  provider?: string | null;
  model?: string | null;
};

type Company = {
  id: number;
  name: string;
  code?: string | null;
  parent_id?: number | null;
  status?: string | null;
  created_at?: string | null;
};

type User = {
  id: number;
  name: string;
  email?: string | null;
  role: string;
  company_id?: number | null;
  status?: string | null;
  created_at?: string | null;
};

type OpportunityContact = {
  id?: number;
  name?: string;
  role?: string;
  title?: string;
  phone?: string;
  email?: string;
  wechat?: string;
};

type FilterValues = {
  name?: string;
  status?: string;
  stage?: string;
  city?: string;
  industry?: string;
  owner_id?: number;
  company_id?: number;
  source?: string;
};

type CreateFormValues = {
  name: string;
  type: string;
  source: string;
  industry?: string;
  city?: string;
  status?: string;
  stage?: string;
  organizer_name?: string;
  organizer_type?: string;
  exhibition_name?: string;
  exhibition_start_date?: any;
  exhibition_end_date?: any;
  venue_name?: string;
  venue_address?: string;
  booth_count?: number;
  exhibition_area_sqm?: number;
  expected_visitors?: number;
  exhibition_theme?: string;
  budget_range?: string;
  risk_notes?: string;
  contact_name?: string;
  contact_title?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_wechat?: string;
  company_name?: string;
  company_phone?: string;
  company_email?: string;
  contact_department?: string;
  contact_person?: string;
  contact_address?: string;
  website?: string;
  country?: string;
  hall_no?: string;
  booth_no?: string;
  booth_type?: string;
  booth_area_sqm?: number;
  invalid_reason?: string;
  company_id?: number;
  owner_id?: number;
  contacts?: Array<{
    name?: string;
    role?: string;
    title?: string;
    phone?: string;
    email?: string;
    wechat?: string;
  }>;
};

type CompanyFormValues = {
  name: string;
  code?: string;
  parent_id?: number;
  status?: string;
};

type UserFormValues = {
  name: string;
  email?: string;
  role: string;
  company_id?: number;
  status?: string;
  password?: string;
};

type LoginFormValues = {
  username: string;
  password: string;
};

type UserFilterValues = {
  name?: string;
  role?: string;
  company_id?: number;
  status?: string;
};

type OpportunitySummary = {
  total: number;
  valid: number;
  in_progress: number;
  ready_for_handoff: number;
  host: number;
};

type OrgTreeNode = {
  key: string;
  title: string;
  company?: Company;
  isRoot?: boolean;
  children?: OrgTreeNode[];
};

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [userId, setUserId] = useState(() => localStorage.getItem(USER_STORAGE_KEY) || "");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authChecking, setAuthChecking] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [opportunitySummary, setOpportunitySummary] = useState<OpportunitySummary>({
    total: 0,
    valid: 0,
    in_progress: 0,
    ready_for_handoff: 0,
    host: 0
  });
  const [opportunityPagination, setOpportunityPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [activeView, setActiveView] = useState<ActiveView>("opportunities");
  const [overviewType, setOverviewType] = useState<OverviewType>("all");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [companyDrawerOpen, setCompanyDrawerOpen] = useState(false);
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [companyEditing, setCompanyEditing] = useState<Company | null>(null);
  const [userEditing, setUserEditing] = useState<User | null>(null);
  const [companySaving, setCompanySaving] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [userDetailOpen, setUserDetailOpen] = useState(false);
  const [userDetail, setUserDetail] = useState<User | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [userFilters, setUserFilters] = useState<UserFilterValues>({});
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [commentHtml, setCommentHtml] = useState("");
  const commentRef = useRef<HTMLDivElement | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisFetching, setAnalysisFetching] = useState(false);
  const [analysisData, setAnalysisData] = useState<OpportunityInsight | null>(null);
  const [analysisTarget, setAnalysisTarget] = useState<Opportunity | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importSheets, setImportSheets] = useState<string[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);

  const [filterForm] = Form.useForm<FilterValues>();
  const [createForm] = Form.useForm<CreateFormValues>();
  const [companyForm] = Form.useForm<CompanyFormValues>();
  const [userForm] = Form.useForm<UserFormValues>();
  const [userFilterForm] = Form.useForm<UserFilterValues>();
  const [loginForm] = Form.useForm<LoginFormValues>();
  const [importForm] = Form.useForm<{
    filename: string;
    sheet: string;
    company_id?: number;
  }>();
  const [passwordForm] = Form.useForm<{
    current_password: string;
    new_password: string;
    confirm_password: string;
  }>();
  const [loginLoading, setLoginLoading] = useState(false);

  const isGroupAdmin = currentUser?.role === "group_admin";
  const isSubAdmin = currentUser?.role === "subsidiary_admin";
  const canManageOrg = Boolean(isGroupAdmin || isSubAdmin);

  const headers = (): HeadersInit => {
    if (!userId) {
      throw new Error("请先设置用户 ID。");
    }
    return {
      "Content-Type": "application/json",
      "x-user-id": String(userId)
    };
  };

  const uploadHeaders = (): HeadersInit => {
    if (!userId) {
      throw new Error("请先设置用户 ID。");
    }
    return {
      "x-user-id": String(userId)
    };
  };

  const apiFetch = (path: string, options: RequestInit = {}) =>
    fetch(`${API_BASE}${path}`, options);

  const fetchCurrentUser = async () => {
    setAuthChecking(true);
    try {
      const response = await apiFetch("/me", { headers: headers() });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem(USER_STORAGE_KEY);
          setUserId("");
        }
        throw new Error(body.error || "加载失败");
      }
      setCurrentUser(body.data || null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "加载失败";
      message.error(errorMessage);
      setCurrentUser(null);
    } finally {
      setAuthChecking(false);
    }
  };

  const fetchOpportunities = async (
    override: Partial<FilterValues> = {},
    pagination?: { page?: number; pageSize?: number }
  ) => {
    setLoading(true);
    try {
      const values = filterForm.getFieldsValue();
      const payload: Record<string, string | number | undefined | null> = {
        ...values,
        ...override
      };
      const typeFilter = activeView === "opportunities" ? overviewType : activeView;
      if (typeFilter !== "all") {
        payload.type = typeFilter;
      }
      const params = new URLSearchParams();
      Object.entries(payload).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
          return;
        }
        params.append(key, String(value));
      });
      const currentPage = pagination?.page ?? opportunityPagination.current ?? 1;
      const currentPageSize = pagination?.pageSize ?? opportunityPagination.pageSize ?? 10;
      params.set("page", String(currentPage));
      params.set("page_size", String(currentPageSize));

      const response = await apiFetch(`/opportunities?${params.toString()}`, {
        headers: headers()
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "加载失败");
      }
      setOpportunities(body.data || []);
      const summaryData = body.summary || {
        total: body.total ?? (body.data ? body.data.length : 0),
        valid: 0,
        in_progress: 0,
        ready_for_handoff: 0,
        host: 0
      };
      setOpportunitySummary({
        total: summaryData.total ?? 0,
        valid: summaryData.valid ?? 0,
        in_progress: summaryData.in_progress ?? 0,
        ready_for_handoff: summaryData.ready_for_handoff ?? 0,
        host: summaryData.host ?? 0
      });
      setOpportunityPagination({
        current: body.page ?? currentPage,
        pageSize: body.page_size ?? currentPageSize,
        total: body.total ?? summaryData.total ?? 0
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "加载失败";
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async (opportunityId: number) => {
    setActivityLoading(true);
    try {
      const response = await apiFetch(`/opportunities/${opportunityId}/activities`, {
        headers: headers()
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "加载失败");
      }
      setActivities(body.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "加载失败";
      message.error(errorMessage);
    } finally {
      setActivityLoading(false);
    }
  };

  const fetchOpportunityContacts = async (opportunityId: number) => {
    try {
      const response = await apiFetch(`/opportunities/${opportunityId}/contacts`, {
        headers: headers()
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "加载失败");
      }
      const contacts = Array.isArray(body.data) ? body.data : [];
      let mapped = contacts.map((contact: OpportunityContact) => ({
        name: contact.name,
        role: contact.role,
        title: contact.title,
        phone: contact.phone,
        email: contact.email,
        wechat: contact.wechat
      }));
      if (!mapped.length) {
        const fallback = {
          name: createForm.getFieldValue("contact_name"),
          title: createForm.getFieldValue("contact_title"),
          phone: createForm.getFieldValue("contact_phone"),
          email: createForm.getFieldValue("contact_email"),
          wechat: createForm.getFieldValue("contact_wechat")
        };
        if (Object.values(fallback).some(Boolean)) {
          mapped = [fallback];
        }
      }
      createForm.setFieldsValue({ contacts: mapped });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "加载失败";
      message.error(errorMessage);
    }
  };

  const fetchCompanies = async () => {
    setCompanyLoading(true);
    try {
      const response = await apiFetch("/companies", { headers: headers() });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "加载失败");
      }
      setCompanies(body.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "加载失败";
      message.error(errorMessage);
    } finally {
      setCompanyLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUserLoading(true);
    try {
      const response = await apiFetch("/users", { headers: headers() });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "加载失败");
      }
      setUsers(body.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "加载失败";
      message.error(errorMessage);
    } finally {
      setUserLoading(false);
    }
  };

  const refreshOrg = async () => {
    await Promise.all([fetchCompanies(), fetchUsers()]);
  };

  useEffect(() => {
    if (userId) {
      fetchCurrentUser();
    } else {
      setCurrentUser(null);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      if (activeView === "org") {
        refreshOrg();
      } else {
        fetchOpportunities();
      }
    }
  }, [userId, activeView, overviewType]);

  useEffect(() => {
    if (userId && companies.length === 0) {
      fetchCompanies();
    }
  }, [userId, companies.length]);

  useEffect(() => {
    if (userId && canManageOrg && users.length === 0) {
      fetchUsers();
    }
  }, [userId, canManageOrg, users.length]);

  useEffect(() => {
    if (activeView === "org" && currentUser && !canManageOrg) {
      setActiveView("opportunities");
    }
  }, [activeView, currentUser, canManageOrg]);

  useEffect(() => {
    if (activeView === "org" && currentUser && !isGroupAdmin) {
      userFilterForm.resetFields();
    }
  }, [activeView, currentUser, isGroupAdmin, userFilterForm]);

  useEffect(() => {
    if (selectedOrgId && !companies.some((company) => company.id === selectedOrgId)) {
      setSelectedOrgId(null);
    }
  }, [companies, selectedOrgId]);

  const summary = opportunitySummary;

  const handleOpportunityTableChange = (pagination: TablePaginationConfig) => {
    const nextPage = pagination.current ?? 1;
    const nextPageSize = pagination.pageSize ?? opportunityPagination.pageSize ?? 10;
    fetchOpportunities({}, { page: nextPage, pageSize: nextPageSize });
  };

  const roleOptions = useMemo(() => {
    const entries = Object.entries(USER_ROLE_LABELS);
    if (isGroupAdmin) {
      return entries;
    }
    return entries.filter(([value]) => value !== "group_admin");
  }, [isGroupAdmin]);

  const companyMap = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name])),
    [companies]
  );
  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user.name])), [users]);

  const companyChildrenMap = useMemo(() => {
    const childrenMap = new Map<number, Company[]>();
    companies.forEach((company) => {
      const parentId = company.parent_id ?? 0;
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(company);
    });
    return childrenMap;
  }, [companies]);

  const orgTreeData = useMemo<OrgTreeNode[]>(() => {
    const buildNodes = (parentId: number): OrgTreeNode[] => {
      const items = companyChildrenMap.get(parentId) || [];
      return items.map((item) => ({
        title: item.name,
        key: String(item.id),
        company: item,
        children: buildNodes(item.id)
      }));
    };

    if (isGroupAdmin) {
      return [
        {
          title: GROUP_LABEL,
          key: "root",
          isRoot: true,
          children: buildNodes(0)
        }
      ];
    }

    if (isSubAdmin && currentUser?.company_id) {
      const rootCompany = companies.find((company) => company.id === currentUser.company_id);
      if (!rootCompany) {
        return [];
      }
      return [
        {
          title: rootCompany.name,
          key: String(rootCompany.id),
          company: rootCompany,
          children: buildNodes(rootCompany.id)
        }
      ];
    }

    return buildNodes(0);
  }, [companies, companyChildrenMap, currentUser, isGroupAdmin, isSubAdmin]);

  const selectedCompanyIds = useMemo(() => {
    if (!selectedOrgId) {
      return null;
    }
    const visited = new Set<number>();
    const stack = [selectedOrgId];
    while (stack.length) {
      const currentId = stack.pop();
      if (!currentId || visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);
      const children = companyChildrenMap.get(currentId) || [];
      children.forEach((child) => {
        if (!visited.has(child.id)) {
          stack.push(child.id);
        }
      });
    }
    return visited;
  }, [companyChildrenMap, selectedOrgId]);

  const filteredUsers = useMemo(() => {
    let rows = users;
    const nameFilter = userFilters.name?.trim();
    if (nameFilter) {
      rows = rows.filter((item) => item.name.includes(nameFilter));
    }
    if (userFilters.role) {
      rows = rows.filter((item) => item.role === userFilters.role);
    }
    if (userFilters.status) {
      rows = rows.filter((item) => item.status === userFilters.status);
    }
    if (isGroupAdmin && userFilters.company_id !== undefined) {
      if (userFilters.company_id === 0) {
        rows = rows.filter((item) => !item.company_id);
      } else if (userFilters.company_id) {
        rows = rows.filter((item) => item.company_id === userFilters.company_id);
      }
    }
    if (selectedCompanyIds) {
      rows = rows.filter((item) => item.company_id && selectedCompanyIds.has(item.company_id));
    }
    return rows;
  }, [isGroupAdmin, selectedCompanyIds, userFilters, users]);

  const handleLogin = async () => {
    try {
      const values = await loginForm.validateFields();
      setLoginLoading(true);
      const response = await apiFetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const rawText = await response.text();
      let body: any = {};
      try {
        body = rawText ? JSON.parse(rawText) : {};
      } catch (err) {
        body = { error: "服务暂时不可用，请稍后再试。" };
      }
      if (!response.ok) {
        throw new Error(body.error || "登录失败");
      }
      const user = body.data as CurrentUser;
      setUserId(String(user.id));
      localStorage.setItem(USER_STORAGE_KEY, String(user.id));
      setCurrentUser(user);
      loginForm.resetFields();
      message.success("登录成功");
      if (user.role === "group_admin" || user.role === "subsidiary_admin") {
        setActiveView("org");
      } else {
        setActiveView("opportunities");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "登录失败";
      message.error(errorMessage);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    setUserId("");
    setCurrentUser(null);
    setOpportunities([]);
    setCompanies([]);
    setUsers([]);
    setActivities([]);
    setActiveView("opportunities");
    message.success("已退出登录");
  };

  const handleOpenPasswordModal = () => {
    passwordForm.resetFields();
    setPasswordModalOpen(true);
  };

  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      setPasswordLoading(true);
      const response = await apiFetch("/me/password", {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({
          current_password: values.current_password,
          new_password: values.new_password
        })
      });
      const body = await response.json();
      if (!response.ok) {
        const errorMessage = body.error === "invalid_password" ? "当前密码不正确。" : body.error || "修改失败";
        throw new Error(errorMessage);
      }
      message.success("密码已更新。");
      setPasswordModalOpen(false);
      passwordForm.resetFields();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "修改失败";
      message.error(errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  };

  if (authChecking) {
    return (
      <div className="login-page">
        <div className="login-card">
          <Text type="secondary">正在验证登录状态...</Text>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">Pico商机管理</div>
          <Text type="secondary">请使用管理员账号登录</Text>
          <Form
            form={loginForm}
            layout="vertical"
            className="login-form-vertical"
            onFinish={handleLogin}
          >
            <Form.Item
              name="username"
              label="用户名"
              rules={[{ required: true, message: "请输入用户名" }]}
            >
              <Input placeholder="admin-pico" />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: "请输入密码" }]}
            >
              <Input.Password placeholder="pico@2026" />
            </Form.Item>
            <Tooltip title="登录">
              <Button
                type="primary"
                htmlType="submit"
                loading={loginLoading}
                block
              >
                登录
              </Button>
            </Tooltip>
          </Form>
          <Text type="secondary" style={{ marginTop: 12 }}>
            管理员账号：admin-pico / pico@2026
          </Text>
        </div>
      </div>
    );
  }

  const formatDateValue = (value: any) => {
    if (value === null) return null;
    if (!value) return undefined;
    if (typeof value === "string") return value;
    if (typeof value === "object" && typeof value.format === "function") {
      return value.format("YYYY-MM-DD");
    }
    return undefined;
  };

  const safeArray = (value: any) => (Array.isArray(value) ? value : []);

  const stripHtml = (html: string) =>
    html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

  const isCommentEmpty = (html: string) => stripHtml(html).length === 0;

  const syncComment = () => {
    if (!commentRef.current) return;
    setCommentHtml(commentRef.current.innerHTML);
  };

  const applyFormat = (command: string, value?: string) => {
    if (!commentRef.current) return;
    commentRef.current.focus();
    document.execCommand(command, false, value);
    syncComment();
  };

  const parseDateRange = (value?: string) => {
    if (!value || typeof value !== "string") return {};
    const matches = Array.from(
      value.matchAll(/(\\d{4}[./-]\\d{1,2}[./-]\\d{1,2})/g)
    ).map((match) => match[1]);
    if (matches.length >= 2) {
      const start = moment(matches[0]);
      const end = moment(matches[1]);
      return {
        start: start.isValid() ? start : undefined,
        end: end.isValid() ? end : undefined
      };
    }
    if (matches.length === 1) {
      const start = moment(matches[0]);
      return { start: start.isValid() ? start : undefined };
    }
    return {};
  };

  const toNumber = (value: any) => {
    if (value === null || value === undefined || value === "") return undefined;
    if (typeof value === "number" && !Number.isNaN(value)) return value;
    const parsed = parseInt(String(value), 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const applyAnalysisToForm = () => {
    if (!analysisTarget || !analysisData?.analysis) {
      message.error("暂无可用分析结果");
      return;
    }
    const suggestions = analysisData.analysis.form_suggestions || {};
    const suggestedContacts = safeArray(analysisData.contacts ?? analysisData.analysis.contacts);
    handleOpenEditOpportunity(analysisTarget);

    setTimeout(() => {
      const current = createForm.getFieldsValue();
      const updates: Partial<CreateFormValues> = {};
      const fillIfEmpty = (key: keyof CreateFormValues, value: any) => {
        if (value === undefined || value === null || value === "") return;
        const currentValue = current[key];
        if (currentValue === undefined || currentValue === null || currentValue === "") {
          updates[key] = value;
        }
      };

      fillIfEmpty("organizer_name", suggestions.organizer_name);
      fillIfEmpty("organizer_type", suggestions.organizer_type);
      fillIfEmpty("exhibition_name", suggestions.exhibition_name);
      fillIfEmpty("venue_name", suggestions.venue_name);
      fillIfEmpty("venue_address", suggestions.venue_address);
      fillIfEmpty("exhibition_theme", suggestions.exhibition_theme);
      fillIfEmpty("budget_range", suggestions.budget_range);
      fillIfEmpty("city", suggestions.city);
      fillIfEmpty("industry", suggestions.industry);
      fillIfEmpty("source", suggestions.source);
      fillIfEmpty("company_name", suggestions.company_name || suggestions.customer_company_name);
      fillIfEmpty("company_phone", suggestions.company_phone || suggestions.customer_phone);
      fillIfEmpty("company_email", suggestions.company_email || suggestions.customer_email);
      fillIfEmpty("contact_department", suggestions.contact_department);
      fillIfEmpty("contact_person", suggestions.contact_person);
      fillIfEmpty("contact_address", suggestions.contact_address);
      fillIfEmpty("website", suggestions.website);
      fillIfEmpty("country", suggestions.country);
      fillIfEmpty("hall_no", suggestions.hall_no);
      fillIfEmpty("booth_no", suggestions.booth_no);
      fillIfEmpty("booth_type", suggestions.booth_type);

      const boothCount = toNumber(suggestions.booth_count);
      const areaSqm = toNumber(suggestions.exhibition_area_sqm);
      const boothAreaSqm = toNumber(suggestions.booth_area_sqm);
      const visitors = toNumber(suggestions.expected_visitors);
      if (boothCount !== undefined) fillIfEmpty("booth_count", boothCount);
      if (areaSqm !== undefined) fillIfEmpty("exhibition_area_sqm", areaSqm);
      if (boothAreaSqm !== undefined) fillIfEmpty("booth_area_sqm", boothAreaSqm);
      if (visitors !== undefined) fillIfEmpty("expected_visitors", visitors);

      if (!current.exhibition_start_date && suggestions.exhibition_start_date) {
        const start = moment(suggestions.exhibition_start_date);
        if (start.isValid()) {
          updates.exhibition_start_date = start as any;
        }
      }
      if (!current.exhibition_end_date && suggestions.exhibition_end_date) {
        const end = moment(suggestions.exhibition_end_date);
        if (end.isValid()) {
          updates.exhibition_end_date = end as any;
        }
      }
      if (
        (!updates.exhibition_start_date && !updates.exhibition_end_date) ||
        (!current.exhibition_start_date && !current.exhibition_end_date)
      ) {
        const range = parseDateRange(suggestions.exhibition_time || suggestions.time);
        if (range.start && !current.exhibition_start_date) {
          updates.exhibition_start_date = range.start as any;
        }
        if (range.end && !current.exhibition_end_date) {
          updates.exhibition_end_date = range.end as any;
        }
      }

      if (!current.contacts?.length && suggestedContacts.length) {
        updates.contacts = suggestedContacts.map((contact: any) => ({
          name: contact.name || "",
          role: contact.role || contact.contact_role || "",
          title: contact.title || "",
          phone: contact.phone || contact.contact_phone || "",
          email: contact.email || contact.contact_email || "",
          wechat: contact.wechat || contact.contact_wechat || ""
        }));
      }

      if (Object.keys(updates).length === 0) {
        message.info("没有可补充的字段");
        return;
      }
      createForm.setFieldsValue(updates);
      message.success("已补充到表单，请检查后保存");
    }, 0);
  };

  const renderTextValue = (value: any) => {
    if (value === undefined || value === null || value === "") return "-";
    if (Array.isArray(value)) {
      const cleaned = value
        .map((item) => {
          if (item === undefined || item === null || item === "") return "";
          if (typeof item === "object") {
            if (item.name) return String(item.name);
            if (item.title) return String(item.title);
            if (item.value) return String(item.value);
            try {
              return JSON.stringify(item);
            } catch (err) {
              return String(item);
            }
          }
          return String(item);
        })
        .filter(Boolean);
      return cleaned.length ? cleaned.join(" / ") : "-";
    }
    if (typeof value === "object") {
      const parts = [];
      if (value.name) parts.push(value.name);
      if (value.city) parts.push(value.city);
      if (value.address) parts.push(value.address);
      if (value.venue) parts.push(value.venue);
      if (value.time) parts.push(value.time);
      if (value.theme) parts.push(value.theme);
      if (value.scale) parts.push(value.scale);
      if (parts.length) return parts.join(" ");
      try {
        return JSON.stringify(value);
      } catch (err) {
        return String(value);
      }
    }
    return String(value);
  };

  const renderTagList = (items?: string[]) => {
    const list = safeArray(items) as any[];
    if (!list.length) return "-";
    return (
      <Space wrap>
        {list.map((item, index) => (
          <Tag key={`${String(item)}-${index}`}>{renderTextValue(item)}</Tag>
        ))}
      </Space>
    );
  };

  const uniqueList = (items: string[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (!item) return false;
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  };

  const toTextList = (value: any) => {
    const list = safeArray(value) as any[];
    return uniqueList(
      list
        .map((item) => {
          const text = renderTextValue(item);
          return text === "-" ? "" : text;
        })
        .filter(Boolean) as string[]
    );
  };

  const formatContactLabel = (contact: any) => {
    if (!contact || typeof contact !== "object") return "";
    const name = contact.name ? String(contact.name) : "";
    const roleLabel = contact.role ? CONTACT_ROLE_LABELS[String(contact.role)] || String(contact.role) : "";
    const title = contact.title ? String(contact.title) : "";
    if (name && title) return `${name} · ${title}`;
    if (name && roleLabel) return `${name} · ${roleLabel}`;
    return name || title || roleLabel || "";
  };

  const buildContactStructureFromContacts = (contacts: any[]) => {
    const normalized = safeArray(contacts)
      .map((item) => ({
        name: item?.name ? String(item.name) : "",
        role: item?.role ? String(item.role) : "",
        title: item?.title ? String(item.title) : ""
      }))
      .filter((item) => item.name || item.title);

    const mapByRoles = (roles: string[], keywords: string[]) =>
      uniqueList(
        normalized
          .filter((item) => {
            if (item.role && roles.includes(item.role)) {
              return true;
            }
            return keywords.some((keyword) => item.title.includes(keyword));
          })
          .map((item) => formatContactLabel(item))
          .filter(Boolean)
      );

    const decisionNode = {
      label: "决策者",
      names: mapByRoles(["decision_maker"], ["董事长", "总经理", "总裁", "CEO", "负责人", "董事", "主席", "决策"])
    };
    const procurementNode = {
      label: "采购",
      names: mapByRoles(["procurement"], ["采购", "供应链"])
    };
    const financeNode = {
      label: "财务",
      names: mapByRoles(["finance"], ["财务", "会计", "资金"])
    };
    const marketingNode = {
      label: "市场主管",
      names: mapByRoles(["marketing"], ["市场", "营销", "推广"])
    };
    const brandNode = {
      label: "品牌事务对接",
      names: mapByRoles(["brand"], ["品牌", "公关", "传播"])
    };

    const hasAny =
      decisionNode.names.length ||
      procurementNode.names.length ||
      financeNode.names.length ||
      marketingNode.names.length ||
      brandNode.names.length;

    return {
      hasAny,
      top: decisionNode,
      middle: [procurementNode],
      bottom: [financeNode, marketingNode, brandNode]
    };
  };

  const matchContactsByKeywords = (keywords: string[]) => {
    const normalized = keywords.filter(Boolean);
    if (!normalized.length) return [];
    return analysisContacts
      .filter((contact: any) => {
        const name = contact?.name ? String(contact.name) : "";
        const title = contact?.title ? String(contact.title) : "";
        const org = contact?.organization ? String(contact.organization) : "";
        const target = `${name} ${title} ${org}`;
        return normalized.some((keyword) => target.includes(keyword));
      })
      .map((contact: any) => formatContactLabel(contact))
      .filter(Boolean);
  };

  const buildContactNode = (label: string, keywords: string[], fallback?: any) => {
    const matched = matchContactsByKeywords(keywords);
    const fallbackList = toTextList(fallback);
    const names = uniqueList([...matched, ...fallbackList]);
    return { label, names };
  };

  const buildOpportunityPayload = (values: CreateFormValues) => {
    const contacts = (values.contacts || [])
      .map((contact) => ({
        name: contact.name?.trim(),
        role: contact.role?.trim(),
        title: contact.title?.trim(),
        phone: contact.phone?.trim(),
        email: contact.email?.trim(),
        wechat: contact.wechat?.trim()
      }))
      .filter((contact) => Object.values(contact).some(Boolean));

    const payload = {
      ...values,
      contacts,
      exhibition_start_date: formatDateValue(values.exhibition_start_date),
      exhibition_end_date: formatDateValue(values.exhibition_end_date)
    };
    return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      const payload = buildOpportunityPayload(values);
      setCreateLoading(true);
      const response = await apiFetch(
        editingOpportunity ? `/opportunities/${editingOpportunity.id}` : "/opportunities",
        {
          method: editingOpportunity ? "PATCH" : "POST",
          headers: headers(),
          body: JSON.stringify(payload)
        }
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "创建失败");
      }
      message.success(editingOpportunity ? "商机已更新。" : `已创建商机 #${body.data.id}。`);
      createForm.resetFields();
      setCreateOpen(false);
      setEditingOpportunity(null);
      fetchOpportunities();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "创建失败";
      message.error(errorMessage);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleOpenActivity = (record: Opportunity) => {
    setSelectedOpportunity(record);
    setCommentHtml("");
    if (commentRef.current) {
      commentRef.current.innerHTML = "";
    }
    setActivityOpen(true);
    fetchActivities(record.id);
  };

  const handleAddActivity = async () => {
    try {
      if (!selectedOpportunity) {
        throw new Error("未选择商机");
      }
      const html = commentRef.current?.innerHTML || commentHtml;
      if (!html || isCommentEmpty(html)) {
        throw new Error("请输入跟进内容");
      }
      setActivityLoading(true);
      const response = await apiFetch(`/opportunities/${selectedOpportunity.id}/activities`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ comment: html })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "保存失败");
      }
      message.success("跟进记录已保存。");
      setCommentHtml("");
      if (commentRef.current) {
        commentRef.current.innerHTML = "";
      }
      fetchActivities(selectedOpportunity.id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "保存失败";
      message.error(errorMessage);
    } finally {
      setActivityLoading(false);
    }
  };

  const runAnalysis = async (record: Opportunity) => {
    setAnalysisLoading(true);
    try {
      const response = await apiFetch(`/opportunities/${record.id}/analysis`, {
        method: "POST",
        headers: headers()
      });
      const body = await response.json();
      if (!response.ok) {
        let errorMessage = body.error || "分析失败";
        if (errorMessage === "search_provider_not_configured") {
          errorMessage = "请先配置 SERPER_API_KEY 或 SERPAPI_API_KEY。";
        } else if (errorMessage === "missing_searxng_url") {
          errorMessage = "请先配置 SEARXNG_URL（自建搜索服务地址）。";
        } else if (errorMessage === "missing_opportunity_name") {
          errorMessage = "请先填写商机名称再分析。";
        } else if (errorMessage === "no_search_results") {
          errorMessage = "未找到公开结果，请补充展会信息后再试。";
        } else if (errorMessage === "analysis_parse_failed") {
          errorMessage = "分析结果解析失败，请重新尝试。";
        }
        throw new Error(errorMessage);
      }
      setAnalysisData(body.data || null);
      message.success("分析已生成。");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "分析失败";
      message.error(errorMessage);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const fetchAnalysis = async (record: Opportunity) => {
    setAnalysisFetching(true);
    try {
      const response = await apiFetch(`/opportunities/${record.id}/analysis`, {
        headers: headers()
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "加载失败");
      }
      setAnalysisData(body.data || null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "加载失败";
      message.error(errorMessage);
      setAnalysisData(null);
    } finally {
      setAnalysisFetching(false);
    }
  };

  const handleOpenAnalysis = (record: Opportunity) => {
    setAnalysisTarget(record);
    setAnalysisOpen(true);
    fetchAnalysis(record);
  };

  const handleOpenCompanyDrawer = (company?: Company, parentId?: number) => {
    if (!isGroupAdmin) {
      return;
    }
    if (company) {
      setCompanyEditing(company);
      companyForm.setFieldsValue({
        name: company.name,
        code: company.code || undefined,
        parent_id: company.parent_id ?? 0,
        status: company.status || "active"
      });
    } else {
      setCompanyEditing(null);
      companyForm.resetFields();
      if (parentId) {
        companyForm.setFieldsValue({ parent_id: parentId, status: "active" });
      } else {
        companyForm.setFieldsValue({ status: "active" });
      }
    }
    setCompanyDrawerOpen(true);
  };

  const handleOpenUserDrawer = (user?: User) => {
    if (user) {
      setUserEditing(user);
      userForm.setFieldsValue({
        name: user.name,
        email: user.email || undefined,
        role: user.role,
        company_id: user.company_id ?? 0,
        status: user.status || "active",
        password: undefined
      });
    } else {
      setUserEditing(null);
      userForm.resetFields();
      if (isSubAdmin && currentUser?.company_id) {
        userForm.setFieldsValue({ company_id: currentUser.company_id ?? undefined });
      }
    }
    if (!companies.length) {
      fetchCompanies();
    }
    setUserDrawerOpen(true);
  };

  const handleCreateCompany = async () => {
    if (!isGroupAdmin) {
      message.error("无权限");
      return;
    }
    try {
      const values = await companyForm.validateFields();
      setCompanySaving(true);
      const payload = {
        ...values,
        parent_id: values.parent_id === 0 ? undefined : values.parent_id
      };
      const response = await apiFetch(
        companyEditing ? `/companies/${companyEditing.id}` : "/companies",
        {
          method: companyEditing ? "PATCH" : "POST",
          headers: headers(),
          body: JSON.stringify(payload)
        }
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "保存失败");
      }
      message.success(companyEditing ? "公司已更新。" : "公司已创建。");
      companyForm.resetFields();
      setCompanyDrawerOpen(false);
      setCompanyEditing(null);
      refreshOrg();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "创建失败";
      message.error(errorMessage);
    } finally {
      setCompanySaving(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      const values = await userForm.validateFields();
      setUserSaving(true);
      const payload: Record<string, any> = {
        ...values,
        company_id: values.role === "group_admin" ? undefined : values.company_id
      };
      if (!payload.password) {
        delete payload.password;
      }
      if (isSubAdmin) {
        payload.company_id = currentUser?.company_id ?? undefined;
      }
      const response = await apiFetch(userEditing ? `/users/${userEditing.id}` : "/users", {
        method: userEditing ? "PATCH" : "POST",
        headers: headers(),
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "保存失败");
      }
      message.success(userEditing ? "员工已更新。" : "员工已创建。");
      userForm.resetFields();
      setUserDrawerOpen(false);
      setUserEditing(null);
      refreshOrg();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "创建失败";
      message.error(errorMessage);
    } finally {
      setUserSaving(false);
    }
  };

  const handleDeleteCompany = (company: Company) => {
    if (!isGroupAdmin) {
      message.error("无权限");
      return;
    }
    Modal.confirm({
      title: "确认删除该公司？",
      content: "删除后无法恢复，请确保已清理下级公司、员工和商机数据。",
      okText: "",
      cancelText: "",
      okButtonProps: { danger: true, icon: <DeleteOutlined />, "aria-label": "删除" },
      cancelButtonProps: { icon: <CloseOutlined />, "aria-label": "取消" },
      onOk: async () => {
        try {
          const response = await apiFetch(`/companies/${company.id}`, {
            method: "DELETE",
            headers: headers()
          });
          const body = await response.json();
          if (!response.ok) {
            const errorCode = body.error;
            const errorMessage =
              errorCode === "company_has_children"
                ? "请先删除下级公司。"
                : errorCode === "company_has_users"
                  ? "请先移除该公司下的员工。"
                  : errorCode === "company_has_opportunities"
                    ? "请先移除该公司下的商机。"
                    : errorCode === "not_found"
                      ? "公司不存在。"
                      : body.error || "删除失败";
            throw new Error(errorMessage);
          }
          message.success("公司已删除。");
          refreshOrg();
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "删除失败";
          message.error(errorMessage);
        }
      }
    });
  };

  const handleToggleUserStatus = (user: User) => {
    const nextStatus = user.status === "inactive" ? "active" : "inactive";
    Modal.confirm({
      title: nextStatus === "inactive" ? "停用该员工？" : "启用该员工？",
      content: nextStatus === "inactive" ? "停用后该员工将无法登录。" : "该员工将恢复启用状态。",
      okText: "",
      cancelText: "",
      okButtonProps: { icon: <CheckOutlined />, "aria-label": "确认" },
      cancelButtonProps: { icon: <CloseOutlined />, "aria-label": "取消" },
      onOk: async () => {
        try {
          const response = await apiFetch(`/users/${user.id}`, {
            method: "PATCH",
            headers: headers(),
            body: JSON.stringify({ status: nextStatus })
          });
          const body = await response.json();
          if (!response.ok) {
            throw new Error(body.error || "操作失败");
          }
          message.success("状态已更新。");
          refreshOrg();
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "操作失败";
          message.error(errorMessage);
        }
      }
    });
  };

  const handleViewUser = (user: User) => {
    setUserDetail(user);
    setUserDetailOpen(true);
  };

  const handleUserFilter = () => {
    const values = userFilterForm.getFieldsValue();
    setUserFilters(values);
  };

  const handleUserReset = () => {
    userFilterForm.resetFields();
    setUserFilters({});
  };

  const handleOpenCreate = () => {
    setEditingOpportunity(null);
    createForm.resetFields();
    const preferredType =
      activeView === "opportunities"
        ? overviewType === "all"
          ? undefined
          : overviewType
        : activeView;
    if (preferredType) {
      createForm.setFieldsValue({ type: preferredType });
    }
    createForm.setFieldsValue({ contacts: [] });
    if (isGroupAdmin && !companies.length) {
      fetchCompanies();
    }
    setCreateOpen(true);
  };

  const handleOpenImport = async () => {
    if (isGroupAdmin && !companies.length) {
      fetchCompanies();
    }
    setUploadedFilename(null);
    const defaultCompanyId = currentUser?.company_id || undefined;
    importForm.setFieldsValue({
      filename: DEFAULT_IMPORT_FILE,
      sheet: "总表",
      company_id: defaultCompanyId
    });
    setImportOpen(true);
    try {
      const response = await apiFetch(
        `/imports/sheets?filename=${encodeURIComponent(DEFAULT_IMPORT_FILE)}`,
        { headers: headers() }
      );
      const body = await response.json();
      if (response.ok) {
        setImportSheets(body.data?.sheets || []);
      } else {
        throw new Error(body.error || "读取Excel失败");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "读取Excel失败";
      message.error(errorMessage);
      setImportSheets([]);
    }
  };

  const handleUploadExcel = async (file: File) => {
    if (!userId) {
      message.error("请先登录");
      return false;
    }
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiFetch("/imports/upload", {
        method: "POST",
        headers: uploadHeaders(),
        body: formData
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "上传失败");
      }
      const filename = body.data?.filename;
      if (!filename) {
        throw new Error("上传失败");
      }
      setUploadedFilename(filename);
      importForm.setFieldsValue({ filename, sheet: undefined });

      const sheetsResponse = await apiFetch(
        `/imports/sheets?filename=${encodeURIComponent(filename)}`,
        { headers: headers() }
      );
      const sheetsBody = await sheetsResponse.json();
      if (sheetsResponse.ok) {
        const sheets = sheetsBody.data?.sheets || [];
        setImportSheets(sheets);
        if (sheets.length) {
          importForm.setFieldsValue({ sheet: sheets[0] });
        }
      } else {
        throw new Error(sheetsBody.error || "读取工作表失败");
      }
      message.success("上传成功");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "上传失败";
      message.error(errorMessage);
    } finally {
      setUploadLoading(false);
    }
    return false;
  };

  const handleImportExcel = async () => {
    try {
      const values = await importForm.validateFields();
      setImportLoading(true);
      const payload: Record<string, any> = {
        filename: values.filename,
        sheet: values.sheet
      };
      if (values.company_id !== undefined) {
        payload.company_id = values.company_id;
      } else if (isGroupAdmin) {
        payload.company_id = 0;
      }
      const response = await apiFetch("/imports/opportunities", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!response.ok) {
        const errorMessage =
          body.error === "company_required" ? "请选择公司" : body.error || "导入失败";
        throw new Error(errorMessage);
      }
      const stats = body.data || {};
      message.success(
        `导入完成：新增 ${stats.inserted || 0}，更新 ${stats.updated || 0}，跳过 ${stats.skipped || 0}，联系人新增 ${stats.contacts_added || 0}`
      );
      setImportOpen(false);
      fetchOpportunities();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "导入失败";
      message.error(errorMessage);
    } finally {
      setImportLoading(false);
    }
  };

  const handleOpenEditOpportunity = (record: Opportunity) => {
    setEditingOpportunity(record);
    createForm.setFieldsValue({
      name: record.name,
      type: record.type,
      source: record.source || undefined,
      industry: record.industry || undefined,
      city: record.city || undefined,
      status: record.status || undefined,
      stage: record.stage || undefined,
      organizer_name: record.organizer_name || undefined,
      organizer_type: record.organizer_type || undefined,
      exhibition_name: record.exhibition_name || undefined,
      exhibition_start_date: record.exhibition_start_date
        ? moment(record.exhibition_start_date)
        : null,
      exhibition_end_date: record.exhibition_end_date ? moment(record.exhibition_end_date) : null,
      venue_name: record.venue_name || undefined,
      venue_address: record.venue_address || undefined,
      booth_count: record.booth_count ?? undefined,
      exhibition_area_sqm: record.exhibition_area_sqm ?? undefined,
      expected_visitors: record.expected_visitors ?? undefined,
      exhibition_theme: record.exhibition_theme || undefined,
      budget_range: record.budget_range || undefined,
      risk_notes: record.risk_notes || undefined,
      contact_name: record.contact_name || undefined,
      contact_title: record.contact_title || undefined,
      contact_phone: record.contact_phone || undefined,
      contact_email: record.contact_email || undefined,
      contact_wechat: record.contact_wechat || undefined,
      company_name: record.company_name || undefined,
      company_phone: record.company_phone || undefined,
      company_email: record.company_email || undefined,
      contact_department: record.contact_department || undefined,
      contact_person: record.contact_person || undefined,
      contact_address: record.contact_address || undefined,
      website: record.website || undefined,
      country: record.country || undefined,
      hall_no: record.hall_no || undefined,
      booth_no: record.booth_no || undefined,
      booth_type: record.booth_type || undefined,
      booth_area_sqm: record.booth_area_sqm ?? undefined,
      company_id: record.company_id ?? undefined,
      owner_id: record.owner_id ?? undefined
    });
    fetchOpportunityContacts(record.id);
    if (isGroupAdmin && !companies.length) {
      fetchCompanies();
    }
    setCreateOpen(true);
  };

  const handleOrgSelect = (_selectedKeys: Key[], info: any) => {
    const node = info.node as OrgTreeNode;
    if (node.isRoot) {
      setSelectedOrgId(null);
      return;
    }
    if (node.company?.id) {
      setSelectedOrgId(node.company.id);
    }
  };

  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    if (key === "org" || key === "opportunities" || key === "normal" || key === "host") {
      setActiveView(key as ActiveView);
      if (key === "opportunities") {
        setOverviewType("all");
      }
    }
  };

  const viewLabels: Record<ActiveView, string> = {
    org: "组织架构",
    opportunities: "首页",
    normal: "普通商机",
    host: "主场商机"
  };

  const hostFieldKeys: (keyof CreateFormValues)[] = [
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
    "risk_notes"
  ];

  const handleOpportunityFormChange = (changedValues: Partial<CreateFormValues>) => {
    if (changedValues.type && changedValues.type !== "host") {
      const cleared: Partial<CreateFormValues> = {};
      hostFieldKeys.forEach((key) => {
        cleared[key] = undefined;
      });
      createForm.setFieldsValue(cleared);
    }
  };

  const formatExhibitionDateRange = (record: Opportunity) => {
    const start = record.exhibition_start_date;
    const end = record.exhibition_end_date;
    if (start && end) return `${start} ~ ${end}`;
    return start || end || "-";
  };

  const formatExhibitionScale = (record: Opportunity) => {
    const parts = [];
    if (record.booth_count) parts.push(`${record.booth_count}展位`);
    if (record.exhibition_area_sqm) parts.push(`${record.exhibition_area_sqm}㎡`);
    if (record.expected_visitors) parts.push(`${record.expected_visitors}人`);
    return parts.length ? parts.join(" / ") : "-";
  };

  const formatExhibitionVenue = (record: Opportunity) => {
    const parts = [record.venue_name, record.city, record.venue_address].filter(Boolean);
    return parts.length ? parts.join(" · ") : "-";
  };

  const nameColumn: ColumnsType<Opportunity>[number] = {
    title: "商机",
    dataIndex: "name",
    key: "name",
    render: (value: string, record) => (
      <Space direction="vertical" size={0}>
        <Text strong>{value}</Text>
        <Text type="secondary">
          {record.company_id
            ? companyMap.get(record.company_id) || `子公司 #${record.company_id}`
            : GROUP_LABEL}
        </Text>
      </Space>
    )
  };

  const typeColumn: ColumnsType<Opportunity>[number] = {
    title: "类型",
    dataIndex: "type",
    key: "type",
    render: (value: string) => <Tag color="geekblue">{TYPE_LABELS[value] || value}</Tag>
  };

  const statusColumn: ColumnsType<Opportunity>[number] = {
    title: "状态",
    dataIndex: "status",
    key: "status",
    render: (value?: string) => {
      if (!value) return "-";
      return <Tag color={STATUS_COLORS[value] || "default"}>{STATUS_LABELS[value] || value}</Tag>;
    }
  };

  const stageColumn: ColumnsType<Opportunity>[number] = {
    title: "阶段",
    dataIndex: "stage",
    key: "stage",
    render: (value?: string) => {
      if (!value) return "-";
      return <Tag color={STAGE_COLORS[value] || "default"}>{STAGE_LABELS[value] || value}</Tag>;
    }
  };

  const sourceColumn: ColumnsType<Opportunity>[number] = {
    title: "来源",
    dataIndex: "source",
    key: "source",
    render: (value?: string) => value || "-"
  };

  const industryColumn: ColumnsType<Opportunity>[number] = {
    title: "行业",
    dataIndex: "industry",
    key: "industry",
    render: (value?: string) => value || "-"
  };

  const organizerContactColumn: ColumnsType<Opportunity>[number] = {
    title: "主办方 / 联系人",
    key: "contact",
    render: (_, record) => (
      <Space direction="vertical" size={0}>
        <Text>{record.organizer_name || "-"}</Text>
        <Text type="secondary">{record.contact_name || "-"}</Text>
      </Space>
    )
  };

  const organizerColumn: ColumnsType<Opportunity>[number] = {
    title: "主办方",
    dataIndex: "organizer_name",
    key: "organizer_name",
    render: (value?: string) => value || "-"
  };

  const organizerTypeColumn: ColumnsType<Opportunity>[number] = {
    title: "主办方类型",
    dataIndex: "organizer_type",
    key: "organizer_type",
    render: (value?: string) => {
      if (!value) return "-";
      return <Tag color="purple">{ORGANIZER_TYPE_LABELS[value] || value}</Tag>;
    }
  };

  const exhibitionColumn: ColumnsType<Opportunity>[number] = {
    title: "展会名称",
    dataIndex: "exhibition_name",
    key: "exhibition_name",
    render: (value?: string) => value || "-"
  };

  const exhibitionDateColumn: ColumnsType<Opportunity>[number] = {
    title: "展会时间",
    key: "exhibition_dates",
    render: (_, record) => formatExhibitionDateRange(record)
  };

  const venueColumn: ColumnsType<Opportunity>[number] = {
    title: "展馆/地点",
    key: "venue",
    render: (_, record) => formatExhibitionVenue(record)
  };

  const scaleColumn: ColumnsType<Opportunity>[number] = {
    title: "展会规模",
    key: "scale",
    render: (_, record) => formatExhibitionScale(record)
  };

  const budgetColumn: ColumnsType<Opportunity>[number] = {
    title: "预算区间",
    dataIndex: "budget_range",
    key: "budget_range",
    render: (value?: string) => value || "-"
  };

  const contactColumn: ColumnsType<Opportunity>[number] = {
    title: "联系人",
    key: "contact",
    render: (_, record) => (
      <Space direction="vertical" size={0}>
        <Text>{record.contact_name || "-"}</Text>
        <Text type="secondary">{record.contact_title || "-"}</Text>
      </Space>
    )
  };

  const contactInfoColumn: ColumnsType<Opportunity>[number] = {
    title: "联系人",
    key: "contact",
    render: (_, record) => (
      <Space direction="vertical" size={0}>
        <Text>{record.contact_name || "-"}</Text>
        <Text type="secondary">
          {record.contact_phone || record.contact_email || "-"}
        </Text>
      </Space>
    )
  };

  const cityColumn: ColumnsType<Opportunity>[number] = {
    title: "城市",
    dataIndex: "city",
    key: "city",
    render: (value?: string) => value || "-"
  };

  const ownerColumn: ColumnsType<Opportunity>[number] = {
    title: "负责人",
    dataIndex: "owner_id",
    key: "owner_id",
    render: (value?: number) => {
      if (!value) return "-";
      return userMap.get(value) || `#${value}`;
    }
  };

  const updatedColumn: ColumnsType<Opportunity>[number] = {
    title: "更新时间",
    dataIndex: "updated_at",
    key: "updated_at",
    render: (value?: string) => (value ? new Date(value).toLocaleString() : "-")
  };

  const actionColumn: ColumnsType<Opportunity>[number] = {
    title: "操作",
    key: "actions",
    fixed: "right",
    width: 120,
    render: (_, record) => (
      <span className="action-icons">
        <Tooltip title="编辑">
          <Button
            type="text"
            icon={<EditOutlined />}
            aria-label="编辑"
            onClick={() => handleOpenEditOpportunity(record)}
          />
        </Tooltip>
        <Tooltip title="跟进记录">
          <Button
            type="text"
            icon={<MessageOutlined />}
            aria-label="跟进记录"
            onClick={() => handleOpenActivity(record)}
          />
        </Tooltip>
        <Tooltip title="智能中心">
          <Button
            type="text"
            icon={<AiCuteIcon />}
            aria-label="智能中心"
            onClick={() => handleOpenAnalysis(record)}
          />
        </Tooltip>
      </span>
    )
  };

  const allColumns: ColumnsType<Opportunity> = [
    nameColumn,
    typeColumn,
    statusColumn,
    stageColumn,
    sourceColumn,
    organizerContactColumn,
    cityColumn,
    ownerColumn,
    updatedColumn,
    actionColumn
  ];

  const normalColumns: ColumnsType<Opportunity> = [
    nameColumn,
    statusColumn,
    stageColumn,
    sourceColumn,
    industryColumn,
    contactInfoColumn,
    cityColumn,
    ownerColumn,
    updatedColumn,
    actionColumn
  ];

  const hostColumns: ColumnsType<Opportunity> = [
    nameColumn,
    statusColumn,
    stageColumn,
    organizerColumn,
    organizerTypeColumn,
    exhibitionColumn,
    exhibitionDateColumn,
    venueColumn,
    scaleColumn,
    budgetColumn,
    contactColumn,
    cityColumn,
    ownerColumn,
    updatedColumn,
    actionColumn
  ];

  const opportunityColumns =
    activeView === "normal" ? normalColumns : activeView === "host" ? hostColumns : allColumns;

  const userColumns: ColumnsType<User> = [
    {
      title: "姓名",
      dataIndex: "name",
      key: "name",
      render: (value: string) => <Text strong>{value}</Text>
    },
    {
      title: "角色",
      dataIndex: "role",
      key: "role",
      render: (value: string) => USER_ROLE_LABELS[value] || value
    },
    {
      title: "所属公司",
      dataIndex: "company_id",
      key: "company_id",
      render: (value?: number | null) => {
        if (!value) {
          return GROUP_LABEL;
        }
        return companyMap.get(value) || `#${value}`;
      }
    },
    {
      title: "邮箱",
      dataIndex: "email",
      key: "email",
      render: (value?: string | null) => value || "-"
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (value?: string | null) => {
        const label = value ? USER_STATUS_LABELS[value] : "";
        return label ? <Tag color={value === "active" ? "green" : "red"}>{label}</Tag> : "-";
      }
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (value?: string | null) => (value ? new Date(value).toLocaleString() : "-")
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 80,
      render: (_, record) => (
        <Space>
          <Tooltip title="详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              aria-label="详情"
              onClick={() => handleViewUser(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              aria-label="编辑"
              onClick={() => handleOpenUserDrawer(record)}
            />
          </Tooltip>
          <Tooltip title={record.status === "inactive" ? "启用" : "停用"}>
            <Button
              type="text"
              icon={record.status === "inactive" ? <CheckCircleOutlined /> : <StopOutlined />}
              aria-label={record.status === "inactive" ? "启用" : "停用"}
              onClick={() => handleToggleUserStatus(record)}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  const breadcrumbLabel = viewLabels[activeView];
  const tableTitle = activeView === "opportunities" ? "商机列表" : `${breadcrumbLabel}列表`;
  const summaryTypeLabel = activeView === "normal" ? "普通商机" : "主场商机";
  const summaryTypeValue = activeView === "opportunities" ? summary.host : summary.total;
  const headerTitle = activeView === "org" ? "组织架构管理" : "商机管理工作台";
  const headerSubtitle = activeView === "org" ? "公司与员工权限" : "";
  const userInitial = currentUser?.name ? currentUser.name.slice(0, 1) : "U";
  const analysis = analysisData?.analysis || {};
  const analysisContacts = safeArray(analysisData?.contacts ?? analysis?.contacts);
  const analysisSources = safeArray(analysisData?.sources);
  const organizerProfile = analysis.organizer_profile || {};
  const eventProfile = analysis.event_profile || {};
  const customerPersona = analysis.customer_persona || {};
  const hasValue = (value: any) => {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") {
      return Object.values(value).some((item) => {
        if (Array.isArray(item)) return item.length > 0;
        return Boolean(item);
      });
    }
    return Boolean(value);
  };

  const contactStructure = (() => {
    const decisionNode = buildContactNode(
      "决策者",
      ["董事长", "总经理", "总裁", "CEO", "负责人", "董事", "主席"],
      customerPersona.decision_makers
    );
    const procurementNode = buildContactNode(
      "采购",
      ["采购", "供应链"],
      customerPersona.primary_roles?.filter?.((item: any) => String(item).includes("采购"))
    );
    const financeNode = buildContactNode("财务", ["财务", "会计", "资金"]);
    const marketingNode = buildContactNode("市场主管", ["市场", "营销", "推广"]);
    const brandNode = buildContactNode("品牌事务对接", ["品牌", "公关", "传播"]);
    const hasAny =
      decisionNode.names.length ||
      procurementNode.names.length ||
      financeNode.names.length ||
      marketingNode.names.length ||
      brandNode.names.length;
    return {
      hasAny,
      top: decisionNode,
      middle: [procurementNode],
      bottom: [financeNode, marketingNode, brandNode]
    };
  })();

  const userMenuItems = [
    {
      key: "password",
      icon: <KeyOutlined />,
      label: "修改密码",
      onClick: handleOpenPasswordModal
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "退出登录",
      onClick: handleLogout
    }
  ];

  const navigationItems = [
    { key: "opportunities", label: "首页" },
    canManageOrg ? { key: "org", label: "组织架构" } : null,
    { key: "normal", label: "普通商机" },
    { key: "host", label: "主场商机" }
  ].filter(Boolean) as { key: string; label: string }[];

  const renderOrgTitle = (node: OrgTreeNode) => {
    if (node.isRoot) {
      return (
        <div className="org-tree-node">
          <span className="org-tree-title">{node.title}</span>
          {isGroupAdmin && (
            <Space size="small" className="org-tree-actions">
              <Tooltip title="新增子公司">
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  aria-label="新增子公司"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleOpenCompanyDrawer();
                  }}
                />
              </Tooltip>
            </Space>
          )}
        </div>
      );
    }

    const company = node.company;
    if (!company) {
      return <span className="org-tree-title">{node.title}</span>;
    }

    const statusLabel =
      company.status && COMPANY_STATUS_LABELS[company.status]
        ? COMPANY_STATUS_LABELS[company.status]
        : company.status;

    return (
      <div className="org-tree-node">
        <span className="org-tree-title">{company.name}</span>
        {company.status === "inactive" && (
          <Tag className="org-tree-status" color="red">
            {statusLabel || "停用"}
          </Tag>
        )}
        <Space size="small" className="org-tree-actions">
          {isGroupAdmin && (
            <>
              <Tooltip title="新增子公司">
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  aria-label="新增子公司"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleOpenCompanyDrawer(undefined, company.id);
                  }}
                />
              </Tooltip>
              <Tooltip title="编辑">
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  aria-label="编辑"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleOpenCompanyDrawer(company);
                  }}
                />
              </Tooltip>
              <Tooltip title="删除">
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label="删除"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeleteCompany(company);
                  }}
                />
              </Tooltip>
            </>
          )}
        </Space>
      </div>
    );
  };

  return (
    <Layout className="app-layout">
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} trigger={null}>
        <div className="logo-bar">
          <div className="logo-text">{collapsed ? "Pico" : "Pico商机管理"}</div>
          <Tooltip title={collapsed ? "展开菜单" : "收起菜单"}>
            <Button
              className="logo-toggle"
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              aria-label={collapsed ? "展开菜单" : "收起菜单"}
              onClick={() => setCollapsed((prev) => !prev)}
            />
          </Tooltip>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeView]}
          onClick={handleMenuClick}
          items={navigationItems}
        />
      </Sider>
      <Layout>
        <Content className="app-content">
          <>
          {activeView === "org" ? (
            <div className="org-layout">
              <Card className="table-card" title="组织架构树" loading={companyLoading}>
                {orgTreeData.length ? (
                  <Tree
                    showLine={{ showLeafIcon: false }}
                    defaultExpandAll
                    blockNode
                    treeData={orgTreeData}
                    titleRender={(node) => renderOrgTitle(node as OrgTreeNode)}
                    onSelect={handleOrgSelect}
                  />
                ) : (
                  <Text type="secondary">暂无组织架构数据。</Text>
                )}
              </Card>
              <Card
                className="table-card"
                title="员工列表"
                extra={
                  <Tooltip title="新建员工">
                    <Button
                      type="primary"
                      icon={<UserAddOutlined />}
                      aria-label="新建员工"
                      onClick={() => handleOpenUserDrawer()}
                    />
                  </Tooltip>
                }
              >
                <Form
                  form={userFilterForm}
                  layout="vertical"
                  onFinish={handleUserFilter}
                  style={{ marginBottom: 12 }}
                >
                  <Row gutter={[16, 8]}>
                    <Col xs={24} sm={12} md={6}>
                      <Form.Item name="name" label="姓名">
                        <Input placeholder="姓名" allowClear />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Form.Item name="role" label="角色">
                        <Select allowClear placeholder="全部">
                          {roleOptions.map(([value, label]) => (
                            <Option key={value} value={value}>
                              {label}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    {isGroupAdmin && (
                      <Col xs={24} sm={12} md={6}>
                        <Form.Item name="company_id" label="所属公司">
                          <Select allowClear placeholder="全部">
                            <Option value={0}>{GROUP_LABEL}</Option>
                            {companies.map((company) => (
                              <Option key={company.id} value={company.id}>
                                {company.name}
                              </Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                    )}
                    <Col xs={24} sm={12} md={6}>
                      <Form.Item name="status" label="状态">
                        <Select allowClear placeholder="全部">
                          <Option value="active">启用</Option>
                          <Option value="inactive">停用</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Space>
                    <Tooltip title="应用筛选">
                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={userLoading}
                        icon={<FilterOutlined />}
                        aria-label="应用筛选"
                      />
                    </Tooltip>
                    <Tooltip title="重置">
                      <Button
                        icon={<UndoOutlined />}
                        aria-label="重置"
                        onClick={handleUserReset}
                      />
                    </Tooltip>
                  </Space>
                </Form>
                <Table
                  rowKey="id"
                  columns={userColumns}
                  dataSource={filteredUsers}
                  loading={userLoading}
                  scroll={{ x: "max-content" }}
                  pagination={{ pageSize: 8 }}
                />
              </Card>
            </div>
          ) : (
            <>
              {activeView === "opportunities" && (
                <Row gutter={[16, 16]} className="stat-grid">
                  <Col xs={24} sm={12} md={6}>
                    <Card>
                      <Statistic title="总商机" value={summary.total} />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Card>
                      <Statistic title="有效商机" value={summary.valid} />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Card>
                      <Statistic title="跟进中" value={summary.in_progress} />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Card>
                      <Statistic title={summaryTypeLabel} value={summaryTypeValue} />
                    </Card>
                  </Col>
                </Row>
              )}

              {activeView !== "opportunities" && (
                <>
                  <Card className="filter-card">
                    <Form form={filterForm} layout="vertical" onFinish={() => fetchOpportunities()}>
                      <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12} md={6}>
                          <Form.Item name="name" label="商机名称">
                            <Search
                              placeholder="关键词"
                              allowClear
                              onSearch={() => fetchOpportunities()}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                          <Form.Item name="status" label="状态">
                            <Select allowClear placeholder="全部">
                              <Option value="new">新建</Option>
                              <Option value="assigned">已分配</Option>
                              <Option value="in_progress">跟进中</Option>
                              <Option value="valid">有效</Option>
                              <Option value="invalid">无效</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                          <Form.Item name="stage" label="阶段">
                            <Select allowClear placeholder="全部">
                              <Option value="cold">冷淡</Option>
                              <Option value="interest">意向</Option>
                              <Option value="need_defined">需求明确</Option>
                              <Option value="bid_preparing">投标准备</Option>
                              <Option value="ready_for_handoff">待移交</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                          <Form.Item name="city" label="城市">
                            <Input placeholder="城市" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                          <Form.Item name="industry" label="行业">
                            <Input placeholder="行业" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                          <Form.Item name="owner_id" label="负责人">
                            <Select
                              allowClear
                              showSearch
                              placeholder="搜索负责人名称"
                              optionFilterProp="label"
                              filterOption={(input, option) =>
                                String(option?.label ?? "")
                                  .toLowerCase()
                                  .includes(input.toLowerCase())
                              }
                            >
                              {users.map((user) => (
                                <Option key={user.id} value={user.id}>
                                  {user.name}
                                </Option>
                              ))}
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                          <Form.Item name="company_id" label={`子公司（${GROUP_LABEL}）`}>
                            <Select
                              allowClear
                              showSearch
                              placeholder="搜索子公司名称"
                              optionFilterProp="label"
                              filterOption={(input, option) =>
                                String(option?.label ?? "")
                                  .toLowerCase()
                                  .includes(input.toLowerCase())
                              }
                              options={companies.map((company) => ({
                                value: company.id,
                                label: company.name
                              }))}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                          <Form.Item name="source" label="来源">
                            <Input placeholder="来源" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Form>
                  </Card>

                  <Card
                    className="table-card"
                    title={tableTitle}
                    extra={
                      currentUser ? (
                        <Space size="middle">
                          <Tooltip title="导入 Excel">
                            <Button
                              shape="circle"
                              size="large"
                              icon={<UploadOutlined />}
                              onClick={handleOpenImport}
                            />
                          </Tooltip>
                          <Tooltip title="新建商机">
                            <Button
                              type="primary"
                              shape="circle"
                              size="large"
                              icon={<PlusOutlined />}
                              onClick={handleOpenCreate}
                              aria-label="新建商机"
                            />
                          </Tooltip>
                        </Space>
                      ) : null
                    }
                  >
                    <Table
                      rowKey="id"
                      columns={opportunityColumns}
                      dataSource={opportunities}
                      loading={loading}
                      scroll={{ x: "max-content" }}
                      pagination={{
                        ...opportunityPagination,
                        pageSizeOptions: ["10", "20", "50", "100"],
                        showSizeChanger: true,
                        showTotal: (total: number) => `共 ${total} 条`
                      }}
                      onRow={(record) => ({
                        onDoubleClick: () => handleOpenEditOpportunity(record)
                      })}
                      onChange={handleOpportunityTableChange}
                    />
                  </Card>
                </>
              )}
            </>
          )}
          </>
        </Content>
      </Layout>

      <Drawer
        title={editingOpportunity ? "编辑商机" : "新建商机"}
        width={1040}
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditingOpportunity(null);
          createForm.resetFields();
        }}
        footer={
          <Space>
            <Tooltip title="取消">
              <Button
                icon={<CloseOutlined />}
                aria-label="取消"
                onClick={() => {
                  setCreateOpen(false);
                  setEditingOpportunity(null);
                  createForm.resetFields();
                }}
              />
            </Tooltip>
            <Tooltip title="保存">
              <Button
                type="primary"
                icon={<SaveOutlined />}
                aria-label="保存"
                loading={createLoading}
                onClick={handleCreate}
              />
            </Tooltip>
          </Space>
        }
      >
        <Form layout="vertical" form={createForm} onValuesChange={handleOpportunityFormChange}>
          <Form.Item name="name" label="商机名称" rules={[{ required: true, message: "必填" }]}>
            <Input placeholder="商机名称" />
          </Form.Item>
          <Form.Item name="type" label="商机类型" rules={[{ required: true, message: "必填" }]}>
            <Select placeholder="请选择类型">
              <Option value="normal">普通商机</Option>
              <Option value="host">主场商机</Option>
            </Select>
          </Form.Item>
          <Form.Item name="source" label="来源" rules={[{ required: true, message: "必填" }]}>
            <Input placeholder="来源" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="city" label="城市">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="industry" label="行业">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="状态" initialValue="new">
                <Select>
                  <Option value="new">新建</Option>
                  <Option value="assigned">已分配</Option>
                  <Option value="in_progress">跟进中</Option>
                  <Option value="valid">有效</Option>
                  <Option value="invalid">无效</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="stage" label="阶段" initialValue="cold">
                <Select>
                  <Option value="cold">冷淡</Option>
                  <Option value="interest">意向</Option>
                  <Option value="need_defined">需求明确</Option>
                  <Option value="bid_preparing">投标准备</Option>
                  <Option value="ready_for_handoff">待移交</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Divider>客户基本信息</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="company_name" label="公司名称">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contact_department" label="联系部门">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contact_person" label="联系人">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="company_phone" label="电话">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="company_email" label="邮箱">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="website" label="网址">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="contact_address" label="联系地址">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="country" label="国家">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="hall_no" label="展馆号">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="booth_no" label="展位号">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="booth_type" label="展位类型">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="booth_area_sqm" label="展位面积(㎡)">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item shouldUpdate={(prev, cur) => prev.type !== cur.type} noStyle>
            {({ getFieldValue }) => {
              const type = getFieldValue("type");
              if (type !== "host") {
                return (
                  <>
                    <Divider>主场字段</Divider>
                    <Text type="secondary">普通商机无需填写展会信息。</Text>
                  </>
                );
              }
              return (
                <>
                  <Divider>主场字段</Divider>
                  <Form.Item name="organizer_name" label="主办方名称">
                    <Input />
                  </Form.Item>
                  <Form.Item name="organizer_type" label="主办方类型">
                    <Select allowClear>
                      <Option value="foreign">外资</Option>
                      <Option value="state_owned">国企</Option>
                      <Option value="gov_joint">政企合办</Option>
                      <Option value="government">政府类</Option>
                      <Option value="commercial">纯商业</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="exhibition_name" label="展会名称">
                    <Input />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="exhibition_start_date" label="展会开始日期">
                        <DatePicker style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="exhibition_end_date" label="展会结束日期">
                        <DatePicker style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="venue_name" label="展馆名称">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="venue_address" label="展馆地址">
                        <Input />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="booth_count" label="展位数">
                        <InputNumber min={0} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="exhibition_area_sqm" label="展览面积(㎡)">
                        <InputNumber min={0} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="expected_visitors" label="预计观众数">
                        <InputNumber min={0} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="exhibition_theme" label="展会主题">
                    <Input />
                  </Form.Item>
                  <Form.Item name="budget_range" label="预算区间">
                    <Input placeholder="例如 50-80 万" />
                  </Form.Item>
                  <Form.Item name="risk_notes" label="风险/备注">
                    <Input.TextArea rows={3} />
                  </Form.Item>
                </>
              );
            }}
          </Form.Item>
          <Divider>联系人列表</Divider>
          <Form.Item shouldUpdate>
            {() => {
              const contactRows = createForm.getFieldValue("contacts") || [];
              const updateContact = (index: number, key: string, value: any) => {
                const next = [...contactRows];
                next[index] = { ...next[index], [key]: value };
                createForm.setFieldsValue({ contacts: next });
              };
              const addContact = () => {
                const next = [
                  ...contactRows,
                  { name: "", role: undefined, title: "", phone: "", email: "", wechat: "" }
                ];
                createForm.setFieldsValue({ contacts: next });
              };
              const removeContact = (index: number) => {
                const next = contactRows.filter((_: any, idx: number) => idx !== index);
                createForm.setFieldsValue({ contacts: next });
              };
              const columns = [
                {
                  title: "姓名",
                  dataIndex: "name",
                  render: (_: any, record: any, index: number) => (
                    <Input
                      value={record.name}
                      placeholder="姓名"
                      onChange={(e) => updateContact(index, "name", e.target.value)}
                    />
                  )
                },
                {
                  title: "组织角色",
                  dataIndex: "role",
                  render: (_: any, record: any, index: number) => (
                    <Select
                      allowClear
                      placeholder="选择角色"
                      value={record.role}
                      onChange={(value) => updateContact(index, "role", value)}
                      style={{ width: "100%" }}
                    >
                      {CONTACT_ROLE_OPTIONS.map((option) => (
                        <Option key={option.value} value={option.value}>
                          {option.label}
                        </Option>
                      ))}
                    </Select>
                  )
                },
                {
                  title: "职位",
                  dataIndex: "title",
                  render: (_: any, record: any, index: number) => (
                    <Input
                      value={record.title}
                      placeholder="职位"
                      onChange={(e) => updateContact(index, "title", e.target.value)}
                    />
                  )
                },
                {
                  title: "电话",
                  dataIndex: "phone",
                  render: (_: any, record: any, index: number) => (
                    <Input
                      value={record.phone}
                      placeholder="电话"
                      onChange={(e) => updateContact(index, "phone", e.target.value)}
                    />
                  )
                },
                {
                  title: "邮箱",
                  dataIndex: "email",
                  render: (_: any, record: any, index: number) => (
                    <Input
                      value={record.email}
                      placeholder="邮箱"
                      onChange={(e) => updateContact(index, "email", e.target.value)}
                    />
                  )
                },
                {
                  title: "微信",
                  dataIndex: "wechat",
                  render: (_: any, record: any, index: number) => (
                    <Input
                      value={record.wechat}
                      placeholder="微信"
                      onChange={(e) => updateContact(index, "wechat", e.target.value)}
                    />
                  )
                },
                {
                  title: "操作",
                  dataIndex: "actions",
                  width: 80,
                  render: (_: any, _record: any, index: number) => (
                    <Tooltip title="删除">
                      <Button
                        icon={<CloseOutlined />}
                        aria-label="删除"
                        onClick={() => removeContact(index)}
                      />
                    </Tooltip>
                  )
                }
              ];
              return (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <Button type="dashed" icon={<PlusOutlined />} onClick={addContact}>
                      新增联系人
                    </Button>
                  </div>
                  <Table
                    rowKey={(_, index) => String(index)}
                    columns={columns as any}
                    dataSource={contactRows}
                    pagination={false}
                    locale={{ emptyText: "暂无联系人，点击上方按钮添加" }}
                    size="small"
                  />
                </>
              );
            }}
          </Form.Item>
          <Divider>联系人组织架构</Divider>
          <Form.Item shouldUpdate>
            {() => {
              const contactList = (createForm.getFieldValue("contacts") || []).filter(
                (item: any) => item?.name || item?.title
              );
              const structure = buildContactStructureFromContacts(contactList);
              return (
                <div className="contact-structure">
                  <div className="contact-structure-row contact-structure-top">
                    <div className="contact-node contact-node-top">
                      <span className="contact-role">{structure.top.label}</span>
                      <span className="contact-names">
                        {structure.top.names.length
                          ? structure.top.names.join(" / ")
                          : "待补充"}
                      </span>
                    </div>
                  </div>
                  <div className="contact-structure-link" />
                  <div className="contact-structure-row contact-structure-middle">
                    {structure.middle.map((node) => (
                      <div key={node.label} className="contact-node">
                        <span className="contact-role">{node.label}</span>
                        <span className="contact-names">
                          {node.names.length ? node.names.join(" / ") : "待补充"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="contact-structure-link" />
                  <div className="contact-structure-row contact-structure-branch">
                    {structure.bottom.map((node) => (
                      <div key={node.label} className="contact-node">
                        <span className="contact-role">{node.label}</span>
                        <span className="contact-names">
                          {node.names.length ? node.names.join(" / ") : "待补充"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {!structure.hasAny && (
                    <div className="contact-structure-empty">暂无联系人信息，请补充</div>
                  )}
                </div>
              );
            }}
          </Form.Item>
          <Divider>{GROUP_LABEL}专用</Divider>
          <Form.Item
            name="company_id"
            label="子公司"
            rules={isGroupAdmin ? [{ required: true, message: "请选择子公司" }] : []}
          >
            <Select
              showSearch
              allowClear
              placeholder={isGroupAdmin ? "请选择子公司" : `仅${GROUP_LABEL}管理员可设置`}
              optionFilterProp="children"
              disabled={!isGroupAdmin}
            >
              {companies.map((company) => (
                <Option key={company.id} value={company.id}>
                  {company.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={companyEditing ? "编辑公司" : "新建公司"}
        width={480}
        open={companyDrawerOpen}
        onClose={() => {
          setCompanyDrawerOpen(false);
          setCompanyEditing(null);
        }}
        footer={
          <Space>
            <Tooltip title="取消">
              <Button
                icon={<CloseOutlined />}
                aria-label="取消"
                onClick={() => {
                  setCompanyDrawerOpen(false);
                  setCompanyEditing(null);
                }}
              />
            </Tooltip>
            <Tooltip title="保存">
              <Button
                type="primary"
                icon={<SaveOutlined />}
                aria-label="保存"
                loading={companySaving}
                onClick={handleCreateCompany}
              />
            </Tooltip>
          </Space>
        }
      >
        <Form layout="vertical" form={companyForm} initialValues={{ status: "active" }}>
          <Form.Item name="name" label="公司名称" rules={[{ required: true, message: "必填" }]}>
            <Input placeholder="公司名称" />
          </Form.Item>
          <Form.Item name="code" label="公司编码">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="parent_id" label="上级公司">
            <Select allowClear showSearch placeholder={`${GROUP_LABEL}根公司`} optionFilterProp="children">
              <Option value={0}>{GROUP_LABEL}根公司</Option>
              {companies
                .filter((company) => company.id !== companyEditing?.id)
                .map((company) => (
                  <Option key={company.id} value={company.id}>
                    {company.name}
                  </Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={userEditing ? "编辑员工" : "新建员工"}
        width={500}
        open={userDrawerOpen}
        onClose={() => {
          setUserDrawerOpen(false);
          setUserEditing(null);
        }}
        footer={
          <Space>
            <Tooltip title="取消">
              <Button
                icon={<CloseOutlined />}
                aria-label="取消"
                onClick={() => {
                  setUserDrawerOpen(false);
                  setUserEditing(null);
                }}
              />
            </Tooltip>
            <Tooltip title="保存">
              <Button
                type="primary"
                icon={<SaveOutlined />}
                aria-label="保存"
                loading={userSaving}
                onClick={handleCreateUser}
              />
            </Tooltip>
          </Space>
        }
      >
        <Form layout="vertical" form={userForm} initialValues={{ status: "active" }}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: "必填" }]}>
            <Input placeholder="姓名" />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item
            name="password"
            label="登录密码"
            extra={userEditing ? "留空则不修改密码" : "默认密码为 88888888"}
          >
            <Input.Password placeholder={userEditing ? "留空保持原密码" : "默认 88888888"} />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: "必填" }]}>
            <Select placeholder="请选择角色">
              {roleOptions.map(([value, label]) => (
                <Option key={value} value={value}>
                  {label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item shouldUpdate={(prev, cur) => prev.role !== cur.role} noStyle>
            {({ getFieldValue }) => {
              const role = getFieldValue("role");
              const requireCompany = role && role !== "group_admin";
              const companyOptions = isSubAdmin
                ? companies.filter((company) => company.id === currentUser?.company_id)
                : companies;
              const placeholder = isSubAdmin
                ? "固定为本公司"
                : requireCompany
                  ? "请选择公司"
                  : `${GROUP_LABEL}管理员可不选`;
              return (
                <Form.Item
                  name="company_id"
                  label="所属公司"
                  rules={requireCompany ? [{ required: true, message: "必填" }] : []}
                >
                  <Select
                    allowClear={!isSubAdmin}
                    disabled={isSubAdmin}
                    showSearch
                    placeholder={placeholder}
                    optionFilterProp="children"
                  >
                    {companyOptions.map((company) => (
                      <Option key={company.id} value={company.id}>
                        {company.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title="员工详情"
        width={420}
        open={userDetailOpen}
        onClose={() => {
          setUserDetailOpen(false);
          setUserDetail(null);
        }}
      >
        {userDetail ? (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="姓名">{userDetail.name}</Descriptions.Item>
            <Descriptions.Item label="角色">
              {USER_ROLE_LABELS[userDetail.role] || userDetail.role}
            </Descriptions.Item>
            <Descriptions.Item label="所属公司">
              {userDetail.company_id ? companyMap.get(userDetail.company_id) || `#${userDetail.company_id}` : GROUP_LABEL}
            </Descriptions.Item>
            <Descriptions.Item label="邮箱">{userDetail.email || "-"}</Descriptions.Item>
            <Descriptions.Item label="状态">
              {userDetail.status ? USER_STATUS_LABELS[userDetail.status] || userDetail.status : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {userDetail.created_at ? new Date(userDetail.created_at).toLocaleString() : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="用户ID">{userDetail.id}</Descriptions.Item>
          </Descriptions>
        ) : (
          <Text type="secondary">暂无员工信息。</Text>
        )}
      </Drawer>

      <Modal
        title="修改密码"
        open={passwordModalOpen}
        onCancel={() => {
          setPasswordModalOpen(false);
          passwordForm.resetFields();
        }}
        footer={
          <Space>
            <Tooltip title="取消">
              <Button
                icon={<CloseOutlined />}
                aria-label="取消"
                onClick={() => {
                  setPasswordModalOpen(false);
                  passwordForm.resetFields();
                }}
              />
            </Tooltip>
            <Tooltip title="保存">
              <Button
                type="primary"
                icon={<SaveOutlined />}
                aria-label="保存"
                loading={passwordLoading}
                onClick={handleChangePassword}
              />
            </Tooltip>
          </Space>
        }
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="current_password"
            label="当前密码"
            rules={[{ required: true, message: "请输入当前密码" }]}
          >
            <Input.Password placeholder="当前密码" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[{ required: true, message: "请输入新密码" }]}
          >
            <Input.Password placeholder="新密码" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认新密码"
            dependencies={["new_password"]}
            rules={[
              { required: true, message: "请再次输入新密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("new_password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                }
              })
            ]}
          >
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Excel导入"
        open={importOpen}
        onCancel={() => {
          setImportOpen(false);
          setImportSheets([]);
          setUploadedFilename(null);
          importForm.resetFields();
        }}
        footer={
          <Space>
            <Button
              onClick={() => {
                setImportOpen(false);
                setImportSheets([]);
                setUploadedFilename(null);
                importForm.resetFields();
              }}
            >
              取消
            </Button>
            <Button type="primary" loading={importLoading} onClick={handleImportExcel}>
              导入
            </Button>
          </Space>
        }
      >
        <Form form={importForm} layout="vertical">
          <Form.Item label="上传Excel">
            <Upload
              accept=".xlsx"
              maxCount={1}
              beforeUpload={handleUploadExcel}
              showUploadList={false}
            >
              <Button loading={uploadLoading}>选择文件</Button>
            </Upload>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                {uploadedFilename ? `已上传：${uploadedFilename}` : `默认文件：${DEFAULT_IMPORT_FILE}`}
              </Text>
            </div>
          </Form.Item>
          <Form.Item
            name="filename"
            label="文件名"
            rules={[{ required: true, message: "请上传文件" }]}
          >
            <Input placeholder="上传后自动填充" />
          </Form.Item>
          <Form.Item
            name="sheet"
            label="工作表"
            rules={[{ required: true, message: "请选择工作表" }]}
          >
            <Select placeholder="请选择工作表" allowClear>
              {importSheets.map((sheet) => (
                <Option key={sheet} value={sheet}>
                  {sheet}
                </Option>
              ))}
            </Select>
          </Form.Item>
          {isGroupAdmin ? (
            <Form.Item
              name="company_id"
              label="导入到公司"
              rules={[
                {
                  validator: (_, value) => {
                    if (value === 0 || value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("请选择公司"));
                  }
                }
              ]}
            >
              <Select showSearch optionFilterProp="children" placeholder="请选择公司">
                <Option value={0}>{GROUP_LABEL}</Option>
                {companies.map((company) => (
                  <Option key={company.id} value={company.id}>
                    {company.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          ) : (
            <Text type="secondary">将导入到当前账号所属公司。</Text>
          )}
        </Form>
      </Modal>

      <Drawer
        title="跟进记录"
        width={560}
        open={activityOpen}
        onClose={() => {
          setActivityOpen(false);
          setSelectedOpportunity(null);
          setActivities([]);
          setCommentHtml("");
          if (commentRef.current) {
            commentRef.current.innerHTML = "";
          }
        }}
      >
        {selectedOpportunity ? (
          <>
            <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="商机">{selectedOpportunity.name}</Descriptions.Item>
              <Descriptions.Item label="类型">
                {TYPE_LABELS[selectedOpportunity.type] || selectedOpportunity.type}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {STATUS_LABELS[selectedOpportunity.status || ""] || selectedOpportunity.status}
              </Descriptions.Item>
              <Descriptions.Item label="阶段">
                {STAGE_LABELS[selectedOpportunity.stage || ""] || selectedOpportunity.stage}
              </Descriptions.Item>
              <Descriptions.Item label="来源">{selectedOpportunity.source}</Descriptions.Item>
              {selectedOpportunity.type === "host" && (
                <>
                  <Descriptions.Item label="展会名称">
                    {selectedOpportunity.exhibition_name || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="展会时间">
                    {formatExhibitionDateRange(selectedOpportunity)}
                  </Descriptions.Item>
                  <Descriptions.Item label="展馆/地点">
                    {formatExhibitionVenue(selectedOpportunity)}
                  </Descriptions.Item>
                  <Descriptions.Item label="展会规模">
                    {formatExhibitionScale(selectedOpportunity)}
                  </Descriptions.Item>
                  <Descriptions.Item label="展会主题">
                    {selectedOpportunity.exhibition_theme || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="预算区间">
                    {selectedOpportunity.budget_range || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="风险/备注">
                    {selectedOpportunity.risk_notes || "-"}
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
            <Card size="small" title="新增跟进" style={{ marginBottom: 16 }}>
              <div className="activity-toolbar">
                <Tooltip title="加粗">
                  <Button
                    icon={<BoldOutlined />}
                    aria-label="加粗"
                    onClick={() => applyFormat("bold")}
                  />
                </Tooltip>
                <Tooltip title="斜体">
                  <Button
                    icon={<ItalicOutlined />}
                    aria-label="斜体"
                    onClick={() => applyFormat("italic")}
                  />
                </Tooltip>
                <Tooltip title="下划线">
                  <Button
                    icon={<UnderlineOutlined />}
                    aria-label="下划线"
                    onClick={() => applyFormat("underline")}
                  />
                </Tooltip>
                <Tooltip title="无序列表">
                  <Button
                    icon={<UnorderedListOutlined />}
                    aria-label="无序列表"
                    onClick={() => applyFormat("insertUnorderedList")}
                  />
                </Tooltip>
                <Tooltip title="有序列表">
                  <Button
                    icon={<OrderedListOutlined />}
                    aria-label="有序列表"
                    onClick={() => applyFormat("insertOrderedList")}
                  />
                </Tooltip>
                <Tooltip title="插入链接">
                  <Button
                    icon={<LinkOutlined />}
                    aria-label="插入链接"
                    onClick={() => {
                      const url = window.prompt("链接地址");
                      if (url) {
                        applyFormat("createLink", url);
                      }
                    }}
                  />
                </Tooltip>
                <Tooltip title="清空">
                  <Button
                    icon={<ClearOutlined />}
                    aria-label="清空"
                    onClick={() => {
                      if (commentRef.current) {
                        commentRef.current.innerHTML = "";
                      }
                      setCommentHtml("");
                    }}
                  />
                </Tooltip>
              </div>
              <div
                className="activity-editor"
                contentEditable
                ref={commentRef}
                onInput={syncComment}
                suppressContentEditableWarning
                data-placeholder="输入跟进内容..."
              />
              <Tooltip title="保存跟进">
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  aria-label="保存跟进"
                  onClick={handleAddActivity}
                  loading={activityLoading}
                />
              </Tooltip>
            </Card>
            <Card size="small" title="跟进时间线" loading={activityLoading}>
              <List
                dataSource={activities}
                locale={{ emptyText: "暂无记录" }}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={`跟进记录 · ${item.created_at ? new Date(item.created_at).toLocaleString() : "-"}`}
                      description={
                        item.result ? (
                          <div
                            className="activity-content"
                            dangerouslySetInnerHTML={{ __html: item.result }}
                          />
                        ) : (
                          "-"
                        )
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          </>
        ) : (
          <Text type="secondary">请选择一条商机查看跟进记录。</Text>
        )}
      </Drawer>

      <Drawer
        title="客户画像分析"
        width={720}
        open={analysisOpen}
        onClose={() => {
          setAnalysisOpen(false);
          setAnalysisTarget(null);
          setAnalysisData(null);
          setAnalysisFetching(false);
        }}
      >
        {analysisTarget ? (
          <>
            <Space style={{ marginBottom: 16 }}>
              <Text strong>{analysisTarget.name}</Text>
              <Text type="secondary">{analysisTarget.exhibition_name || analysisTarget.organizer_name || ""}</Text>
              <Tooltip title={analysisData ? "重新分析" : "开始分析"}>
                <Button
                  type="primary"
                  icon={<IdcardOutlined />}
                  aria-label={analysisData ? "重新分析" : "开始分析"}
                  loading={analysisLoading}
                  onClick={() => runAnalysis(analysisTarget)}
                />
              </Tooltip>
              <Tooltip title="补充到表单">
                <Button
                  icon={<SaveOutlined />}
                  aria-label="补充到表单"
                  onClick={applyAnalysisToForm}
                />
              </Tooltip>
            </Space>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="商机类型">
                {TYPE_LABELS[analysisTarget.type] || analysisTarget.type}
              </Descriptions.Item>
              <Descriptions.Item label="行业">
                {analysisTarget.industry || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="城市">{analysisTarget.city || "-"}</Descriptions.Item>
              <Descriptions.Item label="来源">{analysisTarget.source || "-"}</Descriptions.Item>
              {analysisTarget.organizer_name && (
                <Descriptions.Item label="主办方">
                  {analysisTarget.organizer_name}
                </Descriptions.Item>
              )}
              {analysisTarget.exhibition_name && (
                <Descriptions.Item label="展会名称">
                  {analysisTarget.exhibition_name}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="更新时间">
                {analysisData?.updated_at ? new Date(analysisData.updated_at).toLocaleString() : "-"}
              </Descriptions.Item>
            </Descriptions>
            <Card size="small" title="客户基本信息" style={{ marginBottom: 16 }}>
              <Descriptions bordered size="small" column={4}>
                <Descriptions.Item label="公司名称">
                  {renderTextValue(analysisTarget.company_name)}
                </Descriptions.Item>
                <Descriptions.Item label="电话">
                  {renderTextValue(analysisTarget.company_phone)}
                </Descriptions.Item>
                <Descriptions.Item label="邮箱">
                  {renderTextValue(analysisTarget.company_email)}
                </Descriptions.Item>
                <Descriptions.Item label="联系部门">
                  {renderTextValue(analysisTarget.contact_department)}
                </Descriptions.Item>
                <Descriptions.Item label="联系人">
                  {renderTextValue(analysisTarget.contact_person || analysisTarget.contact_name)}
                </Descriptions.Item>
                <Descriptions.Item label="联系地址">
                  {renderTextValue(analysisTarget.contact_address)}
                </Descriptions.Item>
                <Descriptions.Item label="网址">
                  {renderTextValue(analysisTarget.website)}
                </Descriptions.Item>
                <Descriptions.Item label="国家">
                  {renderTextValue(analysisTarget.country)}
                </Descriptions.Item>
                <Descriptions.Item label="展馆号">
                  {renderTextValue(analysisTarget.hall_no)}
                </Descriptions.Item>
                <Descriptions.Item label="展位号">
                  {renderTextValue(analysisTarget.booth_no)}
                </Descriptions.Item>
                <Descriptions.Item label="展位类型">
                  {renderTextValue(analysisTarget.booth_type)}
                </Descriptions.Item>
                <Descriptions.Item label="展位面积">
                  {analysisTarget.booth_area_sqm ? `${analysisTarget.booth_area_sqm}㎡` : "-"}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {analysisFetching && !analysisData && (
              <Text type="secondary">正在加载分析结果...</Text>
            )}

            {!analysisFetching && analysisLoading && !analysisData && (
              <Text type="secondary">正在生成分析，请稍候...</Text>
            )}

            {!analysisFetching && !analysisLoading && !analysisData && (
              <Text type="secondary">暂无分析，点击上方按钮生成。</Text>
            )}

            {analysisData && (
              <>
                {hasValue(organizerProfile) && (
                  <Card size="small" title="主办方画像" style={{ marginBottom: 16 }}>
                    <Descriptions bordered size="small" column={1}>
                      <Descriptions.Item label="背景">
                        {renderTextValue(organizerProfile.background)}
                      </Descriptions.Item>
                      <Descriptions.Item label="业务范围">
                        {renderTextValue(organizerProfile.business_scope)}
                      </Descriptions.Item>
                      <Descriptions.Item label="规模">
                        {renderTextValue(organizerProfile.scale)}
                      </Descriptions.Item>
                      <Descriptions.Item label="地区">
                        {renderTagList(organizerProfile.locations)}
                      </Descriptions.Item>
                      <Descriptions.Item label="官网">
                        {renderTagList(organizerProfile.official_sites)}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                )}

                {hasValue(eventProfile) && (
                  <Card size="small" title="展会画像" style={{ marginBottom: 16 }}>
                    <Descriptions bordered size="small" column={1}>
                      <Descriptions.Item label="主题">
                        {renderTextValue(eventProfile.theme)}
                      </Descriptions.Item>
                      <Descriptions.Item label="时间">
                        {renderTextValue(eventProfile.time)}
                      </Descriptions.Item>
                      <Descriptions.Item label="地点">
                        {renderTextValue(eventProfile.venue)}
                      </Descriptions.Item>
                      <Descriptions.Item label="规模">
                        {renderTextValue(eventProfile.scale)}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                )}

                <Card size="small" title="客户画像" style={{ marginBottom: 16 }}>
                  <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="核心角色">
                      {renderTagList(customerPersona.primary_roles)}
                    </Descriptions.Item>
                    <Descriptions.Item label="关键决策者">
                      {renderTagList(customerPersona.decision_makers)}
                    </Descriptions.Item>
                    <Descriptions.Item label="目标">
                      {renderTagList(customerPersona.goals)}
                    </Descriptions.Item>
                    <Descriptions.Item label="痛点">
                      {renderTagList(customerPersona.pain_points)}
                    </Descriptions.Item>
                    <Descriptions.Item label="预算信号">
                      {renderTextValue(customerPersona.budget_signals)}
                    </Descriptions.Item>
                    <Descriptions.Item label="采购周期">
                      {renderTextValue(customerPersona.procurement_cycle)}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card size="small" title="联系人架构" style={{ marginBottom: 16 }}>
                  <div className="contact-structure">
                    <div className="contact-structure-row contact-structure-top">
                      <div className="contact-node contact-node-top">
                        <span className="contact-role">{contactStructure.top.label}</span>
                        <span className="contact-names">
                          {contactStructure.top.names.length
                            ? contactStructure.top.names.join(" / ")
                            : "待补充"}
                        </span>
                      </div>
                    </div>
                    <div className="contact-structure-link" />
                    <div className="contact-structure-row contact-structure-middle">
                      {contactStructure.middle.map((node) => (
                        <div key={node.label} className="contact-node">
                          <span className="contact-role">{node.label}</span>
                          <span className="contact-names">
                            {node.names.length ? node.names.join(" / ") : "待补充"}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="contact-structure-link" />
                    <div className="contact-structure-row contact-structure-branch">
                      {contactStructure.bottom.map((node) => (
                        <div key={node.label} className="contact-node">
                          <span className="contact-role">{node.label}</span>
                          <span className="contact-names">
                            {node.names.length ? node.names.join(" / ") : "待补充"}
                          </span>
                        </div>
                      ))}
                    </div>
                    {!contactStructure.hasAny && (
                      <div className="contact-structure-empty">暂无联系人信息，请补充</div>
                    )}
                  </div>
                </Card>

                <Card size="small" title="销售切入点" style={{ marginBottom: 16 }}>
                  {renderTagList(analysis.sales_angles)}
                </Card>

                <Card size="small" title="风险提示" style={{ marginBottom: 16 }}>
                  {renderTagList(analysis.risk_flags)}
                </Card>

                <Card size="small" title="假设/待确认" style={{ marginBottom: 16 }}>
                  {renderTagList(analysis.assumptions)}
                </Card>

                <Card size="small" title="公开联系人" style={{ marginBottom: 16 }}>
                  <List
                    dataSource={analysisContacts}
                    locale={{ emptyText: "暂无联系人" }}
                    renderItem={(item: any) => (
                      <List.Item
                        actions={
                          item?.source_url
                            ? [
                                <a key="source" href={item.source_url} target="_blank" rel="noreferrer">
                                  来源
                                </a>
                              ]
                            : undefined
                        }
                      >
                        <List.Item.Meta
                          title={`${item?.name || "-"}${item?.title ? ` · ${item.title}` : ""}`}
                          description={`${item?.organization || ""}${item?.confidence ? ` · 置信度 ${item.confidence}` : ""}`}
                        />
                      </List.Item>
                    )}
                  />
                </Card>

                <Card size="small" title="来源" style={{ marginBottom: 16 }}>
                  <List
                    dataSource={analysisSources}
                    locale={{ emptyText: "暂无来源" }}
                    renderItem={(item: any) => (
                      <List.Item
                        actions={
                          item?.url
                            ? [
                                <a key="source" href={item.url} target="_blank" rel="noreferrer">
                                  打开
                                </a>
                              ]
                            : undefined
                        }
                      >
                        <List.Item.Meta
                          title={item?.title || item?.url || "-"}
                          description={item?.snippet || ""}
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              </>
            )}
          </>
        ) : (
          <Text type="secondary">请选择一条主场商机进行分析。</Text>
        )}
      </Drawer>
    </Layout>
  );
}

export default App;
