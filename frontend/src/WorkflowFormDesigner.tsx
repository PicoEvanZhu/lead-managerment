import { useMemo, useState, type CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Card, Divider, Input, InputNumber, Select, Space, Switch, Tag, Typography, message } from "antd";
import { DeleteOutlined, DragOutlined, PlusOutlined } from "@ant-design/icons";

const { Text } = Typography;

export type WorkflowFormDesignerColumn = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "boolean";
  options?: string[];
};

export type WorkflowFormDesignerField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "boolean" | "attachment" | "table";
  required?: boolean;
  options?: string[];
  columns?: WorkflowFormDesignerColumn[];
  max_count?: number;
  default?: unknown;
  placeholder?: string;
  order?: number;
};

type WorkflowFormDesignerProps = {
  seed?: number;
  initialSchema: WorkflowFormDesignerField[];
  onSchemaChange: (schema: WorkflowFormDesignerField[]) => void;
  showGuideBar?: boolean;
  guideStep?: 1 | 2;
  nextLabel?: string;
  publishLabel?: string;
  onNextStep?: () => void;
  onPublish?: () => void;
  disableNext?: boolean;
  disablePublish?: boolean;
  publishing?: boolean;
};

type DesignerItem = {
  id: string;
  field: WorkflowFormDesignerField;
};

const PALETTE_ITEM_PREFIX = "palette:";
const CANVAS_DROP_END_ID = "canvas_drop_end";

const FIELD_TYPE_OPTIONS: Array<{ label: string; value: WorkflowFormDesignerField["type"]; group: "basic" | "advanced" }> = [
  { label: "单行文本", value: "text", group: "basic" },
  { label: "多行输入框", value: "textarea", group: "basic" },
  { label: "数字输入框", value: "number", group: "basic" },
  { label: "日期选择", value: "date", group: "basic" },
  { label: "单选框", value: "boolean", group: "basic" },
  { label: "多选框", value: "select", group: "basic" },
  { label: "文件上传", value: "attachment", group: "basic" },
  { label: "明细表格", value: "table", group: "advanced" }
];

const COLUMN_TYPE_OPTIONS: Array<{ label: string; value: WorkflowFormDesignerColumn["type"] }> = [
  { label: "单行文本", value: "text" },
  { label: "多行文本", value: "textarea" },
  { label: "数字", value: "number" },
  { label: "日期", value: "date" },
  { label: "下拉选项", value: "select" },
  { label: "布尔", value: "boolean" }
];

const FIELD_TYPE_LABELS: Record<WorkflowFormDesignerField["type"], string> = {
  text: "单行文本",
  textarea: "多行文本",
  number: "数字",
  date: "日期",
  select: "多选",
  boolean: "单选",
  attachment: "附件",
  table: "明细"
};

let itemSequence = 1;
const nextItemId = () => `wf_item_${itemSequence++}`;

const normalizeField = (field: WorkflowFormDesignerField): WorkflowFormDesignerField => {
  const next: WorkflowFormDesignerField = {
    key: String(field.key || "").trim(),
    label: String(field.label || "").trim(),
    type: field.type,
    required: Boolean(field.required),
    placeholder: typeof field.placeholder === "string" ? field.placeholder : undefined
  };

  if (field.type === "select") {
    next.options = (field.options || [])
      .map((item) => String(item || "").trim())
      .filter((item) => item);
  }

  if (field.type === "attachment") {
    if (typeof field.max_count === "number" && field.max_count > 0) {
      next.max_count = field.max_count;
    }
  }

  if (field.type === "table") {
    next.columns = (field.columns || []).map((column) => {
      const normalizedColumn: WorkflowFormDesignerColumn = {
        key: String(column.key || "").trim(),
        label: String(column.label || "").trim(),
        type: column.type
      };
      if (column.type === "select") {
        normalizedColumn.options = (column.options || [])
          .map((item) => String(item || "").trim())
          .filter((item) => item);
      }
      return normalizedColumn;
    });
  }

  if (field.default !== undefined) {
    next.default = field.default;
  }
  return next;
};

