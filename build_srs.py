#!/usr/bin/env python3
"""Generate client-facing SRS PDF for Invoice & Expense Management System."""
from fpdf import FPDF

BLUE = (25, 65, 120)
DARK = (30, 30, 30)
GRAY = (110, 110, 110)
LIGHT_BG = (235, 240, 248)
WHITE = (255, 255, 255)

class SRS(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("DejaVu", "", 8)
        self.set_text_color(*GRAY)
        self.cell(0, 8, "Invoice & Expense Management System  |  SRS v1.2 (Draft)", align="L")
        self.cell(0, 8, f"Page {self.page_no()}", align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*BLUE)
        self.set_line_width(0.4)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)

    def footer(self):
        if self.page_no() == 1:
            return
        self.set_y(-15)
        self.set_font("DejaVu", "", 8)
        self.set_text_color(*GRAY)
        self.cell(0, 10, "DRAFT -- Pending Client Confirmation", align="C")

    def section(self, num, title):
        self.ln(4)
        self.set_font("DejaVu", "B", 13)
        self.set_text_color(*BLUE)
        self.cell(0, 9, f"{num}.  {title}", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*BLUE)
        self.set_line_width(0.6)
        self.line(self.l_margin, self.get_y(), self.l_margin + 150, self.get_y())
        self.ln(3)
        self.set_text_color(*DARK)

    def body(self, text):
        self.set_font("DejaVu", "", 10.5)
        self.set_text_color(*DARK)
        self.multi_cell(0, 6, text)
        self.ln(1)

    def bullet(self, text, bold_lead=None):
        self.set_font("DejaVu", "", 10.5)
        self.set_text_color(*DARK)
        x = self.get_x()
        self.cell(6, 6, "*")
        if bold_lead:
            self.set_font("DejaVu", "B", 10.5)
            self.write(6, bold_lead + " ")
            self.set_font("DejaVu", "", 10.5)
        self.multi_cell(0, 6, text)
        self.ln(1)

    def req_table(self, rows, widths, header=True):
        self.set_font("DejaVu", "B", 10)
        self.set_fill_color(*BLUE)
        self.set_text_color(*WHITE)
        if header:
            for w, h in zip(widths, rows[0]):
                self.cell(w, 8, h, border=1, fill=True, align="C")
            self.ln()
            rows = rows[1:]
        fill = False
        for row in rows:
            self.set_font("DejaVu", "B", 10)
            self.set_text_color(*DARK)
            max_h = 8
            # compute row height
            col_texts = []
            for w, txt in zip(widths, row):
                self.set_font("DejaVu", "", 10)
                lines = self.multi_cell(w, 6, txt, dry_run=True, output="LINES")
                col_texts.append((txt, len(lines)))
                max_h = max(max_h, len(lines) * 6)
            self.set_fill_color(*LIGHT_BG) if fill else self.set_fill_color(*WHITE)
            x0 = self.get_x()
            y0 = self.get_y()
            for i, (w, txt) in enumerate(zip(widths, row)):
                self.set_xy(x0 + sum(widths[:i]), y0)
                self.set_font("DejaVu", "B" if i == 0 else "", 10)
                self.multi_cell(w, 6, txt, border=1, fill=True)
            self.set_xy(x0, y0 + max_h)
            fill = not fill
        self.ln(3)


