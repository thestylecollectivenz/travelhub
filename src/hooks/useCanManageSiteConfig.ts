import * as React from 'react';
import { SPPermission } from '@microsoft/sp-page-context';
import { useSpContext } from '../context/SpContext';

/** True when the user can edit site-wide AppConfig (typically site owners / members with manage lists). */
export function useCanManageSiteConfig(): boolean {
  const spContext = useSpContext();
  return React.useMemo(() => {
    try {
      const perms = spContext.pageContext.web.permissions;
      return (
        perms.hasPermission(SPPermission.manageLists) ||
        perms.hasPermission(SPPermission.manageWeb) ||
        perms.hasPermission(SPPermission.addAndCustomizePages)
      );
    } catch {
      return false;
    }
  }, [spContext]);
}
