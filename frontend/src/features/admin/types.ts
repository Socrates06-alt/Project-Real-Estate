import type { PropertyType } from "@/shared/api/client";

export type Group = "new" | "live" | "sold" | "not_listed" | "removed";
/** What can be done to a property now; the server decides (backend/app/admin/lifecycle.py). */
export type PropertyAction = "publish" | "sold" | "take_down" | "not_listed" | "remove" | "restore";

export interface PropertyRow {
  id: string;
  number: number;
  seller_name: string;
  seller_phone: string;
  property_type: PropertyType;
  location: string;
  title: string;
  price: number;
  listing_id: string | null;
  group: Group;
  cover_url: string | null;
  open_visits: number;
  via?: string; // search only: why it was found ("Visit request: Anil")
  wants_doc_help: boolean;
  wants_dev_help: boolean;
  created_at: string;
}

export interface Visit {
  id: string;
  name: string;
  phone: string;
  preferred_time: string;
  budget: string;
  status: "new" | "contacted" | "scheduled" | "done" | "cancelled";
  admin_notes?: string;
  came_from?: string;
  created_at: string;
  listing_number?: number;
  listing_title?: string;
  property_id?: string;
}

export interface Inbox {
  new: PropertyRow[];
  visits: Visit[];
  counts: Record<Group, number>;
  buyer_requests: number; // website requests no founder has seen yet
  callbacks: number; // people waiting for a call back
}

export interface PublicForm {
  title: string;
  property_type: PropertyType;
  land_area_cents: number;
  location: string;
  description: string;
  price: number;
  negotiable: boolean;
  documents_available: boolean;
  documents_note: string;
  photo_ids: string[];
  lat: number | null; // exact pin (private)
  lng: number | null;
}

export interface Property {
  id: string;
  group: Group;
  actions: PropertyAction[];
  number: number;
  listing_id: string | null;
  reference_price: number;
  seller: {
    seller_name: string;
    seller_phone: string;
    seller_phone2?: string;
    property_type: PropertyType;
    land_area_cents: number;
    location: string;
    area_lat: number | null;
    area_lng: number | null;
    address: string;
    description: string;
    expected_price: number;
    negotiable: boolean;
    documents_available: boolean;
    documents_note: string;
    wants_doc_help: boolean;
    wants_dev_help: boolean;
    consent_version: string;
    consent_at: string;
    created_at: string;
    status_note: string | null;
  };
  admin_entered: boolean; // entered by a founder, so the seller's details can be corrected
  photos: { id: string; url: string }[];
  form: PublicForm;
  visits: Visit[];
}
