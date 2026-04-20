import { WebPartContext } from '@microsoft/sp-webpart-base';

export interface ITravelHubProps {
  description: string;
  licenceKey: string;
  isDarkTheme: boolean;
  environmentMessage: string;
  hasTeamsContext: boolean;
  userDisplayName: string;
  context: WebPartContext;
}
