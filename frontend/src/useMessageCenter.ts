import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const APPROVAL_INSTANCE_STATUS_LABELS: Record<ApprovalInstanceStatus, string> = {
  pending: "审批中",
  approved: "已通过",
  rejected: "已拒绝",
  withdrawn: "已撤回"
};

const MESSAGE_READ_STORAGE_KEY_PREFIX = "crm_message_reads_";
const MESSAGE_SCOPE_STORAGE_KEY_PREFIX = "crm_message_scope_";

export type ApprovalInstanceStatus = "pending" | "approved" | "rejected" | "withdrawn";
export type MessageScope = "all" | "todo" | "mine";

type ApprovalInstanceBrief = {
  id: number;
  process_name?: string | null;
  title?: string | null;
  applicant_name?: string | null;
  status: ApprovalInstanceStatus;
  pending_action?: boolean;
  current_step_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  finished_at?: string | null;
};

export type HeaderMessageItem = {
  id: string;
  scope: "todo" | "mine";
  instance_id: number;
  title: string;
  subtitle: string;
  status: ApprovalInstanceStatus;
  pending_action: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type UseMessageCenterOptions = {
  userId: string;
  hasCurrentUser: boolean;
  isWorkflowActive: boolean;
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
  headers: () => HeadersInit;
  onError?: (messageText: string) => void;
};

type UseMessageCenterResult = {
  messageCenterOpen: boolean;
  messageCenterLoading: boolean;
  messageScope: MessageScope;
  messageScopeOptions: Array<{ key: MessageScope; label: string }>;
  filteredMessageItems: HeaderMessageItem[];
  readMessageIdSet: Set<string>;
  messageUnreadCount: number;
  messageItemsCount: number;
  setMessageScope: (scope: MessageScope) => void;
  openMessageCenter: () => void;
  closeMessageCenter: () => void;
  refreshMessages: () => void;
  markMessageRead: (messageId: string) => void;
  markAllMessagesRead: () => void;
  resetMessageCenter: () => void;
};

export default function useMessageCenter(options: UseMessageCenterOptions): UseMessageCenterResult {
  const { userId, hasCurrentUser, isWorkflowActive, apiFetch, headers, onError } = options;

  const [messageCenterOpen, setMessageCenterOpen] = useState(false);
  const [messageCenterLoading, setMessageCenterLoading] = useState(false);
  const [messageScope, setMessageScope] = useState<MessageScope>("all");
  const [messageScopeHydrated, setMessageScopeHydrated] = useState(false);
  const [messageItems, setMessageItems] = useState<HeaderMessageItem[]>([]);
  const [readMessageIds, setReadMessageIds] = useState<string[]>([]);

  const messageItemsSignatureRef = useRef("");
  const messageFetchSeqRef = useRef(0);
  const messageFetchAbortRef = useRef<AbortController | null>(null);
  const messageLastFetchAtRef = useRef(0);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const toMessageTime = useCallback(
    (item: ApprovalInstanceBrief) => item.updated_at || item.finished_at || item.created_at || "",
    []
  );

  const mapPendingInstanceToMessage = useCallback(
    (item: ApprovalInstanceBrief): HeaderMessageItem => ({
      id: `todo_${item.id}_${toMessageTime(item)}`,
      scope: "todo",
      instance_id: item.id,
      title: item.title || item.process_name || `审批单 #${item.id}`,
      subtitle: `待你审批 · ${item.current_step_name || item.process_name || "流程节点"} · 发起人 ${item.applicant_name || "-"}`,
      status: item.status,
      pending_action: item.pending_action === true,
      created_at: item.created_at,
      updated_at: item.updated_at
    }),
    [toMessageTime]
  );

  const mapMineInstanceToMessage = useCallback(
    (item: ApprovalInstanceBrief): HeaderMessageItem => {
      const statusLabel = APPROVAL_INSTANCE_STATUS_LABELS[item.status] || item.status;
      const statusPrefix = item.status === "pending" ? "我发起 · 进行中" : `我发起 · ${statusLabel}`;
      return {
        id: `mine_${item.id}_${item.status}_${toMessageTime(item)}`,
        scope: "mine",
        instance_id: item.id,
        title: item.title || item.process_name || `审批单 #${item.id}`,
        subtitle: `${statusPrefix} · ${item.process_name || "审批流程"}`,
        status: item.status,
        pending_action: item.pending_action === true,
        created_at: item.created_at,
        updated_at: item.updated_at
      };
    },
    [toMessageTime]
  );

  const fetchApprovalInstancesByScope = useCallback(
    async (scope: "pending" | "mine", signal?: AbortSignal): Promise<ApprovalInstanceBrief[]> => {
      const response = await apiFetch(`/approval/instances?scope=${scope}`, { headers: headers(), signal });
      let body: { data?: unknown; error?: string };
      try {
        body = (await response.json()) as { data?: unknown; error?: string };
      } catch {
        body = {
          error: response.ok ? "invalid_response_format" : "internal_server_error"
        };
      }
      if (!response.ok) {
        throw new Error(body.error || "加载消息失败");
      }
      return Array.isArray(body.data) ? body.data : [];
    },
    [apiFetch, headers]
  );

  const fetchMessageCenterData = useCallback(
    async (options?: { silent?: boolean; showError?: boolean }) => {
      const silent = options?.silent === true;
      const showError = options?.showError !== false;
      if (messageFetchAbortRef.current) {
        messageFetchAbortRef.current.abort();
      }
      const controller = new AbortController();
      messageFetchAbortRef.current = controller;
      const requestSeq = messageFetchSeqRef.current + 1;
      messageFetchSeqRef.current = requestSeq;
      if (!silent) {
        setMessageCenterLoading(true);
      }
      try {
        const [pendingRows, mineRows] = await Promise.all([
          fetchApprovalInstancesByScope("pending", controller.signal),
          fetchApprovalInstancesByScope("mine", controller.signal)
        ]);
        if (requestSeq !== messageFetchSeqRef.current) {
          return;
        }
        const allMessages = [
          ...pendingRows.map(mapPendingInstanceToMessage),
          ...mineRows.map(mapMineInstanceToMessage)
        ];
        const uniqueById = new Map<string, HeaderMessageItem>();
        allMessages.forEach((item) => {
          if (!uniqueById.has(item.id)) {
            uniqueById.set(item.id, item);
          }
        });
        const sorted = Array.from(uniqueById.values()).sort((a, b) => {
          const ta = new Date(a.updated_at || a.created_at || 0).getTime();
          const tb = new Date(b.updated_at || b.created_at || 0).getTime();
          return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
        });
        const signature = sorted
          .map((item) => `${item.id}|${item.status}|${item.pending_action ? "1" : "0"}|${item.updated_at || item.created_at || ""}`)
          .join(";");
        if (signature !== messageItemsSignatureRef.current) {
          messageItemsSignatureRef.current = signature;
          setMessageItems(sorted);
        }
        messageLastFetchAtRef.current = Date.now();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        if (showError) {
          onErrorRef.current?.(err instanceof Error ? err.message : "加载消息失败");
        }
      } finally {
        if (!silent && requestSeq === messageFetchSeqRef.current) {
          setMessageCenterLoading(false);
        }
      }
    },
    [fetchApprovalInstancesByScope, mapMineInstanceToMessage, mapPendingInstanceToMessage]
  );

  useEffect(() => {
    if (!userId) {
      setReadMessageIds([]);
      return;
    }
    const storageKey = `${MESSAGE_READ_STORAGE_KEY_PREFIX}${userId}`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      setReadMessageIds([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setReadMessageIds(parsed.map((item) => String(item)));
      } else {
        setReadMessageIds([]);
      }
    } catch {
      setReadMessageIds([]);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setMessageScope("all");
      setMessageScopeHydrated(false);
      return;
    }
    const storageKey = `${MESSAGE_SCOPE_STORAGE_KEY_PREFIX}${userId}`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      setMessageScope("all");
      setMessageScopeHydrated(true);
      return;
    }
    const normalized = String(raw);
    if (normalized === "todo" || normalized === "mine" || normalized === "all") {
      setMessageScope(normalized);
      setMessageScopeHydrated(true);
      return;
    }
    setMessageScope("all");
    setMessageScopeHydrated(true);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const storageKey = `${MESSAGE_READ_STORAGE_KEY_PREFIX}${userId}`;
    const compact = readMessageIds.slice(-2000);
    localStorage.setItem(storageKey, JSON.stringify(compact));
  }, [userId, readMessageIds]);

  useEffect(() => {
    if (!userId || !messageScopeHydrated) {
      return;
    }
    const storageKey = `${MESSAGE_SCOPE_STORAGE_KEY_PREFIX}${userId}`;
    localStorage.setItem(storageKey, messageScope);
  }, [messageScope, messageScopeHydrated, userId]);

  useEffect(() => {
    return () => {
      messageFetchAbortRef.current?.abort();
      messageFetchAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!userId || !hasCurrentUser) {
      messageItemsSignatureRef.current = "";
      messageLastFetchAtRef.current = 0;
      setMessageItems([]);
      return;
    }
    fetchMessageCenterData({ silent: false, showError: false });
    const isHotPolling = messageCenterOpen || isWorkflowActive;
    const intervalMs = isHotPolling ? 30000 : 120000;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      fetchMessageCenterData({ silent: true, showError: false });
    }, intervalMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchMessageCenterData({ silent: true, showError: false });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userId, hasCurrentUser, fetchMessageCenterData, messageCenterOpen, isWorkflowActive]);

  const readMessageIdSet = useMemo(() => new Set(readMessageIds), [readMessageIds]);

  const messageCountByScope = useMemo(() => {
    const stats = { all: 0, todo: 0, mine: 0 };
    messageItems.forEach((item) => {
      stats.all += 1;
      stats[item.scope] += 1;
    });
    return stats;
  }, [messageItems]);

  const filteredMessageItems = useMemo(() => {
    if (messageScope === "all") {
      return messageItems;
    }
    return messageItems.filter((item) => item.scope === messageScope);
  }, [messageItems, messageScope]);

  const messageUnreadCount = useMemo(
    () => messageItems.filter((item) => !readMessageIdSet.has(item.id)).length,
    [messageItems, readMessageIdSet]
  );

  const messageScopeOptions: Array<{ key: MessageScope; label: string }> = [
    { key: "all", label: `全部 ${messageCountByScope.all}` },
    { key: "todo", label: `待我审批 ${messageCountByScope.todo}` },
    { key: "mine", label: `我发起 ${messageCountByScope.mine}` }
  ];

  const markMessageRead = useCallback((messageId: string) => {
    setReadMessageIds((current) => (current.includes(messageId) ? current : [...current, messageId]));
  }, []);

  const markAllMessagesRead = useCallback(() => {
    const ids = messageItems.map((item) => item.id);
    if (!ids.length) {
      return;
    }
    setReadMessageIds((current) => {
      const merged = new Set([...current, ...ids]);
      return Array.from(merged);
    });
  }, [messageItems]);

  const openMessageCenter = useCallback(() => {
    setMessageCenterOpen(true);
    const now = Date.now();
    if (now - messageLastFetchAtRef.current < 15000) {
      return;
    }
    fetchMessageCenterData({ silent: false, showError: true });
  }, [fetchMessageCenterData]);

  const closeMessageCenter = useCallback(() => {
    setMessageCenterOpen(false);
  }, []);

  const refreshMessages = useCallback(() => {
    fetchMessageCenterData({ silent: false, showError: true });
  }, [fetchMessageCenterData]);

  const resetMessageCenter = useCallback(() => {
    messageFetchAbortRef.current?.abort();
    messageFetchAbortRef.current = null;
    messageItemsSignatureRef.current = "";
    messageLastFetchAtRef.current = 0;
    setMessageCenterOpen(false);
    setMessageItems([]);
    setReadMessageIds([]);
  }, []);

  return {
    messageCenterOpen,
    messageCenterLoading,
    messageScope,
    messageScopeOptions,
    filteredMessageItems,
    readMessageIdSet,
    messageUnreadCount,
    messageItemsCount: messageItems.length,
    setMessageScope,
    openMessageCenter,
    closeMessageCenter,
    refreshMessages,
    markMessageRead,
    markAllMessagesRead,
    resetMessageCenter
  };
}
