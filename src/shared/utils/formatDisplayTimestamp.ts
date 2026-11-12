export function formatDisplayTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const inputDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const timeLabel = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (inputDay.getTime() === today.getTime()) {
    return `Today, ${timeLabel}`;
  }

  if (inputDay.getTime() === yesterday.getTime()) {
    return `Yesterday, ${timeLabel}`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
