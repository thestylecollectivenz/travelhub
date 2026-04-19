import * as React from 'react';
import '../../../styles/global.css';
import type { ITravelHubProps } from './ITravelHubProps';
import { LicenceGate } from './app/LicenceGate';
import { AppRouter } from './app/AppRouter';

const TravelHub: React.FC<ITravelHubProps> = (props) => {
  const [licenceKey, setLicenceKey] = React.useState<string>(props.licenceKey || '');

  React.useEffect(() => {
    setLicenceKey(props.licenceKey || '');
  }, [props.licenceKey]);

  return (
    <LicenceGate licenceKey={licenceKey} onKeySubmit={setLicenceKey}>
      <AppRouter />
    </LicenceGate>
  );
};

export default TravelHub;
