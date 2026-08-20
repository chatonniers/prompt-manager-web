// SAP URL detection — evaluated top-to-bottom, first match wins
const SAP_URL_RULES = [
  {
    solution: "Joule Studio",
    patterns: [/joule-studio/i, /build\.joule\.cloud\.sap/i],
    suggestedFlows: ["Design-to-Operate"]
  },
  {
    solution: "Joule",
    patterns: [/joule\.cloud\.sap/i, /\/joule\//i, /ai-assistant/i],
    suggestedFlows: []
  },
  {
    solution: "IBP",
    patterns: [/ibpcloud\.sap/i, /ibp\.cloud\.sap/i, /sapibp/i, /integrated-business-planning/i],
    suggestedFlows: ["Plan-to-Inventory"]
  },
  {
    solution: "Ariba",
    patterns: [/ariba\.com/i, /s1\.ariba\.com/i, /businessnetwork\.sap/i, /sap-ariba/i],
    suggestedFlows: ["Procure-to-Pay"]
  },
  {
    solution: "S/4HANA",
    patterns: [/s4hana\.cloud\.sap/i, /my\d+\.s4hana\.cloud\.sap/i, /\/sap\/s4\/hana/i, /\.s4hana\./i],
    suggestedFlows: ["Procure-to-Pay", "Order-to-Cash", "Record-to-Report", "Hire-to-Retire"]
  },
  {
    solution: "BTP",
    patterns: [/cockpit\.btp\.cloud\.sap/i, /cfapps\.[a-z0-9-]+\.hana\.ondemand\.com/i, /\.btp\.cloud\.sap/i, /build\.cloud\.sap/i],
    suggestedFlows: ["Design-to-Operate"]
  },
  {
    solution: "Digital Manufacturing",
    patterns: [/dmc\.cloud\.sap/i, /digital-manufacturing/i, /manufacturing\.cloud\.sap/i],
    suggestedFlows: ["Design-to-Operate"]
  },
  {
    solution: "Datasphere",
    patterns: [/datasphere\.cloud\.sap/i, /dwc\.cloud\.sap/i],
    suggestedFlows: ["Plan-to-Inventory", "Record-to-Report"]
  },
  {
    solution: "SuccessFactors",
    patterns: [/successfactors\.com/i, /\.successfactors\.eu/i],
    suggestedFlows: ["Hire-to-Retire"]
  },
  {
    solution: "SAP (Generic)",
    patterns: [/\.sap\.com/i, /\.sapcloud\.io/i, /\.hana\.ondemand\.com/i, /\.hanacloudservices\.cloud\.sap/i],
    suggestedFlows: []
  }
];

function detectSAPContext(url) {
  for (const rule of SAP_URL_RULES) {
    if (rule.patterns.some(p => p.test(url))) {
      return { detected: true, solution: rule.solution, suggestedFlows: rule.suggestedFlows };
    }
  }
  return { detected: false, solution: null, suggestedFlows: [] };
}

export { SAP_URL_RULES, detectSAPContext };
