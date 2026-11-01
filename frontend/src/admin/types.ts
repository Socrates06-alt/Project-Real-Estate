import type { PropertyType, SubmissionStatus } from "@/lib/api";

export interface AdminSubmissionRow {
  id: string;
  ref_code: string;
  seller_name: string;
  seller_phone: string;
  property_type: PropertyType;
  land_area_cents: string;
  location: string;
  expected_price: number;
  status: SubmissionStatus;
  created_at: string;
  listing_id: string | null;
}

export interface AdminSubmission extends AdminSubmissionRow {
  description: string;
  negotiable: boolean;
  documents_available: boolean;
  documents_note: string;
  consent_version: string;
  consent_at: string;
  status_note: string | null;
  photos: { id: string; url: string }[];
}

export type ListingState = "draft" | "published" | "sold" | "withdrawn";

export interface AdminListing {
  id: string;
  number: number;
  submission_id: string;
  state: ListingState;
  title: string;
  property_type: PropertyType;
  land_area_cents: string;
  location: string;
  description: string;
  price: number;
  negotiable: boolean;
  documents_available: boolean;
  documents_note: string;
  photo_ids: string[];
  confirmed_price: number | null;
  current_version: number;
  published_at: string | null;
  updated_at: string;
  versions: { version: number; published_at: string; snapshot: Record<string, unknown> }[];
}

export interface Visit {
  id: string;
  listing_id: string;
  listing_number: number;
  listing_title: string;
  name: string;
  phone: string;
  preferred_time: string;
  budget: string;
  message: string;
  status: "new" | "contacted" | "scheduled" | "done" | "cancelled";
  admin_notes: string;
  created_at: string;
}
