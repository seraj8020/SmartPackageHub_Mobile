export function firstNameFrom(fullName?: string) {
  const trimmed = fullName?.trim();
  if (!trimmed) return "Resident";
  return trimmed.split(/\s+/)[0] ?? "Resident";
}

/** Format: SocietyName.Tower/Wing-Flat Number */
export function societyLocationLabel(
  societyName?: string,
  towerWing?: string,
  flatNumber?: string,
) {
  const society = societyName?.trim() || "Your society";
  const tower = towerWing?.trim() || "—";
  const flat = flatNumber?.trim() || "—";
  return `${society}.${tower}-${flat}`;
}

export function greetingForNow() {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
