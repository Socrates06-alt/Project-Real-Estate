import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { getConfig } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { PageHeader } from "@/components/PageHeader";

const UPDATED = "November 2026";
// Contact number shown on the legal pages.
const LEGAL_PHONE = "+91 9074343370";

function Doc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <PageHeader title={title} subtitle={`Last updated: ${UPDATED}`} />
      <article className="card space-y-6 p-5 text-[15px] leading-relaxed shadow-card [&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-semibold [&_li]:mt-1.5 [&_ol]:list-[lower-alpha] [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </article>
      <p className="mt-4 text-center text-sm text-sub">
        <Link to="/terms" className="underline underline-offset-2">Terms of Service</Link>
        {" · "}
        <Link to="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
      </p>
    </>
  );
}

function Contact() {
  return (
    <p className="mt-2">
      Phone / WhatsApp:{" "}
      <a href={`tel:${LEGAL_PHONE.replace(/\s/g, "")}`} className="font-medium text-brand underline underline-offset-2">
        {LEGAL_PHONE}
      </a>
    </p>
  );
}

export function Terms() {
  const { data: config } = useAsync(getConfig, []);
  const seller = config?.brokerage.seller_pct ?? 2;
  const buyer = config?.brokerage.buyer_pct ?? 1;
  return (
    <Doc title="Terms of Service">
      <p>
        These Terms of Service ("Terms") govern your access to and use of the LandFinder website and related services
        (together, the "Service"). By accessing the Service, submitting a property or requesting a visit, you agree to be
        bound by these Terms. If you do not agree, please do not use the Service.
      </p>

      <section>
        <h2>1. About the Service</h2>
        <p>
          LandFinder is a property brokerage platform that connects people who wish to sell property with prospective
          buyers. LandFinder acts as a facilitator and intermediary. LandFinder is not a party to any sale agreement
          between a buyer and a seller and does not own, sell or purchase any property listed on the Service.
        </p>
        {config?.rera_number && <p className="mt-2">Kerala RERA agent registration: {config.rera_number}.</p>}
      </section>

      <section>
        <h2>2. Listings</h2>
        <ol>
          <li>Listing a property on the Service is free of charge.</li>
          <li>
            Listing information, including descriptions, photographs, area, price and document details, is provided by
            the seller. LandFinder may review, edit, decline or remove any listing at its sole discretion and without
            giving reasons.
          </li>
          <li>Any verification carried out by LandFinder is limited in scope and is not a certification of title, legal status, condition or value of any property.</li>
        </ol>
      </section>

      <section>
        <h2>3. Brokerage fees</h2>
        <ol>
          <li>
            Brokerage is payable only on the successful completion of a sale: <b>{seller}%</b> of the final sale price
            by the seller and <b>{buyer}%</b> of the final sale price by the buyer. Applicable taxes, including GST, are
            charged in addition.
          </li>
          <li>Brokerage becomes due on the date of registration of the sale deed.</li>
          <li>
            Brokerage remains payable where a buyer introduced through LandFinder purchases the property directly from
            the seller, or through any other person, within twelve (12) months of the introduction.
          </li>
          <li>
            Additional services, such as documentation assistance, are optional and are charged separately. The
            applicable charges will be communicated before the service begins.
          </li>
        </ol>
      </section>

      <section>
        <h2>4. Seller responsibilities</h2>
        <ol>
          <li>You confirm that you are the lawful owner of the property, or are duly authorised to sell it.</li>
          <li>You confirm that all information and photographs you provide are true, accurate and not misleading, and that you have the right to share them.</li>
          <li>You will inform LandFinder promptly of any change in price, availability or legal status of the property.</li>
        </ol>
      </section>

      <section>
        <h2>5. Buyer responsibilities</h2>
        <ol>
          <li>
            Before making any payment or entering into any agreement, you are responsible for carrying out your own
            independent checks, including verification of title, encumbrances, approvals, tax records and the physical
            condition of the property, and for obtaining legal advice where appropriate.
          </li>
          <li>Prices shown are the seller's asking price and are subject to change and negotiation.</li>
        </ol>
      </section>

      <section>
        <h2>6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>submit false, misleading or unauthorised listings or information;</li>
          <li>use the Service for any unlawful, fraudulent or abusive purpose;</li>
          <li>attempt to access data or accounts that you are not authorised to access, or interfere with the operation or security of the Service;</li>
          <li>copy, scrape or reproduce listings or other content from the Service without written permission.</li>
        </ul>
        <p className="mt-2">LandFinder may suspend or restrict access to the Service for any person who breaches these Terms.</p>
      </section>

      <section>
        <h2>7. Intellectual property</h2>
        <p>
          The LandFinder name, logo, design and software are the property of LandFinder. By submitting content, you grant
          LandFinder a non-exclusive, royalty-free licence to use, edit and publish that content for the purpose of
          operating and promoting the Service.
        </p>
      </section>

      <section>
        <h2>8. Disclaimer</h2>
        <p>
          The Service and all information on it are provided on an "as is" and "as available" basis, without warranties
          of any kind, whether express or implied. LandFinder does not guarantee the accuracy, completeness or
          availability of any listing or information, the outcome of any negotiation or transaction, or that the Service
          will be uninterrupted or error-free.
        </p>
      </section>

      <section>
        <h2>9. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, LandFinder, its founders, employees and agents shall not be liable for
          any indirect, incidental, special or consequential loss or damage, or for any loss arising from any transaction
          between buyers and sellers, from reliance on information on the Service, or from any act or omission of any
          buyer, seller or third party. Where liability cannot be excluded, LandFinder's total liability shall not exceed
          the brokerage actually received by LandFinder in respect of the transaction concerned.
        </p>
      </section>

      <section>
        <h2>10. Indemnity</h2>
        <p>
          You agree to indemnify and hold harmless LandFinder, its founders, employees and agents from any claim, loss or
          expense arising from your breach of these Terms, from information you provide, or from your dealings with other
          users of the Service.
        </p>
      </section>

      <section>
        <h2>11. Changes to these Terms</h2>
        <p>
          LandFinder may update these Terms from time to time. The updated Terms will be posted on this page with a new
          "Last updated" date. Your continued use of the Service after changes are posted constitutes acceptance of the
          updated Terms.
        </p>
      </section>

      <section>
        <h2>12. Contact</h2>
        <p>For questions about these Terms, please contact us.</p>
        <Contact />
      </section>
    </Doc>
  );
}

