import Loading from '@/components/arks/loading';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Test - 组件测试",
  description: "用于测试各种组件",
};

export default function Test() {
  return (
    <div className=''>
      <Loading type="charJump" text="Loading..." />
      <Loading type="animation" text="正在提交反馈至神经......" />
      {/* <Loading type="text" text="加载中..." /> */}
    </div>
  );
}