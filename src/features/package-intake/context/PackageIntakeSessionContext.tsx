import { createContext, useContext, type ReactNode } from "react";
import { usePackageIntake } from "@/features/package-intake/hooks/usePackageIntake";

export type PackageIntakeSession = ReturnType<typeof usePackageIntake>;

const PackageIntakeSessionContext = createContext<PackageIntakeSession | null>(null);

export function PackageIntakeSessionProvider({
  societyId,
  staffUserId,
  username,
  flowFocused,
  children,
}: {
  societyId: string;
  staffUserId: string;
  username: string;
  flowFocused: boolean;
  children: ReactNode;
}) {
  const intake = usePackageIntake({
    societyId,
    staffUserId,
    defaultStaffName: username,
    flowFocused,
  });

  return (
    <PackageIntakeSessionContext.Provider value={intake}>
      {children}
    </PackageIntakeSessionContext.Provider>
  );
}

export function usePackageIntakeSession(): PackageIntakeSession {
  const ctx = useContext(PackageIntakeSessionContext);
  if (!ctx) {
    throw new Error("usePackageIntakeSession must be used within PackageIntakeSessionProvider");
  }
  return ctx;
}
