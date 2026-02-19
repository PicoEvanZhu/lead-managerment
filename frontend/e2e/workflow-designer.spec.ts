import { expect, test, type Page, type Route } from "@playwright/test";

const API_BASE = "http://localhost:3000";

type DesignerStats = {
  nodes: number;
  edges: number;
  start: number;
  end: number;
};

const respondJson = async (route: Route, body: Record<string, unknown>, status = 200) => {
  await route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body)
  });
};

const parseDesignerStats = (text: string): DesignerStats => {
  const match = text.match(/节点\s*(\d+)\s*\/\s*连线\s*(\d+)\s*\/\s*开始\s*(\d+)\s*\/\s*结束\s*(\d+)/);
  if (!match) {
    throw new Error(`无法解析设计器统计文本: ${text}`);
  }
  return {
    nodes: Number(match[1]),
    edges: Number(match[2]),
    start: Number(match[3]),
    end: Number(match[4])
  };
};

const readDesignerStats = async (page: Page): Promise<DesignerStats> => {
  const text = await page.getByTestId("workflow-designer-stats").innerText();
  return parseDesignerStats(text);
};

const readCanvasNodeIds = async (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    return Array.from(document.querySelectorAll(".react-flow__node"))
      .map((element) => element.getAttribute("data-id"))
      .filter((id): id is string => Boolean(id));
  });

const openWorkflowCenter = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("menuitem", { name: "流程审批" }).click();
  await expect(page.getByText("流程审批中心")).toBeVisible();
};

