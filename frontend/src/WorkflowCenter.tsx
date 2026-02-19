import { Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tabs,
  message,
  Typography
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  CopyOutlined,
  MinusCircleOutlined,
  EditOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  RollbackOutlined,
  UndoOutlined,
  RedoOutlined,
  CheckOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  StopOutlined
} from "@ant-design/icons";
import type { WorkflowCondition, WorkflowDefinition } from "./WorkflowProcessDesigner";
import type { WorkflowFormDesignerField } from "./WorkflowFormDesigner";

const WorkflowProcessDesigner = lazy(() => import("./WorkflowProcessDesigner"));
const WorkflowFormDesigner = lazy(() => import("./WorkflowFormDesigner"));

const { Text } = Typography;

type WorkflowUser = {
  id: number;
  name: string;
  role: string;
  company_id?: number | null;
};

type WorkflowCompany = {
  id: number;
  name: string;
};

type WorkflowCurrentUser = {
  id: number;
  name: string;
  role: string;
  company_id?: number | null;
};

type WorkflowField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "boolean" | "attachment" | "table";
  required?: boolean;
  can_edit?: boolean;
  can_view?: boolean;
  options?: string[];
  columns?: Array<{
    key: string;
    label: string;
    type: "text" | "textarea" | "number" | "date" | "select" | "boolean";
    options?: string[];
  }>;
  max_count?: number;
  default?: unknown;
  placeholder?: string;
  order?: number;
};

type WorkflowFieldColumn = NonNullable<WorkflowField["columns"]>[number] & { placeholder?: string };

type WorkflowStep = {
  step_no?: number;
  name: string;
  step_type?: "approval" | "cc" | "condition" | "subprocess" | "parallel_start" | "parallel_join";
  approver_type?:
    | "user"
    | "role"
    | "manager"
    | "department_manager"
    | "position"
    | "applicant_select"
    | "previous_handler";
  approval_mode?: "any" | "all";
  approver_user_ids?: number[];
  approver_roles?: string[];
  approver_positions?: string[];
  approver_field_key?: string;
  previous_step_offset?: number;
  subprocess_template_id?: number;
  allow_self_approve?: boolean;
  condition?: WorkflowCondition;
};

type ProcessTemplate = {
  id: number;
  name: string;
  description?: string | null;
  company_id?: number | null;
  company_name?: string | null;
  status: "active" | "inactive";
  form_template_id: number;
  form_template_name?: string | null;
  form_schema?: WorkflowField[];
  steps: WorkflowStep[];
  definition?: WorkflowDefinition;
  step_count: number;
  current_version?: number | null;
  published_version?: number | null;
  updated_at?: string | null;
};

type ProcessTemplateVersion = {
  id: number;
  process_template_id: number;
  version_no: number;
  form_template_id: number;
  form_template_name?: string | null;
  status: "draft" | "published" | "archived";
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  step_count: number;
  definition?: WorkflowDefinition;
  form_schema?: WorkflowField[];
};

type WorkflowFieldPermission = {
  can_view: boolean;
  can_edit: boolean;
  required: boolean;
};

type ApprovalTask = {
  id: number;
  step_no: number;
  step_name: string;
  approval_mode: "any" | "all";
  approver_id: number;
  approver_name?: string | null;
  status: "pending" | "waiting" | "approved" | "rejected" | "skipped";
  decision?: "approve" | "reject" | null;
  comment?: string | null;
  acted_at?: string | null;
};

type ApprovalInstance = {
  id: number;
  process_template_id: number;
  form_template_id: number;
  process_name: string;
  title: string;
  company_id?: number | null;
  company_name?: string | null;
  applicant_id: number;
  applicant_name?: string | null;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  current_step: number;
  total_steps: number;
  current_step_name?: string | null;
  pending_action: boolean;
  created_at?: string | null;
  finished_at?: string | null;
};

type ApprovalInstanceDetail = ApprovalInstance & {
  process_snapshot: Record<string, unknown>;
  form_schema: WorkflowField[];
  form_data: Record<string, unknown>;
  field_permissions?: Record<string, WorkflowFieldPermission>;
  tasks: ApprovalTask[];
  events: ApprovalEvent[];
};

type ApprovalEvent = {
  id: number;
  task_id?: number | null;
  user_id?: number | null;
  user_name?: string | null;
  action: string;
  comment?: string | null;
  detail?: Record<string, unknown> | null;
  created_at?: string | null;
};

type ApiResponse<T> = {
  data: T;
};

type ApiEnvelope<T> = {
  data: T;
  page?: number;
  page_size?: number;
  total?: number;
};

type WorkflowValidationIssue = {
  code: string;
  message: string;
  nodes?: string[];
  edge_ids?: string[];
};

type WorkflowValidationResult = {
  valid: boolean;
  errors: WorkflowValidationIssue[];
  warnings: WorkflowValidationIssue[];
};

type PublishCheckResult = {
  validation: WorkflowValidationResult;
  diff: {
    fields: { added: string[]; removed: string[]; changed: string[] };
    nodes: { added: string[]; removed: string[]; changed: string[] };
    edges: { added: string[]; removed: string[]; changed: string[] };
  };
  hasChanges: boolean;
};

type DraftCompareResult = {
  baseLabel: string;
  diff: PublishCheckResult["diff"];
  hasChanges: boolean;
};

type ProcessTemplateEditorValues = {
  name: string;
  description?: string;
  status: "active" | "inactive";
  company_id?: number;
  form_template_id?: number;
  mode?: "designer" | "json";
  steps_text: string;
};

type ProcessEditorLocalDraft = {
  version: 1;
  template_id: number | null;
  saved_at: number;
  form_values: Partial<ProcessTemplateEditorValues>;
  definition: WorkflowDefinition;
  form_schema: WorkflowField[];
  wizard_step: 1 | 2;
  meta_visible: boolean;
};

type ProcessEditorSnapshot = {
  name: string;
  description?: string;
  status: "active" | "inactive";
  company_id?: number;
  form_template_id?: number;
  mode?: "designer" | "json";
  steps_text: string;
  definition: WorkflowDefinition;
  form_schema: WorkflowField[];
};

type FormDataValue =
  | string
  | number
  | boolean
  | Record<string, unknown>
  | Array<string | number | boolean | Record<string, unknown>>;

type StartInstanceValues = {
  process_template_id: number;
  title?: string;
  form_data?: Record<string, FormDataValue | undefined>;
};

type StartInstanceLocalDraft = {
  version: 1;
  saved_at: number;
  process_template_id: number;
  title?: string;
  form_data?: Record<string, unknown>;
};

type WorkflowCenterProps = {
  apiBase: string;
  userId: string;
  currentUser: WorkflowCurrentUser;
  companies: WorkflowCompany[];
  users: WorkflowUser[];
  orgRoleOptions?: string[];
  orgPositionOptions?: string[];
  isGroupAdmin: boolean;
  isSubAdmin: boolean;
  refreshOrg: () => Promise<void>;
  focusRequest?: {
    instanceId: number;
    token: number;
  } | null;
  onFocusHandled?: () => void;
};

const STEP_SCHEMA_SAMPLE = `[
  {
    "step_type": "approval",
    "name": "直属负责人审批",
    "approver_type": "manager",
    "approval_mode": "any"
  },
  {
    "step_type": "approval",
    "name": "财务审批",
    "approver_type": "role",
    "approver_roles": ["marketing", "subsidiary_admin"],
    "approval_mode": "any",
    "condition": {
      "logic": "and",
      "rules": [
        { "field": "amount", "operator": "gte", "value": 10000 }
      ]
    }
  },
  {
    "step_type": "cc",
    "name": "抄送发起人",
    "approver_type": "user",
    "approver_user_ids": [1]
  }
]`;
const PROCESS_EDITOR_DRAFT_STORAGE_PREFIX = "crm_process_editor_draft_v1";
const START_INSTANCE_DRAFT_STORAGE_PREFIX = "crm_start_instance_draft_v1";
const DEFAULT_INSTANCE_PAGE_SIZE = 20;

const createDefaultDefinition = (): WorkflowDefinition => ({
  version: "graph_v1",
  start_node_id: "start",
  nodes: [
    { id: "start", name: "开始", node_type: "start", position: { x: 80, y: 180 } },
    {
      id: "approval_1",
      name: "审批节点",
      node_type: "approval",
      approver_type: "manager",
      approval_mode: "any",
      allow_self_approve: true,
      position: { x: 340, y: 180 }
    },
    { id: "end", name: "结束", node_type: "end", position: { x: 620, y: 180 } }
  ],
  edges: [
    { id: "e_start_approval_1", source: "start", target: "approval_1", priority: 1 },
    { id: "e_approval_1_end", source: "approval_1", target: "end", priority: 2 }
  ]
});

const mapStepTypeToNodeType = (
  stepType?: WorkflowStep["step_type"]
): WorkflowDefinition["nodes"][number]["node_type"] => {
  if (stepType === "approval") {
    return "approval";
  }
  if (stepType === "cc") {
    return "cc";
  }
  if (stepType === "condition") {
    return "condition";
  }
  if (stepType === "subprocess") {
    return "subprocess";
  }
  if (stepType === "parallel_start") {
    return "parallel_start";
  }
  if (stepType === "parallel_join") {
    return "parallel_join";
  }
  return "approval";
};

const stepsToDefinition = (steps: WorkflowStep[]): WorkflowDefinition => {
  const safeSteps = Array.isArray(steps) ? steps : [];
  const nodes: WorkflowDefinition["nodes"] = [
    { id: "start", name: "开始", node_type: "start", position: { x: 80, y: 180 } }
  ];
  const edges: WorkflowDefinition["edges"] = [];
  let prevId = "start";

  safeSteps.forEach((step, index) => {
    const stepId = `step_${index + 1}`;
    const nodeType = mapStepTypeToNodeType(step.step_type);
    nodes.push({
      id: stepId,
      name: step.name || `${index + 1}号节点`,
      node_type: nodeType,
      approver_type: step.approver_type,
      approval_mode: step.approval_mode,
      approver_user_ids: step.approver_user_ids,
      approver_roles: step.approver_roles,
      approver_positions: step.approver_positions,
      approver_field_key: step.approver_field_key,
      previous_step_offset: step.previous_step_offset,
      subprocess_template_id: step.subprocess_template_id,
      allow_self_approve: step.allow_self_approve,
      condition: step.condition,
      position: { x: 80 + (index + 1) * 260, y: 180 }
    });
    edges.push({
      id: `e_${prevId}_${stepId}`,
      source: prevId,
      target: stepId,
      priority: index + 1
    });
    prevId = stepId;
  });

  const endId = "end";
  nodes.push({
    id: endId,
    name: "结束",
    node_type: "end",
    position: { x: 80 + (safeSteps.length + 1) * 260, y: 180 }
  });
  edges.push({
    id: `e_${prevId}_${endId}`,
    source: prevId,
    target: endId,
    priority: edges.length + 1
  });
  return {
    version: "graph_v1",
    start_node_id: "start",
    nodes,
    edges
  };
};

const parseStepsText = (stepsText: string): WorkflowStep[] | null => {
  try {
    const parsed = JSON.parse(stepsText || "[]");
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed as WorkflowStep[];
  } catch {
    return null;
  }
};

const INSTANCE_STATUS_LABELS: Record<ApprovalInstance["status"], string> = {
  pending: "审批中",
  approved: "已通过",
  rejected: "已拒绝",
  withdrawn: "已撤回"
};

const INSTANCE_STATUS_COLORS: Record<ApprovalInstance["status"], string> = {
  pending: "processing",
  approved: "success",
  rejected: "error",
  withdrawn: "default"
};

const TASK_STATUS_LABELS: Record<ApprovalTask["status"], string> = {
  pending: "待处理",
  waiting: "待激活",
  approved: "已通过",
  rejected: "已拒绝",
  skipped: "已跳过"
};

const PROCESS_TEMPLATE_STATUS_LABELS: Record<ProcessTemplate["status"], string> = {
  active: "已发布",
  inactive: "草稿"
};

const PROCESS_TEMPLATE_STATUS_COLORS: Record<ProcessTemplate["status"], string> = {
  active: "green",
  inactive: "gold"
};

const EVENT_ACTION_LABELS: Record<string, string> = {
  approve: "审批通过",
  reject: "审批拒绝",
  return: "审批退回",
  withdraw: "发起人撤回",
  transfer: "转交",
  add_sign: "加签",
  remind: "催办",
  subprocess_auto: "子流程自动处理"
};

const toSnapshotText = (value: unknown) => JSON.stringify(value ?? null);
const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const buildDefinitionHistorySignature = (definition: WorkflowDefinition) => {
  const safeDefinition = cloneJson(definition || createDefaultDefinition());
  const nodes = (safeDefinition.nodes || [])
    .map((node) => {
      const nextNode = { ...(node || {}) } as Record<string, unknown>;
      if (Array.isArray(node.approver_groups)) {
        nextNode.approver_groups = node.approver_groups.map((group) => {
          const nextGroup = { ...(group || {}) } as Record<string, unknown>;
          delete nextGroup.id;
          return nextGroup;
        });
      }
      return nextNode;
    })
    .sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")));
  const edges = (safeDefinition.edges || [])
    .map((edge) => {
      const nextEdge = { ...(edge || {}) } as Record<string, unknown>;
      delete nextEdge.id;
      return nextEdge;
    })
    .sort((a, b) => {
      const aKey = `${String(a.source || "")}->${String(a.target || "")}->${String(a.priority ?? "")}->${toSnapshotText(
        a.condition
      )}->${String(a.label || "")}->${String(a.is_default === true)}`;
      const bKey = `${String(b.source || "")}->${String(b.target || "")}->${String(b.priority ?? "")}->${toSnapshotText(
        b.condition
      )}->${String(b.label || "")}->${String(b.is_default === true)}`;
      return aKey.localeCompare(bKey);
    });
  return toSnapshotText({
    version: safeDefinition.version,
    start_node_id: safeDefinition.start_node_id,
    nodes,
    edges
  });
};

const normalizeFieldForDiff = (field: WorkflowField) => {
  const next: Record<string, unknown> = {};
  Object.keys(field || {}).forEach((key) => {
    if (key === "order" || key === "can_edit" || key === "can_view") {
      return;
    }
    next[key] = (field as Record<string, unknown>)[key];
  });
  return next;
};

