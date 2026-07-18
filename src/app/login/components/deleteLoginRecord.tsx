import { AuthDetail, useAuthStore } from "@/store/auth";
import Portal from "@/components/Portal";
import { CircleQuestionMark } from "lucide-react"
import SystemDialog from "@/components/arks/systemDialog";

export default function DeleteLoginRecord(props: { detail: AuthDetail, onCancel: () => void }) {
  const removeDetail = useAuthStore(state => state.removeDetail);

  return (
    <Portal className="flex items-center justify-center z-[10000]">
      <SystemDialog
        operation="删除"
        contentTitle={`是否确认删除「${props.detail.username}」的登录记录？`}
        contentDescription="删除后将清除本地保存的所有登录凭证及会话数据"
        children={CircleQuestionMark}
        onCancel={() => props.onCancel()}
        onConfirm={() => { removeDetail(props.detail.uid); props.onCancel() }}
      />
    </Portal>
  );
}