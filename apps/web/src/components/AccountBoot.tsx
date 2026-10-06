"use client";

import { useEffect } from "react";
import { initAccount } from "@/lib/account";

export function AccountBoot() {
  useEffect(() => initAccount(), []);
  return null;
}
