export const SCORING_WEIGHTS = {
  momentum: {
    ticketVelocity: 0.2,
    ticketThroughput: 0.15,
    cycleTimeEfficiency: 0.15,
    codeVolume: 0.1,
    prThroughput: 0.15,
    adoption: 0.15,
    userTraction: 0.1,
  },
} as const;

export const SCORE_RANGE = { min: 0, max: 100 } as const;

export const FEATURE_FLAG_KEYS = [
  "guidance_chat",
  "guidance_item_search",
  "copilot_v2",
  "skills",
  "order_agent",
  "contract_agent",
  "contract_extraction",
  "contracts",
  "order_confirmations",
  "invoice_agent",
  "sourcing_agent",
  "sourcing_agent_negotiation",
  "negotiation_agent",
  "negotiation_agent_v2",
  "negotiation_projects_standalone",
  "goods_receipt_agent",
  "agentic_guided_buying",
  "forms",
  "purchase_requests",
  "supports_shopping_cart",
  "beta_negotiation_projects",
  "web_access",
  "strategic_negotiation_agent",
  "bundling_agent",
] as const;

export const INTEGRATION_KEYS = [
  "coupa",
  "ariba",
  "sap",
  "solunity",
  "oci",
  "ms_graph",
  "candex",
  "sharepoint_sync",
  "scim",
] as const;

export const SYSTEM_DATABASE_PREFIXES = [
  "admin",
  "local",
  "config",
  "supplier-portal",
] as const;

export const FEATURE_FLAG_DISPLAY_NAMES: Record<string, string> = {
  guidance_chat: "Guided Buying",
  guidance_item_search: "Item Search",
  copilot_v2: "Copilot V2",
  skills: "Copilot Skills",
  order_agent: "Order Agent",
  contract_agent: "Contract Agent",
  contract_extraction: "Contract Extraction",
  contracts: "Contracts",
  order_confirmations: "Order Confirmations",
  invoice_agent: "Invoice Agent",
  sourcing_agent: "Sourcing Agent",
  sourcing_agent_negotiation: "Sourcing Negotiation",
  negotiation_agent: "Negotiation Agent",
  negotiation_agent_v2: "Negotiation Agent V2",
  negotiation_projects_standalone: "Negotiation Projects",
  goods_receipt_agent: "Goods Receipt Agent",
  agentic_guided_buying: "Agentic Guided Buying",
  forms: "Forms",
  purchase_requests: "Purchase Requests",
  supports_shopping_cart: "Shopping Cart",
  beta_negotiation_projects: "Beta Negotiation",
  web_access: "Web Access",
  strategic_negotiation_agent: "Strategic Negotiation",
  bundling_agent: "Bundling Agent",
};
