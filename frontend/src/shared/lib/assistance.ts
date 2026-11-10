/** Optional paid services offered alongside a sale. Each info sheet is a list of highlighted lines. */
export type AssistanceInfo = {
  title: string; // tick box label and sheet title
  note: string; // small line under the label
  intro: string;
  items: [string, string][]; // [highlighted name, what it means]
  footer: string;
  confirm: string; // button in the info sheet
};

export const DOC_HELP: AssistanceInfo = {
  title: "Documentation assistance",
  note: "Special charges apply",
  intro: "We help you prepare and obtain:",
  items: [
    ["Sale Agreement & Sale Deed Registration", "drafting the agreement and registering the sale deed at the Sub-Registrar Office."],
    ["Encumbrance Certificate (EC)", "shows the property is free of loans, mortgages or legal dues."],
    ["Possession Certificate", "from the Village Office, confirming who holds the property."],
    ["Non-Attachment Certificate", "confirms the property is not attached by any court or revenue recovery."],
    ["Location Sketch", "Village Office sketch showing the property's location and boundaries."],
  ],
  footer: "Special charges apply for this assistance.",
  confirm: "I need this",
};

export const DEV_HELP: AssistanceInfo = {
  title: "Property development assistance",
  note: "Special charges apply",
  intro: "We help get your property ready to sell, through trusted local partners:",
  items: [
    ["Survey & boundary marking", "a licensed surveyor measures the land and fixes boundary stones; area mismatches sorted out."],
    ["Land clearing & levelling", "clearing bushes and debris and levelling, so the plot looks usable."],
    ["Boundary wall / fencing", "quotes and work for a compound wall, gate or fencing."],
    ["Road access", "approach path, culvert or gravel road to the plot."],
    ["Plot subdivision", "splitting large land into sellable plots, with layout and approvals guidance."],
    ["Repairs & painting (houses)", "minor repairs, painting and cleaning before listing."],
    ["Photos & video", "professional photos and drone video of the property."],
  ],
  footer: "Special charges apply. We share a quote before any work starts.",
  confirm: "I need this",
};

export const FINANCE_HELP: AssistanceInfo = {
  title: "Financial assistance",
  note: "Special charges may apply",
  intro: "We help buyers arrange finance through partner banks and lenders:",
  items: [
    ["Home & plot loans", "guidance and applications with partner banks."],
    ["NRI home loans", "loans for buyers living abroad."],
    ["Eligibility check", "how much they can borrow, and the monthly EMI."],
    ["Document checklist", "income, ID and property papers the bank will ask for."],
    ["Full cost estimate", "stamp duty, registration and other charges, so there are no surprises."],
    ["Loan against property", "for buyers using another property as security."],
  ],
  footer: "Loans are subject to bank approval. LandFinder is not a lender; we help you apply.",
  confirm: "Needs this",
};