const computeSchemaDiff = (currentSchema: WorkflowField[], baseSchema: WorkflowField[]) => {
  const currentMap = new Map((currentSchema || []).map((field) => [field.key, field]));
  const baseMap = new Map((baseSchema || []).map((field) => [field.key, field]));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  currentMap.forEach((field, key) => {
    if (!baseMap.has(key)) {
      added.push(key);
      return;
    }
    const currentText = toSnapshotText(normalizeFieldForDiff(field));
    const baseText = toSnapshotText(normalizeFieldForDiff(baseMap.get(key) as WorkflowField));
    if (currentText !== baseText) {
      changed.push(key);
    }
  });
  baseMap.forEach((_field, key) => {
    if (!currentMap.has(key)) {
      removed.push(key);
    }
  });
  return { added, removed, changed };
};

const normalizeNodeForDiff = (node: WorkflowDefinition["nodes"][number]) => {
  const copy = { ...(node || {}) } as Record<string, unknown>;
  delete copy.position;
  return copy;
};

const computeDefinitionDiff = (
  currentDefinition: WorkflowDefinition,
  baseDefinition?: WorkflowDefinition
) => {
  const currentNodes = currentDefinition?.nodes || [];
  const baseNodes = baseDefinition?.nodes || [];
  const currentEdges = currentDefinition?.edges || [];
  const baseEdges = baseDefinition?.edges || [];

  const currentNodeMap = new Map(currentNodes.map((node) => [node.id, node]));
  const baseNodeMap = new Map(baseNodes.map((node) => [node.id, node]));
  const nodes = { added: [] as string[], removed: [] as string[], changed: [] as string[] };
  currentNodeMap.forEach((node, id) => {
    if (!baseNodeMap.has(id)) {
      nodes.added.push(node.name || id);
      return;
    }
    const currentText = toSnapshotText(normalizeNodeForDiff(node));
    const baseText = toSnapshotText(normalizeNodeForDiff(baseNodeMap.get(id) as WorkflowDefinition["nodes"][number]));
    if (currentText !== baseText) {
      nodes.changed.push(node.name || id);
    }
  });
  baseNodeMap.forEach((node, id) => {
    if (!currentNodeMap.has(id)) {
      nodes.removed.push(node.name || id);
    }
  });

  const edgeKey = (edge: WorkflowDefinition["edges"][number]) => edge.id || `${edge.source}->${edge.target}`;
  const currentEdgeMap = new Map(currentEdges.map((edge) => [edgeKey(edge), edge]));
  const baseEdgeMap = new Map(baseEdges.map((edge) => [edgeKey(edge), edge]));
  const edges = { added: [] as string[], removed: [] as string[], changed: [] as string[] };
  currentEdgeMap.forEach((edge, key) => {
    if (!baseEdgeMap.has(key)) {
      edges.added.push(`${edge.source} → ${edge.target}`);
      return;
    }
    const currentText = toSnapshotText(edge);
    const baseText = toSnapshotText(baseEdgeMap.get(key) as WorkflowDefinition["edges"][number]);
    if (currentText !== baseText) {
      edges.changed.push(`${edge.source} → ${edge.target}`);
    }
  });
  baseEdgeMap.forEach((edge, key) => {
    if (!currentEdgeMap.has(key)) {
      edges.removed.push(`${edge.source} → ${edge.target}`);
    }
  });

  return { nodes, edges };
};

