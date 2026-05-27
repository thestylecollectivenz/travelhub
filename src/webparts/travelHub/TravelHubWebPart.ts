import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

import * as strings from 'TravelHubWebPartStrings';
import TravelHub from './components/TravelHub';
import { ITravelHubProps } from './components/ITravelHubProps';
import {
  TRAVEL_HUB_CHROME_CSS,
  TRAVEL_HUB_CHROME_STYLE_ID,
  TRAVEL_HUB_PAGE_CLASS
} from './sharePointChromeCss';

export interface ITravelHubWebPartProps {
  description: string;
  licenceKey: string;
}

export default class TravelHubWebPart extends BaseClientSideWebPart<ITravelHubWebPartProps> {

  private _isDarkTheme: boolean = false;
  private _environmentMessage: string = '';

  private _ensureChromeStyle(): void {
    if (!document.getElementById(TRAVEL_HUB_CHROME_STYLE_ID)) {
      const styleEl: HTMLStyleElement = document.createElement('style');
      styleEl.id = TRAVEL_HUB_CHROME_STYLE_ID;
      styleEl.textContent = TRAVEL_HUB_CHROME_CSS;
      document.head.appendChild(styleEl);
    }

    document.body.classList.add(TRAVEL_HUB_PAGE_CLASS);
  }

  private _removeChromeStyleIfUnused(): void {
    document.body.classList.remove(TRAVEL_HUB_PAGE_CLASS);

    const styleEl = document.getElementById(TRAVEL_HUB_CHROME_STYLE_ID);
    if (styleEl) {
      styleEl.remove();
    }
  }

  public render(): void {
    this._ensureChromeStyle();

    const element: React.ReactElement<ITravelHubProps> = React.createElement(
      TravelHub,
      {
        description: this.properties.description,
        licenceKey: this.properties.licenceKey ?? '',
        isDarkTheme: this._isDarkTheme,
        environmentMessage: this._environmentMessage,
        hasTeamsContext: !!this.context.sdks.microsoftTeams,
        userDisplayName: this.context.pageContext.user.displayName,
        context: this.context
      }
    );

    ReactDom.render(element, this.domElement);
  }

  protected onInit(): Promise<void> {
    return this._getEnvironmentMessage().then(message => {
      this._environmentMessage = message;
    });
  }

  private _getEnvironmentMessage(): Promise<string> {
    if (!!this.context.sdks.microsoftTeams) { // running in Teams, office.com or Outlook
      return this.context.sdks.microsoftTeams.teamsJs.app.getContext()
        .then(context => {
          let environmentMessage: string = '';
          switch (context.app.host.name) {
            case 'Office': // running in Office
              environmentMessage = this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentOffice : strings.AppOfficeEnvironment;
              break;
            case 'Outlook': // running in Outlook
              environmentMessage = this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentOutlook : strings.AppOutlookEnvironment;
              break;
            case 'Teams': // running in Teams
            case 'TeamsModern':
              environmentMessage = this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentTeams : strings.AppTeamsTabEnvironment;
              break;
            default:
              environmentMessage = strings.UnknownEnvironment;
          }

          return environmentMessage;
        });
    }

    return Promise.resolve(this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentSharePoint : strings.AppSharePointEnvironment);
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme) {
      return;
    }

    this._isDarkTheme = !!currentTheme.isInverted;
    const {
      semanticColors
    } = currentTheme;

    if (semanticColors) {
      this.domElement.style.setProperty('--bodyText', semanticColors.bodyText || null);
      this.domElement.style.setProperty('--link', semanticColors.link || null);
      this.domElement.style.setProperty('--linkHovered', semanticColors.linkHovered || null);
    }

  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
    this._removeChromeStyleIfUnused();
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: strings.PropertyPaneDescription
          },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneTextField('description', {
                  label: strings.DescriptionFieldLabel
                }),
                PropertyPaneTextField('licenceKey', {
                  label: strings.LicenceKeyFieldLabel
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
