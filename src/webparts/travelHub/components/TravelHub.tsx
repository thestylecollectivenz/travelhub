import * as React from 'react';
import '../../../styles/global.css';
import type { ITravelHubProps } from './ITravelHubProps';
import { LicenceGate } from './app/LicenceGate';
import { AppRouter } from './app/AppRouter';
import { SpContext } from '../../../context/SpContext';
import { ConfigProvider } from '../../../context/ConfigContext';
import { AppConfigProvider } from '../../../context/AppConfigContext';

const TravelHub: React.FC<ITravelHubProps> = (props) => {
  const [licenceKey, setLicenceKey] = React.useState<string>(props.licenceKey || '');

  React.useEffect(() => {
    setLicenceKey(props.licenceKey || '');
  }, [props.licenceKey]);

  return (
    <SpContext.Provider value={props.context}>
      <AppConfigProvider>
        <ConfigProvider>
          <LicenceGate licenceKey={licenceKey} onKeySubmit={setLicenceKey}>
            <AppRouter />
          </LicenceGate>
        </ConfigProvider>
      </AppConfigProvider>
    </SpContext.Provider>
  );
};

export default TravelHub;
