import { AuthDetail, useAuthStore } from "@/store/auth";
import { CircleQuestionMark } from "lucide-react"
import SystemDialog from "@/components/arks/systemDialog";
import { useState } from "react";

export default function DeleteLoginRecord(props: { detail: AuthDetail, onCancel: () => void }) {
  const removeDetail = useAuthStore(state => state.removeDetail);
  const [error, setError] = useState('');

  async function deleteRecord() {
    setError('');
    const response = await fetch(`/api/session?uid=${encodeURIComponent(props.detail.uid)}`, { method: 'DELETE' });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.message || '删除失败，请重试');
      return;
    }
    removeDetail(props.detail.uid);
    props.onCancel();
  }

  return (
    <SystemDialog
      operation="删除"
      contentTitle={`是否确认删除「${props.detail.username}」的登录记录？`}
      contentDescription={error || "删除后将清除本地保存的所有登录凭证及会话数据"}
      onCancel={() => props.onCancel()}
      onConfirm={() => { void deleteRecord() }}
    >
      {CircleQuestionMark}
    </SystemDialog>
  );
}
