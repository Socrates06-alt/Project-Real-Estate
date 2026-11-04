/** Shapes of the data the public API returns. */

export type PropertyType = "house" | "land" | "commercial";

export interface Listing {
  id: string;
  number: number;
  status: "live" | "sold";
  version: number;
  title: string;
  property_type: PropertyType;
  land_area_cents: number;
  location: string;
  description: string;
  price: number;
  negotiable: boolean;
  documents_available: boolean;
  documents_note: string;
  photos: string[];
  published_at: string;
  listed_at: string;
  price_reduced: boolean;
  sold_at: string | null;
}

export interface Contact {
  phone: string;
  whatsapp: string;
}

export interface Parsed {
  text: string;
  property_type: PropertyType | null;
  min_price: number | null;
  max_price: number | null;
  min_cents: number | null;
  max_cents: number | null;
}

export interface Feed {
  items: Listing[];
  has_more: boolean;
  total: number;
  parsed: Parsed;
  contact: Contact;
}

export interface PublicConfig {
  contact: Contact;
  brokerage: { seller_pct: number; buyer_pct: number; gst_extra: boolean; listing_fee: number };
  consent_version: string;
  rera_number: string | null;
  max_photos: number;
  max_photo_bytes: number;
}

export interface MySubmission {
  id: string;
  number: number;
  property_type: PropertyType;
  location: string;
  expected_price: number;
  status: SubmissionStatus;
  created_at: string;
  listing_id: string | null;
}

export type SubmissionStatus = "received" | "under_review" | "listed" | "sold" | "withdrawn" | "rejected";
