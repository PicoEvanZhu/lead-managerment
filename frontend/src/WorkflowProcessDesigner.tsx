import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  applyNodeChanges,
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type NodeChange,
  type Node,
  type NodeProps,
  type ReactFlowProps,
  type ReactFlowInstance
} from "reactflow";
import {
  Button,
  Card,
  Divider,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Switch,
  Tabs,
  Typography,
  message
} from "antd";
import {
  ApartmentOutlined,
  DeleteOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
  ZoomInOutlined
} from "@ant-design/icons";
import "reactflow/dist/style.css";

const { Text } = Typography;

export type WorkflowCondition = {
  logic: "and" | "or";
  expression?: string;
  rules: Array<{
    field: string;
    operator:
      | "eq"
      | "neq"
      | "gt"
      | "gte"
      | "lt"
      | "lte"
      | "in"
      | "not_in"
      | "contains"
      | "is_true"
      | "is_false"
      | "is_empty"
      | "not_empty";
    value?: unknown;
  }>;
};

export type WorkflowApproverGroup = {
  id: string;
  name: string;
  approver_type:
    | "user"
    | "role"
    | "manager"
    | "department_manager"
    | "position"
    | "applicant_select"
    | "previous_handler";
  approver_user_ids?: number[];
  approver_roles?: string[];
  approver_positions?: string[];
  approver_field_key?: string;
  previous_step_offset?: number;
  cc_user_ids?: number[];
  condition?: WorkflowCondition;
};

export type WorkflowFieldPermission = {
  field_key: string;
  can_view: boolean;
  can_edit: boolean;
  required: boolean;
};

export type WorkflowDefinitionNode = {
  id: string;
  name: string;
  node_type:
    | "start"
    | "approval"
    | "cc"
    | "condition"
    | "end"
    | "parallel_start"
    | "parallel_join"
    | "subprocess";
  approver_type?:
    | "user"
    | "role"
    | "manager"
    | "department_manager"
    | "position"
    | "applicant_select"
    | "previous_handler";
  approval_mode?: "any" | "all";
  approval_type?: "any" | "all" | "sequential";
  approver_groups?: WorkflowApproverGroup[];
  approver_user_ids?: number[];
  approver_roles?: string[];
  approver_positions?: string[];
  approver_field_key?: string;
  previous_step_offset?: number;
  subprocess_template_id?: number;
  allow_self_approve?: boolean;
  allow_return?: boolean;
  timeout_hours?: number;
  field_permissions?: WorkflowFieldPermission[];
  condition?: WorkflowCondition;
  position?: { x: number; y: number };
};

export type WorkflowDefinitionEdge = {
  id: string;
  source: string;
  target: string;
  priority?: number;
  condition?: WorkflowCondition;
  is_default?: boolean;
  label?: string;
};

export type WorkflowDefinition = {
  version: "graph_v1";
  start_node_id: string;
  nodes: WorkflowDefinitionNode[];
  edges: WorkflowDefinitionEdge[];
};

type DesignerUser = {
  id: number;
  name: string;
  role: string;
};

type DesignerFormField = {
  key: string;
  label: string;
};

type WorkflowProcessDesignerProps = {
  apiBase: string;
  userId: string;
  initialDefinition: WorkflowDefinition;
  users: DesignerUser[];
  formFields?: DesignerFormField[];
  roleOptions?: string[];
  positionOptions?: string[];
  onDefinitionChange: (definition: WorkflowDefinition) => void;
};

type NodeData = {
  label?: string;
  name: string;
  node_type: WorkflowDefinitionNode["node_type"];
  approver_type?: WorkflowDefinitionNode["approver_type"];
  approval_mode?: WorkflowDefinitionNode["approval_mode"];
  approval_type?: WorkflowDefinitionNode["approval_type"];
  approver_groups?: WorkflowApproverGroup[];
  approver_user_ids?: number[];
  approver_roles?: string[];
  approver_positions?: string[];
  approver_field_key?: string;
  previous_step_offset?: number;
  subprocess_template_id?: number;
  allow_self_approve?: boolean;
  allow_return?: boolean;
  timeout_hours?: number;
  field_permissions?: WorkflowFieldPermission[];
  condition?: WorkflowCondition;
};

type WorkflowQuickAddContextValue = {
  targetType: WorkflowDefinitionNode["node_type"];
  appendAfter: (sourceNodeId: string, targetType: WorkflowDefinitionNode["node_type"]) => void;
};

type EdgeData = {
  priority?: number;
  condition?: WorkflowCondition;
  is_default?: boolean;
};

type ConnectTargetOption = {
  value: string;
  label: string;
  disabled: boolean;
  reason: string | null;
};

const NODE_LIBRARY: Array<{ label: string; value: WorkflowDefinitionNode["node_type"] }> = [
  { label: "开始节点", value: "start" },
  { label: "审批节点", value: "approval" },
  { label: "抄送节点", value: "cc" },
  { label: "条件节点", value: "condition" },
  { label: "并行分支", value: "parallel_start" },
  { label: "并行汇聚", value: "parallel_join" },
  { label: "子流程", value: "subprocess" },
  { label: "结束节点", value: "end" }
];
const NODE_TYPE_VALUES = new Set<WorkflowDefinitionNode["node_type"]>(
  NODE_LIBRARY.map((item) => item.value)
);

const ZOOM_OPTIONS = [50, 75, 100, 125, 150];
const CONDITION_OPERATOR_OPTIONS: Array<{
  label: string;
  value: WorkflowCondition["rules"][number]["operator"];
}> = [
  { label: "等于", value: "eq" },
  { label: "不等于", value: "neq" },
  { label: "大于", value: "gt" },
  { label: "大于等于", value: "gte" },
  { label: "小于", value: "lt" },
  { label: "小于等于", value: "lte" },
  { label: "包含", value: "contains" },
  { label: "在范围中", value: "in" },
  { label: "不在范围中", value: "not_in" },
  { label: "为真", value: "is_true" },
  { label: "为假", value: "is_false" },
  { label: "为空", value: "is_empty" },
  { label: "非空", value: "not_empty" }
];

const getNodeTypeText = (nodeType: WorkflowDefinitionNode["node_type"]) => {
  if (nodeType === "approval") {
    return "审批";
  }
  if (nodeType === "cc") {
    return "抄送";
  }
  if (nodeType === "condition") {
    return "条件";
  }
  if (nodeType === "start") {
    return "开始";
  }
  if (nodeType === "parallel_start") {
    return "并行分支";
  }
  if (nodeType === "parallel_join") {
    return "并行汇聚";
  }
  if (nodeType === "subprocess") {
    return "子流程";
  }
  return "结束";
};

const getSafeNodeType = (rawType: unknown): WorkflowDefinitionNode["node_type"] => {
  if (typeof rawType === "string" && NODE_TYPE_VALUES.has(rawType as WorkflowDefinitionNode["node_type"])) {
    return rawType as WorkflowDefinitionNode["node_type"];
  }
  return "approval";
};

const getSafeId = (rawId: unknown, fallback: string) => {
  const text = String(rawId ?? "").trim();
  return text || fallback;
};

const getSafePosition = (rawPosition: unknown, index: number) => {
  const fallbackX = 140 + (index % 3) * 280;
  const fallbackY = 120 + Math.floor(index / 3) * 160;
  if (!rawPosition || typeof rawPosition !== "object") {
    return { x: fallbackX, y: fallbackY };
  }
  const positionSource = rawPosition as { x?: unknown; y?: unknown };
  const positionX = Number(positionSource.x);
  const positionY = Number(positionSource.y);
  if (!Number.isFinite(positionX) || !Number.isFinite(positionY)) {
    return { x: fallbackX, y: fallbackY };
  }
  return { x: positionX, y: positionY };
};

const getEdgeLabel = (condition?: WorkflowCondition, label?: string, isDefault?: boolean) => {
  if (label) {
    return label;
  }
  if (!condition || ((!condition.rules || !condition.rules.length) && !condition.expression)) {
    return isDefault ? "默认分支" : "";
  }
  if (condition.expression) {
    return "表达式条件";
  }
  const first = condition.rules[0];
  return `${first.field} ${first.operator}`;
};

type ConditionRule = WorkflowCondition["rules"][number];

type ConditionBlockDraft = {
  id: string;
  logic: WorkflowCondition["logic"];
  rules: ConditionRule[];
};

type ConditionDraft = {
  logic: WorkflowCondition["logic"];
  blocks: ConditionBlockDraft[];
  expression?: string;
};

type ConditionExpressionValidation = {
  status: "idle" | "validating" | "valid" | "invalid";
  message?: string;
  result?: boolean | null;
};

const createConditionRule = (defaultField = ""): ConditionRule => ({
  field: defaultField,
  operator: "eq",
  value: ""
});

const createConditionBlock = (defaultField = ""): ConditionBlockDraft => ({
  id: `cond_block_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
  logic: "and",
  rules: defaultField ? [createConditionRule(defaultField)] : []
});

const createEmptyConditionDraft = (defaultField = ""): ConditionDraft => ({
  logic: "or",
  blocks: [createConditionBlock(defaultField)],
  expression: ""
});

const cloneConditionDraft = (condition?: WorkflowCondition, defaultField = ""): ConditionDraft => {
  if (!condition) {
    return createEmptyConditionDraft(defaultField);
  }
  const rules = Array.isArray(condition.rules)
    ? condition.rules
        .filter((rule) => !!rule && typeof rule === "object")
        .map((rule) => ({
          field: String(rule.field || "").trim(),
          operator: rule.operator || "eq",
          value: rule.value
        }))
    : [];
  const expression = typeof condition.expression === "string" ? condition.expression : "";

  if (!rules.length && !expression) {
    return createEmptyConditionDraft(defaultField);
  }
  return {
    logic: condition.logic === "or" ? "or" : "and",
    blocks: [
      {
        id: `cond_block_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        logic: condition.logic === "or" ? "or" : "and",
        rules
      }
    ],
    expression
  };
};

const toPythonLiteral = (value: unknown): string => {
  if (value === undefined || value === null) {
    return "None";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "0";
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => toPythonLiteral(item)).join(", ")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, val]) => `${JSON.stringify(key)}: ${toPythonLiteral(val)}`
    );
    return `{${entries.join(", ")}}`;
  }
  return JSON.stringify(String(value));
};

const buildRuleExpression = (rule: ConditionRule) => {
  const fieldName = String(rule.field || "").trim();
  if (!fieldName) {
    return "";
  }
  const fieldExpr = `field(${toPythonLiteral(fieldName)})`;
  const valueExpr = toPythonLiteral(rule.value);
  switch (rule.operator) {
    case "neq":
      return `${fieldExpr} != ${valueExpr}`;
    case "gt":
      return `float(${fieldExpr}) > float(${valueExpr})`;
    case "gte":
      return `float(${fieldExpr}) >= float(${valueExpr})`;
    case "lt":
      return `float(${fieldExpr}) < float(${valueExpr})`;
    case "lte":
      return `float(${fieldExpr}) <= float(${valueExpr})`;
    case "in":
      return `${fieldExpr} in ${valueExpr}`;
    case "not_in":
      return `${fieldExpr} not in ${valueExpr}`;
    case "contains":
      return `contains(${fieldExpr}, ${valueExpr})`;
    case "is_true":
      return `bool(${fieldExpr}) is True`;
    case "is_false":
      return `bool(${fieldExpr}) is False`;
    case "is_empty":
      return `empty(${fieldExpr})`;
    case "not_empty":
      return `not empty(${fieldExpr})`;
    default:
      return `${fieldExpr} == ${valueExpr}`;
  }
};

const buildBlockExpression = (block: ConditionBlockDraft) => {
  const ruleExpressions = (block.rules || [])
    .map((rule) => ({
      field: String(rule.field || "").trim(),
      operator: rule.operator || "eq",
      value: rule.value
    }))
    .filter((rule) => rule.field)
    .map((rule) => buildRuleExpression(rule));
  if (!ruleExpressions.length) {
    return "";
  }
  if (ruleExpressions.length === 1) {
    return ruleExpressions[0];
  }
  return `(${ruleExpressions.join(block.logic === "or" ? " or " : " and ")})`;
};

