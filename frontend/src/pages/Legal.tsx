import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { getConfig } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { PageHeader } from "@/components/PageHeader";

const UPDATED = "November 2026";

function Doc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <PageHeader title={title} subtitle={`Last updated: ${UPDATED}`} />
      <article className="card space-y-5 p-5 text-[15px] leading-relaxed shadow-card [&_h2]:text-base [&_h2]:font-semibold [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </article>
      <p className="mt-4 text-center text-sm text-sub">
        <Link to="/privacy" className="underline underline-offset-2">Privacy policy</Link>
        {" · "}
        <Link to="/terms" className="underline underline-offset-2">Terms of use</Link>
      </p>
    </>
  );
}

function ContactLine() {
  const { data: config } = useAsync(getConfig, []);
  return <>{config ? `call or WhatsApp us on ${config.contact.phone}` : "contact us by phone or WhatsApp"}</>;
}

export function Privacy() {
  return (
    <Doc title="Privacy policy">
      <p>
        LandFinder helps people buy and sell property around Chengannur. This page explains what we collect, why, and how
        we protect it. We follow India's Digital Personal Data Protection Act, 2023.
      </p>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li><b>Sellers:</b> name, phone number, property address and area, land size, price, description, documents details and photos.</li>
          <li><b>Buyers asking for a visit:</b> name, phone number, preferred time and budget (if given).</li>
          <li><b>Your device:</b> a random code stored in your browser so "My listings" works without a login. We keep only a scrambled (hashed) version of it.</li>
          <li><b>Your location:</b> only if you tap "Near me", and only to show nearby properties. It is not stored.</li>
        </ul>
      </section>
      <section>
        <h2>What buyers and the public can see</h2>
        <ul>
          <li>Only the property details we publish: photos, area name, size, price, description and documents status.</li>
          <li>Sellers' names, phone numbers, full addresses and exact locations are <b>never shown</b>. Buyers contact LandFinder, not the seller.</li>
          <li>Location (GPS) information is removed from every photo before it is stored.</li>
        </ul>
      </section>
      <section>
        <h2>Why we use your information</h2>
        <ul>
          <li>To verify and publish listings, arrange site visits and complete sales.</li>
          <li>To call or message you about your property or visit request.</li>
          <li>To keep records required by law (for example, for brokerage invoices and GST).</li>
        </ul>
        <p className="mt-2">We do not sell your information, and we do not use it for advertising.</p>
      </section>
      <section>
        <h2>Who we share it with</h2>
        <ul>
          <li>Only LandFinder's founders and trained staff can see your details.</li>
          <li>When a buyer and seller agree to go ahead, we share the details needed to complete the sale with both of them.</li>
          <li>Government or courts, only when the law requires it.</li>
        </ul>
      </section>
      <section>
        <h2>On your phone</h2>
        <p>
          The app stores a few things in your own browser: the device code above, your light/dark choice, and an unfinished
          "List your property" form so you can continue later. We don't use advertising or tracking cookies.
        </p>
      </section>
      <section>
        <h2>How long we keep it</h2>
        <p>
          While your listing or visit request is active, and afterwards only as long as needed for legal and tax records.
          Seller submissions are kept unchanged as a record of what was agreed.
        </p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>
          You can ask us to see, correct or delete your information, or to take down your listing. Just <ContactLine />.
          Some records may need to be kept where the law requires it.
        </p>
      </section>
    </Doc>
  );
}

export function Terms() {
  const { data: config } = useAsync(getConfig, []);
  const seller = config?.brokerage.seller_pct ?? 2;
  const buyer = config?.brokerage.buyer_pct ?? 1;
  return (
    <Doc title="Terms of use">
      <p>By using LandFinder or submitting a property, you agree to these terms.</p>
      <section>
        <h2>Our service</h2>
        <ul>
          <li>LandFinder is a property brokerage for Chengannur and nearby areas.</li>
          <li>Listing a property is <b>free</b>. We review every property before publishing it, and we may decline any listing.</li>
          <li>We arrange and accompany site visits, and help both sides through to registration.</li>
          {config?.rera_number && <li>Kerala RERA agent registration: {config.rera_number}.</li>}
        </ul>
      </section>
      <section>
        <h2>Brokerage</h2>
        <ul>
          <li><b>Seller:</b> {seller}% of the final sale price.</li>
          <li><b>Buyer:</b> {buyer}% of the final sale price.</li>
          <li>GST is extra. Brokerage is due only when the sale is completed (on registration).</li>
          <li>
            Brokerage also applies if a buyer introduced by LandFinder buys the property directly from the seller within 12
            months of the introduction.
          </li>
          <li>Documentation assistance is optional and charged separately; we tell you the charge before starting.</li>
        </ul>
      </section>
      <section>
        <h2>Sellers</h2>
        <ul>
          <li>You confirm you own the property or are authorised to sell it, and that the details and photos you give are true.</li>
          <li>We may edit the description and photos for clarity. Any price change is confirmed with you before it goes live.</li>
          <li>You can ask us to take your listing down at any time.</li>
        </ul>
      </section>
      <section>
        <h2>Buyers</h2>
        <ul>
          <li>Listings are checked by us, but you should still verify documents (title, encumbrance, tax receipts) before paying any money. We can help with this.</li>
          <li>Prices are the seller's asking price unless marked otherwise.</li>
        </ul>
      </section>
      <section>
        <h2>Limits</h2>
        <ul>
          <li>We take care to keep information accurate, but we can't guarantee every detail. The final agreement is between buyer and seller.</li>
          <li>Please don't misuse the site: no false listings, spam or attempts to access other people's information.</li>
        </ul>
      </section>
      <section>
        <h2>Law</h2>
        <p>These terms follow Indian law. Any dispute will be handled by the courts in Alappuzha district, Kerala.</p>
      </section>
      <section>
        <h2>Questions</h2>
        <p>
          Please <ContactLine />.
        </p>
      </section>
    </Doc>
  );
}
