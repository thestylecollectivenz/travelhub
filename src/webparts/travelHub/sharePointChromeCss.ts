export const TRAVEL_HUB_CHROME_STYLE_ID = 'travel-hub-sharepoint-chrome-overrides';
export const TRAVEL_HUB_PAGE_CLASS = 'th-travelhub-page';

/**
 * Runtime-injected page CSS for SharePoint host chrome.
 *
 * Live DOM selectors confirmed from the current page:
 * - `#sp-appBar`: SharePoint left app/navigation rail
 * - `#SuiteNavWrapper` / `#O365_NavHeader`: Microsoft 365 suite shell
 * - `#spCommandBar`: SharePoint authoring command bar (+ New / Promote / Page details / Preview / Analytics / Share / Edit / Republish)
 * - `#spSiteHeader` / page header hosts: SharePoint site title/header rows that still reserve vertical space above the app
 * - `.spAppAndPropertyPanelContainer`: SharePoint flex wrapper for the app bar and page content
 * - current page wrappers under `role="main"` include classes that apply `width: calc(100% - 120px)`,
 *   `margin: 0 auto`, and left-side offset styles after the nav host is hidden
 *
 * The site quick-launch nav is rendered by SharePoint's left-nav React host. Its concrete class is hashed,
 * so this targets the stable runtime class prefix SharePoint uses for that nav container.
 */