const openWorkflowDesigner = async (page: Page) => {
  await openWorkflowCenter(page);
  await page.getByTestId("workflow-create-template-button").click();
  await expect(page.getByText("新建流程模板")).toBeVisible();
  await page.getByTestId("workflow-form-palette-text").click();
  await page.getByTestId("workflow-wizard-next-button").click();
  await expect(page.getByText("② 审批流程设计")).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("crm_user_id", "1");
  });

  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const path = url.pathname;

    if (method === "GET" && path === "/me") {
      await respondJson(route, {
        data: { id: 1, name: "集团管理员", role: "group_admin", company_id: 1 }
      });
      return;
    }

    if (method === "GET" && path === "/companies") {
      await respondJson(route, {
        data: [{ id: 1, name: "Pico 集团", parent_id: 0, status: "active" }]
      });
      return;
    }

    if (method === "GET" && path === "/users") {
      await respondJson(route, {
        data: [
          { id: 1, name: "集团管理员", role: "group_admin", company_id: 1, status: "active" },
          { id: 2, name: "审批人A", role: "sales", company_id: 1, status: "active" },
          { id: 3, name: "审批人B", role: "marketing", company_id: 1, status: "active" }
        ]
      });
      return;
    }

    if (method === "GET" && path === "/opportunities") {
      await respondJson(route, {
        data: [],
        page: 1,
        page_size: 10,
        total: 0,
        summary: {
          total: 0,
          valid: 0,
          in_progress: 0,
          ready_for_handoff: 0,
          host: 0,
          follow_ups: 0,
          contacts: 0,
          personas: 0
        }
      });
      return;
    }

    if (method === "GET" && path === "/approval/process-templates") {
      await respondJson(route, {
        data: [
          {
            id: 9101,
            name: "请假流程模板",
            description: "请假审批",
            company_id: 1,
            company_name: "Pico 集团",
            status: "active",
            form_template_id: 7001,
            form_template_name: "请假单",
            form_schema: [
              {
                key: "reason",
                label: "申请说明",
                type: "text",
                required: true
              }
            ],
            steps: [],
            definition: null,
            step_count: 3,
            current_version: 1,
            published_version: 1
          }
        ]
      });
      return;
    }

    if (method === "GET" && path === "/approval/instances") {
      const scope = url.searchParams.get("scope") || "all";
      if (scope === "pending") {
        await respondJson(route, {
          data: [
            {
              id: 6001,
              process_name: "请假流程模板",
              title: "外出审批",
              applicant_name: "集团管理员",
              status: "pending",
              pending_action: true,
              current_step_name: "直属审批",
              created_at: "2026-02-18T10:00:00Z",
              updated_at: "2026-02-18T10:05:00Z"
            }
          ]
        });
        return;
      }
      if (scope === "mine") {
        await respondJson(route, {
          data: [
            {
              id: 6002,
              process_name: "请假流程模板",
              title: "事假申请",
              applicant_name: "集团管理员",
              status: "approved",
              pending_action: false,
              current_step_name: "结束",
              created_at: "2026-02-17T09:00:00Z",
              updated_at: "2026-02-17T09:20:00Z"
            }
          ]
        });
        return;
      }
      await respondJson(route, { data: [] });
      return;
    }

    if (method === "GET" && /^\/approval\/process-templates\/\d+\/versions$/.test(path)) {
      await respondJson(route, { data: [] });
      return;
    }

    if (method === "POST" && path === "/approval/process-templates/validate") {
      await respondJson(route, {
        data: { valid: true, errors: [], warnings: [] }
      });
      return;
    }

    if (method === "POST" && path === "/approval/conditions/validate-expression") {
      await respondJson(route, {
        data: { valid: true, result: true, message: "ok" }
      });
      return;
    }

    if (method === "POST" && path === "/approval/form-templates") {
      await respondJson(route, {
        data: {
          id: 7001,
          name: "流程专属表单",
          status: "active",
          field_count: 1,
          schema: []
        }
      });
      return;
    }

    if (method === "PATCH" && /^\/approval\/form-templates\/\d+$/.test(path)) {
      const id = Number(path.split("/").pop() || "0");
      await respondJson(route, {
        data: {
          id,
          name: "流程专属表单",
          status: "active",
          field_count: 1,
          schema: []
        }
      });
      return;
    }

    if (method === "POST" && path === "/approval/process-templates") {
      await respondJson(route, {
        data: {
          id: 8001,
          name: "mock_process",
          status: "inactive",
          form_template_id: 7001,
          steps: [],
          definition: null
        }
      });
      return;
    }

    if (method === "PATCH" && /^\/approval\/process-templates\/\d+$/.test(path)) {
      const id = Number(path.split("/").pop() || "0");
      await respondJson(route, {
        data: {
          id,
          name: "mock_process",
          status: "inactive",
          form_template_id: 7001,
          steps: [],
          definition: null
        }
      });
      return;
    }

    await respondJson(route, { data: [] });
  });
});

test("流程设计器：新增节点与拖拽后不丢失起止节点", async ({ page }) => {
  await openWorkflowDesigner(page);
  const initialStats = await readDesignerStats(page);
  expect(initialStats.nodes).toBe(3);
  expect(initialStats.start).toBe(1);
  expect(initialStats.end).toBe(1);

  const baseApprovalQuickAdd = page
    .locator('.react-flow__node[data-id="approval_1"] .workflow-card-node-add-next')
    .first();
  await baseApprovalQuickAdd.evaluate((button) => {
    (button as HTMLButtonElement).click();
  });

  await expect(page.getByTestId("workflow-designer-stats")).toContainText("节点 4");
  const afterAddStats = await readDesignerStats(page);
  expect(afterAddStats.nodes).toBe(4);
  expect(afterAddStats.edges).toBeGreaterThanOrEqual(3);
  expect(afterAddStats.start).toBe(1);
  expect(afterAddStats.end).toBe(1);
  const nodeIdsAfterAdd = await readCanvasNodeIds(page);
  expect(new Set(nodeIdsAfterAdd).size).toBe(nodeIdsAfterAdd.length);

  const approvalNode = page.locator('.react-flow__node[data-id="approval_1"]').first();
  const box = await approvalNode.boundingBox();
  if (!box) {
    throw new Error("未找到可拖拽的审批节点");
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2 + 90, { steps: 12 });
  await page.mouse.up();

  const afterDragStats = await readDesignerStats(page);
  expect(afterDragStats.nodes).toBe(4);
  expect(afterDragStats.start).toBe(1);
  expect(afterDragStats.end).toBe(1);

  const canvas = page.getByTestId("workflow-designer-canvas");
  await expect(canvas.locator(".react-flow__node").filter({ hasText: "开始" }).first()).toBeVisible();
  await expect(canvas.locator(".react-flow__node").filter({ hasText: "结束" }).first()).toBeVisible();
});

