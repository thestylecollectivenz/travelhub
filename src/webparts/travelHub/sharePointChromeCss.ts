export const TRAVEL_HUB_CHROME_STYLE_ID = 'travel-hub-sharepoint-chrome-overrides';
export const TRAVEL_HUB_PAGE_CLASS = 'th-travelhub-page';

/**
 * Runtime-injected page CSS for SharePoint host chrome.
 *
 * Live DOM selectors confirmed on travelhub SitePages/Travel-Hub.aspx (May 2026):
 * - `#spLeftNav`: page layout left nav (sibling of `section.mainContent` under App Chrome)
 * - `#sp-appBar`, `#spCommandBar`, `#spSiteHeader`, suite nav: standard SharePoint chrome
 * - `#CommentsWrapper` / `[data-sp-feature-tag="Comments"]`: page comments band below canvas
 * - `#spPageCanvasContent`: canvas host — width/margin reset only (no negative margin reclaim)
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
body.${TRAVEL_HUB_PAGE_CLASS} #spLeftNav,
body.${TRAVEL_HUB_PAGE_CLASS} .sp-sideNav,
body.${TRAVEL_HUB_PAGE_CLASS} [class*="spReactLeftNav"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automationid="SiteHeader"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automation-id="SiteHeader"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automationid="pageHeader"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automation-id="pageHeader"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-automationid="SiteHeaderLeftNavToggleButton"],
body.${TRAVEL_HUB_PAGE_CLASS} #CommentsWrapper,
body.${TRAVEL_HUB_PAGE_CLASS} [data-sp-feature-tag="Comments"],
body.${TRAVEL_HUB_PAGE_CLASS} [data-sp-placeholder="Bottom"],
body.${TRAVEL_HUB_PAGE_CLASS} .sp-placeholder-bottom {
  display: none !important;
}

body.${TRAVEL_HUB_PAGE_CLASS} .spAppAndPropertyPanelContainer .sp-appBar,
body.${TRAVEL_HUB_PAGE_CLASS} .spAppAndPropertyPanelContainer .sp-appBar-mobile,
body.${TRAVEL_HUB_PAGE_CLASS} .sp-sideNav,
body.${TRAVEL_HUB_PAGE_CLASS} #spLeftNav {
  min-width: 0 !important;
  width: 0 !important;
  flex-basis: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
  overflow: hidden !important;
}

body.${TRAVEL_HUB_PAGE_CLASS} .spAppAndPropertyPanelContainer {
  gap: 0 !important;
  column-gap: 0 !important;
  row-gap: 0 !important;
  padding-left: 0 !important;
  margin-left: 0 !important;
}

body.${TRAVEL_HUB_PAGE_CLASS} section.mainContent,
body.${TRAVEL_HUB_PAGE_CLASS} #spPageCanvasContent:has([data-th-app-root]),
body.${TRAVEL_HUB_PAGE_CLASS} [role="main"]:has([data-th-app-root]) {
  flex: 1 1 auto !important;
  width: 100% !important;
  max-width: none !important;
  min-width: 0 !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
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

body.${TRAVEL_HUB_PAGE_CLASS} .th-app-root,
body.${TRAVEL_HUB_PAGE_CLASS} #spPageCanvasContent:has([data-th-app-root]),
body.${TRAVEL_HUB_PAGE_CLASS} .sp-canvasPage:has([data-th-app-root]) {
  min-height: 100dvh !important;
  background: #faf8f4 !important;
  overflow: hidden !important;
}
`;
