'use client'

import Loading from "@/components/arks/loading";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function Page() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown <= 0) {
      router.push('/');
    }
  }, [countdown, router]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <Image
        src="/404.jpeg"
        alt="404"
        fill={true}
        loading="eager"
        className="absolute top-0 left-0 w-full h-full object-cover"
      />
      <Loading type="text" text="404 Not Found" />
      <Loading type="animation" text={`返回首页 ( ${countdown} ) ......`} />
    </>
  );
}