const normalizeConditionDraft = (draft: ConditionDraft): WorkflowCondition | undefined => {
  const blocks: ConditionBlockDraft[] = (draft.blocks || []).map(
    (block): ConditionBlockDraft => ({
      id: block.id,
      logic: block.logic === "or" ? "or" : "and",
      rules: (block.rules || [])
        .map(
          (rule): ConditionRule => ({
            field: String(rule.field || "").trim(),
            operator: rule.operator || "eq",
            value: rule.value
          })
        )
        .filter((rule) => rule.field)
    })
  );
  const activeBlocks = blocks.filter((block) => block.rules.length > 0);
  const manualExpression = String(draft.expression || "").trim();

  if (!activeBlocks.length && !manualExpression) {
    return undefined;
  }

  if (activeBlocks.length <= 1 && !manualExpression) {
    const onlyBlock = activeBlocks[0];
    if (!onlyBlock) {
      return undefined;
    }
    return {
      logic: onlyBlock.logic,
      rules: onlyBlock.rules
    };
  }

  const expressions = activeBlocks.map((block) => buildBlockExpression(block)).filter((text) => text);
  if (manualExpression) {
    expressions.push(`(${manualExpression})`);
  }
  if (!expressions.length) {
    return undefined;
  }
  return {
    logic: draft.logic === "or" ? "or" : "and",
    expression: expressions.join(draft.logic === "or" ? " or " : " and "),
    rules: []
  };
};

const buildConditionPreviewExpression = (draft: ConditionDraft): string => {
  const normalized = normalizeConditionDraft(draft);
  if (!normalized) {
    return "";
  }
  if (normalized.expression) {
    return normalized.expression;
  }
  return buildBlockExpression({
    id: "preview_block",
    logic: normalized.logic === "or" ? "or" : "and",
    rules: normalized.rules || []
  });
};

const stringifyConditionValue = (value: unknown) => {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
};

const parseConditionValue = (rawText: string): unknown => {
  const text = String(rawText || "").trim();
  if (!text) {
    return "";
  }
  if (text === "true") {
    return true;
  }
  if (text === "false") {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return Number(text);
  }
  if ((text.startsWith("[") && text.endsWith("]")) || (text.startsWith("{") && text.endsWith("}"))) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
};

const getNodeCardWidth = (nodeType: WorkflowDefinitionNode["node_type"]) => {
  if (nodeType === "start" || nodeType === "end") {
    return 150;
  }
  if (nodeType === "approval" || nodeType === "cc") {
    return 240;
  }
  return 200;
};

const getNodeContainerStyle = (nodeType: WorkflowDefinitionNode["node_type"]) => ({
  width: getNodeCardWidth(nodeType),
  background: "transparent",
  border: "none",
  boxShadow: "none",
  padding: 0
});

const summarizeApproverGroup = (group?: WorkflowApproverGroup) => {
  if (!group) {
    return "-";
  }
  if (group.approver_type === "user") {
    return group.approver_user_ids?.length ? `指定${group.approver_user_ids.length}人` : "未指定";
  }
  if (group.approver_type === "role") {
    return group.approver_roles?.length ? group.approver_roles.join(", ") : "未配置角色";
  }
  if (group.approver_type === "position") {
    return group.approver_positions?.length ? group.approver_positions.join(", ") : "未配置岗位";
  }
  if (group.approver_type === "manager") {
    return "直属上级";
  }
  if (group.approver_type === "department_manager") {
    return "部门负责人";
  }
  if (group.approver_type === "applicant_select") {
    return group.approver_field_key ? `发起人字段: ${group.approver_field_key}` : "发起人自选";
  }
  if (group.approver_type === "previous_handler") {
    return `前${group.previous_step_offset || 1}步处理人`;
  }
  return "-";
};

const getNodeSummary = (data: NodeData) => {
  if (data.node_type === "approval") {
    return `审批人：${summarizeApproverGroup(data.approver_groups?.[0])}`;
  }
  if (data.node_type === "cc") {
    return `抄送人：${summarizeApproverGroup(data.approver_groups?.[0])}`;
  }
  if (data.node_type === "condition") {
    return "按条件匹配分支";
  }
  if (data.node_type === "parallel_start") {
    return "并行发散节点";
  }
  if (data.node_type === "parallel_join") {
    return "并行汇聚节点";
  }
  if (data.node_type === "subprocess") {
    return data.subprocess_template_id ? `子流程ID：${data.subprocess_template_id}` : "配置子流程模板";
  }
  if (data.node_type === "start") {
    return "发起流程";
  }
  return "流程结束";
};

const WorkflowQuickAddContext = createContext<WorkflowQuickAddContextValue | null>(null);

const workflowCardNodePropsEqual = (prev: NodeProps<NodeData>, next: NodeProps<NodeData>) => {
  if (prev.selected !== next.selected) {
    return false;
  }
  const prevData = prev.data;
  const nextData = next.data;
  return (
    prevData.name === nextData.name &&
    prevData.node_type === nextData.node_type &&
    prevData.approval_type === nextData.approval_type &&
    prevData.approver_type === nextData.approver_type &&
    prevData.subprocess_template_id === nextData.subprocess_template_id &&
    prevData.approver_groups === nextData.approver_groups
  );
};

const WorkflowCardNode = memo((props: NodeProps<NodeData>) => {
  const { data, selected, id } = props;
  const isStart = data.node_type === "start";
  const isEnd = data.node_type === "end";
  const title = data.name || `${getNodeTypeText(data.node_type)}节点`;
  const quickAddContext = useContext(WorkflowQuickAddContext);
  const canQuickAdd = !isEnd && Boolean(quickAddContext);
  const quickAddLabel = quickAddContext ? `新增${getNodeTypeText(quickAddContext.targetType)}后续` : "新增后续节点";

  return (
    <div
      className={`workflow-card-node ${selected ? "is-selected" : ""} ${isStart ? "is-start" : ""} ${isEnd ? "is-end" : ""}`}
    >
      {!isStart ? (
        <>
          <Handle type="target" id="left" position={Position.Left} className="workflow-node-handle" />
          <Handle type="target" id="top" position={Position.Top} className="workflow-node-handle" />
        </>
      ) : null}
      {!isEnd ? (
        <>
          <Handle type="source" id="right" position={Position.Right} className="workflow-node-handle" />
          <Handle type="source" id="bottom" position={Position.Bottom} className="workflow-node-handle" />
        </>
      ) : null}
      <div className={`workflow-card-node-header ${isStart || isEnd ? "is-terminal" : ""}`}>{title}</div>
      <div className="workflow-card-node-body">
        <div className="workflow-card-node-main">{getNodeSummary(data)}</div>
        {data.node_type === "approval" ? (
          <div className="workflow-card-node-sub">
            审批方式：
            {data.approval_type === "sequential"
              ? "依次审批"
              : data.approval_type === "all"
                ? "会签审批"
                : "或签审批"}
          </div>
        ) : null}
      </div>
      {data.node_type === "approval" || data.node_type === "cc" ? (
        <div className="workflow-card-node-corner">设置</div>
      ) : null}
      {canQuickAdd ? (
        <button
          type="button"
          className="workflow-card-node-add-next"
          title={quickAddLabel}
          onClick={(event) => {
            event.stopPropagation();
            quickAddContext?.appendAfter(id, quickAddContext.targetType);
          }}
        >
          +
        </button>
      ) : null}
    </div>
  );
}, workflowCardNodePropsEqual);

const normalizeApproverGroup = (
  rawGroup: Partial<WorkflowApproverGroup>,
  index: number
): WorkflowApproverGroup => {
  const groupId = String(rawGroup.id || `group_${index}_${Date.now()}`);
  return {
    id: groupId,
    name: String(rawGroup.name || `审批组${index}`),
    approver_type: rawGroup.approver_type || "manager",
    approver_user_ids: Array.isArray(rawGroup.approver_user_ids)
      ? rawGroup.approver_user_ids.filter((item) => typeof item === "number")
      : [],
    approver_roles: Array.isArray(rawGroup.approver_roles)
      ? rawGroup.approver_roles.filter((item) => typeof item === "string")
      : [],
    approver_positions: Array.isArray(rawGroup.approver_positions)
      ? rawGroup.approver_positions.filter((item) => typeof item === "string")
      : [],
    approver_field_key: rawGroup.approver_field_key || "",
    previous_step_offset: rawGroup.previous_step_offset || 1,
    cc_user_ids: Array.isArray(rawGroup.cc_user_ids)
      ? rawGroup.cc_user_ids.filter((item) => typeof item === "number")
      : [],
    condition: rawGroup.condition
  };
};

const buildDefaultGroup = (index: number): WorkflowApproverGroup =>
  normalizeApproverGroup(
    {
      id: `group_${Date.now()}_${index}`,
      name: `审批组${index}`,
      approver_type: "manager",
      approver_user_ids: [],
      approver_roles: [],
      approver_positions: [],
      approver_field_key: "",
      previous_step_offset: 1,
      cc_user_ids: []
    },
    index
  );

const ensureNodeGroups = (node: WorkflowDefinitionNode): WorkflowApproverGroup[] => {
  if (Array.isArray(node.approver_groups) && node.approver_groups.length) {
    return node.approver_groups.map((group, index) => normalizeApproverGroup(group, index + 1));
  }
  if (node.node_type === "approval" || node.node_type === "cc") {
    return [
      normalizeApproverGroup(
        {
          id: `group_${node.id}_1`,
          name: "审批组1",
          approver_type: node.approver_type || "manager",
          approver_user_ids: node.approver_user_ids || [],
          approver_roles: node.approver_roles || [],
          approver_positions: node.approver_positions || [],
          approver_field_key: node.approver_field_key || "",
          previous_step_offset: node.previous_step_offset || 1,
          cc_user_ids: []
        },
        1
      )
    ];
  }
  return [];
};

const toReactFlowNodes = (definition: WorkflowDefinition): Array<Node<NodeData>> => {
  return definition.nodes.map((node, index) => {
    const nodeType = getSafeNodeType(node.node_type);
    const nodeId = getSafeId(node.id, `${nodeType}_${index + 1}`);
    const displayName = String(node.name || getNodeTypeText(nodeType));
    const groups = ensureNodeGroups({
      ...node,
      id: nodeId,
      node_type: nodeType
    });
    const safePosition = getSafePosition(node.position, index);

    return {
      id: nodeId,
      type: "workflow_card",
      position: safePosition,
      data: {
        label: `${displayName}`,
        name: displayName,
        node_type: nodeType,
        approver_type: node.approver_type,
        approval_mode: node.approval_mode,
        approval_type: node.approval_type || node.approval_mode || "any",
        approver_groups: groups,
        approver_user_ids: node.approver_user_ids || [],
        approver_roles: node.approver_roles || [],
        approver_positions: node.approver_positions || [],
        approver_field_key: node.approver_field_key,
        previous_step_offset: node.previous_step_offset,
        subprocess_template_id: node.subprocess_template_id,
        allow_self_approve: node.allow_self_approve,
        allow_return: node.allow_return,
        timeout_hours: node.timeout_hours,
        field_permissions: Array.isArray(node.field_permissions) ? node.field_permissions : [],
        condition: node.condition
      },
      style: getNodeContainerStyle(nodeType),
      draggable: true,
      selectable: true,
      sourcePosition: "right",
      targetPosition: "left"
    } as Node<NodeData>;
  });
};

const toReactFlowEdges = (definition: WorkflowDefinition): Array<Edge<EdgeData>> =>
  (definition.edges || [])
    .map((edge, index) => {
      const source = getSafeId(edge.source, "");
      const target = getSafeId(edge.target, "");
      if (!source || !target) {
        return null;
      }
      return {
        id: getSafeId(edge.id, `e_${source}_${target}_${index + 1}`),
        source,
        target,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#7e8797" },
        style: { stroke: "#7e8797", strokeWidth: 1.6 },
        labelStyle: { fill: "#4b5565", fontSize: 11 },
        labelBgPadding: [6, 2],
        labelBgBorderRadius: 4,
        labelBgStyle: { fill: "rgba(255,255,255,0.92)", color: "#4b5565" },
        label: getEdgeLabel(edge.condition, edge.label, edge.is_default),
        data: {
          priority: edge.priority ?? index + 1,
          condition: edge.condition,
          is_default: edge.is_default === true
        }
      } as Edge<EdgeData>;
    })
    .filter((edge): edge is Edge<EdgeData> => Boolean(edge));

