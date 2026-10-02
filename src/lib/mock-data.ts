import { ExtractedDocument } from "@/types";

export const MOCK_DOCUMENTS: ExtractedDocument[] = [
  {
    metadata: {
      id: "doc-sample-1",
      name: "Master Services Agreement (Acme & Apex)",
      originalFilename: "MSA_Acme_Apex_2024_Final.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1845200,
      pageCount: 24,
      uploadedAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
      status: "ready",
      clauseCount: 14,
      parties: ["Acme Innovations Inc.", "Apex Enterprise Technologies LLC"],
      effectiveDate: "2024-03-15",
      expirationDate: "2027-03-14",
      summary:
        "Comprehensive professional services framework governing cloud migration, deliverables acceptance, IP ownership, and indemnification caps.",
    },
    fullText: `MASTER SERVICES AGREEMENT

This Master Services Agreement ("Agreement") is entered into as of March 15, 2024 ("Effective Date"), by and between Acme Innovations Inc., a Delaware corporation with its principal place of business at 100 Tech Boulevard, San Francisco, CA ("Client"), and Apex Enterprise Technologies LLC, a Delaware limited liability company with its principal place of business at 500 Market Plaza, New York, NY ("Service Provider").

RECITALS
WHEREAS, Service Provider specializes in cloud architecture consulting and software implementation services; and
WHEREAS, Client desires to retain Service Provider to perform certain professional services described in one or more Statements of Work ("SOW");
NOW, THEREFORE, in consideration of the mutual covenants herein contained, the parties agree as follows:

1. DEFINITIONS AND STATEMENTS OF WORK
1.1 "Deliverables" means all work product, source code, scripts, technical specifications, and documentation created or delivered by Service Provider specifically for Client under an SOW.
1.2 Statements of Work shall describe the scope of work, project milestones, deliverable specifications, fee schedule, and designated project managers. In the event of a direct conflict between the terms of this Agreement and an SOW, this Agreement shall prevail unless the SOW explicitly identifies the section to be superseded.

2. FEES, INVOICING, AND PAYMENT TERMS
2.1 Client agrees to compensate Service Provider for services performed pursuant to each SOW. Unless otherwise specified in an SOW, all invoices are due and payable thirty (30) calendar days from receipt of a valid and undisputed invoice ("Net 30").
2.2 Disputed charges must be identified in writing by Client within ten (10) business days of receipt, detailing the specific line items and justification. The undisputed portion of any invoice shall remain payable under the original schedule.

3. INTELLECTUAL PROPERTY RIGHTS
3.1 Client Ownership of Deliverables. Upon full payment of all applicable fees, Service Provider hereby assigns to Client all right, title, and interest worldwide in and to the custom Deliverables created under each SOW, including all copyright, patent, trademark, and trade secret rights therein.
3.2 Service Provider Pre-Existing IP. Service Provider retains all right, title, and interest in and to its pre-existing tools, libraries, methodologies, frameworks, and generic know-how ("Background Materials"). To the extent Background Materials are embedded within any Deliverable, Service Provider grants Client a perpetual, irrevocable, worldwide, non-exclusive, fully paid-up license to use, reproduce, modify, and display such Background Materials solely as integrated into the Deliverables.

4. CONFIDENTIALITY AND DATA PROTECTION
4.1 "Confidential Information" means all non-public information disclosed by either party ("Disclosing Party") to the other ("Receiving Party"), whether orally or in writing, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information.
4.2 Standard of Care. The Receiving Party shall exercise the same degree of care it protects its own confidential materials (but not less than reasonable care) and shall not disclose Confidential Information to any third party except to its employees, contractors, and legal advisors who have a strict need-to-know and are bound by confidentiality obligations at least as restrictive as those herein.
4.3 Exclusions. Confidential Information does not include information that: (a) is or becomes publicly available without breach of this Agreement; (b) was known to Receiving Party prior to disclosure without restriction; or (c) is independently developed by Receiving Party without reference to or reliance upon Disclosing Party's Confidential Information.

5. INDEMNIFICATION
5.1 Service Provider Indemnity. Service Provider shall defend, indemnify, and hold harmless Client, its affiliates, directors, and officers against any third-party claims, damages, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or resulting from an allegation that any Deliverable infringes, misappropriates, or violates any third party's valid patent, copyright, trademark, or trade secret.
5.2 Client Indemnity. Client shall defend, indemnify, and hold harmless Service Provider from and against any third-party claims arising out of: (a) Client Data or Client-provided materials; or (b) Client's gross negligence or willful misconduct.
5.3 Indemnification Procedure. The indemnified party must: (i) provide prompt written notice of any claim; (ii) grant the indemnifying party sole control over defense and settlement; and (iii) provide reasonable cooperation at the indemnifying party's expense.

6. LIMITATION OF LIABILITY
6.1 Consequential Damages Waiver. TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY SHALL BE LIABLE TO THE OTHER FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING LOSS OF PROFITS, DATA, BUSINESS INTERRUPTION, OR REPUTATIONAL HARM, REGARDLESS OF WHETHER SUCH PARTY WAS ADVISED OF THE POSSIBILITY OF SUCH LOSS.
6.2 Aggregate Liability Cap. EXCEPT FOR (A) BREACH OF SECTION 4 (CONFIDENTIALITY), (B) INDEMNIFICATION OBLIGATIONS UNDER SECTION 5, OR (C) WILLFUL MISCONDUCT OR FRAUD, EACH PARTY'S TOTAL AGGREGATE LIABILITY ARISING UNDER OR RELATED TO THIS AGREEMENT SHALL BE STRICTLY LIMITED TO THE TOTAL FEES PAID OR PAYABLE BY CLIENT UNDER THE APPLICABLE SOW DURING THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO LIABILITY.

7. TERM AND TERMINATION
7.1 Term. This Agreement shall commence on the Effective Date and remain in effect for three (3) years, unless terminated earlier in accordance with this Section 7.
7.2 Termination for Convenience. Client may terminate this Agreement or any individual SOW without cause upon forty-five (45) calendar days' prior written notice to Service Provider. Client shall pay for all authorized services rendered through the effective date of termination.
7.3 Termination for Cause. Either party may terminate this Agreement immediately upon written notice if the other party: (a) materially breaches any provision of this Agreement and fails to cure such breach within thirty (30) days of receiving written notice; or (b) becomes insolvent, makes an assignment for the benefit of creditors, or files for bankruptcy.

8. GOVERNING LAW AND DISPUTE RESOLUTION
8.1 Governing Law. This Agreement shall be governed by, construed, and enforced in accordance with the laws of the State of Delaware, without giving effect to its conflict of law principles.
8.2 Dispute Resolution. Any dispute, claim, or controversy arising out of or relating to this Agreement shall first be submitted to senior executive mediation for a period of thirty (30) days. If unresolved, the dispute shall be resolved through binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules in Wilmington, Delaware.`,
    clauses: [
      {
        id: "c-1",
        title: "Client Ownership of Deliverables",
        category: "intellectual_property",
        text: "Upon full payment of all applicable fees, Service Provider hereby assigns to Client all right, title, and interest worldwide in and to the custom Deliverables created under each SOW...",
        pageNumber: 3,
        startOffset: 1240,
        endOffset: 1540,
        riskLevel: "low",
        summary: "Full IP assignment to client contingent on fee settlement.",
      },
      {
        id: "c-2",
        title: "IP Infringement Indemnity",
        category: "indemnity",
        text: "Service Provider shall defend, indemnify, and hold harmless Client, its affiliates, directors, and officers against any third-party claims arising out of or resulting from an allegation that any Deliverable infringes any valid patent, copyright, trademark, or trade secret.",
        pageNumber: 5,
        startOffset: 2480,
        endOffset: 2890,
        riskLevel: "medium",
        summary: "Standard defense and indemnification against third-party IP claims.",
      },
      {
        id: "c-3",
        title: "Aggregate Liability Cap & Exclusions",
        category: "liability",
        text: "EXCEPT FOR (A) BREACH OF SECTION 4 (CONFIDENTIALITY), (B) INDEMNIFICATION OBLIGATIONS UNDER SECTION 5, OR (C) WILLFUL MISCONDUCT OR FRAUD, EACH PARTY'S TOTAL AGGREGATE LIABILITY SHALL BE STRICTLY LIMITED TO THE TOTAL FEES PAID OR PAYABLE... DURING THE TWELVE (12) MONTHS PRECEDING THE EVENT.",
        pageNumber: 6,
        startOffset: 3120,
        endOffset: 3580,
        riskLevel: "high",
        summary: "12-month trailing fee cap with notable uncapped carve-outs for confidentiality and indemnity.",
      },
      {
        id: "c-4",
        title: "Termination for Convenience (45-Day Notice)",
        category: "termination",
        text: "Client may terminate this Agreement or any individual SOW without cause upon forty-five (45) calendar days' prior written notice to Service Provider.",
        pageNumber: 7,
        startOffset: 3840,
        endOffset: 4050,
        riskLevel: "low",
        summary: "Client possesses unilateral right to terminate with 45 days written notice.",
      },
      {
        id: "c-5",
        title: "Delaware Governing Law & AAA Arbitration",
        category: "governing_law",
        text: "This Agreement shall be governed by Delaware law. Disputes shall first be submitted to 30-day senior executive mediation, followed by binding AAA arbitration in Wilmington, Delaware.",
        pageNumber: 8,
        startOffset: 4320,
        endOffset: 4610,
        riskLevel: "low",
        summary: "Delaware law governs with mandatory mediation and AAA arbitration venue.",
      },
    ],
  },
  {
    metadata: {
      id: "doc-sample-2",
      name: "Enterprise SaaS License Agreement",
      originalFilename: "CloudScale_Enterprise_SLA_v4.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 840500,
      pageCount: 16,
      uploadedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      status: "ready",
      clauseCount: 9,
      parties: ["CloudScale Systems Inc.", "Nova Logistics Global"],
      effectiveDate: "2024-05-01",
      expirationDate: "2025-04-30",
      summary:
        "Subscription software agreement including 99.9% uptime SLA commitments, service credits, data export windows, and automatic renewal terms.",
    },
    fullText: `ENTERPRISE SOFTWARE-AS-A-SERVICE (SAAS) AGREEMENT

This Enterprise SaaS Agreement ("Agreement") is dated May 1, 2024, between CloudScale Systems Inc. ("Vendor") and Nova Logistics Global ("Subscriber").

1. SUBSCRIPTION GRANT AND ACCESS
Vendor grants Subscriber a non-exclusive, non-transferable right to access and use the CloudScale Enterprise Platform during the Subscription Term solely for Subscriber's internal business operations.

2. SERVICE LEVEL AGREEMENT (SLA) & UPTIME COMMITMENT
2.1 Uptime Commitment. Vendor shall provide 99.9% Monthly Uptime Percentage, excluding scheduled maintenance windows announced at least 72 hours in advance.
2.2 Service Credits. If uptime falls below 99.9% in any calendar month, Subscriber's sole remedy shall be a service credit equal to 10% of that month's subscription fee, escalating to 25% for uptime below 99.0%.

3. AUTO-RENEWAL AND CANCELLATION
This Agreement shall automatically renew for successive twelve (12) month terms unless either party gives written notice of non-renewal at least sixty (60) days prior to the expiration of the then-current term. Fee increases upon renewal shall not exceed 5% annually.`,
    clauses: [
      {
        id: "c-201",
        title: "99.9% Service Level Commitment",
        category: "warranty",
        text: "Vendor shall provide 99.9% Monthly Uptime Percentage, excluding scheduled maintenance windows announced at least 72 hours in advance.",
        pageNumber: 3,
        startOffset: 450,
        endOffset: 650,
        riskLevel: "medium",
        summary: "High availability tier with service credits as sole financial remedy.",
      },
      {
        id: "c-202",
        title: "60-Day Auto-Renewal Window",
        category: "termination",
        text: "This Agreement shall automatically renew for successive twelve (12) month terms unless either party gives written notice of non-renewal at least sixty (60) days prior...",
        pageNumber: 4,
        startOffset: 890,
        endOffset: 1140,
        riskLevel: "high",
        summary: "Strict 60-day advance notice requirement to prevent automatic 1-year renewal.",
      },
    ],
  },
  {
    metadata: {
      id: "doc-sample-3",
      name: "Mutual Non-Disclosure Agreement (Draft)",
      originalFilename: "Standard_Mutual_NDA_Template.pdf",
      mimeType: "application/pdf",
      sizeBytes: 312000,
      pageCount: 4,
      uploadedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      status: "ready",
      clauseCount: 6,
      parties: ["Nexus Cybernetics", "Horizon Robotics"],
      effectiveDate: "2024-09-01",
      expirationDate: "2026-09-01",
      summary:
        "Bilateral NDA safeguarding technical trade secrets, source code algorithms, and business negotiations for 24 months.",
    },
    fullText: `MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement ("Agreement") is made between Nexus Cybernetics and Horizon Robotics ("Parties").

1. SCOPE AND DEFINITION
Confidential Information includes technical, proprietary, and commercial information disclosed in connection with exploring a potential joint venture.

2. TERM OF OBLIGATION
Obligations of confidentiality shall survive for two (2) years following the date of disclosure; provided that Trade Secrets shall be preserved indefinitely.

3. REMEDIES FOR BREACH
Money damages may be inadequate to remedy a breach. The non-breaching party shall be entitled to seek injunctive relief without posting bond.`,
    clauses: [
      {
        id: "c-301",
        title: "Indefinite Trade Secret Protection",
        category: "confidentiality",
        text: "Obligations of confidentiality shall survive for two (2) years following disclosure; provided that Trade Secrets shall be preserved indefinitely.",
        pageNumber: 2,
        startOffset: 320,
        endOffset: 480,
        riskLevel: "low",
        summary: "Standard 2-year term with perpetual carveout for trade secrets.",
      },
    ],
  },
];
