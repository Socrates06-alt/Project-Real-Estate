import { Home, Store, Trees } from "lucide-react";
import type { PropertyType } from "@/shared/api/client";

export const TYPE_ICON = { house: Home, land: Trees, commercial: Store } satisfies Record<PropertyType, unknown>;

/** Soft tag colours per type (badge tone names). */
export const TYPE_TONE = { house: "house", land: "land", commercial: "commercial" } as const;

export const TYPE_TAG = {
  house: "bg-house-soft text-house",
  land: "bg-land-soft text-land",
  commercial: "bg-commercial-soft text-commercial",
} satisfies Record<PropertyType, string>;