const buildDefinitionFromCanvas = (
  nodes: Array<Node<NodeData>>,
  edges: Array<Edge<EdgeData>>
): WorkflowDefinition => {
  const startNode = nodes.find((node) => node.data.node_type === "start");
  return {
    version: "graph_v1",
    start_node_id: startNode?.id || "start",
    nodes: nodes.map((node) => {
      const groups = (node.data.approver_groups || []).map((group) => ({
        ...group,
        approver_user_ids: group.approver_user_ids || [],
        approver_roles: group.approver_roles || [],
        approver_positions: group.approver_positions || [],
        cc_user_ids: group.cc_user_ids || []
      }));
      const primaryGroup = groups[0];
      const approvalType = node.data.approval_type || "any";
      return {
        id: node.id,
        name: node.data.name,
        node_type: node.data.node_type,
        approval_type: approvalType,
        approval_mode: approvalType === "all" || approvalType === "sequential" ? "all" : "any",
        approver_groups: groups,
        approver_type: primaryGroup?.approver_type || node.data.approver_type,
        approver_user_ids: primaryGroup?.approver_user_ids || node.data.approver_user_ids || [],
        approver_roles: primaryGroup?.approver_roles || node.data.approver_roles || [],
        approver_positions: primaryGroup?.approver_positions || node.data.approver_positions || [],
        approver_field_key: primaryGroup?.approver_field_key || node.data.approver_field_key,
        previous_step_offset: primaryGroup?.previous_step_offset || node.data.previous_step_offset,
        subprocess_template_id: node.data.subprocess_template_id,
        allow_self_approve: node.data.allow_self_approve,
        allow_return: node.data.allow_return,
        timeout_hours: node.data.timeout_hours,
        field_permissions: node.data.field_permissions || [],
        condition: node.data.condition,
        position: node.position
      };
    }),
    edges: edges.map((edge, index) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      priority: edge.data?.priority ?? index + 1,
      condition: edge.data?.condition,
      is_default: edge.data?.is_default === true,
      label: typeof edge.label === "string" ? edge.label : undefined
    }))
  };
};

const ensureBoundaryNodes = (definition: WorkflowDefinition): WorkflowDefinition => {
  const sourceNodes = Array.isArray(definition?.nodes) ? definition.nodes : [];
  const sourceEdges = Array.isArray(definition?.edges) ? definition.edges : [];
  const nodes: WorkflowDefinitionNode[] = sourceNodes
    .filter((node) => !!node && typeof node === "object")
    .map((node, index) => {
      const nodeType = getSafeNodeType(node.node_type);
      return {
        ...node,
        id: getSafeId(node.id, `${nodeType}_${index + 1}`),
        name: String(node.name || getNodeTypeText(nodeType)),
        node_type: nodeType,
        position: getSafePosition(node.position, index)
      };
    });
  const edges: WorkflowDefinitionEdge[] = sourceEdges
    .filter((edge) => !!edge && typeof edge === "object")
    .map((edge, index) => {
      const source = getSafeId(edge.source, "");
      const target = getSafeId(edge.target, "");
      if (!source || !target) {
        return null;
      }
      return {
        ...edge,
        id: getSafeId(edge.id, `e_${source}_${target}_${index + 1}`),
        source,
        target
      };
    })
    .filter((edge): edge is WorkflowDefinitionEdge => Boolean(edge));
  const nodeIds = new Set(nodes.map((node) => node.id));

  let startNode = nodes.find((node) => node.node_type === "start");
  if (!startNode) {
    let startId = "start";
    let suffix = 1;
    while (nodeIds.has(startId)) {
      startId = `start_${suffix++}`;
    }
    startNode = {
      id: startId,
      name: "开始",
      node_type: "start",
      position: { x: 220, y: 220 }
    };
    nodes.unshift(startNode);
    nodeIds.add(startId);
  }

  let endNode = nodes.find((node) => node.node_type === "end");
  if (!endNode) {
    let endId = "end";
    let suffix = 1;
    while (nodeIds.has(endId)) {
      endId = `end_${suffix++}`;
    }
    endNode = {
      id: endId,
      name: "结束",
      node_type: "end",
      position: { x: 820, y: 220 }
    };
    nodes.push(endNode);
    nodeIds.add(endId);
  }

  const firstMiddleNode = nodes.find((node) => node.id !== startNode.id && node.id !== endNode.id);
  const edgeExists = (source: string, target: string) =>
    edges.some((edge) => edge.source === source && edge.target === target);
  const buildEdgeId = (source: string, target: string) => `e_${source}_${target}_${Date.now()}_${Math.random()}`;

  if (!edges.some((edge) => edge.source === startNode.id)) {
    const targetId = firstMiddleNode ? firstMiddleNode.id : endNode.id;
    if (!edgeExists(startNode.id, targetId)) {
      edges.push({
        id: buildEdgeId(startNode.id, targetId),
        source: startNode.id,
        target: targetId,
        priority: edges.length + 1
      });
    }
  }

  if (!edges.some((edge) => edge.target === endNode.id)) {
    const sourceId = firstMiddleNode ? firstMiddleNode.id : startNode.id;
    if (!edgeExists(sourceId, endNode.id)) {
      edges.push({
        id: buildEdgeId(sourceId, endNode.id),
        source: sourceId,
        target: endNode.id,
        priority: edges.length + 1
      });
    }
  }

  return {
    version: "graph_v1",
    start_node_id: startNode.id,
    nodes,
    edges
  };
};

const hasPath = (edges: Array<Edge<EdgeData>>, fromId: string, toId: string): boolean => {
  if (fromId === toId) {
    return true;
  }
  const adjacency = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, []);
    }
    adjacency.get(edge.source)?.push(edge.target);
  });
  const visited = new Set<string>();
  const stack = [fromId];
  while (stack.length) {
    const current = stack.pop();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);
    const targets = adjacency.get(current) || [];
    for (const target of targets) {
      if (target === toId) {
        return true;
      }
      if (!visited.has(target)) {
        stack.push(target);
      }
    }
  }
  return false;
};

const layoutNodesByFlow = (
  sourceNodes: Array<Node<NodeData>>,
  sourceEdges: Array<Edge<EdgeData>>
): Array<Node<NodeData>> => {
  if (!sourceNodes.length) {
    return sourceNodes;
  }
  const nodeMap = new Map(sourceNodes.map((node) => [node.id, node]));
  const levels = new Map<string, number>();
  const startNodes = sourceNodes.filter((node) => node.data.node_type === "start");
  const queue: string[] = startNodes.length ? startNodes.map((node) => node.id) : [sourceNodes[0].id];
  queue.forEach((id) => levels.set(id, 0));

  while (queue.length) {
    const currentId = queue.shift();
    if (!currentId) {
      continue;
    }
    const currentLevel = levels.get(currentId) ?? 0;
    sourceEdges
      .filter((edge) => edge.source === currentId && nodeMap.has(edge.target))
      .forEach((edge) => {
        const nextLevel = currentLevel + 1;
        const existing = levels.get(edge.target);
        if (existing === undefined || nextLevel < existing) {
          levels.set(edge.target, nextLevel);
          queue.push(edge.target);
        }
      });
  }

  let maxLevel = Math.max(0, ...Array.from(levels.values()));
  sourceNodes.forEach((node) => {
    if (!levels.has(node.id)) {
      maxLevel += 1;
      levels.set(node.id, maxLevel);
    }
  });

  const endNodeIds = sourceNodes
    .filter((node) => node.data.node_type === "end")
    .map((node) => node.id);
  if (endNodeIds.length) {
    const finalLevel = Math.max(1, ...Array.from(levels.values())) + 1;
    endNodeIds.forEach((id) => levels.set(id, finalLevel));
  }

  const levelBuckets = new Map<number, Array<Node<NodeData>>>();
  sourceNodes.forEach((node) => {
    const level = levels.get(node.id) ?? 0;
    if (!levelBuckets.has(level)) {
      levelBuckets.set(level, []);
    }
    levelBuckets.get(level)?.push(node);
  });

  const sortedLevels = Array.from(levelBuckets.keys()).sort((a, b) => a - b);
  const positioned = new Map<string, { x: number; y: number }>();
  sortedLevels.forEach((level) => {
    const bucket = (levelBuckets.get(level) || []).slice().sort((a, b) => {
      if (a.data.node_type === "start" && b.data.node_type !== "start") {
        return -1;
      }
      if (a.data.node_type !== "start" && b.data.node_type === "start") {
        return 1;
      }
      if (a.data.node_type === "end" && b.data.node_type !== "end") {
        return 1;
      }
      if (a.data.node_type !== "end" && b.data.node_type === "end") {
        return -1;
      }
      return a.id.localeCompare(b.id);
    });
    const centerY = 240;
    const gapY = 170;
    const baseY = centerY - ((bucket.length - 1) * gapY) / 2;
    const x = 220 + level * 280;
    bucket.forEach((node, index) => {
      positioned.set(node.id, {
        x,
        y: baseY + index * gapY
      });
    });
  });

  return sourceNodes.map((node) => ({
    ...node,
    position: positioned.get(node.id) || node.position
  }));
};