const mapItemsToSchema = (items: DesignerItem[]): WorkflowFormDesignerField[] =>
  items.map((item, index) => ({
    ...normalizeField(item.field),
    order: index + 1
  }));

const ensureUniqueKey = (base: string, existingKeys: string[]) => {
  const seed = base.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+/, "") || "field";
  if (!existingKeys.includes(seed)) {
    return seed;
  }
  let index = 1;
  while (existingKeys.includes(`${seed}_${index}`)) {
    index += 1;
  }
  return `${seed}_${index}`;
};

const normalizeFieldKeyInput = (raw: string) =>
  String(raw || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^_+/, "");

const createDefaultField = (
  fieldType: WorkflowFormDesignerField["type"],
  existingKeys: string[]
): WorkflowFormDesignerField => {
  const baseKeyByType: Record<WorkflowFormDesignerField["type"], string> = {
    text: "title",
    textarea: "reason",
    number: "amount",
    date: "date",
    select: "category",
    boolean: "checked",
    attachment: "files",
    table: "items"
  };
  const baseLabelByType: Record<WorkflowFormDesignerField["type"], string> = {
    text: "标题",
    textarea: "请输入",
    number: "数字",
    date: "日期",
    select: "类型",
    boolean: "是否同意",
    attachment: "文件上传",
    table: "明细表"
  };

  const key = ensureUniqueKey(baseKeyByType[fieldType], existingKeys);
  const field: WorkflowFormDesignerField = {
    key,
    label: baseLabelByType[fieldType],
    type: fieldType,
    required: false,
    placeholder: ""
  };

  if (fieldType === "select") {
    field.options = ["选项1", "选项2"];
  }
  if (fieldType === "attachment") {
    field.max_count = 5;
  }
  if (fieldType === "table") {
    field.columns = [
      { key: "item_name", label: "项目", type: "text" },
      { key: "amount", label: "金额", type: "number" }
    ];
  }
  return field;
};

const buildItemsFromSchema = (schema: WorkflowFormDesignerField[]) =>
  (schema || []).map((field) => ({
    id: nextItemId(),
    field: normalizeField(field)
  }));

const getFieldPreviewRightText = (field: WorkflowFormDesignerField) => {
  if (field.type === "select" || field.type === "date" || field.type === "boolean") {
    return "请选择";
  }
  if (field.type === "attachment") {
    return "上传";
  }
  if (field.type === "table") {
    return "明细";
  }
  return field.placeholder || "请输入";
};

type SortablePhoneFieldRowProps = {
  item: DesignerItem;
  selected: boolean;
  layoutMode: "mobile" | "desktop";
  onSelect: () => void;
  onDelete: () => void;
};

type PaletteFieldItemProps = {
  option: { label: string; value: WorkflowFormDesignerField["type"] };
  onClick: () => void;
};

