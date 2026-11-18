"use client";

import { useSyncExternalStore } from "react";
import { formatLocalDateTime } from "@/lib/local-date-time";

const subscribe = () => () => {};
const getDeviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const getServerTimeZone = () => null;

/** The server does not know the device timezone. Hydrate with the same placeholder. */
export function LocalDateTime({ iso }: { iso: string }) {
  const timeZone = useSyncExternalStore(subscribe, getDeviceTimeZone, getServerTimeZone);
  return (
    <time dateTime={iso} title={timeZone ? `Giờ thiết bị: ${timeZone}` : "Đang đọc múi giờ thiết bị"}>
      {timeZone ? formatLocalDateTime(iso, timeZone) : "…"}
    </time>
  );
}
