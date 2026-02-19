import { Button, Drawer, List, Space, Tag, Typography } from "antd";
import {
  APPROVAL_INSTANCE_STATUS_LABELS,
  type HeaderMessageItem,
  type MessageScope
} from "./useMessageCenter";

const { Text } = Typography;

type MessageCenterDrawerProps = {
  open: boolean;
  loading: boolean;
  scope: MessageScope;
  scopeOptions: Array<{ key: MessageScope; label: string }>;
  items: HeaderMessageItem[];
  readMessageIdSet: Set<string>;
  totalMessageCount: number;
  onClose: () => void;
  onRefresh: () => void;
  onScopeChange: (scope: MessageScope) => void;
  onItemClick: (item: HeaderMessageItem) => void;
  onMarkRead: (messageId: string) => void;
  onMarkAllRead: () => void;
};

function MessageCenterDrawer(props: MessageCenterDrawerProps) {
  const {
    open,
    loading,
    scope,
    scopeOptions,
    items,
    readMessageIdSet,
    totalMessageCount,
    onClose,
    onRefresh,
    onScopeChange,
    onItemClick,
    onMarkRead,
    onMarkAllRead
  } = props;

  return (
    <Drawer
      title="消息中心"
      width={460}
      className="message-center-drawer"
      open={open}
      onClose={onClose}
      extra={
        <Space size={8}>
          <Button size="small" onClick={onRefresh}>
            刷新
          </Button>
          <Button size="small" onClick={onMarkAllRead} disabled={!totalMessageCount}>
            全部已读
          </Button>
        </Space>
      }
    >
      <div className="message-center-scope">
        {scopeOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={scope === option.key ? "is-active" : ""}
            onClick={() => onScopeChange(option.key)}
            data-testid={`message-center-scope-${option.key}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <List
        className="message-center-list"
        loading={loading}
        dataSource={items}
        locale={{ emptyText: "暂无消息" }}
        renderItem={(item) => {
          const isRead = readMessageIdSet.has(item.id);
          const statusColor =
            item.status === "approved"
              ? "green"
              : item.status === "rejected"
                ? "red"
                : item.status === "withdrawn"
                  ? "default"
                  : "blue";
          return (
            <List.Item className={`message-center-item ${isRead ? "is-read" : "is-unread"}`}>
              <button
                type="button"
                className="message-center-item-main"
                onClick={() => onItemClick(item)}
              >
                <Space className="message-center-item-head" size={8}>
                  {!isRead ? <span className="message-center-dot" /> : null}
                  <Text strong={!isRead}>{item.title}</Text>
                  <Tag color={item.scope === "todo" ? "orange" : "geekblue"}>
                    {item.scope === "todo" ? "待办" : "我发起"}
                  </Tag>
                  <Tag color={statusColor}>{APPROVAL_INSTANCE_STATUS_LABELS[item.status] || item.status}</Tag>
                </Space>
                <Text type="secondary" className="message-center-item-subtitle">
                  {item.subtitle}
                </Text>
                <Text type="secondary" className="message-center-item-time">
                  {item.updated_at ? new Date(item.updated_at).toLocaleString() : "-"}
                </Text>
              </button>
              {!isRead ? (
                <Button size="small" type="link" onClick={() => onMarkRead(item.id)}>
                  已读
                </Button>
              ) : null}
            </List.Item>
          );
        }}
      />
    </Drawer>
  );
}

export default MessageCenterDrawer;
