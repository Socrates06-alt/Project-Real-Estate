import type { PropertyType } from "@/shared/api/client";
import { t } from "@/shared/i18n";

type Example = { cents: string; description: string; price: string; budget: string; wants: string };

/** Numbers stay as they are; the word examples are read at use time so they follow the chosen language. */
function example(type: PropertyType, nums: { cents: string; price: string; budget: string }): Example {
  return {
    ...nums,
    get description() {
      return t(`example.${type}.description`);
    },
    get wants() {
      return t(`example.${type}.wants`);
    },
  };
}

/** Grey example text for form boxes, matched to what's being sold or wanted. Short on purpose. */
export const EXAMPLES: Record<PropertyType, Example> = {
  land: example("land", { cents: "10", price: "2,00,000", budget: "20" }),
  house: example("house", { cents: "6", price: "45,00,000", budget: "50" }),
  commercial: example("commercial", { cents: "5", price: "80,00,000", budget: "80" }),
};
