import { Component, type ReactNode } from "react";
import { Button, Card, Space, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

const { Text } = Typography;

type WorkflowErrorBoundaryProps = {
  children: ReactNode;
};

type WorkflowErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class WorkflowErrorBoundary extends Component<WorkflowErrorBoundaryProps, WorkflowErrorBoundaryState> {
  state: WorkflowErrorBoundaryState = {
    hasError: false,
    message: ""
  };

  static getDerivedStateFromError(error: Error): WorkflowErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || "审批中心渲染异常"
    };
  }

  componentDidCatch(error: Error) {
    // Keep errors visible in console for debugging.
    console.error("WorkflowErrorBoundary", error);
  }

  private retry = () => {
    this.setState({
      hasError: false,
      message: ""
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <Card style={{ minHeight: 360 }}>
        <Space direction="vertical" size={10}>
          <Text strong>审批中心暂时不可用</Text>
          <Text type="secondary">{this.state.message || "请重试。若持续失败，请刷新页面。"}</Text>
          <Button icon={<ReloadOutlined />} onClick={this.retry}>
            重试渲染
          </Button>
        </Space>
      </Card>
    );
  }
}

export default WorkflowErrorBoundary;
