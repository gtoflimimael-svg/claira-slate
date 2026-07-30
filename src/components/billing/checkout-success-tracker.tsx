"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

export function CheckoutSuccessTracker({ plan, amount }: { plan: string; amount: number }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (searchParams.get("checkout") !== "success") return;
    track("checkout_completed", { plan, amount });
    router.replace(pathname);
  }, [searchParams, plan, amount, router, pathname]);

  return null;
}
