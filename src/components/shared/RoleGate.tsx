import * as React from 'react';
import type { TripRoleLevel } from '../../models/TripMember';
import { roleMeetsRequirement } from '../../models/TripMember';
import { useTripRole } from '../../context/TripRoleContext';

export interface RoleGateProps {
  requiredRole: TripRoleLevel;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/** Renders children only when the current user's trip role meets the requirement. */
export const RoleGate: React.FC<RoleGateProps> = ({ requiredRole, children, fallback = null }) => {
  const { role, loading } = useTripRole();
  if (loading) return null;
  if (!roleMeetsRequirement(role, requiredRole)) return <>{fallback}</>;
  return <>{children}</>;
};