export const TRAVEL_HUB_CHROME_CSS = `
body.${TRAVEL_HUB_PAGE_CLASS} #sp-appBar,
body.${TRAVEL_HUB_PAGE_CLASS} .spAppAndPropertyPanelContainer .sp-appBar,
body.${TRAVEL_HUB_PAGE_CLASS} .spAppAndPropertyPanelContainer .sp-appBar-mobile,
body.${TRAVEL_HUB_PAGE_CLASS} #SuiteNavWrapper,
body.${TRAVEL_HUB_PAGE_CLASS} #O365_NavHeader,
body.${TRAVEL_HUB_PAGE_CLASS} #spCommandBar,
body.${TRAVEL_HUB_PAGE_CLASS} #spSiteHeader,
body.${TRAVEL_HUB_PAGE_CLASS} #spPageHeader,
body.${TRAVEL_HUB_PAGE_CLASS} #spTopPlaceholder,
body.${TRAVEL_HUB_PAGE_CLASS} .sp-sideNav,
body.${TRAVEL_HUB_PAGE_CLASS} [class*="spReactLeftNav"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automationid="SiteHeader"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automation-id="SiteHeader"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automationid="pageHeader"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automation-id="pageHeader"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automationid="SiteHeaderLeftNavToggleButton"] {
  display: none !important;
}

body.${TRAVEL_HUB_PAGE_CLASS} .spAppAndPropertyPanelContainer .sp-appBar,
body.${TRAVEL_HUB_PAGE_CLASS} .spAppAndPropertyPanelContainer .sp-appBar-mobile,
body.${TRAVEL_HUB_PAGE_CLASS} .sp-sideNav {
  min-width: 0 !important;
  width: 0 !important;
  flex-basis: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
}

/* Mirror top-header reclaim: remove the flex column SharePoint keeps for the hidden app/nav rail */
body.${TRAVEL_HUB_PAGE_CLASS} .spAppAndPropertyPanelContainer {
  gap: 0 !important;
  column-gap: 0 !important;
  row-gap: 0 !important;
  padding-left: 0 !important;
  margin-left: 0 !important;
}

body.${TRAVEL_HUB_PAGE_CLASS} .spAppAndPropertyPanelContainer > :first-child:not(:has([data-th-app-root])) {
  display: none !important;
  width: 0 !important;
  min-width: 0 !important;
  max-width: 0 !important;
  flex: 0 0 0 !important;
  overflow: hidden !important;
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
}

body.${TRAVEL_HUB_PAGE_CLASS} .spAppAndPropertyPanelContainer > :has([data-th-app-root]),
body.${TRAVEL_HUB_PAGE_CLASS} #spPageCanvasContent:has([data-th-app-root]),
body.${TRAVEL_HUB_PAGE_CLASS} [role="main"]:has([data-th-app-root]) {
  flex: 1 1 auto !important;
  width: 100% !important;
  max-width: none !important;
  min-width: 0 !important;
  margin-left: 0 !important;
  padding-left: 0 !important;
}

body.${TRAVEL_HUB_PAGE_CLASS} .spAppAndPropertyPanelContainer,
body.${TRAVEL_HUB_PAGE_CLASS} #spPlaceholdersAndPageContentContainer,
body.${TRAVEL_HUB_PAGE_CLASS} #spPageContentContainer,
body.${TRAVEL_HUB_PAGE_CLASS} #spPageChromeAppDiv,
body.${TRAVEL_HUB_PAGE_CLASS} [data-automationid="AppChrome"],
body.${TRAVEL_HUB_PAGE_CLASS} .SPPageChrome-app,
body.${TRAVEL_HUB_PAGE_CLASS} .ms-scroller,
body.${TRAVEL_HUB_PAGE_CLASS} .sp-canvasPage,
body.${TRAVEL_HUB_PAGE_CLASS} section.mainContent,
body.${TRAVEL_HUB_PAGE_CLASS} [data-automation-id="contentScrollRegion"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automationid="contentScrollRegion"],
body.${TRAVEL_HUB_PAGE_CLASS} [role="main"],
body.${TRAVEL_HUB_PAGE_CLASS} #spPageCanvasContent,
body.${TRAVEL_HUB_PAGE_CLASS} .SPCanvas,
body.${TRAVEL_HUB_PAGE_CLASS} .SPCanvas-canvas,
body.${TRAVEL_HUB_PAGE_CLASS} .CanvasComponent,
body.${TRAVEL_HUB_PAGE_CLASS} [data-automation-id="Canvas"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automation-id="CanvasLayout"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automation-id="CanvasZone"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automation-id="CanvasZone-SectionContainer"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automation-id="CanvasSection"],
body.${TRAVEL_HUB_PAGE_CLASS} .ControlZone,
body.${TRAVEL_HUB_PAGE_CLASS} .ms-SPLegacyFabricBlock,
body.${TRAVEL_HUB_PAGE_CLASS} .th-app-root {
  width: 100% !important;
  max-width: none !important;
  box-sizing: border-box !important;
}

body.${TRAVEL_HUB_PAGE_CLASS} .spAppAndPropertyPanelContainer,
body.${TRAVEL_HUB_PAGE_CLASS} #spPlaceholdersAndPageContentContainer,
body.${TRAVEL_HUB_PAGE_CLASS} #spPageContentContainer,
body.${TRAVEL_HUB_PAGE_CLASS} .ms-scroller,
body.${TRAVEL_HUB_PAGE_CLASS} .sp-canvasPage,
body.${TRAVEL_HUB_PAGE_CLASS} section.mainContent,
body.${TRAVEL_HUB_PAGE_CLASS} [data-automation-id="contentScrollRegion"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automationid="contentScrollRegion"],
body.${TRAVEL_HUB_PAGE_CLASS} .sp-sideNav + div,
body.${TRAVEL_HUB_PAGE_CLASS} [role="main"] > div,
body.${TRAVEL_HUB_PAGE_CLASS} #spPageCanvasContent,
body.${TRAVEL_HUB_PAGE_CLASS} .SPCanvas,
body.${TRAVEL_HUB_PAGE_CLASS} .SPCanvas-canvas,
body.${TRAVEL_HUB_PAGE_CLASS} .CanvasComponent,
body.${TRAVEL_HUB_PAGE_CLASS} [data-automation-id="Canvas"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automation-id="CanvasLayout"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automation-id="CanvasZone"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automation-id="CanvasZone-SectionContainer"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automation-id="CanvasSection"],
body.${TRAVEL_HUB_PAGE_CLASS} .ControlZone {
  margin-left: 0 !important;
  margin-right: 0 !important;
  margin-top: 0 !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
  padding-top: 0 !important;
  left: 0 !important;
  top: 0 !important;
  right: auto !important;
  inset-inline-start: 0 !important;
  transform: none !important;
  translate: none !important;
}

body.${TRAVEL_HUB_PAGE_CLASS} .c_1avbf_St4iq > :last-child,
body.${TRAVEL_HUB_PAGE_CLASS} .c_dWimP_St4iq > :last-child,
body.${TRAVEL_HUB_PAGE_CLASS} .r_GCmyc_St4iq > :last-child,
body.${TRAVEL_HUB_PAGE_CLASS} .r_qcTz6_St4iq > :last-child,
body.${TRAVEL_HUB_PAGE_CLASS} .c_1avbf_St4iq > :last-child > :last-child,
body.${TRAVEL_HUB_PAGE_CLASS} .c_dWimP_St4iq > :last-child > :last-child,
body.${TRAVEL_HUB_PAGE_CLASS} .c_pOUh7_St4iq > :last-child > :last-child {
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
}
`;
