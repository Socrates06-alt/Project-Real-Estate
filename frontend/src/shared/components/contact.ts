import type { Contact, Listing } from "@/shared/api/client";
import { typeLabel } from "@/shared/lib/format";

/** WhatsApp chat with LandFinder; for a property, the message includes its link so we know which one. */
export function waLink(contact: Contact, listing?: Pick<Listing, "id" | "property_type" | "location">) {
  const text = listing
    ? `Hi LandFinder, I'm interested in this ${typeLabel(listing.property_type).toLowerCase()} in ${listing.location}: ${window.location.origin}/p/${listing.id}`
    : "Hi LandFinder, I'd like to know more.";
  return `https://wa.me/${contact.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

/** WhatsApp chat with a ready message of our own (e.g. "I want to sell my property"). */
export const waText = (contact: Contact, text: string) =>
  `https://wa.me/${contact.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

export const telLink = (contact: Contact) => `tel:${contact.phone}`;
