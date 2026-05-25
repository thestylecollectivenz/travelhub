export const TRAVEL_HUB_CHROME_STYLE_ID = 'travel-hub-sharepoint-chrome-overrides';
export const TRAVEL_HUB_PAGE_CLASS = 'th-travelhub-page';

/**
 * Runtime-injected page CSS for SharePoint host chrome.
 *
 * Live DOM selectors confirmed from the current page:
 * - `#sp-appBar`: SharePoint left app/navigation rail
 * - `#SuiteNavWrapper` / `#O365_NavHeader`: Microsoft 365 suite shell
 * - `#spCommandBar`: SharePoint authoring command bar (+ New / Promote / Page details / Preview / Analytics / Share / Edit / Republish)
 *
 * The site quick-launch nav is rendered by SharePoint's left-nav React host. Its concrete class is hashed,
 * so this targets the stable runtime class prefix SharePoint uses for that nav container.
 */
export const TRAVEL_HUB_CHROME_CSS = `
body.${TRAVEL_HUB_PAGE_CLASS} #sp-appBar,
body.${TRAVEL_HUB_PAGE_CLASS} #SuiteNavWrapper,
body.${TRAVEL_HUB_PAGE_CLASS} #O365_NavHeader,
body.${TRAVEL_HUB_PAGE_CLASS} #spCommandBar,
body.${TRAVEL_HUB_PAGE_CLASS} [class*="spReactLeftNav"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automationid="SiteHeaderLeftNavToggleButton"] {
  display: none !important;
}

body.${TRAVEL_HUB_PAGE_CLASS} #spPageChromeAppDiv,
body.${TRAVEL_HUB_PAGE_CLASS} [data-automationid="AppChrome"],
body.${TRAVEL_HUB_PAGE_CLASS} .SPPageChrome-app,
body.${TRAVEL_HUB_PAGE_CLASS} section.mainContent,
body.${TRAVEL_HUB_PAGE_CLASS} article,
body.${TRAVEL_HUB_PAGE_CLASS} [data-automation-id="contentScrollRegion"],
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

body.${TRAVEL_HUB_PAGE_CLASS} section.mainContent,
body.${TRAVEL_HUB_PAGE_CLASS} article,
body.${TRAVEL_HUB_PAGE_CLASS} [data-automation-id="contentScrollRegion"],
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
  padding-left: 0 !important;
  padding-right: 0 !important;
}
`;
