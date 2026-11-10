import type { PropertyType } from "@/shared/api/client";

/** Grey example text for form boxes, matched to what's being sold or wanted. Short on purpose. */
export const EXAMPLES: Record<PropertyType, { cents: string; description: string; price: string; budget: string; wants: string }> = {
  land: { cents: "10", description: "Flat plot, road access, well", price: "2,00,000", budget: "20", wants: "Road access, flat plot" },
  house: { cents: "6", description: "3 BHK, 1500 sq ft, car access", price: "45,00,000", budget: "50", wants: "2 BHK, near a school" },
  commercial: { cents: "5", description: "Shop, 800 sq ft, main road", price: "80,00,000", budget: "80", wants: "Shop on the main road" },
};