function WorkflowProcessDesigner(props: WorkflowProcessDesignerProps) {
  const {
    apiBase,
    userId,
    initialDefinition,
    users,
    formFields = [],
    roleOptions = [],
    positionOptions = [],
    onDefinitionChange
  } = props;
  const definitionWithBoundaries = useMemo(
    () => ensureBoundaryNodes(initialDefinition),
    [initialDefinition]
  );
  const [nodes, setNodes] = useNodesState<NodeData>(
    toReactFlowNodes(definitionWithBoundaries)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<EdgeData>(
    toReactFlowEdges(definitionWithBoundaries)
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectTargetNodeId, setConnectTargetNodeId] = useState<string | null>(null);

  const [nodeTypeToAdd, setNodeTypeToAdd] = useState<WorkflowDefinitionNode["node_type"]>("approval");
  const [nodePanelTab, setNodePanelTab] = useState("approver_setting");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupConditionDraft, setGroupConditionDraft] = useState<ConditionDraft>(
    createEmptyConditionDraft()
  );
  const [edgeConditionDraft, setEdgeConditionDraft] = useState<ConditionDraft>(
    createEmptyConditionDraft()
  );
  const [groupExpressionValidation, setGroupExpressionValidation] =
    useState<ConditionExpressionValidation>({ status: "idle", result: null });
  const [edgeExpressionValidation, setEdgeExpressionValidation] =
    useState<ConditionExpressionValidation>({ status: "idle", result: null });
  const [fieldPermissionOpen, setFieldPermissionOpen] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [isNodeDragging, setIsNodeDragging] = useState(false);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const initializedFitRef = useRef(false);
  const runtimeSeqRef = useRef(1);
  const applyingExternalDefinitionRef = useRef(false);
  const emittedDefinitionSignaturesRef = useRef<string[]>([]);
  const lastEmittedDefinitionSignatureRef = useRef("");
  const definitionSyncTimerRef = useRef<number | null>(null);
  const hasNodeDraggingRef = useRef(false);
  const nodesRef = useRef<Array<Node<NodeData>>>([]);
  const edgesRef = useRef<Array<Edge<EdgeData>>>([]);
  const lastConnectTargetOptionsRef = useRef<ConnectTargetOption[]>([]);
  const groupDraftSyncSourceRef = useRef("");
  const appendNodeAfterRef = useRef<
    (sourceNodeId: string, targetType: WorkflowDefinitionNode["node_type"]) => void
  >(() => undefined);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [edges, nodes]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => {
      const protectedNodeIds = new Set(
        current
          .filter((node) => node.data.node_type === "start" || node.data.node_type === "end")
          .map((node) => node.id)
      );
      const normalizedChanges = changes.filter((change) => {
        if (change.type !== "remove") {
          return true;
        }
        return !protectedNodeIds.has(change.id);
      });
      const next = applyNodeChanges(normalizedChanges, current);
      return next.length ? next : current;
    });
  }, [setNodes]);

  const authHeaders: HeadersInit = useMemo(
    () => ({
      "Content-Type": "application/json",
      "x-user-id": String(userId)
    }),
    [userId]
  );

  useEffect(() => {
    const incomingSignature = JSON.stringify(definitionWithBoundaries);
    if (incomingSignature === lastEmittedDefinitionSignatureRef.current) {
      return;
    }
    const currentCanvasSignature = JSON.stringify(
      ensureBoundaryNodes(buildDefinitionFromCanvas(nodesRef.current, edgesRef.current))
    );
    const emittedIndex = emittedDefinitionSignaturesRef.current.indexOf(incomingSignature);
    if (emittedIndex >= 0) {
      emittedDefinitionSignaturesRef.current = emittedDefinitionSignaturesRef.current.slice(emittedIndex + 1);
      if (incomingSignature === currentCanvasSignature) {
        return;
      }
    }
    if (incomingSignature === currentCanvasSignature) {
      return;
    }
    if (definitionSyncTimerRef.current !== null) {
      window.clearTimeout(definitionSyncTimerRef.current);
      definitionSyncTimerRef.current = null;
    }
    applyingExternalDefinitionRef.current = true;
    setNodes(toReactFlowNodes(definitionWithBoundaries));
    setEdges(toReactFlowEdges(definitionWithBoundaries));
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setNodePanelTab("approver_setting");
      setSelectedGroupId(null);
      setGroupConditionDraft(createEmptyConditionDraft(formFields[0]?.key || ""));
      setEdgeConditionDraft(createEmptyConditionDraft(formFields[0]?.key || ""));
      setGroupExpressionValidation({ status: "idle", result: null });
      setEdgeExpressionValidation({ status: "idle", result: null });
    });
    initializedFitRef.current = false;
    const frameId = requestAnimationFrame(() => {
      applyingExternalDefinitionRef.current = false;
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [definitionWithBoundaries, formFields, setEdges, setNodes]);

  useEffect(() => {
    return () => {
      if (definitionSyncTimerRef.current !== null) {
        window.clearTimeout(definitionSyncTimerRef.current);
        definitionSyncTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!flowInstance || initializedFitRef.current) {
      return;
    }
    if (!nodes.length) {
      return;
    }
    const hasStart = nodes.some((node) => node.data.node_type === "start");
    const hasEnd = nodes.some((node) => node.data.node_type === "end");
    if (!hasStart || !hasEnd) {
      return;
    }
    initializedFitRef.current = true;
    requestAnimationFrame(() => {
      flowInstance.fitView({ padding: 0.18, duration: 180 });
      setZoomPercent(Math.round(flowInstance.getZoom() * 100));
    });
  }, [flowInstance, nodes]);

  useEffect(() => {
    if (!nodes.length) {
      const fallback = ensureBoundaryNodes({
        version: "graph_v1",
        start_node_id: "start",
        nodes: [],
        edges: []
      });
      setNodes(toReactFlowNodes(fallback));
      setEdges(toReactFlowEdges(fallback));
      initializedFitRef.current = false;
      return;
    }

    const hasStart = nodes.some((node) => node.data.node_type === "start");
    const hasEnd = nodes.some((node) => node.data.node_type === "end");
    if (hasStart && hasEnd) {
      return;
    }

    const fixedDefinition = ensureBoundaryNodes(buildDefinitionFromCanvas(nodes, edges));
    setNodes(toReactFlowNodes(fixedDefinition));
    setEdges(toReactFlowEdges(fixedDefinition));
    initializedFitRef.current = false;
  }, [edges, nodes, setEdges, setNodes]);

  const userOptions = useMemo(
    () =>
      users.map((user) => ({
        label: `${user.name} (${user.role})`,
        value: user.id
      })),
    [users]
  );

  const approverRoleOptions = useMemo(
    () =>
      Array.from(new Set(roleOptions.map((role) => role.trim()).filter(Boolean))).map((role) => ({
        label: role,
        value: role
      })),
    [roleOptions]
  );

  const approverPositionOptions = useMemo(
    () =>
      Array.from(new Set(positionOptions.map((position) => position.trim()).filter(Boolean))).map(
        (position) => ({
          label: position,
          value: position
        })
      ),
    [positionOptions]
  );

  const conditionFieldOptions = useMemo(
    () =>
      (formFields || []).map((field) => ({
        label: `${field.label} (${field.key})`,
        value: field.key
      })),
    [formFields]
  );

  const requestExpressionValidation = async (expression: string) => {
    const response = await fetch(`${apiBase}/approval/conditions/validate-expression`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ expression })
    });
    const payload = (await response.json()) as {
      data?: { valid?: boolean; result?: boolean | null; message?: string };
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error || "表达式校验失败");
    }
    return {
      valid: payload.data?.valid === true,
      result: payload.data?.result ?? null,
      message: payload.data?.message || ""
    };
  };

  const validateGroupExpression = async () => {
    const text = String(groupConditionDraft.expression || "").trim();
    if (!text) {
      message.warning("请输入表达式后再校验");
      return;
    }
    setGroupExpressionValidation({ status: "validating", result: null });
    try {
      const result = await requestExpressionValidation(text);
      if (!result.valid) {
        setGroupExpressionValidation({
          status: "invalid",
          result: null,
          message: result.message || "表达式不合法"
        });
        return;
      }
      setGroupExpressionValidation({
        status: "valid",
        result: result.result,
        message: result.result === null ? "表达式合法" : `表达式合法，示例求值：${result.result ? "命中" : "不命中"}`
      });
    } catch (err) {
      setGroupExpressionValidation({
        status: "invalid",
        result: null,
        message: err instanceof Error ? err.message : "表达式校验失败"
      });
    }
  };

  const validateEdgeExpression = async () => {
    const text = String(edgeConditionDraft.expression || "").trim();
    if (!text) {
      message.warning("请输入表达式后再校验");
      return;
    }
    setEdgeExpressionValidation({ status: "validating", result: null });
    try {
      const result = await requestExpressionValidation(text);
      if (!result.valid) {
        setEdgeExpressionValidation({
          status: "invalid",
          result: null,
          message: result.message || "表达式不合法"
        });
        return;
      }
      setEdgeExpressionValidation({
        status: "valid",
        result: result.result,
        message: result.result === null ? "表达式合法" : `表达式合法，示例求值：${result.result ? "命中" : "不命中"}`
      });
    } catch (err) {
      setEdgeExpressionValidation({
        status: "invalid",
        result: null,
        message: err instanceof Error ? err.message : "表达式校验失败"
      });
    }
  };

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );
  const selectedNodeGroupSyncSignature = useMemo(() => {
    if (!selectedNode || (selectedNode.data.node_type !== "approval" && selectedNode.data.node_type !== "cc")) {
      return "";
    }
    const groups = selectedNode.data.approver_groups || [];
    return JSON.stringify(
      groups.map((group) => ({
        id: group.id,
        name: group.name,
        approver_type: group.approver_type,
        approver_user_ids: group.approver_user_ids || [],
        approver_roles: group.approver_roles || [],
        approver_positions: group.approver_positions || [],
        approver_field_key: group.approver_field_key || "",
        previous_step_offset: group.previous_step_offset || 1,
        cc_user_ids: group.cc_user_ids || [],
        condition: group.condition || null
      }))
    );
  }, [selectedNode]);
  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) || null,
    [edges, selectedEdgeId]
  );
  const selectedEdgeSourceType = useMemo(() => {
    if (!selectedEdge) {
      return null;
    }
    return nodes.find((node) => node.id === selectedEdge.source)?.data.node_type || null;
  }, [nodes, selectedEdge]);
  const getConnectionValidationError = useCallback(
    (
      sourceNode: Node<NodeData>,
      targetNode: Node<NodeData>,
      currentEdges: Array<Edge<EdgeData>>
    ): string | null => {
      if (sourceNode.id === targetNode.id) {
        return "不支持节点自连接";
      }
      if (sourceNode.data.node_type === "end") {
        return "结束节点不能配置出线";
      }
      if (targetNode.data.node_type === "start") {
        return "开始节点不能配置入线";
      }
      if (currentEdges.some((edge) => edge.source === sourceNode.id && edge.target === targetNode.id)) {
        return "该连线已存在";
      }
      if (hasPath(currentEdges, targetNode.id, sourceNode.id)) {
        return "检测到回路，当前流程不支持循环连线";
      }
      const sourceOutgoingCount = currentEdges.filter((edge) => edge.source === sourceNode.id).length;
      if (
        sourceNode.data.node_type !== "condition" &&
        sourceNode.data.node_type !== "parallel_start" &&
        sourceOutgoingCount >= 1
      ) {
        return "当前节点仅支持一条出线，如需分支请添加条件节点";
      }
      if (sourceNode.data.node_type === "condition" && sourceOutgoingCount >= 2) {
        return "条件节点最多支持两条出线";
      }
      return null;
    },
    []
  );
  const connectTargetOptions = useMemo<ConnectTargetOption[]>(() => {
    if (!selectedNode) {
      lastConnectTargetOptionsRef.current = [];
      return [];
    }
    if (isNodeDragging) {
      return lastConnectTargetOptionsRef.current;
    }
    const options = nodes
      .filter((node) => node.id !== selectedNode.id)
      .map((node) => {
        const reason = getConnectionValidationError(selectedNode, node, edges);
        return {
          value: node.id,
          label: `${node.data.name || node.id} (${getNodeTypeText(node.data.node_type)})`,
          disabled: Boolean(reason),
          reason
        };
      });
    lastConnectTargetOptionsRef.current = options;
    return options;
  }, [edges, getConnectionValidationError, isNodeDragging, nodes, selectedNode]);
  const emitDefinitionChange = useCallback(
    (definition: WorkflowDefinition, signature: string) => {
      lastEmittedDefinitionSignatureRef.current = signature;
      emittedDefinitionSignaturesRef.current.push(signature);
      if (emittedDefinitionSignaturesRef.current.length > 80) {
        emittedDefinitionSignaturesRef.current = emittedDefinitionSignaturesRef.current.slice(-80);
      }
      onDefinitionChange(definition);
    },
    [onDefinitionChange]
  );
  const scheduleDefinitionSync = useCallback(
    (immediate = false) => {
      if (applyingExternalDefinitionRef.current || hasNodeDraggingRef.current) {
        return;
      }
      if (definitionSyncTimerRef.current !== null) {
        window.clearTimeout(definitionSyncTimerRef.current);
        definitionSyncTimerRef.current = null;
      }
      definitionSyncTimerRef.current = window.setTimeout(() => {
        definitionSyncTimerRef.current = null;
        if (applyingExternalDefinitionRef.current || hasNodeDraggingRef.current) {
          return;
        }
        const latestDefinition = ensureBoundaryNodes(
          buildDefinitionFromCanvas(nodesRef.current, edgesRef.current)
        );
        const latestSignature = JSON.stringify(latestDefinition);
        if (latestSignature === lastEmittedDefinitionSignatureRef.current) {
          return;
        }
        emitDefinitionChange(latestDefinition, latestSignature);
      }, immediate ? 0 : 140);
    },
    [emitDefinitionChange]
  );
  const nodeTypes = useMemo(
    () => ({
      workflow_card: WorkflowCardNode
    }),
    []
  );
  const canvasFallbackDefinition = useMemo(
    () =>
      ensureBoundaryNodes({
        version: "graph_v1",
        start_node_id: "start",
        nodes: [],
        edges: []
      }),
    []
  );
  useEffect(() => {
    const defaultField = formFields[0]?.key || "";
    const activeNode = selectedNodeId ? nodesRef.current.find((node) => node.id === selectedNodeId) || null : null;
    if (!activeNode) {
      groupDraftSyncSourceRef.current = "";
      setSelectedGroupId(null);
      setGroupConditionDraft(createEmptyConditionDraft(defaultField));
      setGroupExpressionValidation({ status: "idle", result: null });
      return;
    }
    const groups = activeNode.data.approver_groups || [];
    if (!groups.length) {
      groupDraftSyncSourceRef.current = "";
      setSelectedGroupId(null);
      setGroupConditionDraft(createEmptyConditionDraft(defaultField));
      setGroupExpressionValidation({ status: "idle", result: null });
      return;
    }
    const currentGroup = groups.find((group) => group.id === selectedGroupId);
    const targetGroup = currentGroup || groups[0];
    const sourceKey = `${activeNode.id}|${targetGroup.id}|${JSON.stringify(targetGroup.condition || null)}|${defaultField}`;
    if (sourceKey === groupDraftSyncSourceRef.current) {
      return;
    }
    groupDraftSyncSourceRef.current = sourceKey;
    setSelectedGroupId((current) => (current === targetGroup.id ? current : targetGroup.id));
    setGroupConditionDraft(cloneConditionDraft(targetGroup.condition, defaultField));
    setGroupExpressionValidation({ status: "idle", result: null });
  }, [formFields, selectedGroupId, selectedNodeGroupSyncSignature, selectedNodeId]);

  useEffect(() => {
    let cancelled = false;
    const run = (task: () => void) => {
      queueMicrotask(() => {
        if (!cancelled) {
          task();
        }
      });
    };
    if (!selectedEdge) {
      run(() => {
        setEdgeConditionDraft(createEmptyConditionDraft(formFields[0]?.key || ""));
        setEdgeExpressionValidation({ status: "idle", result: null });
      });
      return () => {
        cancelled = true;
      };
    }
    run(() => {
      setEdgeConditionDraft(cloneConditionDraft(selectedEdge.data?.condition, formFields[0]?.key || ""));
      setEdgeExpressionValidation({ status: "idle", result: null });
    });
    return () => {
      cancelled = true;
    };
  }, [formFields, selectedEdge]);

  useEffect(() => {
    if (!selectedNode) {
      setConnectTargetNodeId(null);
      return;
    }
    const enabledOption =
      connectTargetOptions.find((option) => !option.disabled)?.value || null;
    if (!enabledOption) {
      setConnectTargetNodeId(null);
      return;
    }
    if (!connectTargetNodeId || !connectTargetOptions.some((option) => option.value === connectTargetNodeId)) {
      setConnectTargetNodeId(enabledOption);
    }
  }, [connectTargetNodeId, connectTargetOptions, selectedNode]);

  useEffect(() => {
    scheduleDefinitionSync(false);
  }, [edges, nodes, scheduleDefinitionSync]);

  const updateSelectedNode = (patch: Partial<NodeData>) => {
    if (!selectedNodeId) {
      return;
    }
    setNodes((current) =>
      current.map((node) => {
        if (node.id !== selectedNodeId) {
          return node;
        }
        const nextData = {
          ...node.data,
          ...patch
        };
        nextData.label = `${nextData.name}`;
        return {
          ...node,
          data: nextData
        };
      })
    );
  };

  const updateSelectedGroup = (groupId: string, patch: Partial<WorkflowApproverGroup>) => {
    if (!selectedNode) {
      return;
    }
    const nextGroups = (selectedNode.data.approver_groups || []).map((group) =>
      group.id === groupId
        ? normalizeApproverGroup(
            {
              ...group,
              ...patch
            },
            1
          )
        : group
    );
    updateSelectedNode({ approver_groups: nextGroups });
  };

  const allocateRuntimeId = (prefix: string, kind: "node" | "edge" = "node") => {
    const existingIds =
      kind === "edge"
        ? new Set(edgesRef.current.map((edge) => edge.id))
        : new Set(nodesRef.current.map((node) => node.id));
    let seq = runtimeSeqRef.current;
    let nextId = `${prefix}_${seq}`;
    while (existingIds.has(nextId)) {
      seq += 1;
      nextId = `${prefix}_${seq}`;
    }
    runtimeSeqRef.current = seq + 1;
    return nextId;
  };

  const buildNodeData = (nodeType: WorkflowDefinitionNode["node_type"]): NodeData => {
    const isApprovalLike = nodeType === "approval" || nodeType === "cc";
    const defaultGroup = buildDefaultGroup(1);
    return {
      label: nodeType === "start" ? "开始" : nodeType === "end" ? "结束" : `${getNodeTypeText(nodeType)}节点`,
      name: nodeType === "start" ? "开始审批" : nodeType === "end" ? "完成审批" : `${getNodeTypeText(nodeType)}节点`,
      node_type: nodeType,
      approver_type: isApprovalLike ? "manager" : undefined,
      approval_mode: isApprovalLike ? "any" : undefined,
      approval_type: isApprovalLike ? "any" : undefined,
      approver_groups: isApprovalLike ? [defaultGroup] : [],
      approver_user_ids: [],
      approver_roles: [],
      approver_positions: [],
      approver_field_key: "",
      previous_step_offset: 1,
      subprocess_template_id: nodeType === "subprocess" ? 0 : undefined,
      allow_self_approve: true,
      allow_return: true,
      timeout_hours: undefined,
      field_permissions: []
    };
  };

  const appendNodeAfter = useCallback((sourceNodeId: string, targetType: WorkflowDefinitionNode["node_type"]) => {
    if (targetType === "start") {
      message.warning("后续节点不能是开始节点");
      return;
    }

    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const sourceNode = currentNodes.find((node) => node.id === sourceNodeId);
    if (!sourceNode) {
      message.warning("未找到源节点，请重试");
      return;
    }
    if (sourceNode.data.node_type === "end") {
      message.warning("结束节点后不能再新增节点");
      return;
    }

    const sourceOutgoingEdges = currentEdges.filter((edge) => edge.source === sourceNodeId);
    const sourceOutgoingCount = sourceOutgoingEdges.length;
    const canAutoInsertIntoSingleEdge =
      sourceNode.data.node_type !== "condition" &&
      sourceNode.data.node_type !== "parallel_start" &&
      sourceOutgoingCount === 1;
    if (
      sourceNode.data.node_type !== "condition" &&
      sourceNode.data.node_type !== "parallel_start" &&
      sourceOutgoingCount >= 1
    ) {
      if (!canAutoInsertIntoSingleEdge) {
        message.warning("当前节点仅支持一条出线，如需分支请先添加条件节点");
        return;
      }
    }
    if (sourceNode.data.node_type === "condition" && sourceOutgoingCount >= 2) {
      message.warning("条件节点最多支持两条出线");
      return;
    }

    const nextId = allocateRuntimeId(targetType);
    const existingSingleEdge = canAutoInsertIntoSingleEdge ? sourceOutgoingEdges[0] : null;
    const existingTargetNode = existingSingleEdge
      ? currentNodes.find((node) => node.id === existingSingleEdge.target) || null
      : null;
    const positionOffsetY =
      sourceNode.data.node_type === "condition" ? (sourceOutgoingCount === 0 ? -120 : 120) : 0;
    const nextPosition = {
      x: existingTargetNode
        ? sourceNode.position.x + Math.max(140, (existingTargetNode.position.x - sourceNode.position.x) / 2)
        : sourceNode.position.x + 280,
      y: existingTargetNode
        ? sourceNode.position.y + (existingTargetNode.position.y - sourceNode.position.y) / 2
        : sourceNode.position.y + positionOffsetY
    };
    const nextNode: Node<NodeData> = {
      id: nextId,
      type: "workflow_card",
      position: nextPosition,
      data: buildNodeData(targetType),
      style: getNodeContainerStyle(targetType)
    };

    const shouldDefault = sourceNode.data.node_type === "condition" && sourceOutgoingCount === 0;
    const nextEdge: Edge<EdgeData> = {
      id: allocateRuntimeId(`e_${sourceNodeId}_${nextId}`, "edge"),
      source: sourceNodeId,
      target: nextId,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#7e8797" },
      style: { stroke: "#7e8797", strokeWidth: 1.6 },
      label: getEdgeLabel(undefined, undefined, shouldDefault),
      data: {
        priority: currentEdges.length + 1,
        is_default: shouldDefault
      }
    };

    const edgeFromNewToOldTarget =
      existingSingleEdge && existingTargetNode
        ? ({
            ...existingSingleEdge,
            id: allocateRuntimeId(`e_${nextId}_${existingSingleEdge.target}`, "edge"),
            source: nextId,
            target: existingSingleEdge.target
          } as Edge<EdgeData>)
        : null;

    setNodes((current) => {
      const next = [...current, nextNode];
      nodesRef.current = next;
      return next;
    });
    setEdges((current) => {
      if (!existingSingleEdge || !edgeFromNewToOldTarget) {
        const next = [...current, nextEdge];
        edgesRef.current = next;
        return next;
      }
      const withoutOld = current.filter((edge) => edge.id !== existingSingleEdge.id);
      const next = [...withoutOld, nextEdge, edgeFromNewToOldTarget];
      edgesRef.current = next;
      return next;
    });
    setSelectedNodeId(nextId);
    setSelectedEdgeId(null);
    setNodePanelTab(targetType === "approval" || targetType === "cc" ? "approver_setting" : "node_setting");
    if (existingSingleEdge && edgeFromNewToOldTarget) {
      message.success("已自动插入到当前连线上");
    }
    initializedFitRef.current = false;
    requestAnimationFrame(() => {
      flowInstance?.fitView({ padding: 0.18, duration: 180 });
    });
  }, [flowInstance, setEdges, setNodes]);
  useEffect(() => {
    appendNodeAfterRef.current = appendNodeAfter;
  }, [appendNodeAfter]);

  const createEdgeBetween = useCallback((sourceId: string, targetId: string) => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const sourceNode = currentNodes.find((node) => node.id === sourceId);
    const targetNode = currentNodes.find((node) => node.id === targetId);
    if (!sourceNode || !targetNode) {
      message.warning("连接的节点不存在，请重试");
      return false;
    }
    const connectionError = getConnectionValidationError(sourceNode, targetNode, currentEdges);
    if (connectionError) {
      message.warning(connectionError);
      return false;
    }
    const sourceOutgoingCount = currentEdges.filter((edge) => edge.source === sourceId).length;
    const shouldDefault = sourceNode.data.node_type === "condition" && sourceOutgoingCount === 0;
    const nextId = allocateRuntimeId(`e_${sourceId}_${targetId}`, "edge");
    setEdges((currentEdgesForSet) => {
      const next = addEdge(
        {
          source: sourceId,
          target: targetId,
          id: nextId,
          markerEnd: { type: MarkerType.ArrowClosed, color: "#7e8797" },
          style: { stroke: "#7e8797", strokeWidth: 1.6 },
          label: getEdgeLabel(undefined, undefined, shouldDefault),
          data: { priority: currentEdgesForSet.length + 1, is_default: shouldDefault }
        },
        currentEdgesForSet
      );
      edgesRef.current = next;
      return next;
    });
    setSelectedNodeId(null);
    setSelectedEdgeId(nextId);
    return true;
  }, [getConnectionValidationError, setEdges]);

  const onConnect = useCallback<NonNullable<ReactFlowProps["onConnect"]>>((connection: Connection) => {
    if (!connection.source || !connection.target) {
      return;
    }
    createEdgeBetween(connection.source, connection.target);
  }, [createEdgeBetween]);

  const addNode = useCallback((nodeType: WorkflowDefinitionNode["node_type"]) => {
    const currentNodes = nodesRef.current;
    if (selectedNodeId) {
      const anchorNode = currentNodes.find((node) => node.id === selectedNodeId);
      if (anchorNode && anchorNode.data.node_type !== "end") {
        appendNodeAfter(selectedNodeId, nodeType);
        return;
      }
    }
    if (nodeType === "start" && currentNodes.some((node) => node.data.node_type === "start")) {
      message.warning("开始节点只能有一个");
      return;
    }
    const nextId = allocateRuntimeId(nodeType);
    const x = 140 + (currentNodes.length % 3) * 280;
    const y = 100 + Math.floor(currentNodes.length / 3) * 160;
    const baseData: NodeData = buildNodeData(nodeType);

    setNodes((current) => {
      const next = [
        ...current,
        {
          id: nextId,
          type: "workflow_card",
          position: { x, y },
          data: baseData,
          style: getNodeContainerStyle(nodeType)
        }
      ];
      nodesRef.current = next;
      return next;
    });
  }, [appendNodeAfter, selectedNodeId, setNodes]);

  const addConditionBranchTemplate = () => {
    const now = Date.now();
    const anchorNode =
      selectedNode && selectedNode.data.node_type !== "end"
        ? selectedNode
        : nodes.find((node) => node.data.node_type === "start") || null;
    const anchorOutgoingCount = anchorNode ? edges.filter((edge) => edge.source === anchorNode.id).length : 0;
    const canConnectFromAnchor = anchorNode
      ? anchorNode.data.node_type === "condition"
        ? anchorOutgoingCount < 2
        : anchorNode.data.node_type === "parallel_start"
          ? true
          : anchorOutgoingCount < 1
      : false;

    const baseX = anchorNode ? anchorNode.position.x + 280 : 420;
    const baseY = anchorNode ? anchorNode.position.y : 240;
    const conditionId = `condition_tpl_${now}`;
    const yesId = `approval_yes_${now}`;
    const noId = `approval_no_${now}`;
    const endNode = nodes.find((node) => node.data.node_type === "end") || null;

    const conditionNode: Node<NodeData> = {
      id: conditionId,
      type: "workflow_card",
      position: { x: baseX, y: baseY },
      data: {
        label: "条件分支",
        name: "条件分支",
        node_type: "condition",
        approver_groups: [],
        approver_user_ids: [],
        approver_roles: [],
        approver_positions: [],
        field_permissions: []
      },
      style: getNodeContainerStyle("condition")
    };
    const yesNode: Node<NodeData> = {
      id: yesId,
      type: "workflow_card",
      position: { x: baseX + 320, y: baseY - 120 },
      data: {
        label: "条件满足审批",
        name: "条件满足审批",
        node_type: "approval",
        approver_type: "manager",
        approval_mode: "any",
        approval_type: "any",
        approver_groups: [buildDefaultGroup(1)],
        approver_user_ids: [],
        approver_roles: [],
        approver_positions: [],
        approver_field_key: "",
        previous_step_offset: 1,
        allow_self_approve: true,
        allow_return: true,
        field_permissions: []
      },
      style: getNodeContainerStyle("approval")
    };
    const noNode: Node<NodeData> = {
      id: noId,
      type: "workflow_card",
      position: { x: baseX + 320, y: baseY + 120 },
      data: {
        label: "默认分支审批",
        name: "默认分支审批",
        node_type: "approval",
        approver_type: "manager",
        approval_mode: "any",
        approval_type: "any",
        approver_groups: [buildDefaultGroup(2)],
        approver_user_ids: [],
        approver_roles: [],
        approver_positions: [],
        approver_field_key: "",
        previous_step_offset: 1,
        allow_self_approve: true,
        allow_return: true,
        field_permissions: []
      },
      style: getNodeContainerStyle("approval")
    };

    setNodes((current) => [...current, conditionNode, yesNode, noNode]);
    setEdges((current) => {
      const next = [...current];
      const pushEdge = (source: string, target: string, isDefault = false, label?: string) => {
        if (next.some((edge) => edge.source === source && edge.target === target)) {
          return;
        }
        next.push({
          id: `e_${source}_${target}_${Date.now()}_${Math.random()}`,
          source,
          target,
          markerEnd: { type: MarkerType.ArrowClosed, color: "#7e8797" },
          style: { stroke: "#7e8797", strokeWidth: 1.6 },
          label: label !== undefined ? label : getEdgeLabel(undefined, undefined, isDefault),
          data: {
            priority: next.length + 1,
            is_default: isDefault
          }
        });
      };

      if (anchorNode && canConnectFromAnchor) {
        pushEdge(anchorNode.id, conditionId, false, "");
      }
      pushEdge(conditionId, yesId, false, "满足条件");
      pushEdge(conditionId, noId, true, "默认分支");
      if (endNode) {
        pushEdge(yesId, endNode.id, false, "");
        pushEdge(noId, endNode.id, false, "");
      }
      return next;
    });

    if (anchorNode && !canConnectFromAnchor) {
      message.warning("已创建条件双分支模板，但未接入当前节点（该节点出线已满）");
    } else {
      message.success("已创建条件双分支模板");
    }
    setSelectedNodeId(conditionId);
    setSelectedEdgeId(null);
    setNodePanelTab("node_setting");
    initializedFitRef.current = false;
    requestAnimationFrame(() => {
      flowInstance?.fitView({ padding: 0.18, duration: 220 });
    });
  };

  const removeSelection = () => {
    if (selectedNode) {
      if (selectedNode.data.node_type === "start" || selectedNode.data.node_type === "end") {
        message.warning("开始/结束节点不可删除");
        return;
      }
      setNodes((current) => current.filter((node) => node.id !== selectedNode.id));
      setEdges((current) =>
        current.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id)
      );
      setSelectedNodeId(null);
      return;
    }
    if (selectedEdge) {
      setEdges((current) => {
        const removed = current.find((edge) => edge.id === selectedEdge.id);
        if (!removed) {
          return current;
        }
        const rest = current.filter((edge) => edge.id !== selectedEdge.id);
        if (removed.data?.is_default !== true) {
          return rest;
        }
        const siblingIndex = rest.findIndex((edge) => edge.source === removed.source);
        if (siblingIndex < 0) {
          return rest;
        }
        const next = rest.slice();
        const sibling = next[siblingIndex];
        next[siblingIndex] = {
          ...sibling,
          label: getEdgeLabel(sibling.data?.condition, undefined, true),
          data: {
            ...sibling.data,
            is_default: true
          }
        };
        return next;
      });
      setSelectedEdgeId(null);
    }
  };

  const updateSelectedEdge = (patch: Partial<EdgeData & { label?: string }>) => {
    if (!selectedEdgeId) {
      return;
    }
    const selectedEdgeSource = edges.find((edge) => edge.id === selectedEdgeId)?.source;
    setEdges((current) =>
      current.map((edge) => {
        const shouldClearSiblingDefault =
          patch.is_default === true &&
          selectedEdgeSource &&
          edge.source === selectedEdgeSource &&
          edge.id !== selectedEdgeId;
        if (shouldClearSiblingDefault) {
          return {
            ...edge,
            label: getEdgeLabel(edge.data?.condition, undefined, false),
            data: {
              ...edge.data,
              is_default: false
            }
          };
        }
        if (edge.id !== selectedEdgeId) {
          return edge;
        }
        return {
          ...edge,
          label:
            patch.label !== undefined
              ? patch.label
              : getEdgeLabel(
                  patch.condition ?? edge.data?.condition,
                  typeof edge.label === "string" ? edge.label : undefined,
                  patch.is_default ?? edge.data?.is_default
                ),
          data: {
            ...edge.data,
            ...patch
          }
        };
      })
    );
  };

  const autoLayout = () => {
    setNodes((current) => layoutNodesByFlow(current, edges));
    initializedFitRef.current = false;
    requestAnimationFrame(() => {
      flowInstance?.fitView({ padding: 0.18, duration: 220 });
    });
  };

  const repairBoundaryNodes = () => {
    const fixedDefinition = ensureBoundaryNodes(buildDefinitionFromCanvas(nodes, edges));
    setNodes(toReactFlowNodes(fixedDefinition));
    setEdges(toReactFlowEdges(fixedDefinition));
    initializedFitRef.current = false;
    requestAnimationFrame(() => {
      flowInstance?.fitView({ padding: 0.18, duration: 220 });
    });
    message.success("已修复开始/结束节点与基础连线");
  };

  const renderNodes = useMemo(
    () => (nodes.length ? nodes : toReactFlowNodes(canvasFallbackDefinition)),
    [canvasFallbackDefinition, nodes]
  );
  const renderEdges = useMemo(
    () => (edges.length ? edges : toReactFlowEdges(canvasFallbackDefinition)),
    [canvasFallbackDefinition, edges]
  );
  const renderNodeStats = useMemo(() => {
    let start = 0;
    let end = 0;
    renderNodes.forEach((node) => {
      if (node.data.node_type === "start") {
        start += 1;
      } else if (node.data.node_type === "end") {
        end += 1;
      }
    });
    return { start, end };
  }, [renderNodes]);
  const quickAddContextValue = useMemo<WorkflowQuickAddContextValue>(
    () => ({
      targetType: nodeTypeToAdd,
      appendAfter: (sourceNodeId, targetType) => {
        appendNodeAfterRef.current(sourceNodeId, targetType);
      }
    }),
    [nodeTypeToAdd]
  );
  const handleNodeDragStart = useCallback<NonNullable<ReactFlowProps["onNodeDragStart"]>>(() => {
    hasNodeDraggingRef.current = true;
    setIsNodeDragging(true);
    if (definitionSyncTimerRef.current !== null) {
      window.clearTimeout(definitionSyncTimerRef.current);
      definitionSyncTimerRef.current = null;
    }
  }, []);
  const handleNodeDragStop = useCallback<NonNullable<ReactFlowProps["onNodeDragStop"]>>(() => {
    hasNodeDraggingRef.current = false;
    setIsNodeDragging(false);
    requestAnimationFrame(() => {
      scheduleDefinitionSync(true);
    });
  }, [scheduleDefinitionSync]);
  const handleFlowInit = useCallback<NonNullable<ReactFlowProps["onInit"]>>((instance) => {
    setFlowInstance(instance);
    setZoomPercent(Math.round(instance.getZoom() * 100));
  }, []);
  const handleMoveEnd = useCallback<NonNullable<ReactFlowProps["onMoveEnd"]>>((_, viewport) => {
    setZoomPercent(Math.round(viewport.zoom * 100));
  }, []);
  const handleNodeClick = useCallback<NonNullable<ReactFlowProps["onNodeClick"]>>((_, node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    if (node.data.node_type === "approval" || node.data.node_type === "cc") {
      setNodePanelTab("approver_setting");
    } else {
      setNodePanelTab("node_setting");
    }
  }, []);
  const handleEdgeClick = useCallback<NonNullable<ReactFlowProps["onEdgeClick"]>>((_, edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const addGroupBlock = () => {
    setGroupConditionDraft((current) => ({
      ...current,
      blocks: [...(current.blocks || []), createConditionBlock(formFields[0]?.key || "")]
    }));
  };

  const removeGroupBlock = (blockId: string) => {
    setGroupConditionDraft((current) => {
      const nextBlocks = (current.blocks || []).filter((block) => block.id !== blockId);
      return {
        ...current,
        blocks: nextBlocks.length ? nextBlocks : [createConditionBlock(formFields[0]?.key || "")]
      };
    });
  };

  const updateGroupBlock = (blockId: string, patch: Partial<ConditionBlockDraft>) => {
    setGroupConditionDraft((current) => ({
      ...current,
      blocks: (current.blocks || []).map((block) =>
        block.id === blockId
          ? {
              ...block,
              ...patch
            }
          : block
      )
    }));
  };

  const addGroupRule = (blockId: string) => {
    setGroupConditionDraft((current) => ({
      ...current,
      blocks: (current.blocks || []).map((block) =>
        block.id === blockId
          ? {
              ...block,
              rules: [...(block.rules || []), createConditionRule(formFields[0]?.key || "")]
            }
          : block
      )
    }));
  };

  const removeGroupRule = (blockId: string, ruleIndex: number) => {
    setGroupConditionDraft((current) => ({
      ...current,
      blocks: (current.blocks || []).map((block) =>
        block.id === blockId
          ? {
              ...block,
              rules: (block.rules || []).filter((_, index) => index !== ruleIndex)
            }
          : block
      )
    }));
  };

  const updateGroupRule = (blockId: string, ruleIndex: number, patch: Partial<ConditionRule>) => {
    setGroupConditionDraft((current) => ({
      ...current,
      blocks: (current.blocks || []).map((block) =>
        block.id === blockId
          ? {
              ...block,
              rules: (block.rules || []).map((rule, index) =>
                index === ruleIndex
                  ? {
                      ...rule,
                      ...patch
                    }
                  : rule
              )
            }
          : block
      )
    }));
  };

  const addEdgeBlock = () => {
    setEdgeConditionDraft((current) => ({
      ...current,
      blocks: [...(current.blocks || []), createConditionBlock(formFields[0]?.key || "")]
    }));
  };

  const removeEdgeBlock = (blockId: string) => {
    setEdgeConditionDraft((current) => {
      const nextBlocks = (current.blocks || []).filter((block) => block.id !== blockId);
      return {
        ...current,
        blocks: nextBlocks.length ? nextBlocks : [createConditionBlock(formFields[0]?.key || "")]
      };
    });
  };

  const updateEdgeBlock = (blockId: string, patch: Partial<ConditionBlockDraft>) => {
    setEdgeConditionDraft((current) => ({
      ...current,
      blocks: (current.blocks || []).map((block) =>
        block.id === blockId
          ? {
              ...block,
              ...patch
            }
          : block
      )
    }));
  };

  const addEdgeRule = (blockId: string) => {
    setEdgeConditionDraft((current) => ({
      ...current,
      blocks: (current.blocks || []).map((block) =>
        block.id === blockId
          ? {
              ...block,
              rules: [...(block.rules || []), createConditionRule(formFields[0]?.key || "")]
            }
          : block
      )
    }));
  };

  const removeEdgeRule = (blockId: string, ruleIndex: number) => {
    setEdgeConditionDraft((current) => ({
      ...current,
      blocks: (current.blocks || []).map((block) =>
        block.id === blockId
          ? {
              ...block,
              rules: (block.rules || []).filter((_, index) => index !== ruleIndex)
            }
          : block
      )
    }));
  };

  const updateEdgeRule = (blockId: string, ruleIndex: number, patch: Partial<ConditionRule>) => {
    setEdgeConditionDraft((current) => ({
      ...current,
      blocks: (current.blocks || []).map((block) =>
        block.id === blockId
          ? {
              ...block,
              rules: (block.rules || []).map((rule, index) =>
                index === ruleIndex
                  ? {
                      ...rule,
                      ...patch
                    }
                  : rule
              )
            }
          : block
      )
    }));
  };

  const applyGroupCondition = () => {
    if (!selectedGroupId) {
      message.warning("请先选择审批组");
      return;
    }
    const normalized = normalizeConditionDraft(groupConditionDraft);
    updateSelectedGroup(selectedGroupId, { condition: normalized });
    message.success("审批组条件已更新");
  };

  const clearGroupCondition = () => {
    if (!selectedGroupId) {
      return;
    }
    setGroupConditionDraft(createEmptyConditionDraft(formFields[0]?.key || ""));
    updateSelectedGroup(selectedGroupId, { condition: undefined });
  };

  const applyEdgeCondition = () => {
    const normalized = normalizeConditionDraft(edgeConditionDraft);
    updateSelectedEdge({
      condition: normalized,
      label: getEdgeLabel(normalized, undefined, selectedEdge?.data?.is_default)
    });
    message.success("连线条件已更新");
  };

  const clearEdgeCondition = () => {
    setEdgeConditionDraft(createEmptyConditionDraft(formFields[0]?.key || ""));
    updateSelectedEdge({
      condition: undefined,
      label: getEdgeLabel(undefined, undefined, selectedEdge?.data?.is_default)
    });
  };

  const addApproverGroup = () => {
    if (!selectedNode) {
      return;
    }
    const currentGroups = selectedNode.data.approver_groups || [];
    const next = [...currentGroups, buildDefaultGroup(currentGroups.length + 1)];
    updateSelectedNode({ approver_groups: next });
    setSelectedGroupId(next[next.length - 1].id);
    setNodePanelTab("approver_setting");
  };

  const removeApproverGroup = (groupId: string) => {
    if (!selectedNode) {
      return;
    }
    const currentGroups = selectedNode.data.approver_groups || [];
    if (currentGroups.length <= 1) {
      message.warning("至少保留一个审批组");
      return;
    }
    const next = currentGroups.filter((group) => group.id !== groupId);
    updateSelectedNode({ approver_groups: next });
    if (selectedGroupId === groupId) {
      setSelectedGroupId(next[0]?.id || null);
    }
  };

  const handleZoomChange = (value: number) => {
    setZoomPercent(value);
    if (flowInstance) {
      flowInstance.zoomTo(value / 100, { duration: 200 });
    }
  };

  const handleNodeTypeChange = (value: WorkflowDefinitionNode["node_type"]) => {
    setNodeTypeToAdd(value);
  };

  const handleManualConnect = () => {
    if (!selectedNode) {
      message.warning("请先选择源节点");
      return;
    }
    if (!connectTargetNodeId) {
      message.warning("请先选择目标节点");
      return;
    }
    const success = createEdgeBetween(selectedNode.id, connectTargetNodeId);
    if (success) {
      message.success("连线已创建");
    }
  };

  const fieldPermissionMap = useMemo(() => {
    const map = new Map<string, WorkflowFieldPermission>();
    (selectedNode?.data.field_permissions || []).forEach((item) => {
      map.set(item.field_key, {
        field_key: item.field_key,
        can_view: item.can_view !== false,
        can_edit: item.can_edit === true,
        required: item.required === true
      });
    });
    return map;
  }, [selectedNode]);

  const updateFieldPermission = (
    fieldKey: string,
    patch: Partial<WorkflowFieldPermission>
  ) => {
    if (!selectedNode) {
      return;
    }
    const current = selectedNode.data.field_permissions || [];
    const exists = current.find((item) => item.field_key === fieldKey);
    const nextItem: WorkflowFieldPermission = {
      field_key: fieldKey,
      can_view: exists ? exists.can_view !== false : true,
      can_edit: exists ? exists.can_edit === true : false,
      required: exists ? exists.required === true : false,
      ...patch
    };
    const nextPermissions = [
      ...current.filter((item) => item.field_key !== fieldKey),
      nextItem
    ];
    updateSelectedNode({ field_permissions: nextPermissions });
  };

  const renderApproverGroupEditor = (group: WorkflowApproverGroup, index: number) => (
    <Card
      key={group.id}
      size="small"
      className="workflow-approver-group-card"
      title={`审批组 ${index + 1}`}
      extra={
        <Button
          type="text"
          danger
          size="small"
          onClick={() => removeApproverGroup(group.id)}
        >
          删除
        </Button>
      }
    >
      <Space direction="vertical" style={{ width: "100%" }}>
        <Input
          value={group.name}
          onChange={(event) => updateSelectedGroup(group.id, { name: event.target.value })}
          placeholder="审批组名称"
        />
        <Select
          value={group.approver_type}
          onChange={(value) =>
            updateSelectedGroup(group.id, {
              approver_type: value as WorkflowApproverGroup["approver_type"],
              approver_user_ids: [],
              approver_roles: [],
              approver_positions: [],
              approver_field_key: "",
              previous_step_offset: 1
            })
          }
          options={[
            { label: "指定人员", value: "user" },
            { label: "按角色", value: "role" },
            { label: "直属负责人", value: "manager" },
            { label: "部门负责人", value: "department_manager" },
            { label: "按岗位", value: "position" },
            { label: "发起人自选", value: "applicant_select" },
            { label: "前节点处理人", value: "previous_handler" }
          ]}
        />

        {group.approver_type === "user" ? (
          <Select
            mode="multiple"
            value={group.approver_user_ids || []}
            onChange={(value) => updateSelectedGroup(group.id, { approver_user_ids: value as number[] })}
            options={userOptions}
            placeholder="选择审批人"
          />
        ) : null}

        {group.approver_type === "role" ? (
          <Select
            mode="multiple"
            value={group.approver_roles || []}
            onChange={(value) => updateSelectedGroup(group.id, { approver_roles: value as string[] })}
            options={approverRoleOptions}
            placeholder="选择角色"
          />
        ) : null}

        {group.approver_type === "position" ? (
          <Select
            mode="multiple"
            value={group.approver_positions || []}
            onChange={(value) =>
              updateSelectedGroup(group.id, { approver_positions: value as string[] })
            }
            options={approverPositionOptions}
            placeholder="选择岗位"
          />
        ) : null}

        {group.approver_type === "applicant_select" ? (
          <Input
            value={group.approver_field_key || ""}
            onChange={(event) =>
              updateSelectedGroup(group.id, { approver_field_key: event.target.value })
            }
            placeholder="发起人自选字段 key"
          />
        ) : null}

        {group.approver_type === "previous_handler" ? (
          <InputNumber
            min={1}
            value={group.previous_step_offset || 1}
            onChange={(value) =>
              updateSelectedGroup(group.id, { previous_step_offset: Number(value || 1) })
            }
            style={{ width: "100%" }}
            addonBefore="向前回溯步数"
          />
        ) : null}

        <Select
          mode="multiple"
          value={group.cc_user_ids || []}
          onChange={(value) => updateSelectedGroup(group.id, { cc_user_ids: value as number[] })}
          options={userOptions}
          placeholder="抄送人（可选）"
        />
      </Space>
    </Card>
  );

  const renderConditionRuleEditor = (
    draft: ConditionDraft,
    onDraftLogicChange: (logic: WorkflowCondition["logic"]) => void,
    onExpressionChange: (expression: string) => void,
    expressionValidation: ConditionExpressionValidation,
    onValidateExpression: () => void,
    onBlockLogicChange: (blockId: string, logic: WorkflowCondition["logic"]) => void,
    onRuleChange: (blockId: string, index: number, patch: Partial<ConditionRule>) => void,
    onRuleDelete: (blockId: string, index: number) => void,
    onRuleAdd: (blockId: string) => void,
    onBlockAdd: () => void,
    onBlockDelete: (blockId: string) => void
  ) => {
    const previewExpression = buildConditionPreviewExpression(draft);
    return (
      <div className="workflow-condition-rule-board">
        <div className="workflow-condition-rule-head">
          <Text strong>条件块组合</Text>
          <Radio.Group
            size="small"
            value={draft.logic}
            onChange={(event) => onDraftLogicChange(event.target.value as WorkflowCondition["logic"])}
          >
            <Radio.Button value="and">块间且</Radio.Button>
            <Radio.Button value="or">块间或</Radio.Button>
          </Radio.Group>
        </div>
        <div className="workflow-condition-rule-body">
          {(draft.blocks || []).length === 0 ? (
            <Text type="secondary">暂无条件块，点击下方“添加条件块”</Text>
          ) : null}
          {(draft.blocks || []).map((block, blockIndex) => (
            <Card
              key={block.id}
              size="small"
              className="workflow-condition-block-card"
              title={`条件块 ${blockIndex + 1}`}
              extra={
                <Button
                  type="text"
                  danger
                  size="small"
                  disabled={(draft.blocks || []).length <= 1}
                  onClick={() => onBlockDelete(block.id)}
                >
                  删除条件块
                </Button>
              }
            >
              <Space direction="vertical" style={{ width: "100%" }} size={8}>
                <Radio.Group
                  size="small"
                  value={block.logic}
                  onChange={(event) => onBlockLogicChange(block.id, event.target.value as WorkflowCondition["logic"])}
                >
                  <Radio.Button value="and">块内且</Radio.Button>
                  <Radio.Button value="or">块内或</Radio.Button>
                </Radio.Group>

                {(block.rules || []).length === 0 ? (
                  <Text type="secondary">该条件块暂无规则</Text>
                ) : null}

                {(block.rules || []).map((rule, index) => (
                  <div className="workflow-condition-rule-row" key={`${block.id}_condition_rule_${index}`}>
                    {conditionFieldOptions.length ? (
                      <Select
                        value={rule.field || undefined}
                        options={conditionFieldOptions}
                        placeholder="选择字段"
                        style={{ width: 180 }}
                        onChange={(value) => onRuleChange(block.id, index, { field: String(value || "") })}
                      />
                    ) : (
                      <Input
                        value={rule.field}
                        placeholder="字段 key"
                        style={{ width: 180 }}
                        onChange={(event) => onRuleChange(block.id, index, { field: event.target.value })}
                      />
                    )}
                    <Select
                      value={rule.operator}
                      options={CONDITION_OPERATOR_OPTIONS}
                      style={{ width: 140 }}
                      onChange={(value) =>
                        onRuleChange(block.id, index, {
                          operator: value as WorkflowCondition["rules"][number]["operator"]
                        })
                      }
                    />
                    <Input
                      value={stringifyConditionValue(rule.value)}
                      placeholder="值（支持数字/布尔/JSON）"
                      style={{ width: 180 }}
                      onChange={(event) =>
                        onRuleChange(block.id, index, {
                          value: parseConditionValue(event.target.value)
                        })
                      }
                    />
                    <Button
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => onRuleDelete(block.id, index)}
                    />
                  </div>
                ))}
                <Button type="link" onClick={() => onRuleAdd(block.id)}>
                  + 添加条件
                </Button>
              </Space>
            </Card>
          ))}
        </div>
        <div className="workflow-condition-rule-actions">
          <Button type="link" onClick={onBlockAdd}>
            + 添加条件块
          </Button>
        </div>
        <div className="workflow-condition-rule-expression">
          <Text type="secondary">高级表达式（可选，将与条件块一起生效）</Text>
          <Input.TextArea
            value={draft.expression || ""}
            autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder='示例：field("amount") >= 10000 and field("urgent") == True'
            onChange={(event) => onExpressionChange(event.target.value)}
          />
          <Space size={8} style={{ marginTop: 8 }}>
            <Button
              size="small"
              onClick={onValidateExpression}
              loading={expressionValidation.status === "validating"}
              disabled={!String(draft.expression || "").trim()}
            >
              校验表达式
            </Button>
            {expressionValidation.status === "valid" ? (
              <Text type="success">{expressionValidation.message || "表达式合法"}</Text>
            ) : null}
            {expressionValidation.status === "invalid" ? (
              <Text type="danger">{expressionValidation.message || "表达式不合法"}</Text>
            ) : null}
          </Space>
        </div>
        <div className="workflow-condition-rule-expression">
          <Text type="secondary">最终条件表达式预览</Text>
          <Input.TextArea
            value={previewExpression}
            autoSize={{ minRows: 2, maxRows: 5 }}
            readOnly
            placeholder="配置条件后会自动生成预览表达式"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="workflow-designer-shell cloudflow-like-designer">
      <div className="workflow-designer-toolbar cloudflow-dark-toolbar">
        <Space wrap size={10}>
          <Text className="workflow-toolbar-label">控件：</Text>
          <Select
            size="small"
            value={nodeTypeToAdd}
            onChange={handleNodeTypeChange}
            options={NODE_LIBRARY}
            style={{ width: 140 }}
          />
          <Button size="small" icon={<PlusCircleOutlined />} onClick={() => addNode(nodeTypeToAdd)}>
            添加
          </Button>
          <Button size="small" onClick={addConditionBranchTemplate}>
            条件双分支
          </Button>
          <Divider type="vertical" />
          <Text className="workflow-toolbar-label">缩放：</Text>
          <Select
            size="small"
            value={zoomPercent}
            onChange={(value) => handleZoomChange(value as number)}
            options={ZOOM_OPTIONS.map((value) => ({ label: `${value}%`, value }))}
            style={{ width: 96 }}
            suffixIcon={<ZoomInOutlined />}
          />
          <Button size="small" onClick={() => flowInstance?.fitView({ padding: 0.18, duration: 180 })}>
            适配
          </Button>
          <Divider type="vertical" />
          <Button size="small" icon={<ApartmentOutlined />} onClick={autoLayout}>
            自动排版
          </Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={repairBoundaryNodes}>
            修复起止
          </Button>
          <Divider type="vertical" />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={removeSelection}>
            删除
          </Button>
          <Text
            className="workflow-toolbar-label"
            data-testid="workflow-designer-stats"
          >{`节点 ${renderNodes.length} / 连线 ${renderEdges.length} / 开始 ${renderNodeStats.start} / 结束 ${renderNodeStats.end}`}</Text>
        </Space>
      </div>

      <div className="workflow-designer-body">
        <div className="workflow-designer-canvas" data-testid="workflow-designer-canvas">
          <WorkflowQuickAddContext.Provider value={quickAddContextValue}>
            <ReactFlow
              nodes={renderNodes}
              edges={renderEdges}
              nodeTypes={nodeTypes}
              onlyRenderVisibleElements
              onNodesChange={handleNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              deleteKeyCode={null}
              onNodeDragStart={handleNodeDragStart}
              onNodeDragStop={handleNodeDragStop}
              onInit={handleFlowInit}
              onMoveEnd={handleMoveEnd}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              fitView
              fitViewOptions={{ padding: 0.18 }}
            >
              <MiniMap pannable zoomable />
              <Controls />
              <Background gap={20} size={1} color="#e6ebf2" />
            </ReactFlow>
          </WorkflowQuickAddContext.Provider>
        </div>

        <div className="workflow-designer-panel cloudflow-setting-panel">
          {!selectedNode && !selectedEdge ? (
            <Text type="secondary">选择一个节点或连线后，在右侧完成详细配置。</Text>
          ) : null}

          {selectedNode ? (
            <>
              <div className="workflow-panel-title">
                <Text strong>{selectedNode.data.name}</Text>
                <Text type="secondary">{getNodeTypeText(selectedNode.data.node_type)}</Text>
              </div>

              {(selectedNode.data.node_type === "approval" || selectedNode.data.node_type === "cc") ? (
                <Tabs
                  size="small"
                  activeKey={nodePanelTab}
                  onChange={setNodePanelTab}
                  items={[
                    {
                      key: "approver_setting",
                      label: "审批设置",
                      children: (
                        <Space direction="vertical" style={{ width: "100%" }} size={10}>
                          <Text type="secondary">审批类型</Text>
                          <Radio.Group
                            value={selectedNode.data.approval_type || "any"}
                            onChange={(event) =>
                              updateSelectedNode({
                                approval_type: event.target.value as NodeData["approval_type"],
                                approval_mode:
                                  event.target.value === "all" || event.target.value === "sequential"
                                    ? "all"
                                    : "any"
                              })
                            }
                          >
                            <Radio value="all">会签审批</Radio>
                            <Radio value="any">或签审批</Radio>
                            <Radio value="sequential">依次审批</Radio>
                          </Radio.Group>

                          <Divider style={{ margin: "6px 0" }} />
                          {(selectedNode.data.approver_groups || []).map(renderApproverGroupEditor)}

                          <Button type="dashed" icon={<PlusCircleOutlined />} onClick={addApproverGroup}>
                            添加审批组
                          </Button>
                        </Space>
                      )
                    },
                    {
                      key: "group_condition",
                      label: "条件规则设置",
                      children: (
                        <Space direction="vertical" style={{ width: "100%" }} size={10}>
                          <Select
                            value={selectedGroupId || undefined}
                            onChange={(value) => setSelectedGroupId(value as string)}
                            options={(selectedNode.data.approver_groups || []).map((group, index) => ({
                              label: group.name || `审批组${index + 1}`,
                              value: group.id
                            }))}
                            placeholder="选择审批组"
                          />
                          {renderConditionRuleEditor(
                            groupConditionDraft,
                            (logic) =>
                              setGroupConditionDraft((current) => ({
                                ...current,
                                logic
                              })),
                            (expression) =>
                              {
                                setGroupExpressionValidation({ status: "idle", result: null });
                                setGroupConditionDraft((current) => ({
                                  ...current,
                                  expression
                                }));
                              },
                            groupExpressionValidation,
                            validateGroupExpression,
                            (blockId, logic) => updateGroupBlock(blockId, { logic }),
                            updateGroupRule,
                            removeGroupRule,
                            addGroupRule,
                            addGroupBlock,
                            removeGroupBlock
                          )}
                          <Space>
                            <Button type="primary" onClick={applyGroupCondition}>
                              应用条件
                            </Button>
                            <Button onClick={clearGroupCondition}>清空条件</Button>
                          </Space>
                          <Text type="secondary">
                            说明：审批组条件命中后，该组审批人参与当前节点审批。
                          </Text>
                        </Space>
                      )
                    },
                    {
                      key: "node_setting",
                      label: "审批节点设置",
                      children: (
                        <Space direction="vertical" style={{ width: "100%" }} size={10}>
                          <Input
                            value={selectedNode.data.name}
                            onChange={(event) => updateSelectedNode({ name: event.target.value })}
                            placeholder="审批节点名称"
                          />
                          <Space>
                            <Text type="secondary">允许自审批</Text>
                            <Switch
                              checked={selectedNode.data.allow_self_approve !== false}
                              onChange={(checked) => updateSelectedNode({ allow_self_approve: checked })}
                            />
                          </Space>
                          <Space>
                            <Text type="secondary">允许自由退回</Text>
                            <Switch
                              checked={selectedNode.data.allow_return !== false}
                              onChange={(checked) => updateSelectedNode({ allow_return: checked })}
                            />
                          </Space>
                          <InputNumber
                            min={0}
                            value={selectedNode.data.timeout_hours || 0}
                            onChange={(value) => updateSelectedNode({ timeout_hours: Number(value || 0) })}
                            style={{ width: "100%" }}
                            addonBefore="节点处理时限"
                            addonAfter="小时"
                          />
                          <Button
                            icon={<SettingOutlined />}
                            onClick={() => setFieldPermissionOpen(true)}
                          >
                            设置节点字段权限
                          </Button>
                        </Space>
                      )
                    }
                  ]}
                />
              ) : (
                <Space direction="vertical" style={{ width: "100%" }} size={10}>
                  <Input
                    value={selectedNode.data.name}
                    onChange={(event) => updateSelectedNode({ name: event.target.value })}
                    placeholder="节点名称"
                  />
                  <Text type="secondary">节点类型：{getNodeTypeText(selectedNode.data.node_type)}</Text>
                  {selectedNode.data.node_type === "subprocess" ? (
                    <InputNumber
                      min={1}
                      value={selectedNode.data.subprocess_template_id || undefined}
                      onChange={(value) =>
                        updateSelectedNode({
                          subprocess_template_id: Number(value || 0)
                        })
                      }
                      style={{ width: "100%" }}
                      addonBefore="子流程模板ID"
                    />
                  ) : null}
                </Space>
              )}

              <Divider style={{ margin: "10px 0" }} />
              <Space direction="vertical" style={{ width: "100%" }} size={8}>
                <Text type="secondary">快速连线</Text>
                <Select
                  value={connectTargetNodeId || undefined}
                  onChange={(value) => setConnectTargetNodeId(value ? String(value) : null)}
                  options={connectTargetOptions.map((option) => ({
                    value: option.value,
                    label: option.disabled && option.reason ? `${option.label}（${option.reason}）` : option.label,
                    disabled: option.disabled
                  }))}
                  placeholder="选择目标节点"
                  data-testid="workflow-manual-connect-select"
                />
                <Button
                  type="primary"
                  onClick={handleManualConnect}
                  disabled={!connectTargetNodeId}
                  data-testid="workflow-manual-connect-button"
                >
                  创建连线
                </Button>
              </Space>
            </>
          ) : null}

          {selectedEdge ? (
            <>
              <div className="workflow-panel-title">
                <Text strong>连线设置</Text>
                <Text type="secondary">
                  {selectedEdge.source} → {selectedEdge.target}
                </Text>
              </div>
              <Space direction="vertical" style={{ width: "100%" }} size={10}>
                <InputNumber
                  min={1}
                  value={selectedEdge.data?.priority || 1}
                  style={{ width: "100%" }}
                  onChange={(value) => updateSelectedEdge({ priority: Number(value || 1) })}
                  addonBefore="优先级"
                />
                {selectedEdgeSourceType === "condition" ? (
                  <Space>
                    <Text type="secondary">默认分支</Text>
                    <Switch
                      checked={selectedEdge.data?.is_default === true}
                      onChange={(checked) =>
                        updateSelectedEdge({
                          is_default: checked,
                          label: getEdgeLabel(selectedEdge.data?.condition, undefined, checked)
                        })
                      }
                    />
                  </Space>
                ) : (
                  <Text type="secondary">非条件节点出线无需设置默认分支。</Text>
                )}
                <Divider style={{ margin: "4px 0" }} />
                <Text type="secondary">条件规则</Text>
                {renderConditionRuleEditor(
                  edgeConditionDraft,
                  (logic) =>
                    setEdgeConditionDraft((current) => ({
                      ...current,
                      logic
                    })),
                  (expression) =>
                    {
                      setEdgeExpressionValidation({ status: "idle", result: null });
                      setEdgeConditionDraft((current) => ({
                        ...current,
                        expression
                      }));
                    },
                  edgeExpressionValidation,
                  validateEdgeExpression,
                  (blockId, logic) => updateEdgeBlock(blockId, { logic }),
                  updateEdgeRule,
                  removeEdgeRule,
                  addEdgeRule,
                  addEdgeBlock,
                  removeEdgeBlock
                )}
                <Space>
                  <Button type="primary" onClick={applyEdgeCondition}>
                    应用条件
                  </Button>
                  <Button onClick={clearEdgeCondition}>清空条件</Button>
                </Space>
              </Space>
            </>
          ) : null}
        </div>
      </div>

      <Modal
        title="审批表单字段权限控制"
        open={fieldPermissionOpen}
        width={760}
        onCancel={() => setFieldPermissionOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setFieldPermissionOpen(false)}>
            完成
          </Button>
        ]}
      >
        {!formFields.length ? (
          <Text type="secondary">当前流程未绑定可用表单字段，请先选择表单模板。</Text>
        ) : (
          <div className="workflow-field-permission-grid">
            <div className="workflow-field-permission-head">字段名称</div>
            <div className="workflow-field-permission-head">查看</div>
            <div className="workflow-field-permission-head">编辑</div>
            <div className="workflow-field-permission-head">必填</div>

            {formFields.map((field) => {
              const row = fieldPermissionMap.get(field.key) || {
                field_key: field.key,
                can_view: true,
                can_edit: false,
                required: false
              };
              return (
                <div className="workflow-field-permission-row" key={field.key}>
                  <div className="workflow-field-permission-cell" key={`${field.key}_name`}>
                    {field.label} ({field.key})
                  </div>
                  <div className="workflow-field-permission-cell" key={`${field.key}_view`}>
                    <Switch
                      size="small"
                      checked={row.can_view}
                      onChange={(checked) =>
                        updateFieldPermission(field.key, {
                          can_view: checked,
                          can_edit: checked ? row.can_edit : false,
                          required: checked ? row.required : false
                        })
                      }
                    />
                  </div>
                  <div className="workflow-field-permission-cell" key={`${field.key}_edit`}>
                    <Switch
                      size="small"
                      checked={row.can_edit}
                      disabled={!row.can_view}
                      onChange={(checked) =>
                        updateFieldPermission(field.key, {
                          can_edit: checked,
                          can_view: checked ? true : row.can_view
                        })
                      }
                    />
                  </div>
                  <div className="workflow-field-permission-cell" key={`${field.key}_required`}>
                    <Switch
                      size="small"
                      checked={row.required}
                      disabled={!row.can_edit}
                      onChange={(checked) =>
                        updateFieldPermission(field.key, {
                          required: checked,
                          can_view: checked ? true : row.can_view,
                          can_edit: checked ? true : row.can_edit
                        })
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default WorkflowProcessDesigner;
