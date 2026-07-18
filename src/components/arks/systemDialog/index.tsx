import styles from "./systemDialog.module.scss";
import Portal from "@/components/Portal";
import Button from "@/components/arks/button";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface SystemDialogProps {
  operation: string;
  contentTitle: string;
  contentDescription: string;
  children: LucideIcon;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function SystemDialog(props: SystemDialogProps) {

  return (
    <Portal className="flex items-center justify-center z-[10000]">
      <div className={cn(styles.DialogWrap, 'z-[10001]')}>
        <div className={cn(styles.DialogTitle)}>系统提示</div>
        <div className={cn(styles.DialogContent)}>
          <props.children size={80} className={cn(styles.icon)} />
          <p className="font-bold">{props.contentTitle}</p>
          <p>{props.contentDescription}</p>
          <div className={cn(styles.OpeBtns)}>
            <Button onClick={() => props.onCancel()}>取消</Button>
            <Button onClick={() => props.onConfirm()}>确认{props.operation}</Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}