test("流程设计器：工具栏新增节点后可通过快速连线连接目标节点", async ({ page }) => {
  await openWorkflowDesigner(page);

  const toolbarAddButton = page.locator(".workflow-designer-toolbar").getByRole("button", { name: "添加" });
  await toolbarAddButton.click();

  const afterToolbarAddStats = await readDesignerStats(page);
  expect(afterToolbarAddStats.nodes).toBe(4);
  expect(afterToolbarAddStats.start).toBe(1);
  expect(afterToolbarAddStats.end).toBe(1);

  const nodeIds = await readCanvasNodeIds(page);
  expect(new Set(nodeIds).size).toBe(nodeIds.length);
  const newNodeId = nodeIds.find((id) => !["start", "approval_1", "end"].includes(id));
  expect(newNodeId).toBeTruthy();
  if (!newNodeId) {
    throw new Error("工具栏新增节点失败，未检测到新节点");
  }
  await page.locator(`.react-flow__node[data-id="${newNodeId}"]`).click();

  const manualConnectButton = page.getByTestId("workflow-manual-connect-button");
  await expect(manualConnectButton).toBeEnabled();
  await manualConnectButton.click();

  const afterManualConnectStats = await readDesignerStats(page);
  expect(afterManualConnectStats.edges).toBe(3);
  expect(afterManualConnectStats.start).toBe(1);
  expect(afterManualConnectStats.end).toBe(1);
});

test("发起审批：草稿可自动恢复且支持清空", async ({ page }) => {
  await openWorkflowCenter(page);

  await page.getByTestId("workflow-open-start-drawer-button").click();
  await page.getByTestId("workflow-start-process-select").click();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await page.getByTestId("workflow-start-title-input").fill("外出办事请假");
  const reasonInput = page.getByPlaceholder("请输入申请说明");
  await expect(reasonInput).toBeVisible();
  await reasonInput.fill("需要外出办事");

  await expect(page.getByText("本地草稿自动保存于")).toBeVisible();
  await page.locator(".workflow-start-drawer .ant-drawer-close").click();
  await expect(page.getByTestId("workflow-start-title-input")).not.toBeVisible();

  await page.getByTestId("workflow-open-start-drawer-button").click();
  await expect(page.getByTestId("workflow-start-title-input")).toHaveValue("外出办事请假");
  await expect(page.getByPlaceholder("请输入申请说明")).toHaveValue("需要外出办事");

  await page.getByTestId("workflow-start-clear-draft-button").click();
  await page.locator(".workflow-start-drawer .ant-drawer-close").click();
  await expect(page.getByTestId("workflow-start-title-input")).not.toBeVisible();

  await page.getByTestId("workflow-open-start-drawer-button").click();
  await expect(page.getByTestId("workflow-start-title-input")).toHaveValue("");
  await expect(page.getByPlaceholder("请输入申请说明")).toHaveCount(0);
});

test("消息中心：筛选范围在刷新后保持", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("crm_message_scope_1"));

  await page.getByRole("button", { name: "消息中心" }).click();
  const todoScopeButton = page.getByTestId("message-center-scope-todo");
  await todoScopeButton.click();
  await expect(todoScopeButton).toHaveClass(/is-active/);
  await expect
    .poll(async () => {
      return page.evaluate(() => localStorage.getItem("crm_message_scope_1"));
    })
    .toBe("todo");

  await page.locator(".message-center-drawer .ant-drawer-close").click();
  await page.reload();

  await page.getByRole("button", { name: "消息中心" }).click();
  await expect(page.getByTestId("message-center-scope-todo")).toHaveClass(/is-active/);
});

