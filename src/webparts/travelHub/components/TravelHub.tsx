import * as React from 'react';
import '../../../styles/global.css';
import type { ITravelHubProps } from './ITravelHubProps';
import { LicenceGate } from './app/LicenceGate';
import { AppRouter } from './app/AppRouter';
import { SpContext } from '../../../context/SpContext';
import { ConfigProvider } from '../../../context/ConfigContext';
import { AppConfigProvider } from '../../../context/AppConfigContext';
import { runTravelHubProvisioning } from '../../../services/provisioning/runTravelHubProvisioning';
import { getCurrentUserEmail } from '../../../utils/currentUserEmail';
import { loadStoredLicenceKey } from '../../../utils/licenceKeyStorage';

const TravelHub: React.FC<ITravelHubProps> = (props) => {
  const storageUserId = React.useMemo(() => getCurrentUserEmail(props.context), [props.context]);

  const [licenceKey, setLicenceKey] = React.useState(() => {
    const fromWebPart = (props.licenceKey || '').trim();
    if (fromWebPart) return fromWebPart;
    return loadStoredLicenceKey(storageUserId);
  });

  React.useEffect(() => {
    const fromWebPart = (props.licenceKey || '').trim();
    if (fromWebPart) {
      setLicenceKey(fromWebPart);
      return;
    }
    const stored = loadStoredLicenceKey(storageUserId);
    if (stored) setLicenceKey(stored);
  }, [props.licenceKey, storageUserId]);

  React.useEffect(() => {
    runTravelHubProvisioning(props.context);
  }, [props.context]);

  return (
    <div className="th-app-root" data-th-app-root>
      <SpContext.Provider value={props.context}>
        <AppConfigProvider>
          <ConfigProvider>
            <LicenceGate licenceKey={licenceKey} storageUserId={storageUserId} onKeySubmit={setLicenceKey}>
              <AppRouter />
            </LicenceGate>
          </ConfigProvider>
        </AppConfigProvider>
      </SpContext.Provider>
    </div>
  );
};

export default TravelHub;