function WorkflowCenter(props: WorkflowCenterProps) {
  const {
    apiBase,
    userId,
    currentUser,
    companies,
    users,
    orgRoleOptions = [],
    orgPositionOptions = [],
    isGroupAdmin,
    isSubAdmin,
    refreshOrg,
    focusRequest,
    onFocusHandled
  } = props;

  const canManageTemplates = isGroupAdmin || isSubAdmin;
  const [activeTab, setActiveTab] = useState("instances");

  const [processesLoading, setProcessesLoading] = useState(false);
  const [processTemplates, setProcessTemplates] = useState<ProcessTemplate[]>([]);
  const [processDrawerOpen, setProcessDrawerOpen] = useState(false);
  const [processSaving, setProcessSaving] = useState(false);
  const [editingProcess, setEditingProcess] = useState<ProcessTemplate | null>(null);
  const [processEditorForm] = Form.useForm<ProcessTemplateEditorValues>();
  const [processDefinition, setProcessDefinition] = useState<WorkflowDefinition>(createDefaultDefinition());
  const [designerSeed, setDesignerSeed] = useState(1);
  const [processMetaVisible, setProcessMetaVisible] = useState(false);
  const [processWizardStep, setProcessWizardStep] = useState<1 | 2>(1);
  const [processFormSchemaDraft, setProcessFormSchemaDraft] = useState<WorkflowField[]>([]);
  const [processFormDesignerSeed, setProcessFormDesignerSeed] = useState(1);
  const [processVersionsLoading, setProcessVersionsLoading] = useState(false);
  const [processVersions, setProcessVersions] = useState<ProcessTemplateVersion[]>([]);
  const [publishCheckOpen, setPublishCheckOpen] = useState(false);
  const [publishCheckLoading, setPublishCheckLoading] = useState(false);
  const [publishCheckResult, setPublishCheckResult] = useState<PublishCheckResult | null>(null);
  const [draftCompareOpen, setDraftCompareOpen] = useState(false);
  const [draftCompareResult, setDraftCompareResult] = useState<DraftCompareResult | null>(null);
  const [processInitialSnapshot, setProcessInitialSnapshot] = useState("");
  const [processAutoSaveAt, setProcessAutoSaveAt] = useState<number | null>(null);
  const [processDefinitionPast, setProcessDefinitionPast] = useState<WorkflowDefinition[]>([]);
  const [processDefinitionFuture, setProcessDefinitionFuture] = useState<WorkflowDefinition[]>([]);
  const [processFormSchemaPast, setProcessFormSchemaPast] = useState<WorkflowField[][]>([]);
  const [processFormSchemaFuture, setProcessFormSchemaFuture] = useState<WorkflowField[][]>([]);
  const processDefinitionReplayLockUntilRef = useRef(0);

  const [instancesLoading, setInstancesLoading] = useState(false);
  const [instanceScope, setInstanceScope] = useState<"all" | "mine" | "pending">("all");
  const [instanceStatus, setInstanceStatus] = useState<"pending" | "approved" | "rejected" | "withdrawn" | "">("");
  const [instances, setInstances] = useState<ApprovalInstance[]>([]);
  const [instancePage, setInstancePage] = useState(1);
  const [instancePageSize, setInstancePageSize] = useState(DEFAULT_INSTANCE_PAGE_SIZE);
  const [instanceTotal, setInstanceTotal] = useState(0);

  const [startDrawerOpen, setStartDrawerOpen] = useState(false);
  const [startSaving, setStartSaving] = useState(false);
  const [startForm] = Form.useForm<StartInstanceValues>();
  const [selectedProcess, setSelectedProcess] = useState<ProcessTemplate | null>(null);
  const [startDraftSavedAt, setStartDraftSavedAt] = useState<number | null>(null);
  const startDraftSignatureRef = useRef("");

  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<ApprovalInstanceDetail | null>(null);
  const [actionForm] = Form.useForm<{ form_data?: Record<string, FormDataValue | undefined> }>();
  const [actionComment, setActionComment] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [transferTargetUserId, setTransferTargetUserId] = useState<number | undefined>(undefined);
  const [addSignUserIds, setAddSignUserIds] = useState<number[]>([]);
  const processEditorMode = Form.useWatch("mode", processEditorForm) || "designer";
  const processEditorValues = Form.useWatch([], processEditorForm) as ProcessTemplateEditorValues | undefined;
  const startFormValues = Form.useWatch([], startForm) as StartInstanceValues | undefined;

  const authHeaders: HeadersInit = useMemo(
    () => ({
      "Content-Type": "application/json",
      "x-user-id": String(userId)
    }),
    [userId]
  );

  const resetProcessEditorHistory = useCallback(() => {
    setProcessDefinitionPast([]);
    setProcessDefinitionFuture([]);
    setProcessFormSchemaPast([]);
    setProcessFormSchemaFuture([]);
  }, []);

  const getProcessDraftStorageKey = useCallback(
    (templateId: number | null) => `${PROCESS_EDITOR_DRAFT_STORAGE_PREFIX}_${userId}_${templateId ?? "new"}`,
    [userId]
  );

  const clearProcessLocalDraft = useCallback(
    (templateId: number | null) => {
      try {
        localStorage.removeItem(getProcessDraftStorageKey(templateId));
      } catch {
        // ignore local storage cleanup failure
      }
    },
    [getProcessDraftStorageKey]
  );

  const readProcessLocalDraft = useCallback(
    (templateId: number | null): ProcessEditorLocalDraft | null => {
      try {
        const raw = localStorage.getItem(getProcessDraftStorageKey(templateId));
        if (!raw) {
          return null;
        }
        const parsed = JSON.parse(raw) as Partial<ProcessEditorLocalDraft>;
        if (parsed.version !== 1) {
          localStorage.removeItem(getProcessDraftStorageKey(templateId));
          return null;
        }
        if ((parsed.template_id ?? null) !== (templateId ?? null)) {
          localStorage.removeItem(getProcessDraftStorageKey(templateId));
          return null;
        }
        const definition = parsed.definition;
        if (!definition || !Array.isArray(definition.nodes) || !Array.isArray(definition.edges)) {
          localStorage.removeItem(getProcessDraftStorageKey(templateId));
          return null;
        }
        const savedAt =
          typeof parsed.saved_at === "number" && Number.isFinite(parsed.saved_at)
            ? parsed.saved_at
            : Date.now();
        return {
          version: 1,
          template_id: templateId ?? null,
          saved_at: savedAt,
          form_values:
            parsed.form_values && typeof parsed.form_values === "object"
              ? (parsed.form_values as Partial<ProcessTemplateEditorValues>)
              : {},
          definition: cloneJson(definition),
          form_schema: Array.isArray(parsed.form_schema) ? cloneJson(parsed.form_schema as WorkflowField[]) : [],
          wizard_step: parsed.wizard_step === 2 ? 2 : 1,
          meta_visible: parsed.meta_visible === true
        };
      } catch {
        localStorage.removeItem(getProcessDraftStorageKey(templateId));
        return null;
      }
    },
    [getProcessDraftStorageKey]
  );

  const restoreProcessLocalDraft = useCallback(
    (templateId: number | null) => {
      const draft = readProcessLocalDraft(templateId);
      if (!draft) {
        setProcessAutoSaveAt(null);
        return false;
      }
      processEditorForm.setFieldsValue({
        ...draft.form_values,
        mode: draft.form_values.mode || "designer"
      });
      setProcessDefinition(cloneJson(draft.definition));
      setDesignerSeed((seed) => seed + 1);
      setProcessFormSchemaDraft(cloneJson(draft.form_schema));
      setProcessFormDesignerSeed((seed) => seed + 1);
      setProcessWizardStep(draft.wizard_step);
      setProcessMetaVisible(draft.meta_visible);
      setProcessAutoSaveAt(draft.saved_at);
      resetProcessEditorHistory();
      message.info(`已恢复本地草稿（${new Date(draft.saved_at).toLocaleString()}）`);
      return true;
    },
    [processEditorForm, readProcessLocalDraft, resetProcessEditorHistory]
  );

  const getStartDraftStorageKey = useCallback(
    () => `${START_INSTANCE_DRAFT_STORAGE_PREFIX}_${userId}`,
    [userId]
  );

  const clearStartLocalDraft = useCallback(() => {
    try {
      localStorage.removeItem(getStartDraftStorageKey());
    } catch {
      // ignore local storage cleanup failure
    }
    startDraftSignatureRef.current = "";
    setStartDraftSavedAt(null);
  }, [getStartDraftStorageKey]);

  const readStartLocalDraft = useCallback((): StartInstanceLocalDraft | null => {
    try {
      const raw = localStorage.getItem(getStartDraftStorageKey());
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<StartInstanceLocalDraft>;
      if (parsed.version !== 1) {
        localStorage.removeItem(getStartDraftStorageKey());
        return null;
      }
      const processTemplateId = Number(parsed.process_template_id || 0);
      if (!Number.isFinite(processTemplateId) || processTemplateId <= 0) {
        localStorage.removeItem(getStartDraftStorageKey());
        return null;
      }
      const template = processTemplates.find((item) => item.id === processTemplateId && item.status === "active");
      if (!template) {
        localStorage.removeItem(getStartDraftStorageKey());
        return null;
      }
      return {
        version: 1,
        saved_at: typeof parsed.saved_at === "number" ? parsed.saved_at : Date.now(),
        process_template_id: processTemplateId,
        title: typeof parsed.title === "string" ? parsed.title : undefined,
        form_data:
          parsed.form_data && typeof parsed.form_data === "object" && !Array.isArray(parsed.form_data)
            ? (parsed.form_data as Record<string, unknown>)
            : undefined
      };
    } catch {
      localStorage.removeItem(getStartDraftStorageKey());
      return null;
    }
  }, [getStartDraftStorageKey, processTemplates]);

  const restoreStartLocalDraft = useCallback(() => {
    const draft = readStartLocalDraft();
    if (!draft) {
      setStartDraftSavedAt(null);
      return false;
    }
    const template = processTemplates.find((item) => item.id === draft.process_template_id) || null;
    const schema = template?.form_schema || [];
    const sourceFormData = (draft.form_data || {}) as Record<string, unknown>;
    const hydratedFormData: Record<string, unknown> = {};
    schema.forEach((field) => {
      const rawValue = sourceFormData[field.key];
      if (rawValue === undefined || rawValue === null) {
        return;
      }
      if (field.type === "date" && typeof rawValue === "string") {
        const parsed = moment(rawValue, ["YYYY-MM-DD", "YYYY-MM-DD HH:mm:ss", moment.ISO_8601], true);
        hydratedFormData[field.key] = parsed.isValid() ? parsed : rawValue;
        return;
      }
      if (field.type === "table" && Array.isArray(rawValue)) {
        const columns = field.columns || [];
        hydratedFormData[field.key] = rawValue.map((row) => {
          if (!row || typeof row !== "object" || Array.isArray(row)) {
            return row;
          }
          const sourceRow = row as Record<string, unknown>;
          const nextRow: Record<string, unknown> = {};
          columns.forEach((column) => {
            const columnRawValue = sourceRow[column.key];
            if (columnRawValue === undefined || columnRawValue === null) {
              return;
            }
            if (column.type === "date" && typeof columnRawValue === "string") {
              const parsed = moment(
                columnRawValue,
                ["YYYY-MM-DD", "YYYY-MM-DD HH:mm:ss", moment.ISO_8601],
                true
              );
              nextRow[column.key] = parsed.isValid() ? parsed : columnRawValue;
              return;
            }
            nextRow[column.key] = columnRawValue;
          });
          return nextRow;
        });
        return;
      }
      hydratedFormData[field.key] = rawValue;
    });
    setSelectedProcess(template);
    startForm.setFieldsValue({
      process_template_id: draft.process_template_id,
      title: draft.title,
      form_data: hydratedFormData as Record<string, FormDataValue | undefined>
    });
    startDraftSignatureRef.current = JSON.stringify({
      process_template_id: draft.process_template_id,
      title: draft.title || "",
      form_data: draft.form_data || {}
    });
    setStartDraftSavedAt(draft.saved_at);
    message.info(`已恢复发起审批草稿（${new Date(draft.saved_at).toLocaleString()}）`);
    return true;
  }, [processTemplates, readStartLocalDraft, startForm]);

  const toReadableError = useCallback((errorCode: string, details?: Record<string, unknown>) => {
    if (errorCode.startsWith("missing_required_field:")) {
      const key = errorCode.split(":")[1] || "";
      return `缺少必填字段：${key}`;
    }
    if (errorCode.startsWith("invalid_field_type:")) {
      const key = errorCode.split(":")[1] || "";
      return `字段类型不正确：${key}`;
    }
    if (errorCode.startsWith("invalid_field_option:")) {
      const key = errorCode.split(":")[1] || "";
      return `字段选项不合法：${key}`;
    }
    const mapping: Record<string, string> = {
      forbidden: "无权限操作",
      invalid_form_schema: "表单结构异常，无法更新审批字段",
      invalid_response_format: "服务返回格式异常，请稍后重试",
      invalid_schema: "表单字段配置不合法",
      invalid_steps: "流程节点配置不合法",
      invalid_definition: "流程图定义不合法",
      invalid_definition_nodes: "流程图节点配置不合法",
      invalid_definition_edges: "流程图连线配置不合法",
      invalid_start_node: "流程图必须且只能有一个开始节点",
      missing_end_node: "流程图至少需要一个结束节点",
      start_node_has_incoming_edge: "开始节点不能有入线",
      end_node_has_outgoing_edge: "结束节点不能配置出线",
      node_missing_outgoing_edge: "存在没有出线的非结束节点",
      condition_node_requires_branches: "条件节点至少需要两条分支",
      condition_node_missing_default_branch: "条件节点缺少默认分支",
      condition_node_multiple_default_branch: "条件节点只能有一条默认分支",
      parallel_start_requires_branches: "并行分支节点至少需要两条分支",
      parallel_join_requires_incoming: "并行汇聚节点至少需要两条入线",
      invalid_subprocess_template: "子流程节点配置无效",
      unreachable_nodes: "流程中存在不可达节点",
      dead_end_nodes: "流程中存在无法到达结束节点的死路",
      graph_has_cycle: "流程图包含循环回路，当前版本不支持",
      invalid_company: "公司配置无效",
      invalid_form_template_scope: "流程与表单模板的公司范围不匹配",
      form_template_already_bound: "该表单模板已绑定其他流程，流程与表单必须一对一",
      invalid_field_columns: "表单字段列配置不合法",
      invalid_field_max_count: "附件字段数量限制配置不合法",
      unknown_form_fields: "表单包含未定义字段",
      missing_step_position_approvers: "岗位审批未配置岗位列表",
      invalid_step_applicant_select_field: "发起人自选审批字段配置不合法",
      invalid_step_previous_handler: "前节点处理人配置不合法",
      no_available_approver_for_first_step: "首节点没有可用审批人",
      invalid_instance_status: "当前实例状态不支持该操作",
      no_pending_task: "当前没有可处理的审批任务",
      process_template_inactive: "流程模板未发布或已停用",
      process_template_not_published_version: "流程尚无已发布版本，不能发起",
      db_unavailable: "数据库暂时不可用，请稍后重试",
      internal_server_error: "服务暂时异常，请稍后重试",
      invalid_target_user: "目标处理人无效",
      target_user_task_exists: "目标处理人已在当前步骤中",
      field_update_not_allowed: "当前节点不允许修改表单字段"
    };
    if (errorCode === "field_update_forbidden") {
      const fields = Array.isArray(details?.fields) ? details?.fields : [];
      if (fields.length > 0) {
        return `以下字段不可修改：${fields.join("、")}`;
      }
      return "包含不可修改字段";
    }
    return mapping[errorCode] || errorCode;
  }, []);

  const isDateLike = (value: unknown): value is { format: (fmt: string) => string } => {
    return (
      !!value &&
      typeof value === "object" &&
      "format" in value &&
      typeof (value as { format?: unknown }).format === "function"
    );
  };

  const toDateText = (value: unknown): string | undefined => {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (isDateLike(value)) {
      return value.format("YYYY-MM-DD");
    }
    return undefined;
  };

  const isEmptyValue = (value: unknown) => {
    if (value === undefined || value === null) {
      return true;
    }
    if (typeof value === "string") {
      return value.trim() === "";
    }
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    return false;
  };

  const parseApiResponse = useCallback(async (response: Response) => {
    const rawText = await response.text();
    if (!rawText) {
      return {} as { data?: unknown; error?: string; details?: Record<string, unknown> };
    }
    try {
      return JSON.parse(rawText) as { data?: unknown; error?: string; details?: Record<string, unknown> };
    } catch {
      if (!response.ok) {
        return {
          error: "internal_server_error",
          details: {
            status: response.status,
            raw: rawText.slice(0, 120)
          }
        };
      }
      return {
        error: "invalid_response_format",
        details: {
          status: response.status,
          raw: rawText.slice(0, 120)
        }
      };
    }
  }, []);

  const requestJson = useCallback(async <T,>(path: string, options: RequestInit = {}) => {
    const response = await fetch(`${apiBase}${path}`, options);
    const raw = (await parseApiResponse(response)) as Partial<ApiResponse<T>> & {
      error?: string;
      details?: Record<string, unknown>;
    };
    if (!response.ok) {
      throw new Error(toReadableError(raw.error || "请求失败", raw.details));
    }
    if (!("data" in raw)) {
      throw new Error(toReadableError(raw.error || "invalid_response_format", raw.details));
    }
    return raw.data as T;
  }, [apiBase, parseApiResponse, toReadableError]);

  const requestEnvelope = useCallback(async <T,>(path: string, options: RequestInit = {}) => {
    const response = await fetch(`${apiBase}${path}`, options);
    const raw = (await parseApiResponse(response)) as Partial<ApiEnvelope<T>> & {
      error?: string;
      details?: Record<string, unknown>;
    };
    if (!response.ok) {
      throw new Error(toReadableError(raw.error || "请求失败", raw.details));
    }
    return raw as ApiEnvelope<T>;
  }, [apiBase, parseApiResponse, toReadableError]);

  const toValidationMessage = (issue: WorkflowValidationIssue) => {
    const nodeText = issue.nodes && issue.nodes.length ? ` 节点: ${issue.nodes.join(", ")}` : "";
    return `${issue.message}${nodeText}`;
  };

  const validateProcessDefinition = async (
    payload:
      | {
          definition: WorkflowDefinition;
          steps?: undefined;
        }
      | {
          steps: WorkflowStep[];
          definition?: undefined;
        }
  ) => {
    return requestJson<WorkflowValidationResult>("/approval/process-templates/validate", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(payload)
    });
  };

  const fetchProcessTemplates = useCallback(async () => {
    setProcessesLoading(true);
    try {
      const data = await requestJson<ProcessTemplate[]>(
        "/approval/process-templates?include_steps=1&include_form_schema=1",
        { headers: authHeaders }
      );
      setProcessTemplates(data || []);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载流程模板失败");
    } finally {
      setProcessesLoading(false);
    }
  }, [authHeaders, requestJson]);

  const fetchInstances = useCallback(async (
    scope: "all" | "mine" | "pending",
    status: "pending" | "approved" | "rejected" | "withdrawn" | "",
    page: number,
    pageSize: number
  ) => {
    setInstancesLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("scope", scope);
      if (status) {
        params.set("status", status);
      }
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      const response = await requestEnvelope<ApprovalInstance[]>(`/approval/instances?${params.toString()}`, {
        headers: authHeaders
      });
      const list = response.data || [];
      const resolvedPage = typeof response.page === "number" ? response.page : page;
      const resolvedPageSize = typeof response.page_size === "number" ? response.page_size : pageSize;
      const resolvedTotal = typeof response.total === "number" ? response.total : list.length;
      const maxPage = Math.max(1, Math.ceil(resolvedTotal / Math.max(1, resolvedPageSize)));
      if (resolvedTotal > 0 && list.length === 0 && resolvedPage > maxPage) {
        setInstancePage(maxPage);
        return;
      }
      setInstances(list);
      setInstancePage(resolvedPage);
      setInstancePageSize(resolvedPageSize);
      setInstanceTotal(resolvedTotal);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载审批实例失败");
    } finally {
      setInstancesLoading(false);
    }
  }, [authHeaders, requestEnvelope]);

  const fetchInstanceDetail = useCallback(async (instanceId: number) => {
    setDetailLoading(true);
    try {
      const data = await requestJson<ApprovalInstanceDetail>(`/approval/instances/${instanceId}`, {
        headers: authHeaders
      });
      setDetailData(data);
      setDetailDrawerOpen(true);
      setActionComment("");
      setTransferTargetUserId(undefined);
      setAddSignUserIds([]);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载详情失败");
    } finally {
      setDetailLoading(false);
    }
  }, [authHeaders, requestJson]);

  useEffect(() => {
    fetchProcessTemplates();
  }, [fetchProcessTemplates]);

  useEffect(() => {
    fetchInstances(instanceScope, instanceStatus, instancePage, instancePageSize);
  }, [fetchInstances, instancePage, instancePageSize, instanceScope, instanceStatus]);

  useEffect(() => {
    if (!canManageTemplates && activeTab !== "instances") {
      setActiveTab("instances");
    }
  }, [activeTab, canManageTemplates]);

  useEffect(() => {
    if (!focusRequest?.instanceId) {
      return;
    }
    setActiveTab("instances");
    setInstanceScope("all");
    setInstanceStatus("");
    setInstancePage(1);
    fetchInstanceDetail(focusRequest.instanceId).finally(() => {
      onFocusHandled?.();
    });
  }, [fetchInstanceDetail, focusRequest, onFocusHandled]);

  const handleInstanceScopeChange = (value: "all" | "mine" | "pending") => {
    setInstanceScope(value);
    setInstancePage(1);
  };

  const handleInstanceStatusChange = (value: "pending" | "approved" | "rejected" | "withdrawn" | "") => {
    setInstanceStatus(value);
    setInstancePage(1);
  };

  const handleInstanceTablePageChange = (page: number, pageSize: number) => {
    setInstancePage(page);
    setInstancePageSize(pageSize);
  };

  useEffect(() => {
    if (!detailData) {
      actionForm.resetFields();
      return;
    }
    const defaults: Record<string, FormDataValue | undefined> = {};
    const permissionMap = detailData.field_permissions || {};
    detailData.form_schema.forEach((field) => {
      const permission = permissionMap[field.key];
      const canEdit = Boolean(field.can_edit ?? permission?.can_edit);
      if (!canEdit) {
        return;
      }
      if (Object.prototype.hasOwnProperty.call(detailData.form_data || {}, field.key)) {
        defaults[field.key] = detailData.form_data[field.key] as FormDataValue | undefined;
        return;
      }
      if (field.default !== undefined && field.default !== null && field.default !== "") {
        defaults[field.key] = field.default as FormDataValue | undefined;
      }
    });
    actionForm.setFieldsValue({ form_data: defaults });
  }, [detailData, actionForm]);

  const companyOptions = useMemo(
    () => companies.map((company) => ({ label: company.name, value: company.id })),
    [companies]
  );

  const userOptions = useMemo(
    () =>
      users.map((user) => ({
        label: `${user.name} (${user.role})`,
        value: user.id
      })),
    [users]
  );
  const designerUsers = useMemo(
    () =>
      users.map((user) => ({
        id: user.id,
        name: user.name,
        role: user.role
      })),
    [users]
  );

  useEffect(() => {
    if (!processDrawerOpen || processEditorMode !== "designer") {
      return;
    }
    void import("./WorkflowFormDesigner");
    void import("./WorkflowProcessDesigner");
  }, [processDrawerOpen, processEditorMode]);

  const goProcessWizardNextStep = async () => {
    if (processEditorMode !== "designer") {
      return;
    }
    try {
      validateDraftSchemaBasics(processFormSchemaDraft);
    } catch (err) {
      message.warning(err instanceof Error ? err.message : "请先完成表单设计");
      return;
    }
    try {
      setProcessWizardStep(2);
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in (err as Record<string, unknown>)) {
        return;
      }
      message.error(err instanceof Error ? err.message : "请先完成表单配置");
    }
  };

  const goProcessWizardPrevStep = () => {
    if (processEditorMode !== "designer") {
      return;
    }
    setProcessWizardStep(1);
  };

  const fetchProcessTemplateVersions = async (templateId: number) => {
    if (!templateId) {
      setProcessVersions([]);
      return;
    }
    setProcessVersionsLoading(true);
    try {
      const rows = await requestJson<ProcessTemplateVersion[]>(
        `/approval/process-templates/${templateId}/versions?include_definition=1&include_form_schema=1`,
        { headers: authHeaders }
      );
      setProcessVersions(rows || []);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载流程版本失败");
      setProcessVersions([]);
    } finally {
      setProcessVersionsLoading(false);
    }
  };

  const validateDraftSchemaBasics = (schema: WorkflowField[]) => {
    if (!schema.length) {
      throw new Error("请先在“表单设计”中至少配置一个字段");
    }
    const keys = schema.map((field) => String(field.key || "").trim());
    const emptyIndex = keys.findIndex((key) => !key);
    if (emptyIndex >= 0) {
      throw new Error(`第${emptyIndex + 1}个字段缺少 key，请在表单设计中补全`);
    }
    const duplicateKey = keys.find((key, index) => keys.indexOf(key) !== index);
    if (duplicateKey) {
      throw new Error(`表单字段 key 重复：${duplicateKey}，请修改后再继续`);
    }
  };

  const openCreateProcessTemplate = async () => {
    if (!companies.length || !users.length) {
      await refreshOrg();
    }
    processEditorForm.resetFields();
    const initialValues: ProcessTemplateEditorValues = {
      name: "",
      description: "",
      status: "inactive",
      company_id: isGroupAdmin ? 0 : currentUser.company_id || undefined,
      form_template_id: undefined,
      mode: "designer",
      steps_text: STEP_SCHEMA_SAMPLE
    };
    setEditingProcess(null);
    processEditorForm.setFieldsValue(initialValues);
    setProcessDefinition(createDefaultDefinition());
    setDesignerSeed((seed) => seed + 1);
    setProcessMetaVisible(false);
    setProcessWizardStep(1);
    setProcessFormSchemaDraft([]);
    setProcessFormDesignerSeed((seed) => seed + 1);
    setProcessAutoSaveAt(null);
    setProcessVersions([]);
    setDraftCompareOpen(false);
    setDraftCompareResult(null);
    resetProcessEditorHistory();
    setProcessInitialSnapshot(
      toSnapshotText({
        ...initialValues,
        company_id: initialValues.company_id ?? 0,
        form_template_id: 0,
        definition: createDefaultDefinition(),
        form_schema: []
      })
    );
    restoreProcessLocalDraft(null);
    setProcessDrawerOpen(true);
  };

  const openEditProcessTemplate = async (row: ProcessTemplate) => {
    if (!companies.length || !users.length) {
      await refreshOrg();
    }
    processEditorForm.resetFields();
    const initialValues: ProcessTemplateEditorValues = {
      name: row.name,
      description: row.description || "",
      status: row.status,
      company_id: row.company_id ?? 0,
      form_template_id: row.form_template_id,
      mode: "designer",
      steps_text: JSON.stringify(row.steps || [], null, 2)
    };
    setEditingProcess(row);
    processEditorForm.setFieldsValue(initialValues);
    setProcessDefinition(cloneJson(row.definition || createDefaultDefinition()));
    setDesignerSeed((seed) => seed + 1);
    setProcessMetaVisible(false);
    setProcessWizardStep(1);
    setProcessFormSchemaDraft(cloneJson((row.form_schema || []) as WorkflowField[]));
    setProcessFormDesignerSeed((seed) => seed + 1);
    setProcessAutoSaveAt(null);
    setDraftCompareOpen(false);
    setDraftCompareResult(null);
    resetProcessEditorHistory();
    setProcessInitialSnapshot(
      toSnapshotText({
        ...initialValues,
        company_id: initialValues.company_id ?? 0,
        definition: cloneJson(row.definition || createDefaultDefinition()),
        form_schema: cloneJson((row.form_schema || []) as WorkflowField[])
      })
    );
    restoreProcessLocalDraft(row.id);
    await fetchProcessTemplateVersions(row.id);
    setProcessDrawerOpen(true);
  };

  const openCopyProcessTemplate = async (row: ProcessTemplate) => {
    if (!companies.length || !users.length) {
      await refreshOrg();
    }
    processEditorForm.resetFields();
    const copiedSchema = cloneJson((row.form_schema || []) as WorkflowField[]);
    const copiedDefinition = cloneJson(row.definition || createDefaultDefinition());
    const initialValues: ProcessTemplateEditorValues = {
      name: `${row.name} - 副本`,
      description: row.description || "",
      status: "inactive",
      company_id: row.company_id ?? (isGroupAdmin ? 0 : currentUser.company_id || undefined),
      form_template_id: undefined,
      mode: "designer",
      steps_text: JSON.stringify(row.steps || [], null, 2)
    };
    setEditingProcess(null);
    processEditorForm.setFieldsValue(initialValues);
    setProcessDefinition(copiedDefinition);
    setDesignerSeed((seed) => seed + 1);
    setProcessMetaVisible(false);
    setProcessWizardStep(1);
    setProcessFormSchemaDraft(copiedSchema);
    setProcessFormDesignerSeed((seed) => seed + 1);
    setProcessAutoSaveAt(null);
    setProcessVersions([]);
    setDraftCompareResult(null);
    setDraftCompareOpen(false);
    resetProcessEditorHistory();
    setProcessInitialSnapshot(
      toSnapshotText({
        ...initialValues,
        company_id: initialValues.company_id ?? 0,
        form_template_id: 0,
        definition: copiedDefinition,
        form_schema: copiedSchema
      })
    );
    restoreProcessLocalDraft(null);
    setProcessDrawerOpen(true);
    message.success("已创建模板副本，请编辑后保存。");
  };

  const saveProcessTemplate = async (targetStatus?: ProcessTemplate["status"]) => {
    try {
      const values = await processEditorForm.validateFields();
      setProcessSaving(true);
      let stepsPayload: WorkflowStep[] | undefined;
      let definitionPayload: WorkflowDefinition | undefined;
      const effectiveStatus = targetStatus || values.status;
      validateDraftSchemaBasics(processFormSchemaDraft);
      const payload: Record<string, unknown> = {
        name: values.name,
        description: values.description || undefined,
        status: effectiveStatus
      };
      if (values.mode === "json") {
        let stepsParsed: unknown;
        try {
          stepsParsed = JSON.parse(values.steps_text);
        } catch {
          throw new Error("流程节点 JSON 解析失败，请检查格式");
        }
        if (!Array.isArray(stepsParsed)) {
          throw new Error("流程 steps 必须是数组");
        }
        stepsPayload = stepsParsed as WorkflowStep[];
        payload.steps = stepsPayload;
      } else {
        definitionPayload = processDefinition;
        payload.definition = definitionPayload;
      }
      if (isGroupAdmin) {
        payload.company_id = values.company_id ?? 0;
      } else if (isSubAdmin) {
        payload.company_id = currentUser.company_id || undefined;
      }

      if (effectiveStatus === "active") {
        const validation = await validateProcessDefinition(
          definitionPayload
            ? { definition: definitionPayload }
            : { steps: stepsPayload || [] }
        );
        if (!validation.valid) {
          const errorText = validation.errors.map(toValidationMessage).join("；");
          throw new Error(`流程校验未通过：${errorText}`);
        }
        if (validation.warnings?.length) {
          message.warning(validation.warnings.map(toValidationMessage).join("；"));
        }
      }

      payload.form_schema = processFormSchemaDraft;

      let savedTemplate: ProcessTemplate;
      if (editingProcess) {
        savedTemplate = await requestJson<ProcessTemplate>(`/approval/process-templates/${editingProcess.id}`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify(payload)
        });
      } else {
        savedTemplate = await requestJson<ProcessTemplate>("/approval/process-templates", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(payload)
        });
      }
      processEditorForm.setFieldsValue({
        form_template_id: savedTemplate.form_template_id
      });
      message.success(
        effectiveStatus === "active"
          ? editingProcess
            ? "流程模板已更新并发布"
            : "流程模板已创建并发布"
          : editingProcess
            ? "流程模板已更新"
            : "流程模板已创建"
      );
      clearProcessLocalDraft(editingProcess?.id || null);
      setProcessDrawerOpen(false);
      setEditingProcess(null);
      setProcessInitialSnapshot("");
      setProcessAutoSaveAt(null);
      resetProcessEditorHistory();
      setProcessVersions([]);
      await fetchProcessTemplates();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setProcessSaving(false);
    }
  };

  const runPublishCheck = async () => {
    const values = await processEditorForm.validateFields(["name", "mode"]);
    let validation: WorkflowValidationResult;
    let currentDefinitionForDiff: WorkflowDefinition = processDefinition;
    validateDraftSchemaBasics(processFormSchemaDraft);
    if (values.mode === "json") {
      let stepsParsed: unknown;
      try {
        stepsParsed = JSON.parse(values.steps_text || "[]");
      } catch {
        throw new Error("流程节点 JSON 解析失败，请检查格式");
      }
      if (!Array.isArray(stepsParsed)) {
        throw new Error("流程 steps 必须是数组");
      }
      const normalizedSteps = stepsParsed as WorkflowStep[];
      validation = await validateProcessDefinition({ steps: normalizedSteps });
      currentDefinitionForDiff = stepsToDefinition(normalizedSteps);
    } else {
      validation = await validateProcessDefinition({ definition: processDefinition });
      currentDefinitionForDiff = processDefinition;
    }

    const publishedVersionNo = Number(editingProcess?.published_version || 0);
    const publishedVersion =
      processVersions.find((item) => item.version_no === publishedVersionNo) ||
      processVersions.find((item) => item.status === "published");
    const baseDefinitionForDiff =
      publishedVersion?.definition ||
      editingProcess?.definition ||
      stepsToDefinition((editingProcess?.steps || []) as WorkflowStep[]);
    const definitionDiff = computeDefinitionDiff(currentDefinitionForDiff, baseDefinitionForDiff);
    const fieldDiff = computeSchemaDiff(
      processFormSchemaDraft,
      ((publishedVersion?.form_schema || editingProcess?.form_schema || []) as WorkflowField[])
    );
    const hasChanges =
      definitionDiff.nodes.added.length > 0 ||
      definitionDiff.nodes.removed.length > 0 ||
      definitionDiff.nodes.changed.length > 0 ||
      definitionDiff.edges.added.length > 0 ||
      definitionDiff.edges.removed.length > 0 ||
      definitionDiff.edges.changed.length > 0 ||
      fieldDiff.added.length > 0 ||
      fieldDiff.removed.length > 0 ||
      fieldDiff.changed.length > 0;

    setPublishCheckResult({
      validation,
      diff: {
        fields: fieldDiff,
        nodes: definitionDiff.nodes,
        edges: definitionDiff.edges
      },
      hasChanges
    });
  };

  const openPublishCheck = async () => {
    setPublishCheckOpen(true);
    setPublishCheckResult(null);
    setPublishCheckLoading(true);
    try {
      await runPublishCheck();
    } catch (err) {
      setPublishCheckOpen(false);
      message.error(err instanceof Error ? err.message : "发布检查失败");
    } finally {
      setPublishCheckLoading(false);
    }
  };

  const buildDraftCompareResult = (
    baseLabel: string,
    baseDefinition?: WorkflowDefinition,
    baseSchema?: WorkflowField[]
  ): DraftCompareResult => {
    const currentDefinitionForDiff =
      processEditorMode === "designer"
        ? processDefinition
        : stepsToDefinition(parseStepsText(String(processEditorForm.getFieldValue("steps_text") || "[]")) || []);
    const baseDefinitionForDiff =
      baseDefinition ||
      editingProcess?.definition ||
      stepsToDefinition((editingProcess?.steps || []) as WorkflowStep[]);
    const definitionDiff = computeDefinitionDiff(currentDefinitionForDiff, baseDefinitionForDiff);
    const fieldDiff = computeSchemaDiff(
      processFormSchemaDraft,
      ((baseSchema || editingProcess?.form_schema || []) as WorkflowField[])
    );
    const hasChanges =
      definitionDiff.nodes.added.length > 0 ||
      definitionDiff.nodes.removed.length > 0 ||
      definitionDiff.nodes.changed.length > 0 ||
      definitionDiff.edges.added.length > 0 ||
      definitionDiff.edges.removed.length > 0 ||
      definitionDiff.edges.changed.length > 0 ||
      fieldDiff.added.length > 0 ||
      fieldDiff.removed.length > 0 ||
      fieldDiff.changed.length > 0;
    return {
      baseLabel,
      diff: {
        fields: fieldDiff,
        nodes: definitionDiff.nodes,
        edges: definitionDiff.edges
      },
      hasChanges
    };
  };

  const openDraftCompareWithVersion = (version: ProcessTemplateVersion) => {
    const result = buildDraftCompareResult(
      `v${version.version_no}`,
      version.definition,
      (version.form_schema || []) as WorkflowField[]
    );
    setDraftCompareResult(result);
    setDraftCompareOpen(true);
  };

  const rollbackToVersion = (version: ProcessTemplateVersion) => {
    Modal.confirm({
      title: `回滚到 v${version.version_no}？`,
      content: "会用该版本的表单与流程覆盖当前草稿，回滚后请点击保存。",
      okText: "确认回滚",
      cancelText: "取消",
      okType: "danger",
      onOk: () => {
        const nextDefinition = cloneJson(version.definition || createDefaultDefinition());
        const nextSchema = cloneJson((version.form_schema || []) as WorkflowField[]);
        setProcessDefinition(nextDefinition);
        setDesignerSeed((seed) => seed + 1);
        setProcessFormSchemaDraft(nextSchema);
        setProcessFormDesignerSeed((seed) => seed + 1);
        setProcessWizardStep(1);
        resetProcessEditorHistory();
        processEditorForm.setFieldsValue({ mode: "designer" });
        setDraftCompareOpen(false);
        setDraftCompareResult(null);
        message.success(`已回滚到 v${version.version_no}，请保存生效。`);
      }
    });
  };

  const confirmPublish = async () => {
    if (!publishCheckResult?.validation.valid) {
      message.error("流程校验未通过，无法发布");
      return;
    }
    setPublishCheckOpen(false);
    await saveProcessTemplate("active");
  };

  const updateProcessTemplateStatus = async (
    process: ProcessTemplate,
    nextStatus: ProcessTemplate["status"]
  ) => {
    try {
      setProcessesLoading(true);
      if (nextStatus === "active") {
        const validation = await validateProcessDefinition(
          process.definition ? { definition: process.definition } : { steps: process.steps || [] }
        );
        if (!validation.valid) {
          const errorText = validation.errors.map(toValidationMessage).join("；");
          throw new Error(`发布失败：${errorText}`);
        }
      }
      await requestJson<ProcessTemplate>(`/approval/process-templates/${process.id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ status: nextStatus })
      });
      message.success(nextStatus === "active" ? "流程已发布" : "流程已下线并转为草稿");
      await fetchProcessTemplates();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "更新流程状态失败");
    } finally {
      setProcessesLoading(false);
    }
  };

  const openStartInstanceDrawer = () => {
    setSelectedProcess(null);
    startForm.resetFields();
    restoreStartLocalDraft();
    setStartDrawerOpen(true);
  };

  const onSelectProcess = (processId: number) => {
    const template = processTemplates.find((item) => item.id === processId) || null;
    setSelectedProcess(template);
    setStartDraftSavedAt(null);
    const defaults: Record<string, FormDataValue | undefined> = {};
    (template?.form_schema || []).forEach((field) => {
      const defaultValue = field.default;
      if (
        defaultValue !== undefined &&
        defaultValue !== null &&
        defaultValue !== ""
      ) {
        defaults[field.key] = defaultValue as FormDataValue | undefined;
      }
    });
    startForm.setFieldsValue({
      process_template_id: processId,
      form_data: defaults
    });
  };

  const normalizeSubmissionData = (
    schema: WorkflowField[],
    rawFormData: Record<string, FormDataValue | undefined> | undefined
  ) => {
    const raw = rawFormData || {};
    const normalized: Record<string, unknown> = {};
    schema.forEach((field) => {
      const value = raw[field.key];
      if (isEmptyValue(value)) {
        return;
      }

      if (field.type === "attachment") {
        if (!Array.isArray(value)) {
          return;
        }
        const files = value
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter((item) => item);
        if (files.length > 0) {
          normalized[field.key] = files;
        }
        return;
      }

      if (field.type === "table") {
        if (!Array.isArray(value)) {
          return;
        }
        const columns = field.columns || [];
        const rows = value
          .map((row) => {
            if (!row || typeof row !== "object" || Array.isArray(row)) {
              return null;
            }
            const source = row as Record<string, unknown>;
            const normalizedRow: Record<string, unknown> = {};
            columns.forEach((column) => {
              const columnValue = source[column.key];
              if (isEmptyValue(columnValue)) {
                return;
              }
              if (column.type === "date") {
                const dateText = toDateText(columnValue);
                if (dateText) {
                  normalizedRow[column.key] = dateText;
                }
                return;
              }
              normalizedRow[column.key] = columnValue;
            });
            return Object.keys(normalizedRow).length > 0 ? normalizedRow : null;
          })
          .filter((row): row is Record<string, unknown> => !!row);
        if (rows.length > 0) {
          normalized[field.key] = rows;
        }
        return;
      }

      if (field.type === "date") {
        const dateText = toDateText(value);
        if (dateText) {
          normalized[field.key] = dateText;
        }
        return;
      }

      if (typeof value === "string") {
        const text = value.trim();
        if (text) {
          normalized[field.key] = text;
        }
        return;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        normalized[field.key] = value;
      }
    });
    return normalized;
  };

  const startInstance = async () => {
    try {
      const values = await startForm.validateFields();
      const template = processTemplates.find((item) => item.id === values.process_template_id);
      if (!template) {
        throw new Error("请选择流程模板");
      }
      const payload = {
        process_template_id: values.process_template_id,
        title: values.title,
        form_data: normalizeSubmissionData(template.form_schema || [], values.form_data)
      };
      setStartSaving(true);
      await requestJson<ApprovalInstanceDetail>("/approval/instances", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload)
      });
      message.success("审批实例已发起");
      clearStartLocalDraft();
      setStartDrawerOpen(false);
      setSelectedProcess(null);
      startForm.resetFields();
      await fetchInstances(instanceScope, instanceStatus, instancePage, instancePageSize);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "发起失败");
    } finally {
      setStartSaving(false);
    }
  };

  const runInstanceAction = async (
    action: "approve" | "reject" | "withdraw" | "return" | "transfer" | "add_sign" | "remind",
    extraPayload?: Record<string, unknown>
  ) => {
    if (!detailData) {
      return;
    }
    try {
      setActionLoading(true);
      const idempotencySignature = JSON.stringify({
        instance_id: detailData.id,
        action,
        comment: actionComment || "",
        extra: extraPayload || {},
        bucket: Math.floor(Date.now() / 5000)
      });
      let idempotencyHash = 0;
      for (let index = 0; index < idempotencySignature.length; index += 1) {
        idempotencyHash = (idempotencyHash * 31 + idempotencySignature.charCodeAt(index)) >>> 0;
      }
      const idempotencyKey = `wf-action-${detailData.id}-${action}-${idempotencyHash.toString(16)}`;
      const data = await requestJson<ApprovalInstanceDetail>(`/approval/instances/${detailData.id}/actions`, {
        method: "POST",
        headers: {
          ...(authHeaders as Record<string, string>),
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify({
          action,
          comment: actionComment || undefined,
          ...(extraPayload || {})
        })
      });
      setDetailData(data);
      setActionComment("");
      if (action === "transfer") {
        setTransferTargetUserId(undefined);
      }
      if (action === "add_sign") {
        setAddSignUserIds([]);
      }
      await fetchInstances(instanceScope, instanceStatus, instancePage, instancePageSize);
      const actionText: Record<string, string> = {
        approve: "审批通过",
        reject: "已拒绝",
        withdraw: "已撤回",
        return: "已退回",
        transfer: "已转交",
        add_sign: "已加签",
        remind: "已催办"
      };
      message.success(actionText[action] || "操作成功");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const editableActionFields = useMemo(() => {
    if (!detailData || detailData.status !== "pending" || !detailData.pending_action) {
      return [] as WorkflowField[];
    }
    const permissionMap = detailData.field_permissions || {};
    return (detailData.form_schema || []).filter((field) => {
      const permission = permissionMap[field.key];
      return Boolean(field.can_edit ?? permission?.can_edit);
    });
  }, [detailData]);

  const submitApproveAction = async () => {
    if (!detailData) {
      return;
    }
    try {
      let payload: Record<string, unknown> | undefined;
      if (editableActionFields.length > 0) {
        const values = await actionForm.validateFields();
        payload = {
          form_data: normalizeSubmissionData(editableActionFields, values.form_data)
        };
      }
      await runInstanceAction("approve", payload);
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in (err as Record<string, unknown>)) {
        return;
      }
      message.error(err instanceof Error ? err.message : "审批提交失败");
    }
  };

  const processColumns: ColumnsType<ProcessTemplate> = [
    {
      title: "模板名称",
      dataIndex: "name",
      key: "name",
      render: (value: string) => <Text strong>{value}</Text>
    },
    {
      title: "绑定表单",
      dataIndex: "form_template_name",
      key: "form_template_name",
      render: (value?: string | null) => value || "-"
    },
    {
      title: "公司范围",
      key: "company_name",
      render: (_, row) => row.company_name || "集团通用"
    },
    {
      title: "节点数",
      dataIndex: "step_count",
      key: "step_count"
    },
    {
      title: "版本",
      key: "version",
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text>当前 v{row.current_version || 1}</Text>
          <Text type="secondary">
            {row.published_version ? `已发布 v${row.published_version}` : "未发布"}
          </Text>
        </Space>
      )
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (value: ProcessTemplate["status"]) => (
        <Tag color={PROCESS_TEMPLATE_STATUS_COLORS[value]}>{PROCESS_TEMPLATE_STATUS_LABELS[value]}</Tag>
      )
    },
    {
      title: "操作",
      key: "actions",
      width: 260,
      render: (_, row) =>
        canManageTemplates ? (
          <Space size={4}>
            <Button type="text" icon={<EditOutlined />} onClick={() => openEditProcessTemplate(row)}>
              编辑
            </Button>
            <Button type="text" icon={<CopyOutlined />} onClick={() => openCopyProcessTemplate(row)}>
              复制
            </Button>
            {row.status === "inactive" ? (
              <Button
                type="text"
                icon={<CheckCircleOutlined />}
                onClick={() => updateProcessTemplateStatus(row, "active")}
              >
                发布
              </Button>
            ) : (
              <Popconfirm
                title="确认下线该流程并转为草稿？"
                onConfirm={() => updateProcessTemplateStatus(row, "inactive")}
              >
                <Button type="text" icon={<StopOutlined />} danger>
                  下线
                </Button>
              </Popconfirm>
            )}
          </Space>
        ) : null
    }
  ];

  const instanceColumns: ColumnsType<ApprovalInstance> = [
    {
      title: "单号",
      dataIndex: "id",
      key: "id",
      width: 90
    },
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      render: (value: string, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{row.process_name}</Text>
        </Space>
      )
    },
    {
      title: "发起人",
      dataIndex: "applicant_name",
      key: "applicant_name",
      render: (value?: string | null) => value || "-"
    },
    {
      title: "进度",
      key: "progress",
      render: (_, row) => `${row.current_step}/${row.total_steps} ${row.current_step_name || ""}`
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (value: ApprovalInstance["status"], row) => (
        <Space size={6}>
          <Tag color={INSTANCE_STATUS_COLORS[value]}>{INSTANCE_STATUS_LABELS[value]}</Tag>
          {row.pending_action ? <Tag color="orange">待我审批</Tag> : null}
        </Space>
      )
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
      width: 80,
      render: (_, row) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          onClick={() => fetchInstanceDetail(row.id)}
          aria-label="查看"
        />
      )
    }
  ];

  const taskColumns: ColumnsType<ApprovalTask> = [
    {
      title: "步骤",
      key: "step",
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text>{`第${row.step_no}步`}</Text>
          <Text type="secondary">{row.step_name}</Text>
        </Space>
      )
    },
    {
      title: "审批人",
      dataIndex: "approver_name",
      key: "approver_name",
      render: (value?: string | null) => value || "-"
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (value: ApprovalTask["status"]) => {
        const color =
          value === "approved"
            ? "green"
            : value === "rejected"
              ? "red"
              : value === "pending"
                ? "blue"
                : value === "waiting"
                  ? "gold"
                  : "default";
        return <Tag color={color}>{TASK_STATUS_LABELS[value]}</Tag>;
      }
    },
    {
      title: "意见",
      dataIndex: "comment",
      key: "comment",
      render: (value?: string | null) => value || "-"
    },
    {
      title: "处理时间",
      dataIndex: "acted_at",
      key: "acted_at",
      render: (value?: string | null) => (value ? new Date(value).toLocaleString() : "-")
    }
  ];

  const eventColumns: ColumnsType<ApprovalEvent> = [
    {
      title: "时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (value?: string | null) => (value ? new Date(value).toLocaleString() : "-")
    },
    {
      title: "动作",
      dataIndex: "action",
      key: "action",
      width: 140,
      render: (value: string) => {
        const color =
          value === "approve"
            ? "green"
            : value === "reject" || value === "return"
              ? "red"
              : value === "transfer" || value === "add_sign" || value === "remind"
                ? "blue"
                : "default";
        return <Tag color={color}>{EVENT_ACTION_LABELS[value] || value}</Tag>;
      }
    },
    {
      title: "处理人",
      dataIndex: "user_name",
      key: "user_name",
      width: 120,
      render: (value?: string | null) => value || "-"
    },
    {
      title: "说明",
      key: "summary",
      render: (_, row) => {
        const detail = row.detail && typeof row.detail === "object" ? JSON.stringify(row.detail) : "";
        const text = [row.comment, detail].filter((item) => item).join(" | ");
        return text || "-";
      }
    }
  ];

  const renderFieldInput = (field: WorkflowField | WorkflowFieldColumn) => {
    const placeholder = field.placeholder || `请输入${field.label}`;
    if (field.type === "textarea") {
      return <Input.TextArea rows={3} placeholder={placeholder} />;
    }
    if (field.type === "number") {
      return <InputNumber style={{ width: "100%" }} placeholder={placeholder} min={0} />;
    }
    if (field.type === "date") {
      return <DatePicker style={{ width: "100%" }} />;
    }
    if (field.type === "select") {
      return (
        <Select allowClear placeholder={`请选择${field.label}`}>
          {(field.options || []).map((option) => (
            <Select.Option key={option} value={option}>
              {option}
            </Select.Option>
          ))}
        </Select>
      );
    }
    if (field.type === "attachment") {
      return (
        <Select
          mode="tags"
          allowClear
          tokenSeparators={[","]}
          placeholder={field.placeholder || `输入${field.label}，按回车添加`}
        />
      );
    }
    if (field.type === "boolean") {
      return (
        <Select allowClear placeholder={`请选择${field.label}`}>
          <Select.Option value={true}>是</Select.Option>
          <Select.Option value={false}>否</Select.Option>
        </Select>
      );
    }
    return <Input placeholder={placeholder} />;
  };

  const renderActionFieldInput = (field: WorkflowField | WorkflowFieldColumn) => {
    if (field.type === "date") {
      return <Input placeholder={field.placeholder || "YYYY-MM-DD"} />;
    }
    return renderFieldInput(field);
  };

  const isDesktopFullWidthField = (field: WorkflowField | WorkflowFieldColumn) =>
    field.type === "textarea" || field.type === "attachment" || field.type === "table";

  const renderDetailFieldValue = (field: WorkflowField, value: unknown) => {
    if (value === undefined || value === null) {
      return <Text type="secondary">-</Text>;
    }
    if (field.type === "boolean" && typeof value === "boolean") {
      return <Text type="secondary">{value ? "是" : "否"}</Text>;
    }
    if (field.type === "attachment") {
      const files = Array.isArray(value)
        ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter((item) => item)
        : [];
      if (!files.length) {
        return <Text type="secondary">-</Text>;
      }
      return (
        <Space wrap>
          {files.map((item) => (
            <Tag key={item}>{item}</Tag>
          ))}
        </Space>
      );
    }
    if (field.type === "table") {
      const rows = Array.isArray(value)
        ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item))
        : [];
      if (!rows.length) {
        return <Text type="secondary">-</Text>;
      }
      return (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          {rows.map((row, index) => (
            <Card key={`${field.key}_${index}`} size="small" title={`第${index + 1}行`}>
              <Space wrap>
                {(field.columns || []).map((column) => {
                  const rowData = row as Record<string, unknown>;
                  const cellValue = rowData[column.key];
                  const cellText =
                    cellValue === undefined || cellValue === null || cellValue === ""
                      ? "-"
                      : typeof cellValue === "boolean"
                        ? cellValue
                          ? "是"
                          : "否"
                        : String(cellValue);
                  return <Tag key={`${field.key}_${index}_${column.key}`}>{`${column.label}: ${cellText}`}</Tag>;
                })}
              </Space>
            </Card>
          ))}
        </Space>
      );
    }
    if (Array.isArray(value)) {
      return <Text type="secondary">{value.join("，")}</Text>;
    }
    return <Text type="secondary">{String(value)}</Text>;
  };

  const processCurrentSnapshot = useMemo(
    () =>
      toSnapshotText({
        name: processEditorValues?.name || "",
        description: processEditorValues?.description || "",
        status: processEditorValues?.status || "inactive",
        company_id: processEditorValues?.company_id ?? (isGroupAdmin ? 0 : currentUser.company_id || 0),
        form_template_id: processEditorValues?.form_template_id || editingProcess?.form_template_id || 0,
        mode: processEditorValues?.mode || "designer",
        steps_text: processEditorValues?.steps_text || "",
        definition: processDefinition,
        form_schema: processFormSchemaDraft
      }),
    [
      currentUser.company_id,
      editingProcess?.form_template_id,
      isGroupAdmin,
      processDefinition,
      processEditorValues,
      processFormSchemaDraft
    ]
  );

  const processEditorDirty =
    processDrawerOpen && Boolean(processInitialSnapshot) && processCurrentSnapshot !== processInitialSnapshot;

  useEffect(() => {
    if (!processDrawerOpen || !processEditorDirty) {
      return;
    }
    const templateId = editingProcess?.id || null;
    const timer = window.setTimeout(() => {
      try {
        const formValues = (processEditorForm.getFieldsValue(true) || {}) as Partial<ProcessTemplateEditorValues>;
        const payload: ProcessEditorLocalDraft = {
          version: 1,
          template_id: templateId,
          saved_at: Date.now(),
          form_values: {
            ...formValues,
            mode: formValues.mode || processEditorMode || "designer",
            steps_text: formValues.steps_text || ""
          },
          definition: cloneJson(processDefinition),
          form_schema: cloneJson(processFormSchemaDraft),
          wizard_step: processWizardStep,
          meta_visible: processMetaVisible
        };
        localStorage.setItem(getProcessDraftStorageKey(templateId), JSON.stringify(payload));
        setProcessAutoSaveAt(payload.saved_at);
      } catch {
        // ignore local storage write failure
      }
    }, 900);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    editingProcess?.id,
    getProcessDraftStorageKey,
    processCurrentSnapshot,
    processDefinition,
    processDrawerOpen,
    processEditorDirty,
    processEditorForm,
    processEditorMode,
    processFormSchemaDraft,
    processMetaVisible,
    processWizardStep
  ]);

  useEffect(() => {
    if (!startDrawerOpen) {
      return;
    }
    const processTemplateId = Number(startFormValues?.process_template_id || 0);
    if (!Number.isFinite(processTemplateId) || processTemplateId <= 0) {
      return;
    }
    const template = processTemplates.find((item) => item.id === processTemplateId);
    if (!template) {
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        const normalizedFormData = normalizeSubmissionData(
          template.form_schema || [],
          startFormValues?.form_data as Record<string, FormDataValue | undefined> | undefined
        );
        const title = String(startFormValues?.title || "").trim() || "";
        const signature = JSON.stringify({
          process_template_id: processTemplateId,
          title,
          form_data: normalizedFormData
        });
        if (signature === startDraftSignatureRef.current) {
          return;
        }
        const payload: StartInstanceLocalDraft = {
          version: 1,
          saved_at: Date.now(),
          process_template_id: processTemplateId,
          title: title || undefined,
          form_data: normalizedFormData
        };
        localStorage.setItem(getStartDraftStorageKey(), JSON.stringify(payload));
        startDraftSignatureRef.current = signature;
        setStartDraftSavedAt(payload.saved_at);
      } catch {
        // ignore local storage write failure
      }
    }, 900);
    return () => {
      window.clearTimeout(timer);
    };
  }, [getStartDraftStorageKey, processTemplates, startDrawerOpen, startFormValues]);

  const closeEditorWithConfirm = (dirty: boolean, onConfirm: () => void) => {
    if (!dirty) {
      onConfirm();
      return;
    }
    Modal.confirm({
      title: "当前有未保存的修改",
      content: "确定离开当前页面并放弃修改吗？",
      okText: "放弃修改",
      okType: "danger",
      cancelText: "继续编辑",
      onOk: onConfirm
    });
  };

  const closeProcessEditorPage = () => {
    closeEditorWithConfirm(processEditorDirty, () => {
      clearProcessLocalDraft(editingProcess?.id || null);
      setProcessDrawerOpen(false);
      setEditingProcess(null);
      setProcessMetaVisible(false);
      setProcessWizardStep(1);
      setProcessFormSchemaDraft([]);
      setProcessFormDesignerSeed((seed) => seed + 1);
      setProcessInitialSnapshot("");
      setProcessAutoSaveAt(null);
      resetProcessEditorHistory();
      setProcessVersions([]);
      setDraftCompareOpen(false);
      setDraftCompareResult(null);
    });
  };

  const resetProcessEditorDraft = useCallback(() => {
    clearProcessLocalDraft(editingProcess?.id || null);
    setProcessAutoSaveAt(null);
    if (!processInitialSnapshot) {
      message.success("已清空本地草稿");
      return;
    }
    try {
      const parsed = JSON.parse(processInitialSnapshot) as Partial<ProcessEditorSnapshot>;
      const nextMode = parsed.mode === "json" ? "json" : "designer";
      const nextValues: Partial<ProcessTemplateEditorValues> = {
        name: String(parsed.name || ""),
        description: String(parsed.description || ""),
        status: parsed.status === "active" ? "active" : "inactive",
        company_id: typeof parsed.company_id === "number" ? parsed.company_id : undefined,
        form_template_id: typeof parsed.form_template_id === "number" ? parsed.form_template_id : undefined,
        mode: nextMode,
        steps_text: String(parsed.steps_text || "")
      };
      processEditorForm.setFieldsValue(nextValues as ProcessTemplateEditorValues);
      const nextDefinition =
        parsed.definition && typeof parsed.definition === "object"
          ? cloneJson(parsed.definition as WorkflowDefinition)
          : createDefaultDefinition();
      const nextSchema = Array.isArray(parsed.form_schema)
        ? cloneJson(parsed.form_schema as WorkflowField[])
        : [];
      setProcessDefinition(nextDefinition);
      setDesignerSeed((seed) => seed + 1);
      setProcessFormSchemaDraft(nextSchema);
      setProcessFormDesignerSeed((seed) => seed + 1);
      setProcessWizardStep(1);
      setProcessMetaVisible(false);
      resetProcessEditorHistory();
      setDraftCompareOpen(false);
      setDraftCompareResult(null);
      message.success("已恢复到打开时状态，并清空本地草稿");
    } catch {
      message.error("重置草稿失败，请重试");
    }
  }, [clearProcessLocalDraft, editingProcess?.id, processEditorForm, processInitialSnapshot]);

  const confirmResetProcessEditorDraft = () => {
    Modal.confirm({
      title: "重置当前草稿？",
      content: "会恢复到本次打开页面时状态，并清空本地草稿。",
      okText: "确认重置",
      cancelText: "取消",
      okType: "danger",
      onOk: resetProcessEditorDraft
    });
  };

  const handleProcessDefinitionChange = useCallback((nextDefinition: WorkflowDefinition) => {
    const safeNextDefinition = cloneJson(nextDefinition || createDefaultDefinition());
    const nextSignature = buildDefinitionHistorySignature(safeNextDefinition);
    const replayLocked = Date.now() < processDefinitionReplayLockUntilRef.current;
    setProcessDefinition((currentDefinition) => {
      const safeCurrentDefinition = cloneJson(currentDefinition || createDefaultDefinition());
      const currentSignature = buildDefinitionHistorySignature(safeCurrentDefinition);
      if (currentSignature === nextSignature) {
        return currentDefinition;
      }
      if (replayLocked) {
        return currentDefinition;
      }
      setProcessDefinitionPast((past) => [...past.slice(-40), safeCurrentDefinition]);
      setProcessDefinitionFuture([]);
      return safeNextDefinition;
    });
  }, []);

  const handleProcessFormSchemaChange = useCallback((nextSchema: WorkflowField[]) => {
    const safeNextSchema = cloneJson((nextSchema || []) as WorkflowField[]);
    const nextSignature = JSON.stringify(safeNextSchema);
    setProcessFormSchemaDraft((currentSchema) => {
      const safeCurrentSchema = cloneJson((currentSchema || []) as WorkflowField[]);
      const currentSignature = JSON.stringify(safeCurrentSchema);
      if (currentSignature === nextSignature) {
        return currentSchema;
      }
      setProcessFormSchemaPast((past) => [...past.slice(-40), safeCurrentSchema]);
      setProcessFormSchemaFuture([]);
      return safeNextSchema;
    });
  }, []);

  const undoProcessDefinition = useCallback(() => {
    processDefinitionReplayLockUntilRef.current = Date.now() + 500;
    setProcessDefinitionPast((past) => {
      if (!past.length) {
        return past;
      }
      const previousDefinition = cloneJson(past[past.length - 1]);
      setProcessDefinition((currentDefinition) => {
        const safeCurrentDefinition = cloneJson(currentDefinition || createDefaultDefinition());
        setProcessDefinitionFuture((future) => [safeCurrentDefinition, ...future].slice(0, 40));
        return previousDefinition;
      });
      return past.slice(0, -1);
    });
  }, []);

  const redoProcessDefinition = useCallback(() => {
    processDefinitionReplayLockUntilRef.current = Date.now() + 500;
    setProcessDefinitionFuture((future) => {
      if (!future.length) {
        return future;
      }
      const nextDefinition = cloneJson(future[0]);
      setProcessDefinition((currentDefinition) => {
        const safeCurrentDefinition = cloneJson(currentDefinition || createDefaultDefinition());
        setProcessDefinitionPast((past) => [...past.slice(-40), safeCurrentDefinition]);
        return nextDefinition;
      });
      return future.slice(1);
    });
  }, []);

  const undoProcessFormSchema = useCallback(() => {
    setProcessFormSchemaPast((past) => {
      if (!past.length) {
        return past;
      }
      const previousSchema = cloneJson(past[past.length - 1]);
      setProcessFormSchemaDraft((currentSchema) => {
        const safeCurrentSchema = cloneJson((currentSchema || []) as WorkflowField[]);
        setProcessFormSchemaFuture((future) => [safeCurrentSchema, ...future].slice(0, 40));
        return previousSchema;
      });
      setProcessFormDesignerSeed((seed) => seed + 1);
      return past.slice(0, -1);
    });
  }, []);

  const redoProcessFormSchema = useCallback(() => {
    setProcessFormSchemaFuture((future) => {
      if (!future.length) {
        return future;
      }
      const nextSchema = cloneJson(future[0]);
      setProcessFormSchemaDraft((currentSchema) => {
        const safeCurrentSchema = cloneJson((currentSchema || []) as WorkflowField[]);
        setProcessFormSchemaPast((past) => [...past.slice(-40), safeCurrentSchema]);
        return nextSchema;
      });
      setProcessFormDesignerSeed((seed) => seed + 1);
      return future.slice(1);
    });
  }, []);

  const templateEditorOpen = processDrawerOpen;
  const processCanEnterFlowStep = processFormSchemaDraft.length > 0;
  const canUndoProcessFormSchema = processFormSchemaPast.length > 0;
  const canRedoProcessFormSchema = processFormSchemaFuture.length > 0;
  const canUndoProcessDefinition = processDefinitionPast.length > 0;
  const canRedoProcessDefinition = processDefinitionFuture.length > 0;
  const processFormFieldsForPermission = useMemo(
    () =>
      (processFormSchemaDraft || []).map((field) => ({
        key: field.key,
        label: field.label
      })),
    [processFormSchemaDraft]
  );

  useEffect(() => {
    if (templateEditorOpen) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [templateEditorOpen]);

  useEffect(() => {
    if (!templateEditorOpen) {
      return;
    }
    const hasDirty = processEditorDirty;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasDirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [templateEditorOpen, processEditorDirty]);

  const renderDiffTags = (items: string[], emptyText: string) => {
    if (!items.length) {
      return <Text type="secondary">{emptyText}</Text>;
    }
    return (
      <Space wrap>
        {items.map((item) => (
          <Tag key={item}>{item}</Tag>
        ))}
      </Space>
    );
  };

  return (
    <>
      {!templateEditorOpen ? (
        <Card
          title="流程审批中心"
          extra={
            <Space>
              <Button
                icon={<PlayCircleOutlined />}
                type="primary"
                onClick={openStartInstanceDrawer}
                data-testid="workflow-open-start-drawer-button"
              >
                发起审批
              </Button>
              {canManageTemplates ? (
                <>
                  <Button
                    icon={<PlusOutlined />}
                    onClick={openCreateProcessTemplate}
                    data-testid="workflow-create-template-button"
                  >
                    新建流程模板
                  </Button>
                </>
              ) : null}
            </Space>
          }
        >
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <Tabs.TabPane tab="审批实例" key="instances">
              <Space style={{ marginBottom: 12 }}>
                <Select value={instanceScope} onChange={handleInstanceScopeChange} style={{ width: 140 }}>
                  <Select.Option value="all">全部可见</Select.Option>
                  <Select.Option value="mine">我发起的</Select.Option>
                  <Select.Option value="pending">我的待办</Select.Option>
                </Select>
                <Select
                  value={instanceStatus}
                  onChange={(value) =>
                    handleInstanceStatusChange(value as "pending" | "approved" | "rejected" | "withdrawn" | "")
                  }
                  style={{ width: 140 }}
                >
                  <Select.Option value="">全部状态</Select.Option>
                  <Select.Option value="pending">审批中</Select.Option>
                  <Select.Option value="approved">已通过</Select.Option>
                  <Select.Option value="rejected">已拒绝</Select.Option>
                  <Select.Option value="withdrawn">已撤回</Select.Option>
                </Select>
              </Space>
              <Table
                rowKey="id"
                columns={instanceColumns}
                dataSource={instances}
                loading={instancesLoading}
                pagination={{
                  current: instancePage,
                  pageSize: instancePageSize,
                  total: instanceTotal,
                  showSizeChanger: true,
                  pageSizeOptions: ["10", "20", "50", "100"],
                  showTotal: (total) => `共 ${total} 条`,
                  onChange: handleInstanceTablePageChange
                }}
                scroll={{ x: "max-content" }}
              />
            </Tabs.TabPane>

            {canManageTemplates ? (
              <Tabs.TabPane tab="流程模板" key="processes">
                <Table
                  rowKey="id"
                  columns={processColumns}
                  dataSource={processTemplates}
                  loading={processesLoading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: "max-content" }}
                />
              </Tabs.TabPane>
            ) : null}
          </Tabs>
        </Card>
      ) : null}

      {processDrawerOpen ? (
        <div className="workflow-editor-page workflow-editor-page-portal">
            <div className="workflow-editor-page-header">
              <div>
                <div className="workflow-editor-page-title">{editingProcess ? "编辑流程模板" : "新建流程模板"}</div>
                {processAutoSaveAt ? (
                  <Text type="secondary">{`本地草稿自动保存于 ${new Date(processAutoSaveAt).toLocaleTimeString()}`}</Text>
                ) : null}
              </div>
              <Space>
                <Button onClick={closeProcessEditorPage}>返回</Button>
                {processEditorMode === "designer" && processWizardStep === 1 ? (
                  <>
                    <Button
                      icon={<UndoOutlined />}
                      disabled={!canUndoProcessFormSchema || processSaving}
                      onClick={undoProcessFormSchema}
                      data-testid="workflow-form-undo-button"
                    >
                      撤销
                    </Button>
                    <Button
                      icon={<RedoOutlined />}
                      disabled={!canRedoProcessFormSchema || processSaving}
                      onClick={redoProcessFormSchema}
                      data-testid="workflow-form-redo-button"
                    >
                      重做
                    </Button>
                  </>
                ) : null}
                {processEditorMode === "designer" && processWizardStep === 2 ? (
                  <>
                    <Button
                      icon={<UndoOutlined />}
                      disabled={!canUndoProcessDefinition || processSaving}
                      onClick={undoProcessDefinition}
                      data-testid="workflow-flow-undo-button"
                    >
                      撤销
                    </Button>
                    <Button
                      icon={<RedoOutlined />}
                      disabled={!canRedoProcessDefinition || processSaving}
                      onClick={redoProcessDefinition}
                      data-testid="workflow-flow-redo-button"
                    >
                      重做
                    </Button>
                  </>
                ) : null}
                {processAutoSaveAt ? (
                  <Button
                    danger
                    onClick={confirmResetProcessEditorDraft}
                    data-testid="workflow-process-reset-draft-button"
                >
                  重置草稿
                </Button>
              ) : null}
              {processEditorMode === "designer" && processWizardStep === 2 ? (
                <Button disabled={processSaving} onClick={goProcessWizardPrevStep}>
                  上一步
                </Button>
              ) : null}
              {processEditorMode === "designer" && processWizardStep === 1 ? (
                <Button
                  type="primary"
                  disabled={!processCanEnterFlowStep || processSaving}
                  onClick={goProcessWizardNextStep}
                  data-testid="workflow-wizard-next-button"
                >
                  下一步
                </Button>
              ) : null}
              <Button disabled={processSaving} loading={processSaving} onClick={() => saveProcessTemplate()}>
                保存
              </Button>
              <Button type="primary" loading={processSaving} disabled={processSaving} onClick={openPublishCheck}>
                发布
              </Button>
            </Space>
          </div>
          <div className="workflow-editor-page-body">
            <div className="workflow-editor-section-tabs">
              <button
                type="button"
                className={!processMetaVisible ? "is-active" : ""}
                onClick={() => setProcessMetaVisible(false)}
              >
                流程设计
              </button>
              <button
                type="button"
                className={processMetaVisible ? "is-active" : ""}
                onClick={() => setProcessMetaVisible(true)}
              >
                基础信息
              </button>
            </div>
            <Form
              key={`process_editor_${editingProcess?.id || "new"}_${processDrawerOpen ? 1 : 0}`}
              form={processEditorForm}
              layout="vertical"
              className="workflow-editor-form"
            >
              <div className={`workflow-editor-form-grid ${processMetaVisible ? "" : "form-meta-collapsed"}`}>
                <Card
                  size="small"
                  title="基础信息"
                  className={`workflow-editor-meta-card ${processMetaVisible ? "" : "is-hidden"}`}
                >
                  <Form.Item name="name" label="模板名称" rules={[{ required: true, message: "请输入名称" }]}>
                    <Input placeholder="例如：费用审批流程" />
                  </Form.Item>
                  <Form.Item name="description" label="描述">
                    <Input.TextArea rows={2} placeholder="可选" />
                  </Form.Item>
                  <Space size={16} style={{ display: "flex" }}>
                    <Form.Item name="status" label="状态" initialValue="inactive" style={{ minWidth: 160 }}>
                      <Select>
                        <Select.Option value="inactive">草稿</Select.Option>
                        <Select.Option value="active">已发布</Select.Option>
                      </Select>
                    </Form.Item>
                    <Form.Item name="company_id" label="公司范围" style={{ minWidth: 220 }}>
                      <Select
                        disabled={!isGroupAdmin}
                        placeholder={isGroupAdmin ? "集团通用或指定公司" : "固定为当前公司"}
                      >
                        <Select.Option value={0}>集团通用</Select.Option>
                        {companyOptions.map((option) => (
                          <Select.Option key={option.value} value={option.value}>
                            {option.label}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Space>
                  <Form.Item name="form_template_id" hidden>
                    <InputNumber />
                  </Form.Item>
                  {editingProcess ? (
                    <Text type="secondary">
                      当前版本 v{editingProcess.current_version || 1}，已发布版本{" "}
                      {editingProcess.published_version ? `v${editingProcess.published_version}` : "暂无"}。
                    </Text>
                  ) : null}
                  <Text type="secondary">
                    {editingProcess
                      ? `绑定表单：${editingProcess.form_template_name || "专属表单"}（流程与表单唯一绑定）`
                      : "绑定表单：保存流程时自动创建专属表单（流程与表单唯一绑定）"}
                  </Text>
                  {editingProcess ? (
                    <Card size="small" className="workflow-version-card">
                      <Space direction="vertical" style={{ width: "100%" }} size={8}>
                        <Text strong>版本历史</Text>
                        {processVersionsLoading ? <Text type="secondary">版本加载中...</Text> : null}
                        {!processVersionsLoading && processVersions.length === 0 ? (
                          <Text type="secondary">暂无版本记录</Text>
                        ) : null}
                        {!processVersionsLoading && processVersions.length > 0 ? (
                          <Space direction="vertical" style={{ width: "100%" }} size={4}>
                            {processVersions.slice(0, 4).map((version) => (
                              <div key={version.id} className="workflow-version-row">
                                <Space size={6}>
                                  <Text>{`v${version.version_no}`}</Text>
                                  <Tag color={version.status === "published" ? "green" : "default"}>
                                    {version.status === "published"
                                      ? "已发布"
                                      : version.status === "draft"
                                        ? "草稿"
                                        : "归档"}
                                  </Tag>
                                </Space>
                                <Space size={8} wrap>
                                  <Text type="secondary">
                                    {version.published_at
                                      ? new Date(version.published_at).toLocaleString()
                                      : version.updated_at
                                        ? new Date(version.updated_at).toLocaleString()
                                        : "-"}
                                  </Text>
                                  <Button size="small" type="link" onClick={() => openDraftCompareWithVersion(version)}>
                                    草稿对比
                                  </Button>
                                  <Button
                                    size="small"
                                    type="link"
                                    icon={<RollbackOutlined />}
                                    onClick={() => rollbackToVersion(version)}
                                  >
                                    回滚
                                  </Button>
                                </Space>
                              </div>
                            ))}
                          </Space>
                        ) : null}
                        <Button size="small" onClick={openPublishCheck} disabled={processSaving}>
                          对比当前与已发布
                        </Button>
                      </Space>
                    </Card>
                  ) : null}
                  <Text type="secondary">发布前会自动执行流程校验（可达性、死路、条件分支默认线等）。</Text>
                  <Form.Item name="mode" label="配置方式" initialValue="designer">
                    <Select>
                      <Select.Option value="designer">画布设计（推荐）</Select.Option>
                      <Select.Option value="json">JSON 配置</Select.Option>
                    </Select>
                  </Form.Item>
                  <Divider orientation="left">可选配置参考</Divider>
                  <Text type="secondary">
                    条件操作符支持：eq/neq/gt/gte/lt/lte/in/not_in/contains/is_true/is_false/is_empty/not_empty。
                    角色审批可填 `approver_roles`，指定人员审批可填 `approver_user_ids`。
                  </Text>
                  <Space wrap style={{ marginTop: 8 }}>
                    {userOptions.map((option) => (
                      <Tag key={option.value}>{option.label}</Tag>
                    ))}
                  </Space>
                </Card>

                <Card size="small" title="流程配置" className="workflow-editor-main-card">
                  {processEditorMode === "json" ? (
                    <Form.Item
                      name="steps_text"
                      label="流程节点配置（JSON）"
                      rules={[{ required: true, message: "请输入步骤 JSON" }]}
                      extra="支持 step_type: approval/cc/condition/subprocess/parallel_start/parallel_join，支持更多 approver_type 与 condition.expression"
                    >
                      <Input.TextArea autoSize={{ minRows: 18, maxRows: 40 }} />
                    </Form.Item>
                  ) : (
                    <Space direction="vertical" style={{ width: "100%" }} size={12}>
                      <div className="workflow-process-step-guide">
                        <button
                          type="button"
                          className={processWizardStep === 1 ? "is-active" : ""}
                          onClick={() => setProcessWizardStep(1)}
                        >
                          ① 表单设计
                        </button>
                        <button
                          type="button"
                          className={processWizardStep === 2 ? "is-active" : ""}
                          disabled={!processCanEnterFlowStep}
                          onClick={() => {
                            if (!processCanEnterFlowStep) {
                              return;
                            }
                            setProcessWizardStep(2);
                          }}
                        >
                          ② 审批流程设计
                        </button>
                      </div>

                      {processWizardStep === 1 ? (
                        <Form.Item
                          label="表单设计"
                          extra="此处配置的是当前流程专属表单，保存流程时会自动创建/更新唯一绑定的表单。"
                        >
                          <Suspense
                            fallback={
                              <Card size="small" loading style={{ minHeight: 280 }}>
                                <div />
                              </Card>
                            }
                          >
                              <WorkflowFormDesigner
                                key={`process-form-designer-${processFormDesignerSeed}`}
                                seed={processFormDesignerSeed}
                                initialSchema={processFormSchemaDraft as WorkflowFormDesignerField[]}
                                onSchemaChange={(schema) =>
                                  handleProcessFormSchemaChange(schema as WorkflowField[])
                                }
                              />
                            </Suspense>
                          </Form.Item>
                        ) : (
                        <Form.Item label="审批流程设计">
                          <div className="workflow-designer-fullscreen">
                            <Suspense
                              fallback={
                                <Card size="small" loading style={{ minHeight: 420 }}>
                                  <div />
                                </Card>
                              }
                            >
                              <WorkflowProcessDesigner
                                apiBase={apiBase}
                                userId={userId}
                                key={`designer-${designerSeed}`}
                                initialDefinition={processDefinition}
                                users={designerUsers}
                                roleOptions={orgRoleOptions}
                                positionOptions={orgPositionOptions}
                                formFields={processFormFieldsForPermission}
                                onDefinitionChange={handleProcessDefinitionChange}
                              />
                            </Suspense>
                          </div>
                        </Form.Item>
                      )}
                    </Space>
                  )}
                </Card>
              </div>
            </Form>
          </div>
        </div>
      ) : null}

      <Drawer
        title={
          <Space direction="vertical" size={0}>
            <span>发起审批</span>
            {startDraftSavedAt ? (
              <Text type="secondary">{`本地草稿自动保存于 ${new Date(startDraftSavedAt).toLocaleTimeString()}`}</Text>
            ) : null}
          </Space>
        }
        open={startDrawerOpen}
        width={680}
        className="workflow-start-drawer"
        onClose={() => {
          setStartDrawerOpen(false);
          setSelectedProcess(null);
          startForm.resetFields();
          setStartDraftSavedAt(null);
        }}
        footer={
          <Space>
            {startDraftSavedAt ? (
              <Button
                data-testid="workflow-start-clear-draft-button"
                onClick={() => {
                  clearStartLocalDraft();
                  setSelectedProcess(null);
                  startForm.resetFields();
                  message.success("已清空发起审批草稿");
                }}
              >
                清空草稿
              </Button>
            ) : null}
            <Button
              onClick={() => {
                setStartDrawerOpen(false);
                setSelectedProcess(null);
                startForm.resetFields();
                setStartDraftSavedAt(null);
              }}
            >
              取消
            </Button>
            <Button type="primary" loading={startSaving} onClick={startInstance}>
              发起
            </Button>
          </Space>
        }
      >
        <Form form={startForm} layout="vertical">
          <Form.Item
            name="process_template_id"
            label="流程模板"
            rules={[{ required: true, message: "请选择流程模板" }]}
          >
            <Select
              data-testid="workflow-start-process-select"
              showSearch
              optionFilterProp="children"
              onChange={(value) => onSelectProcess(value as number)}
              placeholder="请选择"
            >
              {processTemplates
                .filter((item) => item.status === "active")
                .map((item) => (
                  <Select.Option key={item.id} value={item.id}>
                    {item.name}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item name="title" label="标题">
            <Input placeholder="可选，不填会自动生成" data-testid="workflow-start-title-input" />
          </Form.Item>

          {selectedProcess && (selectedProcess.form_schema || []).length > 0 && (
            <>
              <Divider orientation="left">表单字段</Divider>
              <div className="workflow-runtime-form-grid">
                {(selectedProcess.form_schema || []).map((field) =>
                  field.type === "table" ? (
                    <div
                      key={field.key}
                      className={`workflow-runtime-form-col ${isDesktopFullWidthField(field) ? "is-full" : ""}`}
                    >
                      <Form.Item label={field.label} required={field.required}>
                        <Form.List
                          name={["form_data", field.key]}
                          rules={
                            field.required
                              ? [
                                  {
                                    validator: async (_, value) => {
                                      if (Array.isArray(value) && value.length > 0) {
                                        return;
                                      }
                                      throw new Error(`请填写${field.label}`);
                                    }
                                  }
                                ]
                              : undefined
                          }
                        >
                          {(tableRows, { add, remove }, { errors }) => (
                            <Space direction="vertical" style={{ width: "100%" }} size={12}>
                              {tableRows.map((tableRow, rowIndex) => (
                                <Card
                                  key={tableRow.key}
                                  size="small"
                                  title={`第${rowIndex + 1}行`}
                                  extra={
                                    <Button
                                      type="text"
                                      icon={<MinusCircleOutlined />}
                                      onClick={() => remove(tableRow.name)}
                                    >
                                      删除
                                    </Button>
                                  }
                                >
                                  {(field.columns || []).map((column) => (
                                    <Form.Item
                                      key={`${tableRow.key}_${column.key}`}
                                      name={[tableRow.name, column.key]}
                                      label={column.label}
                                    >
                                      {renderFieldInput(column)}
                                    </Form.Item>
                                  ))}
                                </Card>
                              ))}
                              <Button
                                type="dashed"
                                icon={<PlusOutlined />}
                                onClick={() => add({})}
                                style={{ width: "100%" }}
                              >
                                新增明细行
                              </Button>
                              <Form.ErrorList errors={errors} />
                            </Space>
                          )}
                        </Form.List>
                      </Form.Item>
                    </div>
                  ) : (
                    <div
                      key={field.key}
                      className={`workflow-runtime-form-col ${isDesktopFullWidthField(field) ? "is-full" : ""}`}
                    >
                      <Form.Item
                        name={["form_data", field.key]}
                        label={field.label}
                        rules={field.required ? [{ required: true, message: `请填写${field.label}` }] : []}
                      >
                        {renderFieldInput(field)}
                      </Form.Item>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </Form>
      </Drawer>

      <Drawer
        title="审批详情"
        open={detailDrawerOpen}
        width={820}
        onClose={() => {
          setDetailDrawerOpen(false);
          setDetailData(null);
          setActionComment("");
        }}
      >
        {detailLoading && <Text type="secondary">加载中...</Text>}
        {!detailLoading && !detailData && <Text type="secondary">暂无数据</Text>}

        {!detailLoading && detailData && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="单号">{detailData.id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={INSTANCE_STATUS_COLORS[detailData.status]}>
                  {INSTANCE_STATUS_LABELS[detailData.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="流程">{detailData.process_name}</Descriptions.Item>
              <Descriptions.Item label="发起人">{detailData.applicant_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="当前步骤">
                {detailData.current_step}/{detailData.total_steps} {detailData.current_step_name || ""}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {detailData.created_at ? new Date(detailData.created_at).toLocaleString() : "-"}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title="表单内容" style={{ marginBottom: 16 }}>
              <List
                size="small"
                dataSource={detailData.form_schema}
                locale={{ emptyText: "无字段" }}
                renderItem={(field) => (
                  <List.Item>
                    <Space direction="vertical" size={0}>
                      <Text strong>{field.label}</Text>
                      {renderDetailFieldValue(field, detailData.form_data[field.key])}
                    </Space>
                  </List.Item>
                )}
              />
            </Card>

            <Card size="small" title="审批轨迹" style={{ marginBottom: 16 }}>
              <Table
                rowKey="id"
                columns={taskColumns}
                dataSource={detailData.tasks}
                pagination={false}
                size="small"
                scroll={{ x: "max-content" }}
              />
            </Card>

            <Card size="small" title="操作日志" style={{ marginBottom: 16 }}>
              <Table
                rowKey="id"
                columns={eventColumns}
                dataSource={detailData.events || []}
                locale={{ emptyText: "暂无日志" }}
                pagination={false}
                size="small"
                scroll={{ x: "max-content" }}
              />
            </Card>

            {detailData.status === "pending" && detailData.pending_action ? (
              <Card size="small" title="审批操作">
                {editableActionFields.length > 0 ? (
                  <>
                    <Form form={actionForm} layout="vertical">
                      <div className="workflow-runtime-form-grid">
                        {editableActionFields.map((field) => {
                          const permission = detailData.field_permissions?.[field.key];
                          const required = Boolean(permission?.required || field.required);
                          if (field.type === "table") {
                            return (
                              <div
                                key={field.key}
                                className={`workflow-runtime-form-col ${isDesktopFullWidthField(field) ? "is-full" : ""}`}
                              >
                                <Form.Item label={field.label} required={required}>
                                  <Form.List
                                    name={["form_data", field.key]}
                                    rules={
                                      required
                                        ? [
                                            {
                                              validator: async (_, value) => {
                                                if (Array.isArray(value) && value.length > 0) {
                                                  return;
                                                }
                                                throw new Error(`请填写${field.label}`);
                                              }
                                            }
                                          ]
                                        : undefined
                                    }
                                  >
                                    {(tableRows, { add, remove }, { errors }) => (
                                      <Space direction="vertical" style={{ width: "100%" }} size={12}>
                                        {tableRows.map((tableRow, rowIndex) => (
                                          <Card
                                            key={tableRow.key}
                                            size="small"
                                            title={`第${rowIndex + 1}行`}
                                            extra={
                                              <Button
                                                type="text"
                                                icon={<MinusCircleOutlined />}
                                                onClick={() => remove(tableRow.name)}
                                              >
                                                删除
                                              </Button>
                                            }
                                          >
                                            {(field.columns || []).map((column) => (
                                              <Form.Item
                                                key={`${tableRow.key}_${column.key}`}
                                                name={[tableRow.name, column.key]}
                                                label={column.label}
                                              >
                                                {renderActionFieldInput(column)}
                                              </Form.Item>
                                            ))}
                                          </Card>
                                        ))}
                                        <Button
                                          type="dashed"
                                          icon={<PlusOutlined />}
                                          onClick={() => add({})}
                                          style={{ width: "100%" }}
                                        >
                                          新增明细行
                                        </Button>
                                        <Form.ErrorList errors={errors} />
                                      </Space>
                                    )}
                                  </Form.List>
                                </Form.Item>
                              </div>
                            );
                          }
                          return (
                            <div
                              key={field.key}
                              className={`workflow-runtime-form-col ${isDesktopFullWidthField(field) ? "is-full" : ""}`}
                            >
                              <Form.Item
                                name={["form_data", field.key]}
                                label={field.label}
                                rules={required ? [{ required: true, message: `请填写${field.label}` }] : []}
                              >
                                {renderActionFieldInput(field)}
                              </Form.Item>
                            </div>
                          );
                        })}
                      </div>
                    </Form>
                    <Divider style={{ margin: "0 0 12px 0" }} />
                  </>
                ) : null}
                <Input.TextArea
                  rows={3}
                  value={actionComment}
                  onChange={(event) => setActionComment(event.target.value)}
                  placeholder="审批意见（可选）"
                  style={{ marginBottom: 12 }}
                />
                <Space>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={actionLoading}
                    onClick={submitApproveAction}
                  >
                    通过
                  </Button>
                  <Popconfirm
                    title="确认拒绝该审批？"
                    onConfirm={() => runInstanceAction("reject")}
                    okButtonProps={{ loading: actionLoading }}
                  >
                    <Button icon={<CloseOutlined />} danger>
                      拒绝
                    </Button>
                  </Popconfirm>
                  <Popconfirm
                    title="确认退回该审批？"
                    onConfirm={() => runInstanceAction("return")}
                    okButtonProps={{ loading: actionLoading }}
                  >
                    <Button>退回</Button>
                  </Popconfirm>
                </Space>
                <Divider style={{ margin: "12px 0" }} />
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Select
                    value={transferTargetUserId}
                    onChange={(value) => setTransferTargetUserId(value as number)}
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    placeholder="选择转交对象"
                  >
                    {userOptions.map((option) => (
                      <Select.Option key={option.value} value={option.value}>
                        {option.label}
                      </Select.Option>
                    ))}
                  </Select>
                  <Button
                    loading={actionLoading}
                    disabled={!transferTargetUserId}
                    onClick={() =>
                      runInstanceAction("transfer", {
                        target_user_id: transferTargetUserId
                      })
                    }
                  >
                    转交
                  </Button>
                  <Select
                    mode="multiple"
                    value={addSignUserIds}
                    onChange={(value) => setAddSignUserIds(value as number[])}
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    placeholder="选择加签对象（可多选）"
                  >
                    {userOptions.map((option) => (
                      <Select.Option key={option.value} value={option.value}>
                        {option.label}
                      </Select.Option>
                    ))}
                  </Select>
                  <Button
                    loading={actionLoading}
                    disabled={!addSignUserIds.length}
                    onClick={() =>
                      runInstanceAction("add_sign", {
                        target_user_ids: addSignUserIds
                      })
                    }
                  >
                    加签
                  </Button>
                </Space>
              </Card>
            ) : null}

            {detailData.status === "pending" ? (
              <Card size="small" style={{ marginTop: 16 }}>
                <Space>
                  <Button loading={actionLoading} onClick={() => runInstanceAction("remind")}>
                    催办
                  </Button>
                  {detailData.applicant_id === currentUser.id ? (
                    <Popconfirm
                      title="确认撤回该审批？"
                      onConfirm={() => runInstanceAction("withdraw")}
                      okButtonProps={{ loading: actionLoading }}
                    >
                      <Button danger>撤回审批</Button>
                    </Popconfirm>
                  ) : null}
                </Space>
              </Card>
            ) : null}
          </>
        )}
      </Drawer>

      <Modal
        title={draftCompareResult ? `草稿对比 ${draftCompareResult.baseLabel}` : "草稿对比"}
        open={draftCompareOpen}
        width={860}
        destroyOnClose
        onCancel={() => setDraftCompareOpen(false)}
        footer={
          <Button onClick={() => setDraftCompareOpen(false)}>
            关闭
          </Button>
        }
      >
        {!draftCompareResult ? <Text type="secondary">暂无对比结果</Text> : null}
        {draftCompareResult ? (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Card size="small" title="表单差异">
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <div>
                  <Text strong>新增字段</Text>
                  <div>{renderDiffTags(draftCompareResult.diff.fields.added, "无新增字段")}</div>
                </div>
                <div>
                  <Text strong>移除字段</Text>
                  <div>{renderDiffTags(draftCompareResult.diff.fields.removed, "无移除字段")}</div>
                </div>
                <div>
                  <Text strong>字段变更</Text>
                  <div>{renderDiffTags(draftCompareResult.diff.fields.changed, "无字段属性变更")}</div>
                </div>
              </Space>
            </Card>
            <Card size="small" title="流程差异">
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <div>
                  <Text strong>节点新增</Text>
                  <div>{renderDiffTags(draftCompareResult.diff.nodes.added, "无新增节点")}</div>
                </div>
                <div>
                  <Text strong>节点移除</Text>
                  <div>{renderDiffTags(draftCompareResult.diff.nodes.removed, "无移除节点")}</div>
                </div>
                <div>
                  <Text strong>节点变更</Text>
                  <div>{renderDiffTags(draftCompareResult.diff.nodes.changed, "无节点属性变更")}</div>
                </div>
                <Divider style={{ margin: "6px 0" }} />
                <div>
                  <Text strong>连线新增</Text>
                  <div>{renderDiffTags(draftCompareResult.diff.edges.added, "无新增连线")}</div>
                </div>
                <div>
                  <Text strong>连线移除</Text>
                  <div>{renderDiffTags(draftCompareResult.diff.edges.removed, "无移除连线")}</div>
                </div>
                <div>
                  <Text strong>连线变更</Text>
                  <div>{renderDiffTags(draftCompareResult.diff.edges.changed, "无连线属性变更")}</div>
                </div>
              </Space>
            </Card>
            <Text type={draftCompareResult.hasChanges ? "secondary" : "warning"}>
              {draftCompareResult.hasChanges
                ? `当前草稿与 ${draftCompareResult.baseLabel} 存在差异。`
                : `当前草稿与 ${draftCompareResult.baseLabel} 一致。`}
            </Text>
          </Space>
        ) : null}
      </Modal>

      <Modal
        title="发布前检查"
        open={publishCheckOpen}
        width={860}
        destroyOnClose
        onCancel={() => setPublishCheckOpen(false)}
        onOk={confirmPublish}
        okText={publishCheckResult?.validation.valid ? "确认发布" : "校验未通过"}
        cancelText="关闭"
        okButtonProps={{
          disabled: !publishCheckResult?.validation.valid || publishCheckLoading || processSaving
        }}
        confirmLoading={processSaving}
      >
        {publishCheckLoading ? <Text type="secondary">正在检查流程配置...</Text> : null}
        {!publishCheckLoading && !publishCheckResult ? <Text type="secondary">暂无检查结果</Text> : null}
        {!publishCheckLoading && publishCheckResult ? (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Card size="small" title="流程校验">
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Tag color={publishCheckResult.validation.valid ? "green" : "red"}>
                  {publishCheckResult.validation.valid ? "校验通过，可发布" : "校验未通过"}
                </Tag>
                {publishCheckResult.validation.errors.length > 0 ? (
                  <List
                    size="small"
                    header={<Text strong>错误</Text>}
                    dataSource={publishCheckResult.validation.errors}
                    renderItem={(issue) => (
                      <List.Item>
                        <Text type="danger">{toValidationMessage(issue)}</Text>
                      </List.Item>
                    )}
                  />
                ) : null}
                {publishCheckResult.validation.warnings.length > 0 ? (
                  <List
                    size="small"
                    header={<Text strong>告警</Text>}
                    dataSource={publishCheckResult.validation.warnings}
                    renderItem={(issue) => (
                      <List.Item>
                        <Text type="warning">{toValidationMessage(issue)}</Text>
                      </List.Item>
                    )}
                  />
                ) : null}
              </Space>
            </Card>

            <Card size="small" title="与已发布版本对比">
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                <div>
                  <Text strong>表单字段新增</Text>
                  <div>{renderDiffTags(publishCheckResult.diff.fields.added, "无新增字段")}</div>
                </div>
                <div>
                  <Text strong>表单字段移除</Text>
                  <div>{renderDiffTags(publishCheckResult.diff.fields.removed, "无移除字段")}</div>
                </div>
                <div>
                  <Text strong>表单字段变更</Text>
                  <div>{renderDiffTags(publishCheckResult.diff.fields.changed, "无字段属性变更")}</div>
                </div>
                <Divider style={{ margin: "6px 0" }} />
                <div>
                  <Text strong>节点新增</Text>
                  <div>{renderDiffTags(publishCheckResult.diff.nodes.added, "无新增节点")}</div>
                </div>
                <div>
                  <Text strong>节点移除</Text>
                  <div>{renderDiffTags(publishCheckResult.diff.nodes.removed, "无移除节点")}</div>
                </div>
                <div>
                  <Text strong>节点变更</Text>
                  <div>{renderDiffTags(publishCheckResult.diff.nodes.changed, "无节点属性变更")}</div>
                </div>
                <Divider style={{ margin: "6px 0" }} />
                <div>
                  <Text strong>连线新增</Text>
                  <div>{renderDiffTags(publishCheckResult.diff.edges.added, "无新增连线")}</div>
                </div>
                <div>
                  <Text strong>连线移除</Text>
                  <div>{renderDiffTags(publishCheckResult.diff.edges.removed, "无移除连线")}</div>
                </div>
                <div>
                  <Text strong>连线变更</Text>
                  <div>{renderDiffTags(publishCheckResult.diff.edges.changed, "无连线属性变更")}</div>
                </div>
              </Space>
            </Card>

            <Text type={publishCheckResult.hasChanges ? "secondary" : "warning"}>
              {publishCheckResult.hasChanges
                ? "检测到当前流程与已发布版本存在差异。"
                : "当前流程结构与已发布版本一致。"}
            </Text>
          </Space>
        ) : null}
      </Modal>
    </>
  );
}

export default memo(WorkflowCenter);
