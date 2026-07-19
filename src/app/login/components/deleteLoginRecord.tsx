import { AuthDetail, useAuthStore } from "@/store/auth";
import { CircleQuestionMark } from "lucide-react"
import SystemDialog from "@/components/arks/systemDialog";

export default function DeleteLoginRecord(props: { detail: AuthDetail, onCancel: () => void }) {
  const removeDetail = useAuthStore(state => state.removeDetail);

  return (
    <SystemDialog
      operation="删除"
      contentTitle={`是否确认删除「${props.detail.username}」的登录记录？`}
      contentDescription="删除后将清除本地保存的所有登录凭证及会话数据"
      onCancel={() => props.onCancel()}
      onConfirm={() => { removeDetail(props.detail.uid); props.onCancel() }}
    >
      {CircleQuestionMark}
    </SystemDialog>
  );
}