test("流程模板：刷新后恢复草稿且可重置为初始状态", async ({ page }) => {
  await openWorkflowCenter(page);
  await page.getByTestId("workflow-create-template-button").click();
  await expect(page.getByText("新建流程模板")).toBeVisible();

  await page.getByTestId("workflow-form-palette-text").click();
  await expect(page.getByTestId("workflow-wizard-next-button")).toBeEnabled();
  await expect(page.getByText("本地草稿自动保存于")).toBeVisible();
  await expect
    .poll(async () => {
      return page.evaluate(() => localStorage.getItem("crm_process_editor_draft_v1_1_new"));
    })
    .not.toBeNull();

  await page.reload();
  await openWorkflowCenter(page);
  await page.getByTestId("workflow-create-template-button").click();

  await expect(page.getByTestId("workflow-wizard-next-button")).toBeEnabled();
  const resetDraftButton = page.getByTestId("workflow-process-reset-draft-button");
  await expect(resetDraftButton).toBeVisible();
  await resetDraftButton.click();
  await page.getByRole("button", { name: "确认重置" }).click();

  await expect(page.getByTestId("workflow-wizard-next-button")).toBeDisabled();
  await expect(resetDraftButton).toHaveCount(0);
  await expect
    .poll(async () => {
      return page.evaluate(() => localStorage.getItem("crm_process_editor_draft_v1_1_new"));
    })
    .toBeNull();
});

test("流程模板：表单与流程支持撤销重做", async ({ page }) => {
  await openWorkflowCenter(page);
  await page.getByTestId("workflow-create-template-button").click();
  await expect(page.getByText("新建流程模板")).toBeVisible();

  const wizardNextButton = page.getByTestId("workflow-wizard-next-button");
  await expect(wizardNextButton).toBeDisabled();

  await page.getByTestId("workflow-form-palette-text").click();
  await expect(wizardNextButton).toBeEnabled();

  const formUndoButton = page.getByTestId("workflow-form-undo-button");
  const formRedoButton = page.getByTestId("workflow-form-redo-button");
  await expect(formUndoButton).toBeEnabled();
  await formUndoButton.click();
  await expect(wizardNextButton).toBeDisabled();

  await expect(formRedoButton).toBeEnabled();
  await formRedoButton.click();
  await expect(wizardNextButton).toBeEnabled();

  await wizardNextButton.click();
  await expect(page.getByText("② 审批流程设计")).toBeVisible();

  const beforeAddStats = await readDesignerStats(page);
  expect(beforeAddStats.nodes).toBe(3);

  const baseApprovalQuickAdd = page
    .locator('.react-flow__node[data-id="approval_1"] .workflow-card-node-add-next')
    .first();
  await baseApprovalQuickAdd.evaluate((button) => {
    (button as HTMLButtonElement).click();
  });

  const afterAddStats = await readDesignerStats(page);
  expect(afterAddStats.nodes).toBe(4);

  const flowUndoButton = page.getByTestId("workflow-flow-undo-button");
  const flowRedoButton = page.getByTestId("workflow-flow-redo-button");

  await expect(flowUndoButton).toBeEnabled();
  await flowUndoButton.click();
  const afterFlowUndoStats = await readDesignerStats(page);
  expect(afterFlowUndoStats.nodes).toBe(3);
  expect(afterFlowUndoStats.start).toBe(1);
  expect(afterFlowUndoStats.end).toBe(1);

  await expect(flowRedoButton).toBeEnabled();
  await flowRedoButton.click();
  const afterFlowRedoStats = await readDesignerStats(page);
  expect(afterFlowRedoStats.nodes).toBe(4);
  expect(afterFlowRedoStats.start).toBe(1);
  expect(afterFlowRedoStats.end).toBe(1);
});
