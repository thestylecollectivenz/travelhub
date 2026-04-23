import * as React from 'react';
import '../../../styles/global.css';
import type { ITravelHubProps } from './ITravelHubProps';
import { LicenceGate } from './app/LicenceGate';
import { AppRouter } from './app/AppRouter';
import { SpContext } from '../../../context/SpContext';
import { ConfigProvider } from '../../../context/ConfigContext';

const TravelHub: React.FC<ITravelHubProps> = (props) => {
  const [licenceKey, setLicenceKey] = React.useState<string>(props.licenceKey || '');

  React.useEffect(() => {
    setLicenceKey(props.licenceKey || '');
  }, [props.licenceKey]);

  return (
    <SpContext.Provider value={props.context}>
      <ConfigProvider>
        <LicenceGate licenceKey={licenceKey} onKeySubmit={setLicenceKey}>
          <AppRouter />
        </LicenceGate>
      </ConfigProvider>
    </SpContext.Provider>
  );
};

export default TravelHub;