pdf = SRS(format="A4")
pdf.set_margins(20, 18, 20)
pdf.set_auto_page_break(True, 20)
pdf.add_font("DejaVu", "", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
pdf.add_font("DejaVu", "B", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")

# ---------------- COVER ----------------
pdf.add_page()
pdf.ln(28)
pdf.set_font("DejaVu", "B", 26)
pdf.set_text_color(*BLUE)
pdf.multi_cell(0, 12, "Invoice & Expense\nManagement System", align="C")
pdf.ln(4)
pdf.set_font("DejaVu", "", 14)
pdf.set_text_color(*GRAY)
pdf.cell(0, 9, "Software Requirements Specification (SRS)", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(10)
pdf.set_draw_color(*BLUE)
pdf.set_line_width(0.8)
pdf.line(60, pdf.get_y(), pdf.w - 60, pdf.get_y())
pdf.ln(10)

meta = [
    ("Prepared for", "[ Client Name ]"),
    ("Prepared by", "Alok  --  ABWcurious (OPC) Pvt. Ltd."),
    ("Date", "23 September 2026"),
    ("Version", "1.2 (Draft)"),
    ("Status", "Pending Client Confirmation"),
]
pdf.set_font("DejaVu", "", 11)
for k, v in meta:
    pdf.set_text_color(*GRAY)
    pdf.set_font("DejaVu", "B", 11)
    pdf.cell(45, 9, k, align="R")
    pdf.set_font("DejaVu", "", 11)
    pdf.set_text_color(*DARK)
    pdf.cell(0, 9, "   " + v, new_x="LMARGIN", new_y="NEXT")
pdf.ln(14)
pdf.set_font("DejaVu", "", 10)
pdf.set_text_color(*GRAY)
pdf.multi_cell(0, 6,
    "This document captures the requirements discussed on 22 September 2026,\n"
    "updated on 23 September 2026 (v1.2: daily email volume requirement and login page added).\n"
    "Please review, confirm each requirement, answer the open questions in Section 9,\n"
    "and add anything missed in Section 10 before sign-off.",
    align="C")

# ---------------- 1. INTRODUCTION ----------------
pdf.add_page()
pdf.section("1", "Introduction")
pdf.body(
    "The purpose of this document is to record the complete set of requirements for the "
    "proposed Invoice & Expense Management System, so that both parties share the same "
    "understanding before design and development begin. Nothing in this document is final "
    "until the client reviews, corrects, and confirms it."
)

# ---------------- 2. PROJECT OVERVIEW ----------------
pdf.section("2", "Project Overview")
pdf.body(
    "The client receives vendor invoices over email and manages event / training related "
    "expenses such as hotel bookings, flights, visas and food. This work is currently done "
    "manually, which causes delays, missed bills and no single view of spending. "
    "A centralized system is required that automatically captures invoices from email, "
    "routes them for verification and approval, manages purchase orders, tracks expenses "
    "event-wise, and provides clear reports on pending and delayed items."
)

# ---------------- 3. OBJECTIVES ----------------
pdf.section("3", "Objectives")
for t in [
    "Automatically capture vendor invoices received over email into one system.",
    "Route every invoice to the right person for verification and approval without manual follow-ups.",
    "Manage the full cycle: Purchase Order -> Bill receipt -> Approval -> Ready for payment.",
    "Track all expenses of a single event or training in one place.",
    "Give real-time visibility through a dashboard: what came in, what is pending, what is delayed and with whom.",
    "Reduce manual effort, errors and payment delays.",
]:
    pdf.bullet(t)

# ---------------- 4. SCOPE ----------------
pdf.section("4", "Scope")
pdf.set_font("DejaVu", "B", 11)
pdf.set_text_color(*DARK)
pdf.cell(0, 8, "In Scope (Phase 1)", new_x="LMARGIN", new_y="NEXT")
for t in [
    "Email-based invoice capture and data extraction",
    "Auto-assignment and approval workflow",
    "Purchase order creation, approval and invoice matching",
    "Event-wise expense tracking and budget reports",
    "Dashboard, pending reports and notifications",
    "Role-based user access",
]:
    pdf.bullet(t)
pdf.set_font("DejaVu", "B", 11)
pdf.cell(0, 8, "Out of Scope / Phase 2 (to be taken up later)", new_x="LMARGIN", new_y="NEXT")
for t in [
    "Bulk payment file upload and bank integration",
    "Integration with external accounting software (Tally etc.) -- to be decided",
    "Mobile app (web application will be mobile-friendly)",
]:
    pdf.bullet(t)

# ---------------- 5. FUNCTIONAL REQUIREMENTS ----------------
pdf.section("5", "Functional Requirements")
fr = [
    ("ID", "Requirement", "Description"),
    ("FR-01", "Email-based invoice capture",
     "System monitors a designated email inbox, picks up invoice attachments (PDF), "
     "extracts vendor name, invoice number, invoice date and amount, and stores them in the database. "
     "Duplicate invoices are flagged. The inbox receives roughly 1,000-1,200 emails per day "
     "during working hours; the system polls it every few minutes, pre-filters invoice "
     "candidates (attachment type + invoice keywords) before extraction, and ignores duplicates."),
    ("FR-02", "Auto-assignment & routing",
     "Every captured invoice is automatically assigned to the concerned person / team "
     "based on predefined rules (e.g. vendor, category, event). Assignee gets notified."),
    ("FR-03", "Invoice verification & approval",
     "The checker verifies bill number, vendor details and amount. Invoice can be Approved "
     "or Rejected with remarks. Rejected invoices go back for correction with full history."),
    ("FR-04", "Purchase order management",
     "Users can create a Purchase Order, which goes to the manager for approval. "
     "Approved POs are locked; any change creates a tracked amendment."),
    ("FR-05", "PO - invoice matching",
     "When a bill arrives against a PO, the system matches them (PO vs invoice). "
     "Mismatches in amount or quantity are highlighted before approval."),
    ("FR-06", "Event-wise expense tracking",
     "Events / trainings can be created in the system. Every bill or expense (hotel, flight, "
     "visa, food, etc.) is tagged to one event, giving a complete per-event cost break-up."),
    ("FR-07", "Budget & spend tracking",
     "Total spend views: per event, per category, per month and per year "
     "(\u201chow much did we spend this year\u201d)."),
    ("FR-08", "Dashboard & reports",
     "Live dashboard showing: invoices received, POs raised, invoices approved, invoices pending, "
     "pending items by stage, and delayed items with the person responsible. Reports are exportable."),
    ("FR-09", "User roles & access control",
     "Role-based access: Admin, Manager / Approver, Finance / Checker, Viewer. "
     "Only authorized roles can approve; everyone sees only what their role permits. "
     "New user onboarding follows the maker-checker rule defined in FR-10."),
    ("FR-10", "User onboarding & credential control",
     "Every user logs in with a username and password; there is no self-registration. "
     "Only a Manager can create (propose) a new user. Every new user must be approved by the Admin. "
     "After approval, the Admin generates the username and password and shares them with the user. "
     "Rejected user requests are sent back with remarks and full history."),
    ("FR-11", "Login page (first page of the system)",
     "The first page of the system is a Login page. Users sign in with their username and password "
     "(generated by the Admin as per FR-10; there is no self-registration and no public sign-up link). "
     "After a successful login, each user lands on the dashboard matching their role "
     "(Admin / Manager / Finance / Viewer). Wrong passwords show a clear error message; "
     "an account is locked after repeated failed attempts and can be unlocked by the Admin."),
]
pdf.req_table(fr, [18, 42, 110])

# ---------------- 6. WORKFLOWS ----------------
pdf.section("6", "Key Workflows")
pdf.set_font("DejaVu", "B", 11)
pdf.cell(0, 8, "Workflow A -- Invoice approval", new_x="LMARGIN", new_y="NEXT")
pdf.body("Email received  ->  Invoice auto-captured  ->  Auto-assigned to checker  ->  "
         "Verified (details checked)  ->  Approved / Rejected  ->  Ready for payment")
pdf.set_font("DejaVu", "B", 11)
pdf.cell(0, 8, "Workflow B -- Purchase order cycle", new_x="LMARGIN", new_y="NEXT")
pdf.body("PO created  ->  Manager approval  ->  PO issued to vendor  ->  "
         "Bill received  ->  Matched with PO  ->  Approved  ->  Ready for payment")
pdf.set_font("DejaVu", "B", 11)
pdf.cell(0, 8, "Workflow C -- User onboarding (maker-checker)", new_x="LMARGIN", new_y="NEXT")
pdf.body("Manager creates new user  ->  Admin approves / rejects  ->  "
         "Admin generates username & password  ->  Credentials shared with the user")
pdf.set_font("DejaVu", "B", 11)
pdf.cell(0, 8, "Workflow D -- Login & access", new_x="LMARGIN", new_y="NEXT")
pdf.body("Login page (first page)  ->  Username + password  ->  Role identified  ->  "
         "Role-based dashboard (Admin / Manager / Finance / Viewer)")

# ---------------- 7. NON-FUNCTIONAL ----------------
pdf.section("7", "Non-Functional Requirements")
for code, t in [
    ("NFR-01  Usability: ", "Simple, clean web interface; usable on mobile browsers."),
    ("NFR-02  Security: ", "Secure login; role-based access; client data kept private and never shared."),
    ("NFR-03  Notifications: ", "Email alerts on new assignment, approval, rejection and long-pending items."),
    ("NFR-04  Data safety: ", "Regular backups; full history / audit trail of every approval action."),
    ("NFR-05  Performance: ", "Dashboard and reports load quickly even with large invoice volumes."),
    ("NFR-06  Email scale: ", "Handles 1,000-1,200 incoming emails per day during working hours: "
     "polls the mailbox every few minutes, pre-filters invoice candidates before extraction, "
     "and skips duplicates without creating repeat entries."),
]:
    pdf.bullet(t, bold_lead=code)

# ---------------- 8. ASSUMPTIONS ----------------
pdf.section("8", "Assumptions")
for t in [
    "Vendor invoices arrive as PDF attachments on one designated email ID. That inbox receives "
    "roughly 1,000-1,200 emails per day during working hours; only a part of these are invoices.",
    "Approval hierarchy and approver names will be confirmed by the client (see Section 9).",
    "One invoice belongs to one event / category; split billing rules to be confirmed if needed.",
    "Phase 1 is a web application; no native mobile app.",
]:
    pdf.bullet(t)

# ---------------- 9. OPEN QUESTIONS ----------------
pdf.section("9", "Open Questions for the Client")
pdf.body("Please write your answers in the right-hand column. These are needed before development starts.")
qs = [
    ("#", "Question", "Client Response"),
    ("Q1", "Which email ID should the system monitor for incoming vendor invoices?",
     ""),
    ("Q2", "How many approval levels are needed, and who are the approvers at each level?",
     ""),
    ("Q3", "How are bills and expenses currently tracked (Tally / Excel / other)? Is any integration needed?",
     ""),
    ("Q4", "For PO-invoice matching: should amounts match exactly, or is a small tolerance acceptable?",
     ""),
    ("Q5", "Who should receive delay / escalation alerts for long-pending invoices?",
     ""),
    ("Q6", "Are any specific report formats or exports required (Excel / PDF)?",
     ""),
]
pdf.req_table(qs, [14, 88, 68])

# ---------------- 10. MISSED REQUIREMENTS ----------------
pdf.section("10", "Anything Missed? (Client to fill)")
pdf.body(
    "If any requirement discussed is missing from this document, or you want to add / change "
    "something, please write it below. Use extra sheets if needed."
)
pdf.set_font("DejaVu", "", 10.5)
pdf.set_text_color(*GRAY)
for i in range(1, 9):
    pdf.cell(8, 9, f"{i}.")
    pdf.set_draw_color(170, 170, 170)
    y = pdf.get_y() + 8
    pdf.line(pdf.get_x(), y, pdf.w - pdf.r_margin, y)
    pdf.ln(9)
pdf.set_text_color(*DARK)

# ---------------- 11. SIGN-OFF ----------------
pdf.section("11", "Confirmation & Sign-off")
pdf.body(
    "I have reviewed this document. The requirements listed above are complete and correct "
    "to the best of my knowledge, along with my answers and additions noted in Sections 9 and 10. "
    "Development may proceed on this basis; any further change will be treated as a new requirement."
)
pdf.ln(6)
pdf.set_font("DejaVu", "", 11)
for label in ["Name", "Signature", "Date"]:
    pdf.set_text_color(*GRAY)
    pdf.set_font("DejaVu", "B", 11)
    pdf.cell(30, 10, label)
    pdf.set_draw_color(120, 120, 120)
    y = pdf.get_y() + 9
    pdf.line(pdf.get_x(), y, pdf.get_x() + 90, y)
    pdf.ln(12)

out = "/home/hatch/workspace/your_files/Invoice-Expense-Management-SRS-v1.2.pdf"
pdf.output(out)
print("SAVED", out)
