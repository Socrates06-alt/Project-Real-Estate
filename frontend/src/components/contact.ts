import type { Contact, Listing } from "@/lib/api";
import { typeLabel } from "@/lib/format";

export function waLink(contact: Contact, listing?: Pick<Listing, "number" | "property_type" | "location">) {
  const text = listing
    ? `Hi Nilayam, I'm interested in property #${listing.number} (${typeLabel(listing.property_type)}, ${listing.location}).`
    : "Hi Nilayam, I'd like to know more.";
  return `https://wa.me/${contact.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export const telLink = (contact: Contact) => `tel:${contact.phone}`;