function PaletteFieldItem(props: PaletteFieldItemProps) {
  const { option, onClick } = props;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${PALETTE_ITEM_PREFIX}${option.value}`
  });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform)
  };
  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      className={`yz-form-palette-item ${isDragging ? "is-dragging" : ""}`}
      data-testid={`workflow-form-palette-${option.value}`}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      <span>{option.label}</span>
      <PlusOutlined />
    </button>
  );
}

function CanvasDropZone(props: { id: string; compact?: boolean }) {
  const { id, compact = false } = props;
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`yz-form-dropzone ${compact ? "is-compact" : ""} ${isOver ? "is-over" : ""}`}>
      拖拽控件到这里
    </div>
  );
}

function SortablePhoneFieldRow(props: SortablePhoneFieldRowProps) {
  const { item, selected, layoutMode, onSelect, onDelete } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const isDesktopWide = layoutMode === "desktop" && (item.field.type === "textarea" || item.field.type === "attachment");
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.72 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`yz-form-sortable-item ${layoutMode === "desktop" ? "is-desktop" : "is-mobile"} ${isDesktopWide ? "is-wide" : ""}`}
    >
      <div
        className={`yz-form-phone-row ${selected ? "is-selected" : ""} ${layoutMode === "desktop" ? "is-desktop" : ""}`}
        onClick={onSelect}
      >
        <div className="yz-form-phone-row-main">
          <div className="yz-form-phone-row-label">
            {item.field.label || "未命名字段"}
            {item.field.required ? <span className="yz-form-required">*</span> : null}
          </div>
          <div className="yz-form-phone-row-value">{getFieldPreviewRightText(item.field)}</div>
        </div>
        <div className="yz-form-phone-row-meta">
          <Tag>{FIELD_TYPE_LABELS[item.field.type]}</Tag>
          <Button
            type="text"
            size="small"
            icon={<DragOutlined />}
            onClick={(event) => event.stopPropagation()}
            {...attributes}
            {...listeners}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          />
        </div>
      </div>
    </div>
  );
}

function WorkflowFormDesigner(props: WorkflowFormDesignerProps) {
  const {
    initialSchema,
    onSchemaChange,
    showGuideBar = false,
    guideStep = 1,
    nextLabel = "下一步",
    publishLabel = "发布",
    onNextStep,
    onPublish,
    disableNext = false,
    disablePublish = false,
    publishing = false
  } = props;
  const [items, setItems] = useState<DesignerItem[]>(() => buildItemsFromSchema(initialSchema));
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id || null);
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("mobile");
  const [settingsTab, setSettingsTab] = useState<"field" | "template">("field");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  const basicFieldOptions = useMemo(
    () => FIELD_TYPE_OPTIONS.filter((item) => item.group === "basic"),
    []
  );

  const advancedFieldOptions = useMemo(
    () => FIELD_TYPE_OPTIONS.filter((item) => item.group === "advanced"),
    []
  );

  const schema = useMemo(() => mapItemsToSchema(items), [items]);
  const requiredCount = useMemo(
    () => items.filter((item) => item.field.required === true).length,
    [items]
  );
  const fieldTypeStats = useMemo(() => {
    const stats = new Map<WorkflowFormDesignerField["type"], number>();
    items.forEach((item) => {
      const key = item.field.type;
      stats.set(key, (stats.get(key) || 0) + 1);
    });
    return Array.from(stats.entries());
  }, [items]);
  const schemaPreviewText = useMemo(() => JSON.stringify(schema, null, 2), [schema]);
  const activeDragPaletteType = useMemo(() => {
    if (!activeDragId || !activeDragId.startsWith(PALETTE_ITEM_PREFIX)) {
      return null;
    }
    const fieldType = activeDragId.slice(PALETTE_ITEM_PREFIX.length) as WorkflowFormDesignerField["type"];
    return FIELD_TYPE_OPTIONS.some((item) => item.value === fieldType) ? fieldType : null;
  }, [activeDragId]);
  const activeDragItem = useMemo(
    () => items.find((item) => item.id === activeDragId) || null,
    [activeDragId, items]
  );

  const commitItems = (nextItems: DesignerItem[], nextSelectedId?: string | null) => {
    setItems(nextItems);
    if (nextSelectedId !== undefined) {
      setSelectedId(nextSelectedId);
    } else if (selectedId && !nextItems.some((item) => item.id === selectedId)) {
      setSelectedId(nextItems[0]?.id || null);
    }
    onSchemaChange(mapItemsToSchema(nextItems));
  };

  const addField = (fieldType: WorkflowFormDesignerField["type"]) => {
    const existingKeys = items.map((item) => item.field.key).filter((item) => item);
    const newItem: DesignerItem = {
      id: nextItemId(),
      field: createDefaultField(fieldType, existingKeys)
    };
    const nextItems = [...items, newItem];
    commitItems(nextItems, newItem.id);
  };

  const removeField = (id: string) => {
    const nextItems = items.filter((item) => item.id !== id);
    const nextSelectedId = selectedId === id ? nextItems[0]?.id || null : selectedId;
    commitItems(nextItems, nextSelectedId);
  };

  const updateField = (
    id: string,
    updater: (field: WorkflowFormDesignerField) => WorkflowFormDesignerField
  ) => {
    const nextItems = items.map((item) =>
      item.id === id
        ? {
            ...item,
            field: normalizeField(updater(item.field))
          }
        : item
    );
    commitItems(nextItems);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = String(active.id);
    const overId = over ? String(over.id) : "";
    if (!over) {
      setActiveDragId(null);
      return;
    }

    if (activeId.startsWith(PALETTE_ITEM_PREFIX)) {
      const fieldType = activeId.slice(PALETTE_ITEM_PREFIX.length) as WorkflowFormDesignerField["type"];
      if (!FIELD_TYPE_OPTIONS.some((option) => option.value === fieldType)) {
        setActiveDragId(null);
        return;
      }
      const existingKeys = items.map((item) => item.field.key).filter((item) => item);
      const newItem: DesignerItem = {
        id: nextItemId(),
        field: createDefaultField(fieldType, existingKeys)
      };

      let insertIndex = items.length;
      if (overId !== CANVAS_DROP_END_ID) {
        const hoverIndex = items.findIndex((item) => item.id === overId);
        if (hoverIndex < 0) {
          setActiveDragId(null);
          return;
        }
        insertIndex = hoverIndex;
      }
      const nextItems = [...items];
      nextItems.splice(insertIndex, 0, newItem);
      commitItems(nextItems, newItem.id);
      setActiveDragId(null);
      return;
    }

    if (activeId === overId) {
      setActiveDragId(null);
      return;
    }
    const oldIndex = items.findIndex((item) => item.id === activeId);
    if (oldIndex < 0) {
      setActiveDragId(null);
      return;
    }
    const newIndex = overId === CANVAS_DROP_END_ID ? items.length - 1 : items.findIndex((item) => item.id === overId);
    if (newIndex < 0) {
      setActiveDragId(null);
      return;
    }
    commitItems(arrayMove(items, oldIndex, newIndex));
    setActiveDragId(null);
  };

  const onDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const copySchemaJson = async () => {
    try {
      await navigator.clipboard.writeText(schemaPreviewText);
      message.success("Schema JSON 已复制");
    } catch {
      message.error("复制失败，请手动复制");
    }
  };

  const renderSortableRows = (layoutMode: "mobile" | "desktop") => (
    <div className={`yz-form-sortable-list ${layoutMode === "desktop" ? "is-desktop" : "is-mobile"}`}>
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={layoutMode === "desktop" ? rectSortingStrategy : verticalListSortingStrategy}
      >
        {items.map((item) => (
          <SortablePhoneFieldRow
            key={item.id}
            item={item}
            selected={item.id === selectedId}
            layoutMode={layoutMode}
            onSelect={() => setSelectedId(item.id)}
            onDelete={() => removeField(item.id)}
          />
        ))}
      </SortableContext>
      <div className={`yz-form-dropzone-slot ${layoutMode === "desktop" ? "is-desktop" : ""}`}>
        <CanvasDropZone id={CANVAS_DROP_END_ID} compact />
      </div>
    </div>
  );

  return (
    <div className="yz-form-designer-shell">
      {showGuideBar ? (
        <div className="yz-form-designer-topbar">
          <div className="yz-form-guide-left">流程设计指南</div>
          <div className="yz-form-guide-steps">
            <span className={guideStep === 1 ? "is-active" : ""}>① 表单设计</span>
            <span className={guideStep === 2 ? "is-active" : ""}>② 审批流程设计</span>
          </div>
          <div className="yz-form-guide-actions">
            <Button size="small" disabled={disableNext} onClick={onNextStep}>
              {nextLabel}
            </Button>
            <Button size="small" type="primary" disabled={disablePublish} loading={publishing} onClick={onPublish}>
              {publishLabel}
            </Button>
          </div>
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveDragId(null)}
      >
        <div className="yz-form-designer-board">
          <aside className="yz-form-palette">
            <div className="yz-panel-title">表单控件</div>
            <div className="yz-form-palette-grid">
              {basicFieldOptions.map((option) => (
                <PaletteFieldItem
                  key={option.value}
                  option={option}
                  onClick={() => addField(option.value)}
                />
              ))}
            </div>

            <Divider style={{ margin: "14px 0" }} />

            <div className="yz-panel-title">高级控件</div>
            <div className="yz-form-palette-grid">
              {advancedFieldOptions.map((option) => (
                <PaletteFieldItem
                  key={option.value}
                  option={option}
                  onClick={() => addField(option.value)}
                />
              ))}
            </div>
          </aside>

          <section className="yz-form-preview-stage">
            <div className="yz-form-preview-toolbar">
              <button
                type="button"
                className={previewDevice === "mobile" ? "is-active" : ""}
                onClick={() => setPreviewDevice("mobile")}
              >
                手机
              </button>
              <button
                type="button"
                className={previewDevice === "desktop" ? "is-active" : ""}
                onClick={() => setPreviewDevice("desktop")}
              >
                电脑
              </button>
            </div>

            {previewDevice === "mobile" ? (
              <div className="yz-form-phone-shell">
                <div className="yz-form-phone-notch" />
                <div className="yz-form-phone-status">100%</div>

                <div className="yz-form-phone-content">
                  {!items.length ? (
                    <div className="yz-form-empty">
                      <CanvasDropZone id={CANVAS_DROP_END_ID} />
                    </div>
                  ) : (
                    renderSortableRows("mobile")
                  )}
                </div>
              </div>
            ) : (
              <div className="yz-form-desktop-shell">
                <div className="yz-form-desktop-header">PC 端预览</div>
                <div className="yz-form-desktop-content">
                  {!items.length ? (
                    <div className="yz-form-empty">
                      <CanvasDropZone id={CANVAS_DROP_END_ID} />
                    </div>
                  ) : (
                    renderSortableRows("desktop")
                  )}
                </div>
              </div>
            )}
          </section>

          <aside className="yz-form-settings-panel">
          <div className="yz-form-settings-tabs">
            <button
              type="button"
              className={settingsTab === "field" ? "is-active" : ""}
              onClick={() => setSettingsTab("field")}
            >
              控件设置
            </button>
            <button
              type="button"
              className={settingsTab === "template" ? "is-active" : ""}
              onClick={() => setSettingsTab("template")}
            >
              模板设置
            </button>
          </div>

          {settingsTab === "field" ? (
            <>
              {!selectedItem ? <Text type="secondary">请选择中间画布中的控件进行属性配置。</Text> : null}

              {selectedItem ? (
                <Space direction="vertical" style={{ width: "100%" }} size={10}>
                  <Text className="yz-setting-label">控件使用说明</Text>

                  <Text type="secondary">标题</Text>
                  <Input
                    value={selectedItem.field.label}
                    onChange={(event) =>
                      updateField(selectedItem.id, (field) => ({
                        ...field,
                        label: event.target.value
                      }))
                    }
                    placeholder="最少20个字"
                  />

                  <Text type="secondary">提示语</Text>
                  <Input
                    value={selectedItem.field.placeholder || ""}
                    onChange={(event) =>
                      updateField(selectedItem.id, (field) => ({
                        ...field,
                        placeholder: event.target.value
                      }))
                    }
                    placeholder="请输入"
                  />

                  <Text type="secondary">字段 Key</Text>
                  <Input
                    value={selectedItem.field.key}
                    onChange={(event) =>
                      updateField(selectedItem.id, (field) => ({
                        ...field,
                        key: event.target.value
                      }))
                    }
                    onBlur={(event) => {
                      const normalized = normalizeFieldKeyInput(event.target.value);
                      const existingKeys = items
                        .filter((item) => item.id !== selectedItem.id)
                        .map((item) => item.field.key)
                        .filter((key) => String(key || "").trim());
                      const unique = ensureUniqueKey(normalized || "field", existingKeys);
                      if (unique !== selectedItem.field.key) {
                        updateField(selectedItem.id, (field) => ({
                          ...field,
                          key: unique
                        }));
                      }
                    }}
                    placeholder="例如 leave_days"
                  />

                  <Text type="secondary">控件类型</Text>
                  <Select
                    value={selectedItem.field.type}
                    options={FIELD_TYPE_OPTIONS.map((item) => ({ label: item.label, value: item.value }))}
                    onChange={(value) =>
                      updateField(selectedItem.id, (field) => {
                        const next = {
                          ...field,
                          type: value as WorkflowFormDesignerField["type"]
                        };
                        if (value === "select" && (!next.options || !next.options.length)) {
                          next.options = ["选项1", "选项2"];
                        } else if (value !== "select") {
                          delete next.options;
                        }
                        if (value === "attachment" && (!next.max_count || next.max_count <= 0)) {
                          next.max_count = 5;
                        } else if (value !== "attachment") {
                          delete next.max_count;
                        }
                        if (value === "table" && (!next.columns || !next.columns.length)) {
                          next.columns = [
                            { key: "item_name", label: "项目", type: "text" },
                            { key: "amount", label: "金额", type: "number" }
                          ];
                        } else if (value !== "table") {
                          delete next.columns;
                        }
                        return next;
                      })
                    }
                  />

                  <Text type="secondary">是否必填</Text>
                  <Switch
                    checked={selectedItem.field.required === true}
                    onChange={(checked) =>
                      updateField(selectedItem.id, (field) => ({
                        ...field,
                        required: checked
                      }))
                    }
                  />

                  {selectedItem.field.type === "select" ? (
                    <>
                      <Text type="secondary">选项值</Text>
                      <Select
                        mode="tags"
                        value={selectedItem.field.options || []}
                        onChange={(value) =>
                          updateField(selectedItem.id, (field) => ({
                            ...field,
                            options: (value || []).map((item) => String(item || "").trim()).filter((item) => item)
                          }))
                        }
                        tokenSeparators={[","]}
                        style={{ width: "100%" }}
                        placeholder="输入选项后回车"
                      />
                    </>
                  ) : null}

                  {selectedItem.field.type === "attachment" ? (
                    <>
                      <Text type="secondary">最大附件数</Text>
                      <InputNumber
                        min={1}
                        max={50}
                        value={selectedItem.field.max_count || 5}
                        onChange={(value) =>
                          updateField(selectedItem.id, (field) => ({
                            ...field,
                            max_count: Number(value || 1)
                          }))
                        }
                        style={{ width: "100%" }}
                      />
                    </>
                  ) : null}

                  {selectedItem.field.type === "table" ? (
                    <>
                      <Divider style={{ margin: "6px 0" }} />
                      <Text strong>明细列配置</Text>
                      {(selectedItem.field.columns || []).map((column, index) => (
                        <Card
                          key={`${selectedItem.id}_${index}`}
                          size="small"
                          className="yz-form-table-column-card"
                          title={`第${index + 1}列`}
                          extra={
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() =>
                                updateField(selectedItem.id, (field) => ({
                                  ...field,
                                  columns: (field.columns || []).filter((_, colIndex) => colIndex !== index)
                                }))
                              }
                            />
                          }
                        >
                          <Space direction="vertical" style={{ width: "100%" }}>
                            <Input
                              value={column.key}
                              onChange={(event) =>
                                updateField(selectedItem.id, (field) => ({
                                  ...field,
                                  columns: (field.columns || []).map((col, colIndex) =>
                                    colIndex === index
                                      ? {
                                          ...col,
                                          key: event.target.value
                                        }
                                      : col
                                  )
                                }))
                              }
                              placeholder="列 key"
                            />
                            <Input
                              value={column.label}
                              onChange={(event) =>
                                updateField(selectedItem.id, (field) => ({
                                  ...field,
                                  columns: (field.columns || []).map((col, colIndex) =>
                                    colIndex === index
                                      ? {
                                          ...col,
                                          label: event.target.value
                                        }
                                      : col
                                  )
                                }))
                              }
                              placeholder="列标题"
                            />
                            <Select
                              value={column.type}
                              options={COLUMN_TYPE_OPTIONS}
                              onChange={(value) =>
                                updateField(selectedItem.id, (field) => ({
                                  ...field,
                                  columns: (field.columns || []).map((col, colIndex) =>
                                    colIndex === index
                                      ? {
                                          ...col,
                                          type: value as WorkflowFormDesignerColumn["type"],
                                          options:
                                            value === "select"
                                              ? col.options && col.options.length
                                                ? col.options
                                                : ["选项1", "选项2"]
                                              : undefined
                                        }
                                      : col
                                  )
                                }))
                              }
                            />
                            {column.type === "select" ? (
                              <Select
                                mode="tags"
                                value={column.options || []}
                                onChange={(value) =>
                                  updateField(selectedItem.id, (field) => ({
                                    ...field,
                                    columns: (field.columns || []).map((col, colIndex) =>
                                      colIndex === index
                                        ? {
                                            ...col,
                                            options: (value || [])
                                              .map((item) => String(item || "").trim())
                                              .filter((item) => item)
                                          }
                                        : col
                                    )
                                  }))
                                }
                                tokenSeparators={[","]}
                                style={{ width: "100%" }}
                                placeholder="输入列选项后回车"
                              />
                            ) : null}
                          </Space>
                        </Card>
                      ))}
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={() =>
                          updateField(selectedItem.id, (field) => ({
                            ...field,
                            columns: [
                              ...(field.columns || []),
                              {
                                key: ensureUniqueKey(
                                  "column",
                                  (field.columns || []).map((item) => item.key)
                                ),
                                label: "新列",
                                type: "text"
                              }
                            ]
                          }))
                        }
                        style={{ width: "100%" }}
                      >
                        新增列
                      </Button>
                    </>
                  ) : null}
                </Space>
              ) : null}
            </>
          ) : (
            <Space direction="vertical" style={{ width: "100%" }} size={10}>
              <Text strong>模板概览</Text>
              <div className="yz-form-template-stats">
                <div className="yz-form-template-stat-card">
                  <Text type="secondary">字段总数</Text>
                  <Text>{items.length}</Text>
                </div>
                <div className="yz-form-template-stat-card">
                  <Text type="secondary">必填字段</Text>
                  <Text>{requiredCount}</Text>
                </div>
              </div>
              <Text type="secondary">字段类型分布</Text>
              <Space wrap>
                {fieldTypeStats.length ? (
                  fieldTypeStats.map(([type, count]) => (
                    <Tag key={type}>
                      {FIELD_TYPE_LABELS[type]} x {count}
                    </Tag>
                  ))
                ) : (
                  <Text type="secondary">暂无字段</Text>
                )}
              </Space>
              <Divider style={{ margin: "8px 0" }} />
              <Text type="secondary">字段索引（点击可切到控件设置）</Text>
              <div className="yz-form-template-field-list">
                {items.length ? (
                  items.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      className="yz-form-template-field-item"
                      onClick={() => {
                        setSelectedId(item.id);
                        setSettingsTab("field");
                      }}
                    >
                      {index + 1}. {item.field.label || "未命名字段"} ({item.field.key || "-"})
                    </button>
                  ))
                ) : (
                  <Text type="secondary">暂无字段</Text>
                )}
              </div>
              <Divider style={{ margin: "8px 0" }} />
              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <Text type="secondary">Schema JSON</Text>
                <Button size="small" onClick={copySchemaJson}>
                  复制 JSON
                </Button>
              </Space>
              <Input.TextArea
                value={schemaPreviewText}
                autoSize={{ minRows: 8, maxRows: 14 }}
                readOnly
                className="yz-form-template-json"
              />
            </Space>
          )}
          </aside>
        </div>

        <DragOverlay>
          {activeDragPaletteType ? (
            <div className="yz-form-drag-overlay">{FIELD_TYPE_LABELS[activeDragPaletteType]}</div>
          ) : activeDragItem ? (
            <div className="yz-form-drag-overlay">{activeDragItem.field.label || "未命名字段"}</div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export default WorkflowFormDesigner;
