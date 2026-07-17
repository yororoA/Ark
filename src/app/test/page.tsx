'use client'

import Loading from '@/components/arks/loading';
import Input from '@/components/arks/input';

// import { Metadata } from 'next';

// export const metadata: Metadata = {
//   title: "Test - 组件测试",
//   description: "用于测试各种组件",
// };

export default function Test() {
  return (
    <div className='relative'>
      {/* <Loading type="charJump" text="Loading..." /> */}
      {/* <Loading type="animation" text="正在提交反馈至神经......" /> */}
      {/* <Loading type="text" text="加载中..." /> */}
      {/* <Button size="large" onClick={() => console.log('提交')}>账号管理</Button> */}
      <Input label="账号" id='account' placeholder="请输入账号" />
    </div>
  );
}