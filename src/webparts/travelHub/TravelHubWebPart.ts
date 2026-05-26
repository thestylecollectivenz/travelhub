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
  private _hostMutationObserver?: MutationObserver;
  private _normalizeHostFrame?: number;

  private readonly _handleWindowResize = (): void => {
    this._scheduleHostNormalization();
  };

  private _ensureChromeStyle(): void {
    if (!document.getElementById(TRAVEL_HUB_CHROME_STYLE_ID)) {
      const styleEl: HTMLStyleElement = document.createElement('style');
      styleEl.id = TRAVEL_HUB_CHROME_STYLE_ID;
      styleEl.textContent = TRAVEL_HUB_CHROME_CSS;
      document.head.appendChild(styleEl);
    }

    document.body.classList.add(TRAVEL_HUB_PAGE_CLASS);
  }

  private _setImportantStyle(element: HTMLElement, property: string, value: string): void {
    element.style.setProperty(property, value, 'important');
  }

  private _collapseElement(element: HTMLElement): void {
    this._setImportantStyle(element, 'display', 'none');
    this._setImportantStyle(element, 'width', '0');
    this._setImportantStyle(element, 'min-width', '0');
    this._setImportantStyle(element, 'max-width', '0');
    this._setImportantStyle(element, 'flex-basis', '0');
    this._setImportantStyle(element, 'margin', '0');
    this._setImportantStyle(element, 'padding', '0');
    this._setImportantStyle(element, 'overflow', 'hidden');
    this._setImportantStyle(element, 'pointer-events', 'none');
  }

  private _normalizeContentChild(container: HTMLElement, hostRoot: HTMLElement): void {
    Array.from(container.children).forEach((child) => {
      if (!(child instanceof HTMLElement)) return;
      if (!child.contains(hostRoot) && child !== hostRoot && child !== this.domElement) return;
      this._setImportantStyle(child, 'flex', '1 1 auto');
      this._setImportantStyle(child, 'min-width', '0');
      this._setImportantStyle(child, 'width', '100%');
      this._setImportantStyle(child, 'max-width', 'none');
      this._setImportantStyle(child, 'margin-left', '0');
      this._setImportantStyle(child, 'margin-top', '0');
      this._setImportantStyle(child, 'padding-left', '0');
      this._setImportantStyle(child, 'padding-top', '0');
    });
  }

  private _collapseReservedLeftColumns(hostRoot: HTMLElement): void {
    const hostRect = hostRoot.getBoundingClientRect();
    const containers = new Set<HTMLElement>();

    const addContainer = (element: Element | null): void => {
      if (element instanceof HTMLElement) {
        containers.add(element);
      }
    };

    addContainer(document.querySelector('.spAppAndPropertyPanelContainer'));
    addContainer(hostRoot.parentElement);

    let ancestor: HTMLElement | null = hostRoot.parentElement;
    while (ancestor && ancestor !== document.body) {
      containers.add(ancestor);
      if (ancestor.getAttribute('role') === 'main') {
        break;
      }
      ancestor = ancestor.parentElement;
    }

    containers.forEach((container) => {
      this._normalizeContentChild(container, hostRoot);
      Array.from(container.children).forEach((child) => {
        if (!(child instanceof HTMLElement)) return;
        if (child.contains(hostRoot) || child === hostRoot || child === this.domElement) return;

        const rect = child.getBoundingClientRect();
        const blankRail =
          rect.width > 0 &&
          rect.width <= 360 &&
          rect.left <= hostRect.left + 8 &&
          rect.right <= hostRect.left + 360;
        const hasNavChrome = Boolean(
          child.querySelector('.sp-appBar, .sp-appBar-mobile, .sp-sideNav, [class*="spReactLeftNav"], [data-automationid="SiteHeaderLeftNavToggleButton"]')
        );
        const emptyShell = (child.textContent ?? '').trim() === '' && child.children.length <= 2;

        if (blankRail && (hasNavChrome || emptyShell)) {
          this._collapseElement(child);
        }
      });
    });
  }

  private _scheduleHostNormalization(): void {
    if (this._normalizeHostFrame !== undefined) {
      window.cancelAnimationFrame(this._normalizeHostFrame);
    }
    this._normalizeHostFrame = window.requestAnimationFrame(() => {
      this._normalizeHostFrame = undefined;
      this._normalizeHostLayout();
    });
  }

  private _normalizeHostLayout(): void {
    const hostRoot = this.domElement.querySelector('[data-th-app-root]') as HTMLElement | null;
    if (!hostRoot) {
      return;
    }

    const addTarget = (set: Set<HTMLElement>, element: Element | null): void => {
      if (element instanceof HTMLElement) {
        set.add(element);
      }
    };

    const targets = new Set<HTMLElement>();
    addTarget(targets, this.domElement);
    addTarget(targets, this.domElement.parentElement);
    addTarget(targets, hostRoot);

    let ancestor: HTMLElement | null = this.domElement.parentElement;
    while (ancestor && ancestor !== document.body) {
      targets.add(ancestor);
      if (ancestor.getAttribute('role') === 'main') {
        break;
      }
      ancestor = ancestor.parentElement;
    }

    const hostSelectors = [
      '.spAppAndPropertyPanelContainer',
      '#spPlaceholdersAndPageContentContainer',
      '#spPageContentContainer',
      '#spPageChromeAppDiv',
      '#spSiteHeader',
      '#spPageHeader',
      '#spTopPlaceholder',
      '[data-automationid="AppChrome"]',
      '[data-automationid="SiteHeader"]',
      '[data-automation-id="SiteHeader"]',
      '[data-automationid="pageHeader"]',
      '[data-automation-id="pageHeader"]',
      '.SPPageChrome-app',
      '.ms-scroller',
      '.sp-canvasPage',
      'section.mainContent',
      '[data-automation-id="contentScrollRegion"]',
      '[data-automationid="contentScrollRegion"]',
      '[role="main"]',
      '#spPageCanvasContent',
      '.SPCanvas',
      '.SPCanvas-canvas',
      '.CanvasComponent',
      '[data-automation-id="Canvas"]',
      '[data-automation-id="CanvasLayout"]',
      '[data-automation-id="CanvasZone"]',
      '[data-automation-id="CanvasZone-SectionContainer"]',
      '[data-automation-id="CanvasSection"]',
      '.ControlZone',
      '.ms-SPLegacyFabricBlock',
      '.sp-sideNav + div'
    ];

    for (const selector of hostSelectors) {
      document.querySelectorAll(selector).forEach((element) => addTarget(targets, element));
    }

    targets.forEach((element) => {
      this._setImportantStyle(element, 'width', '100%');
      this._setImportantStyle(element, 'max-width', 'none');
      this._setImportantStyle(element, 'margin-left', '0');
      this._setImportantStyle(element, 'margin-right', '0');
      this._setImportantStyle(element, 'margin-top', '0');
      this._setImportantStyle(element, 'padding-left', '0');
      this._setImportantStyle(element, 'padding-right', '0');
      this._setImportantStyle(element, 'padding-top', '0');
      this._setImportantStyle(element, 'left', '0');
      this._setImportantStyle(element, 'top', '0');
      this._setImportantStyle(element, 'right', 'auto');
      this._setImportantStyle(element, 'inset-inline-start', '0');
      this._setImportantStyle(element, 'box-sizing', 'border-box');
      this._setImportantStyle(element, 'overflow', 'visible');
    });

    document.querySelectorAll('#sp-appBar, .spAppAndPropertyPanelContainer .sp-appBar, .spAppAndPropertyPanelContainer .sp-appBar-mobile, #SuiteNavWrapper, #O365_NavHeader, #spCommandBar, #spSiteHeader, #spPageHeader, #spTopPlaceholder, .sp-sideNav, [class*="spReactLeftNav"], [data-automationid="SiteHeader"], [data-automation-id="SiteHeader"], [data-automationid="pageHeader"], [data-automation-id="pageHeader"], [data-automationid="SiteHeaderLeftNavToggleButton"]').forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      this._collapseElement(element);

      const sibling = element.nextElementSibling;
      if (sibling instanceof HTMLElement) {
        this._setImportantStyle(sibling, 'width', '100%');
        this._setImportantStyle(sibling, 'max-width', 'none');
        this._setImportantStyle(sibling, 'margin-left', '0');
        this._setImportantStyle(sibling, 'padding-left', '0');
        this._setImportantStyle(sibling, 'flex', '1 1 auto');
        this._setImportantStyle(sibling, 'min-width', '0');
      }

      const parent = element.parentElement;
      if (parent instanceof HTMLElement) {
        this._setImportantStyle(parent, 'gap', '0');
        this._setImportantStyle(parent, 'column-gap', '0');
        this._setImportantStyle(parent, 'row-gap', '0');
        this._setImportantStyle(parent, 'padding-left', '0');
        this._setImportantStyle(parent, 'padding-top', '0');
        this._setImportantStyle(parent, 'margin-left', '0');
        this._setImportantStyle(parent, 'margin-top', '0');
      }
    });

    this._setImportantStyle(hostRoot, 'display', 'block');
    this._setImportantStyle(hostRoot, 'max-width', 'none');
    this._setImportantStyle(hostRoot, 'margin-left', '0');
    this._setImportantStyle(hostRoot, 'margin-top', '0');
    this._setImportantStyle(hostRoot, 'width', '100%');
    this._setImportantStyle(hostRoot, 'min-width', '0');

    this._collapseReservedLeftColumns(hostRoot);
  }

  private _ensureHostObservers(): void {
    if (!this._hostMutationObserver) {
      this._hostMutationObserver = new MutationObserver(() => {
        this._scheduleHostNormalization();
      });
      this._hostMutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    window.removeEventListener('resize', this._handleWindowResize);
    window.addEventListener('resize', this._handleWindowResize);
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
    this._ensureHostObservers();

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
    this._scheduleHostNormalization();
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
    if (this._normalizeHostFrame !== undefined) {
      window.cancelAnimationFrame(this._normalizeHostFrame);
      this._normalizeHostFrame = undefined;
    }
    this._hostMutationObserver?.disconnect();
    this._hostMutationObserver = undefined;
    window.removeEventListener('resize', this._handleWindowResize);
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