export function Privacy() {
  return (
    <Doc title="Privacy Policy">
      <p>
        This Privacy Policy explains how LandFinder ("we", "us") collects, uses and protects personal information when
        you use our website and services (the "Service"). By using the Service, you consent to the practices described
        in this Policy.
      </p>

      <section>
        <h2>1. Information we collect</h2>
        <ol>
          <li><b>Sellers:</b> name, phone number, property address and area, land size, price, description, document details and photographs.</li>
          <li><b>Buyers requesting a visit:</b> name, phone number, preferred time and, if provided, budget.</li>
          <li><b>Device information:</b> a random identifier stored in your browser so that "My listings" works without an account. We store only an encrypted (hashed) form of this identifier.</li>
          <li><b>Location:</b> only if you choose "Near me", and only to show nearby properties. Your location is not stored.</li>
        </ol>
      </section>

      <section>
        <h2>2. How we use information</h2>
        <ul>
          <li>to review, publish and manage property listings;</li>
          <li>to contact you about your property, enquiry or visit request;</li>
          <li>to arrange visits and facilitate transactions between buyers and sellers;</li>
          <li>to maintain records required for accounting, tax and legal purposes;</li>
          <li>to protect the security and proper operation of the Service.</li>
        </ul>
      </section>

      <section>
        <h2>3. What is shown publicly</h2>
        <p>
          Only published property details are visible to the public, such as photographs, area name, land size, price,
          description and document status. Sellers' names, phone numbers, full addresses and exact locations are not
          displayed. Location metadata (GPS) is removed from photographs before they are stored.
        </p>
      </section>

      <section>
        <h2>4. Sharing of information</h2>
        <p>We do not sell personal information. We may share information only:</p>
        <ul>
          <li>with the other party to a proposed transaction, to the extent needed to complete it;</li>
          <li>with service providers who help us operate the Service (such as hosting), under appropriate confidentiality obligations;</li>
          <li>where required by law, regulation or a lawful request from a government authority.</li>
        </ul>
      </section>

      <section>
        <h2>5. Storage on your device</h2>
        <p>
          The Service stores a small amount of data in your browser: the device identifier described above, your display
          preference (light or dark), and any unfinished property form so that you can complete it later. We do not use
          advertising or third-party tracking cookies.
        </p>
      </section>

      <section>
        <h2>6. Data security</h2>
        <p>
          We use reasonable technical and organisational measures to protect personal information, including encrypted
          connections (HTTPS) and restricted access. However, no method of transmission or storage is completely secure,
          and we cannot guarantee absolute security.
        </p>
      </section>

      <section>
        <h2>7. Data retention</h2>
        <p>
          We retain personal information for as long as needed for the purposes described in this Policy, including to
          meet legal, accounting and tax requirements. When information is no longer required, it is deleted or
          anonymised.
        </p>
      </section>

      <section>
        <h2>8. Your rights</h2>
        <p>
          Subject to applicable law, you may request access to, correction of, or deletion of your personal information,
          or the removal of your listing, by contacting us. Some information may need to be retained where required by
          law.
        </p>
      </section>

      <section>
        <h2>9. Changes to this Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Changes will be posted on this page with a new "Last
          updated" date.
        </p>
      </section>

      <section>
        <h2>10. Contact and grievances</h2>
        <p>For any question, request or grievance relating to your personal information, please contact us.</p>
        <Contact />
      </section>
    </Doc>
  );
}
