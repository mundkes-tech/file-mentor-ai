import JSZip from "jszip";
import fs from "fs/promises";
import path from "path";

/**
 * Creates a valid DOCX buffer from an array of paragraphs.
 */
export async function createDocxBufferFromParagraphs(paragraphs) {
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  const xmlParagraphs = paragraphs
    .map((p) => {
      // Escape XML characters
      const escaped = p
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<w:p><w:r><w:t>${escaped}</w:t></w:r></w:p>`;
    })
    .join("\n    ");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${xmlParagraphs}
  </w:body>
</w:document>`;

  zip.file("word/document.xml", documentXml);

  return await zip.generateAsync({ type: "nodebuffer" });
}

/**
 * Generates Document A: Master Services Agreement (~10 pages, rich legal provisions)
 */
export async function generateMasterServicesAgreement() {
  const paras = [
    "MASTER SERVICES AGREEMENT",
    "This Master Services Agreement ('Agreement') is entered into as of January 15, 2026, by and between Apex Global Solutions Inc. ('Customer') and Vertex Cloud Systems LLC ('Provider').",
    "SECTION 1. DEFINITIONS",
    "1.1 'Confidential Information' means all non-public information disclosed by either party, including source code, customer lists, and financial reports.",
    "1.2 'Service Level Target' means 99.9% uptime during each calendar month.",
    "SECTION 2. SCOPE OF SERVICES",
    "Provider shall deliver managed enterprise infrastructure and continuous cloud orchestration services as detailed in applicable Statements of Work.",
    "SECTION 3. PAYMENT TERMS AND INVOICING",
    "Customer shall pay all undisputed invoices within forty-five (45) calendar days from receipt of invoice. Late payments accrue interest at 1.5% per month.",
    "SECTION 4. INTELLECTUAL PROPERTY RIGHTS",
    "Customer retains exclusive title and ownership in all Customer Data. Provider retains all rights in its pre-existing proprietary platform architecture.",
    "SECTION 5. CONFIDENTIALITY AND NON-DISCLOSURE",
    "Each party agrees to hold all Confidential Information of the other party in strict confidence and prevent unauthorized disclosure using reasonable care.",
    "SECTION 6. DATA SECURITY AND PRIVACY",
    "Provider shall implement administrative, technical, and physical safeguards meeting SOC 2 Type II criteria and 256-bit encryption for data in transit and at rest.",
    "SECTION 7. INDEMNIFICATION AND WARRANTIES",
    "Provider shall indemnify, defend, and hold harmless Customer against third-party claims alleging that the cloud services infringe any registered patent or copyright.",
    "SECTION 8. LIMITATION OF LIABILITY",
    "Except for gross negligence or willful misconduct, neither party's aggregate liability under this agreement shall exceed five million dollars ($5,000,000).",
    "SECTION 9. TERM AND TERMINATION",
    "Either party may terminate this agreement for convenience upon sixty (60) days prior written notice to the other party. In the event of material breach, the non-breaching party may terminate immediately if uncured after thirty (30) days.",
    "SECTION 10. GOVERNING LAW AND DISPUTE RESOLUTION",
    "This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to conflicts of law principles."
  ];

  return createDocxBufferFromParagraphs(paras);
}

/**
 * Generates Document B: Isolated Consulting Agreement (for document isolation testing)
 */
export async function generateConsultingAgreement() {
  const paras = [
    "INDEPENDENT CONSULTING AGREEMENT",
    "This Agreement is between Stratosphere Advisory Group and Pacific Technologies Corp.",
    "SECTION 1. ENGAGEMENT AND ADVISORY SCOPE",
    "Consultant shall provide strategic advisory services on European corporate restructuring.",
    "SECTION 2. CONSULTING FEES",
    "Client shall pay a flat retainer fee of $25,000 per month.",
    "SECTION 3. CONSULTING TERMINATION",
    "This consulting agreement terminates automatically on December 31, 2026, unless renewed in writing.",
    "SECTION 4. JURISDICTION",
    "This consulting agreement is governed by the laws of California and San Francisco venue."
  ];

  return createDocxBufferFromParagraphs(paras);
}

/**
 * Generates a realistic 150-page enterprise contract (~150 distinct pages of legal provisions).
 * Explicitly features:
 * - Early clause on Page 2: "Licensee is granted an exclusive enterprise license"
 * - Mid clause on Page 75: "Vendor shall maintain SOC2 Type II compliance and 256-bit encryption"
 * - Late/Deep clause on Page 142: "Contractor shall pay liquidated damages of $15,000 per business day for migration delay"
 */
export async function generate150PageContract() {
  const paras = [];

  paras.push("ENTERPRISE GLOBAL TECHNOLOGY AND TRANSFORMATION MASTER AGREEMENT");
  paras.push("This comprehensive multi-year enterprise transformation agreement is executed between OmniCorp Global Enterprises and HyperScale Infrastructure Partners.");

  // Each page target is ~2000-2400 chars. We create 150 pages with distinct, structured legal sections.
  for (let page = 1; page <= 150; page++) {
    const sectionNum = page;
    let sectionTitle = `SECTION ${sectionNum}. COVENANTS AND OPERATIONAL PROVISIONS OF ARTICLE ${sectionNum}`;
    let body = `This provision governs the operational covenants and responsibilities applicable to Article ${sectionNum}. Under the terms of this operational segment, each designated party agrees to adhere to enterprise security guidelines, architectural benchmarks, and regulatory compliance standards established herein. `;

    // Inject notable distinct provisions at specific pages for testing:
    if (page === 2) {
      sectionTitle = "SECTION 2. EXCLUSIVE TECHNOLOGY LICENSE GRANT";
      body = "Licensee is granted an exclusive worldwide enterprise license to deploy, execute, and integrate the proprietary neural processing engine across all global subsidiaries without user seat caps. ";
    } else if (page === 75) {
      sectionTitle = "SECTION 75. ADVANCED DATA SECURITY AND AUDIT CONTROLS";
      body = "Vendor shall maintain SOC2 Type II compliance and 256-bit encryption across all storage clusters and undergo annual independent third-party penetration testing with immediate vulnerability reporting. ";
    } else if (page === 142) {
      sectionTitle = "SECTION 142. LIQUIDATED DAMAGES FOR DELAYED MIGRATION";
      body = "Contractor shall pay liquidated damages of $15,000 per business day for migration delay beyond the agreed cutover deadline, capped at a maximum of three million dollars. ";
    } else if (page === 149) {
      sectionTitle = "SECTION 149. DISASTER RECOVERY RECOVERY TIME OBJECTIVE";
      body = "The secondary failover site must achieve a Recovery Time Objective of less than fifteen minutes and Recovery Point Objective of zero data loss under all catastrophe scenarios. ";
    }

    // Pad out the body so that each page contains ~2200 characters of realistic legal text
    const padding = `The parties acknowledge that compliance with Section ${sectionNum} is a material condition of this agreement. Any failure to uphold the covenants under this subsection shall constitute an operational incident subject to the remediation protocols detailed in Schedule B. All documentation and audit logs associated with this article shall be preserved for a statutory retention period of seven years. All audits must be conducted during normal business hours with fifteen days advance notice. `.repeat(4);

    paras.push(sectionTitle);
    paras.push(body + padding);
  }

  paras.push("SECTION 151. EXECUTION AND SIGNATURES");
  paras.push("IN WITNESS WHEREOF, the authorized signatories of OmniCorp Global Enterprises and HyperScale Infrastructure Partners have executed this 150-Page Enterprise Agreement.");

  return createDocxBufferFromParagraphs(paras);
}

// Standalone execution script to generate sample test files if run directly
if (process.argv[1]?.endsWith("generate-test-contracts.mjs")) {
  async function main() {
    const testDir = path.resolve(process.cwd(), "uploads", "test-docs");
    await fs.mkdir(testDir, { recursive: true });

    console.log("Generating Master Services Agreement...");
    const msa = await generateMasterServicesAgreement();
    await fs.writeFile(path.join(testDir, "Master_Services_Agreement.docx"), msa);

    console.log("Generating Consulting Agreement...");
    const ca = await generateConsultingAgreement();
    await fs.writeFile(path.join(testDir, "Consulting_Agreement.docx"), ca);

    console.log("Generating 150-Page Enterprise Contract...");
    const l150 = await generate150PageContract();
    await fs.writeFile(path.join(testDir, "Enterprise_Master_150Page.docx"), l150);

    console.log(`Generated all test contracts successfully in: ${testDir}`);
  }

  main().catch(console.error);
}
