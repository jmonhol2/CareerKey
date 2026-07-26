export type RecruitingEvent = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  timezone: string;
  is_active: boolean;
};

export type EventSlotOption = {
  startTime: string;
  endTime: string;
  label: string;
};

export function formatEventDateTime(timestamp: string, timeZone: string) {
  return new Intl.DateTimeFormat([], {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function getEventSlotOptions(event: RecruitingEvent): EventSlotOption[] {
  const durationMs = event.slot_duration_minutes * 60_000;
  const eventStart = new Date(event.start_time).getTime();
  const eventEnd = new Date(event.end_time).getTime();
  const options: EventSlotOption[] = [];

  if (!Number.isFinite(eventStart) || !Number.isFinite(eventEnd) || durationMs <= 0) {
    return options;
  }

  const timeFormatter = new Intl.DateTimeFormat([], {
    timeZone: event.timezone,
    hour: "numeric",
    minute: "2-digit",
  });

  const dateFormatter = new Intl.DateTimeFormat([], {
    timeZone: event.timezone,
    month: "short",
    day: "numeric",
  });

  for (let start = eventStart; start + durationMs <= eventEnd; start += durationMs) {
    const end = start + durationMs;
    const startDate = new Date(start);
    const endDate = new Date(end);
    options.push({
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      label: `${dateFormatter.format(startDate)}, ${timeFormatter.format(startDate)} – ${timeFormatter.format(endDate)}`,
    });
  }

  return options;
}
