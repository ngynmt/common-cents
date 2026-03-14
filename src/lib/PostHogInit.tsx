"use client";

import { useEffect } from "react";
import { initAnalytics } from "./analytics";

export function PostHogInit() {
  useEffect(() => {
    initAnalytics();
  }, []);
  return null;
}
