

const API_BASE = "http://localhost:8000/api";

const state = {
  token: localStorage.getItem("token") || null,
  user: null,
  view: "dashboard",
  usersCache: [],
  codesCache: null,
};

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? "" : v)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmtRs = (n) => "Rs " + Number(n || 0).toLocaleString("en-IN");
const fmtDate = (d) => (d || "").slice(0, 10);

const badge = (status) => {
  const s = String(status || "unknown").toLowerCase();
  const cls = ["approved", "active", "pending", "pending_approval", "rejected", "locked",
               "assigned", "verified", "open"].includes(s) ? s : "";
  return `<span class="badge ${cls}">${esc(status || "unknown")}</span>`;
};


const role = () => (state.user && state.user.role) || "";
const isAdmin = () => role() === "admin";
const isManager = () => role() === "manager";
const isEmployee = () => role() === "employee";
const canManageUsers = () => isAdmin() || isManager();
const canCreateInvoice = () => ["admin", "manager", "finance", "employee"].includes(role());
const canVerifyInvoice = () => ["admin", "manager", "finance"].includes(role());
const canAssignInvoice = () => isAdmin() || isManager();
const canManagePO = () => isAdmin() || isManager();
const canManageEvents = () => isAdmin() || isManager();
const canRecordPayment = () => ["admin", "manager", "finance"].includes(role());
const canManagePayments = () => isAdmin() || isManager();
const canManageVendors = () => ["admin", "manager", "finance"].includes(role());
const canDeleteVendor = () => isAdmin() || isManager();
const canCodeInvoice = () => ["admin", "manager", "finance"].includes(role());
const canLinkEvent = () => ["admin", "manager", "finance"].includes(role());
const canManageCodes = () => isAdmin() || isManager();
const canViewAnalytics = () => ["admin", "manager", "finance"].includes(role());
const canAttachInvoice = (inv) => ["admin", "manager", "finance"].includes(role()) ||
  (isEmployee() && inv && state.user && inv.created_by_id === state.user.id);


function toast(msg, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  $("toasts").appendChild(el);
  setTimeout(() => el.remove(), 4200);
}


function openModal(title, bodyHtml) {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = bodyHtml;
  $("modal-overlay").classList.remove("hidden");
}
function closeModal() {
  $("modal-overlay").classList.add("hidden");
  $("modal-body").innerHTML = "";
}
$("modal-close").addEventListener("click", closeModal);
$("modal-overlay").addEventListener("click", (e) => {
  if (e.target === $("modal-overlay")) closeModal();
});


function openDrawer(title) {
  $("drawer-title").textContent = title;
  $("drawer").classList.remove("hidden");
  $("drawer-overlay").classList.remove("hidden");
}
function closeDrawer() {
  $("drawer").classList.add("hidden");
  $("drawer-overlay").classList.add("hidden");
}
$("drawer-close").addEventListener("click", closeDrawer);
$("drawer-overlay").addEventListener("click", closeDrawer);


async function api(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers["Authorization"] = "Bearer " + state.token;
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    return { ok: false, status: 0, data: { detail: "Network error: could not reach the server." } };
  }
  if (res.status === 401) {
    logout(true); 
    return { ok: false, status: 401, data: { detail: "Session expired. Please sign in again." } };
  }
  let data = null;
  try { data = await res.json(); } catch (e) {  }
  return { ok: res.ok, status: res.status, data: data || {} };
}

const apiErr = (r, fallback) =>
  (r.data && (r.data.detail || r.data.message)) || fallback || "Something went wrong.";


async function handleLogin(e) {
  e.preventDefault();
  const username = $("login-username").value.trim();
  const password = $("login-password").value;
  const errBox = $("login-error");
  errBox.classList.add("hidden");
  $("login-submit").disabled = true;
  try {
    const r = await api("POST", "/auth/login", { username, password });
    if (r.ok) {
      state.token = r.data.access_token;
      localStorage.setItem("token", state.token);
      state.user = r.data.user;
      enterApp();
    } else {
      
      errBox.textContent = apiErr(r, "Sign in failed.");
      errBox.classList.remove("hidden");
    }
  } finally {
    $("login-submit").disabled = false;
  }
}

function logout(silent) {
  state.token = null;
  state.user = null;
  state.usersCache = [];
  localStorage.removeItem("token");
  closeDrawer();
  closeModal();
  $("app-view").classList.add("hidden");
  $("login-view").classList.remove("hidden");
  $("login-password").value = "";
  if (!silent) toast("Signed out.", "info");
}

function enterApp() {
  $("login-view").classList.add("hidden");
  $("app-view").classList.remove("hidden");
  $("user-info").innerHTML =
    `<strong>${esc(state.user.name || state.user.username)}</strong> (${esc(state.user.role)})`;
  applyRoleVisibility();
  showView("dashboard");
}


function applyRoleVisibility() {
  $("nav-users").classList.toggle("hidden", !canManageUsers());
  $("nav-codes").classList.toggle("hidden", !canManageCodes());
  $("new-invoice-btn").classList.toggle("hidden", !canCreateInvoice());
  $("new-po-btn").classList.toggle("hidden", !canManagePO());
  $("new-event-btn").classList.toggle("hidden", !canManageEvents());
  $("bulk-upload-btn").classList.toggle("hidden", !canCreateInvoice() || isEmployee());
  $("new-payment-btn").classList.toggle("hidden", !canRecordPayment());
  $("new-vendor-btn").classList.toggle("hidden", !canManageVendors());
  $("new-code-btn").classList.toggle("hidden", !canManageCodes());
  $("role-filter-admin").classList.toggle("hidden", !isAdmin());
  const emp = isEmployee();
  document.querySelectorAll(".nav-item").forEach((b) => {
    const v = b.dataset.view;
    if (emp && !["dashboard", "invoices"].includes(v)) b.classList.add("hidden");
  });
}

$("login-form").addEventListener("submit", handleLogin);
$("logout-btn").addEventListener("click", () => logout(false));


function showView(name) {
  state.view = name;
  document.querySelectorAll(".nav-item").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  $("view-" + name).classList.remove("hidden");
  
  if (name === "dashboard") loadDashboard();
  if (name === "invoices") { loadEventFilterOptions(); loadInvoices(); }
  if (name === "pos") loadPOs();
  if (name === "events") loadEvents();
  if (name === "payments") loadPayments();
  if (name === "vendors") loadVendors();
  if (name === "codes") loadCodes();
  if (name === "users") loadUsers();
}
document.querySelectorAll(".nav-item").forEach((b) =>
  b.addEventListener("click", () => showView(b.dataset.view)));


async function loadDashboard() {
  const wrap = $("dash-cards");
  wrap.innerHTML = `<div class="card"><div class="card-label">Loading...</div></div>`;
  const r = await api("GET", "/dashboard");
  if (!r.ok) { wrap.innerHTML = ""; toast(apiErr(r, "Could not load dashboard."), "error"); return; }
  const d = r.data;
  const cards = [
    ["Pending invoices", d.pending_invoices],
    ["Delayed invoices", d.delayed_invoices],
    ["Approved this month", d.approved_this_month],
    ["Total spend (Rs)", fmtRs(d.total_spend)],
    ["Pending amount (Rs)", fmtRs(d.total_pending_amount)],
    ["Paid so far (Rs)", fmtRs(d.total_paid_amount)],
    ["Scheduled payments", d.scheduled_payments],
    ["Vendors", d.vendors],
    ["Pending user requests", d.pending_users],
    ["Open POs", d.open_pos],
  ];
  wrap.innerHTML = cards.map(([label, value]) =>
    `<div class="card"><div class="card-label">${esc(label)}</div><div class="card-value">${esc(value)}</div></div>`
  ).join("");
  if (canViewAnalytics()) {
    $("dash-employees-wrap").classList.remove("hidden");
    $("dash-vendors-wrap").classList.remove("hidden");
    loadEmployeeStats();
    loadVendorStats();
  } else {
    $("dash-employees-wrap").classList.add("hidden");
    $("dash-vendors-wrap").classList.add("hidden");
  }
}

async function loadEmployeeStats() {
  const tbody = $("emp-stats-tbody");
  const r = await api("GET", "/dashboard/employees");
  if (!r.ok) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">Could not load employee stats.</td></tr>`;
    return;
  }
  const rows = r.data;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">No employees found.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((e) => `
    <tr><td>${esc(e.name)}</td><td style="text-transform:capitalize">${esc(e.role)}</td>
    <td>${e.total}</td><td>${e.pending}</td><td>${e.approved}</td><td>${e.rejected}</td>
    <td>${fmtRs(e.total_amount)}</td></tr>`).join("");
}

let vendorSort = { by: "paid_amount", order: "desc" };

async function loadVendorStats() {
  const tbody = $("vendor-stats-tbody");
  const q = `?sort_by=${encodeURIComponent(vendorSort.by)}&order=${encodeURIComponent(vendorSort.order)}`;
  const r = await api("GET", "/dashboard/vendors" + q);
  if (!r.ok) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Could not load vendor analytics.</td></tr>`;
    return;
  }
  const rows = r.data;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">No vendors found.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((v) => `
    <tr><td><strong>${esc(v.name)}</strong></td><td>${v.invoice_count}</td>
    <td>${v.approved_count}</td><td>${v.rejected_count}</td>
    <td>${fmtRs(v.approved_amount)}</td><td>${fmtRs(v.paid_amount)}</td></tr>`).join("");
  document.querySelectorAll("[data-vsort]").forEach((th) => {
    const key = th.dataset.vsort;
    const arrow = key === vendorSort.by ? (vendorSort.order === "desc" ? " ▼" : " ▲") : "";
    th.innerHTML = th.textContent.replace(/ [▲▼]/g, "") + arrow;
  });
}

document.querySelectorAll("[data-vsort]").forEach((th) =>
  th.addEventListener("click", () => {
    const key = th.dataset.vsort;
    if (vendorSort.by === key) {
      vendorSort.order = vendorSort.order === "desc" ? "asc" : "desc";
    } else {
      vendorSort = { by: key, order: "desc" };
    }
    loadVendorStats();
  }));


let invoiceSearchTimer = null;

async function loadInvoices() {
  const status = $("invoice-status-filter").value;
  const search = $("invoice-search").value.trim();
  const eventId = $("invoice-event-filter").value;
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  if (search) q.set("search", search);
  if (eventId) q.set("event_id", eventId);
  const tbody = $("invoices-tbody");
  tbody.innerHTML = `<tr><td colspan="6" class="muted">Loading...</td></tr>`;
  const r = await api("GET", "/invoices" + (q.toString() ? "?" + q.toString() : ""));
  if (!r.ok) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Could not load invoices.</td></tr>`;
    toast(apiErr(r, "Could not load invoices."), "error");
    return;
  }
  const rows = r.data;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">No invoices found.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((inv) => `
    <tr class="row-clickable" data-id="${inv.id}">
      <td>${esc(inv.invoice_no)}</td>
      <td>${esc(inv.vendor)}</td>
      <td>${fmtRs(inv.amount)}</td>
      <td>${esc(fmtDate(inv.due_date))}</td>
      <td>${badge(inv.status)}</td>
      <td>${esc(inv.assignee_name || "-")}</td>
    </tr>`).join("");
  tbody.querySelectorAll("tr[data-id]").forEach((tr) =>
    tr.addEventListener("click", () => openInvoiceDrawer(tr.dataset.id)));
}

$("invoice-status-filter").addEventListener("change", loadInvoices);
$("invoice-event-filter").addEventListener("change", loadInvoices);
async function loadEventFilterOptions() {
  const sel = $("invoice-event-filter");
  const keep = sel.value;
  const r = await api("GET", "/events");
  sel.innerHTML = `<option value="">All events</option>` +
    (r.ok ? r.data.map((ev) => `<option value="${ev.id}">${esc(ev.name)}</option>`).join("") : "");
  sel.value = keep;
}
$("invoice-search").addEventListener("input", () => {
  clearTimeout(invoiceSearchTimer);
  invoiceSearchTimer = setTimeout(loadInvoices, 350);
});
$("new-invoice-btn").addEventListener("click", async () => {
  const vr = await api("GET", "/vendors?status=active");
  const vendorNames = vr.ok ? vr.data.map((v) => v.name) : [];
  const er = await api("GET", "/events");
  const events = er.ok ? er.data : [];
  openModal("New invoice", `
    <form id="invoice-form">
      <div class="field"><label>Invoice no<input class="input" name="invoice_no" required></label></div>
      <div class="field"><label>Vendor<input class="input" name="vendor" list="vendor-list" required autocomplete="off" placeholder="Type or pick from vendor master"></label></div>
      <datalist id="vendor-list">${vendorNames.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
      <div class="field"><label>Amount<input class="input" name="amount" type="number" min="0" step="0.01" required></label></div>
      <div class="field"><label>Invoice date<input class="input" name="invoice_date" type="date" required></label></div>
      <div class="field"><label>Due date<input class="input" name="due_date" type="date" required></label></div>
      <div class="field"><label>Event (optional)<select class="input" name="event_id">
        <option value="">No event</option>
        ${events.map((ev) => `<option value="${ev.id}">${esc(ev.name)}</option>`).join("")}
      </select></label></div>
      <button class="btn btn-primary btn-block" type="submit">Create invoice</button>
    </form>`);
  $("invoice-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const r = await api("POST", "/invoices", {
      invoice_no: f.get("invoice_no").trim(),
      vendor: f.get("vendor").trim(),
      amount: Number(f.get("amount")),
      invoice_date: f.get("invoice_date"),
      due_date: f.get("due_date"),
      event_id: f.get("event_id") ? Number(f.get("event_id")) : null,
    });
    if (!r.ok) { toast(apiErr(r, "Could not create invoice."), "error"); return; }
    closeModal();
    toast("Invoice created.", "success");
    loadInvoices();
  });
});


async function getUsers() {
  if (state.usersCache.length) return state.usersCache;
  const r = await api("GET", "/users");
  if (r.ok && Array.isArray(r.data)) state.usersCache = r.data;
  return state.usersCache;
}

async function getAccountCodes() {
  if (state.codesCache) return state.codesCache;
  const r = await api("GET", "/account-codes?status=active");
  state.codesCache = r.ok ? r.data : [];
  return state.codesCache;
}

async function openAttachment(id) {
  const headers = {};
  if (state.token) headers["Authorization"] = "Bearer " + state.token;
  try {
    const res = await fetch(API_BASE + `/invoices/${id}/attachment`, { headers });
    if (!res.ok) { toast("Could not open attachment.", "error"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    toast("Could not open attachment.", "error");
  }
}


async function openInvoiceDrawer(id) {
  openDrawer("Invoice");
  $("drawer-body").innerHTML = `<p class="muted">Loading...</p>`;
  const r = await api("GET", `/invoices/${id}`);
  if (!r.ok) { $("drawer-body").innerHTML = `<p class="muted">Could not load invoice.</p>`; toast(apiErr(r), "error"); return; }
  let vendorRec = null;
  if (r.data.vendor_id) {
    const vr = await api("GET", "/vendors/" + r.data.vendor_id);
    if (vr.ok) vendorRec = vr.data;
  }
  const codes = canCodeInvoice() ? await getAccountCodes() : [];
  renderInvoiceDrawer(r.data, vendorRec, codes);
}

function renderInvoiceDrawer(inv, vendorRec, codes) {
  codes = codes || [];
  $("drawer-title").textContent = `Invoice ${inv.invoice_no || ""}`;
  const st = String(inv.status || "").toLowerCase();
  const history = (inv.history || []).map((h) => `
    <li><strong>${esc(h.action)}</strong> — ${esc(h.by || "")}
      <div class="t-meta">${esc(h.at || "")}${h.remarks ? " · " + esc(h.remarks) : ""}</div>
    </li>`).join("");

  let actions = "";
  
  if (canCodeInvoice() && ["captured", "assigned", "in_verification"].includes(st)) {
    const codeOpts = codes.map((c) =>
      `<option value="${esc(c.code)}" ${c.code === inv.account_code ? "selected" : ""}>${esc(c.code)} — ${esc(c.name)}</option>`).join("");
    const legacyOpt = inv.account_code && !codes.some((c) => c.code === inv.account_code)
      ? `<option value="${esc(inv.account_code)}" selected>${esc(inv.account_code)} (old code)</option>` : "";
    actions += `
      <div class="drawer-section"><h4>Coding</h4>
        <div class="field"><label>Account code
          <select id="code-input" class="input">
            <option value="">Select code...</option>${codeOpts}${legacyOpt}
          </select></label></div>
        <button class="btn btn-primary" id="code-btn">${inv.account_code ? "Update coding" : "Save coding"}</button>
      </div>`;
  }
  
  if (inv.attachment || canAttachInvoice(inv)) {
    actions += `
      <div class="drawer-section"><h4>Invoice photo</h4>
        ${inv.attachment
          ? `<div class="btn-row"><button class="btn btn-ghost" id="view-attach-btn">View attachment</button></div>`
          : `<p class="muted">No invoice photo attached yet.</p>`}
        ${canAttachInvoice(inv) ? `
          <div class="inline-form" style="margin-top:8px">
            <input type="file" id="attach-file" class="input" accept=".png,.jpg,.jpeg,.pdf,.webp">
            <button class="btn btn-primary" id="attach-btn">Upload</button>
          </div>` : ""}
      </div>`;
  }
  
  if (canLinkEvent()) {
    actions += `
      <div class="drawer-section"><h4>Event</h4>
        <div class="inline-form">
          <select id="event-select" class="input"><option value="">No event</option></select>
          <button class="btn btn-primary" id="event-link-btn">Save</button>
        </div>
      </div>`;
  }

  if (canAssignInvoice() && st !== "approved") {
    actions += `
      <div class="drawer-section"><h4>Assign</h4>
        <div class="inline-form">
          <select id="assign-select" class="input"><option value="">Select user...</option></select>
          <button class="btn btn-primary" id="assign-btn">Assign</button>
        </div>
      </div>`;
  }
  
  if (canVerifyInvoice() && st !== "approved") {
    actions += `
      <div class="drawer-section"><h4>Verify</h4>
        ${!inv.account_code ? `<p class="muted" style="margin-bottom:10px">Invoice must be coded before it can be approved.</p>` : ""}
        <div class="field"><label>Remarks (required to reject)</label>
          <textarea id="verify-remarks" class="input" rows="3" placeholder="Reason for rejection..."></textarea></div>
        <div class="btn-row">
          <button class="btn btn-success" id="verify-approve">Approve</button>
          <button class="btn btn-danger" id="verify-reject">Reject</button>
        </div>
      </div>`;
  }
  
  if (canAssignInvoice() && st === "rejected") {
    actions += `
      <div class="drawer-section"><h4>Correction</h4>
        <button class="btn btn-ghost" id="send-back-btn">Send back for correction</button>
      </div>`;
  }

  $("drawer-body").innerHTML = `
    <dl class="detail-grid">
      <dt>Invoice no</dt><dd>${esc(inv.invoice_no)}</dd>
      <dt>Vendor</dt><dd>${esc(inv.vendor)}</dd>
      <dt>Vendor bank</dt><dd>${vendorRec && vendorRec.bank_name ? esc(vendorRec.bank_name) + (vendorRec.account_no ? " • " + esc(vendorRec.account_no) : "") + (vendorRec.ifsc ? " (" + esc(vendorRec.ifsc) + ")" : "") : "—"}</dd>
      <dt>Account code</dt><dd>${inv.account_code ? esc(inv.account_code) + (inv.coded_by_name ? ` <span class="t-meta">by ${esc(inv.coded_by_name)}</span>` : "") : `<span class="badge pending">Not coded</span>`}</dd>
      <dt>Amount</dt><dd>${fmtRs(inv.amount)}</dd>
      <dt>Invoice date</dt><dd>${esc(fmtDate(inv.invoice_date))}</dd>
      <dt>Due date</dt><dd>${esc(fmtDate(inv.due_date))}</dd>
      <dt>Status</dt><dd>${badge(inv.status)}</dd>
      <dt>Assignee</dt><dd>${esc(inv.assignee_name || "-")}</dd>
      <dt>Event</dt><dd>${esc(inv.event_name || "—")}</dd>
      <dt>Uploaded by</dt><dd>${esc(inv.created_by_name || "-")}</dd>
      <dt>Remarks</dt><dd>${esc(inv.remarks || "-")}</dd>
    </dl>
    <div class="drawer-section"><h4>History</h4>
      ${history ? `<ul class="timeline">${history}</ul>` : `<p class="muted">No history yet.</p>`}
    </div>
    ${actions}`;

  
  const codeBtn = $("code-btn");
  if (codeBtn) {
    codeBtn.addEventListener("click", async () => {
      const code = $("code-input").value;
      if (!code) { toast("Please select an account code.", "error"); $("code-input").focus(); return; }
      const r = await api("PATCH", `/invoices/${inv.id}/code`, { account_code: code });
      if (!r.ok) { toast(apiErr(r, "Could not save coding."), "error"); return; }
      toast("Invoice coded.", "success");
      refreshInvoice(inv.id);
    });
  }
  const viewAttachBtn = $("view-attach-btn");
  if (viewAttachBtn) viewAttachBtn.addEventListener("click", () => openAttachment(inv.id));
  const attachBtn = $("attach-btn");
  if (attachBtn) {
    attachBtn.addEventListener("click", async () => {
      const file = $("attach-file").files[0];
      if (!file) { toast("Please choose a file first.", "error"); return; }
      const fd = new FormData();
      fd.append("file", file);
      const r = await apiUpload(`/invoices/${inv.id}/attachment`, fd);
      if (!r.ok) { toast(apiErr(r, "Could not upload attachment."), "error"); return; }
      toast("Attachment uploaded.", "success");
      refreshInvoice(inv.id);
    });
  }
  const assignSel = $("assign-select");
  if (assignSel) {
    getUsers().then((users) => {
      assignSel.innerHTML = `<option value="">Select user...</option>` + users.map((u) =>
        `<option value="${u.id}" ${String(u.id) === String(inv.assignee_id) ? "selected" : ""}>${esc(u.name)} (${esc(u.role)})</option>`).join("");
    });
    $("assign-btn").addEventListener("click", async () => {
      if (!assignSel.value) { toast("Please select a user to assign.", "error"); return; }
      const r = await api("PATCH", `/invoices/${inv.id}/assign`, { assignee_id: Number(assignSel.value) });
      if (!r.ok) { toast(apiErr(r, "Could not assign invoice."), "error"); return; }
      toast("Invoice assigned.", "success");
      refreshInvoice(inv.id);
    });
  }
  const eventSel = $("event-select");
  if (eventSel) {
    api("GET", "/events").then((er) => {
      if (er.ok) {
        eventSel.innerHTML = `<option value="">No event</option>` + er.data.map((ev) =>
          `<option value="${ev.id}" ${String(ev.id) === String(inv.event_id) ? "selected" : ""}>${esc(ev.name)}</option>`).join("");
      }
    });
    $("event-link-btn").addEventListener("click", async () => {
      const r = await api("PATCH", `/invoices/${inv.id}/event`, { event_id: eventSel.value ? Number(eventSel.value) : null });
      if (!r.ok) { toast(apiErr(r, "Could not save event."), "error"); return; }
      toast("Event updated.", "success");
      refreshInvoice(inv.id);
    });
  }
  const approveBtn = $("verify-approve");
  if (approveBtn) {
    approveBtn.addEventListener("click", () => verifyInvoice(inv.id, "approve"));
    $("verify-reject").addEventListener("click", () => {
      const remarks = $("verify-remarks").value.trim();
      if (!remarks) { toast("A reason is required to reject an invoice.", "error"); $("verify-remarks").focus(); return; }
      verifyInvoice(inv.id, "reject", remarks);
    });
  }
  const sendBackBtn = $("send-back-btn");
  if (sendBackBtn) {
    sendBackBtn.addEventListener("click", async () => {
      const r = await api("PATCH", `/invoices/${inv.id}/send-back`);
      if (!r.ok) { toast(apiErr(r, "Could not send back invoice."), "error"); return; }
      toast("Sent back for correction.", "success");
      refreshInvoice(inv.id);
    });
  }
}

async function verifyInvoice(id, decision, remarks = "") {
  const r = await api("PATCH", `/invoices/${id}/verify`, { decision, remarks });
  if (!r.ok) { toast(apiErr(r, "Could not verify invoice."), "error"); return; }
  toast(decision === "approve" ? "Invoice approved." : "Invoice rejected.", "success");
  refreshInvoice(id);
}

async function refreshInvoice(id) {
  const r = await api("GET", `/invoices/${id}`);
  if (!r.ok) return;
  let vendorRec = null;
  if (r.data.vendor_id) {
    const vr = await api("GET", "/vendors/" + r.data.vendor_id);
    if (vr.ok) vendorRec = vr.data;
  }
  const codes = canCodeInvoice() ? await getAccountCodes() : [];
  renderInvoiceDrawer(r.data, vendorRec, codes);
  loadInvoices();
}


async function loadPOs() {
  const tbody = $("pos-tbody");
  tbody.innerHTML = `<tr><td colspan="6" class="muted">Loading...</td></tr>`;
  const r = await api("GET", "/purchase-orders");
  if (!r.ok) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Could not load purchase orders.</td></tr>`;
    toast(apiErr(r, "Could not load purchase orders."), "error");
    return;
  }
  const rows = r.data;
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="6" class="muted">No purchase orders found.</td></tr>`; return; }
  tbody.innerHTML = rows.map((po) => {
    const pending = String(po.status || "").toLowerCase() === "pending_approval";
    const actions = (pending && canManagePO())
      ? `<button class="btn btn-success btn-small" data-po-approve="${po.id}">Approve</button>
         <button class="btn btn-danger btn-small" data-po-reject="${po.id}">Reject</button>`
      : `<span class="muted">-</span>`;
    return `<tr>
      <td>${esc(po.po_no)}</td><td>${esc(po.vendor)}</td><td>${fmtRs(po.amount)}</td>
      <td>${badge(po.status)}</td><td>${esc(fmtDate(po.created_at))}</td>
      <td class="actions-cell">${actions}</td></tr>`;
  }).join("");
  tbody.querySelectorAll("[data-po-approve]").forEach((b) =>
    b.addEventListener("click", () => reviewPO(b.dataset.poApprove, "approve")));
  tbody.querySelectorAll("[data-po-reject]").forEach((b) =>
    b.addEventListener("click", () => askPORejectReason(b.dataset.poReject)));
}

function reviewPO(id, decision, remarks = "") {
  return (async () => {
    const r = await api("PATCH", `/purchase-orders/${id}/review`, { decision, remarks });
    if (!r.ok) { toast(apiErr(r, "Could not review PO."), "error"); return; }
    toast(decision === "approve" ? "PO approved." : "PO rejected.", "success");
    loadPOs();
  })();
}


function askPORejectReason(id) {
  openModal("Reject purchase order", `
    <form id="po-reject-form">
      <div class="field"><label>Reason for rejection</label>
        <textarea id="po-reject-remarks" class="input" rows="3" required placeholder="Why is this PO being rejected?"></textarea></div>
      <button class="btn btn-danger btn-block" type="submit">Reject PO</button>
    </form>`);
  $("po-reject-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const remarks = $("po-reject-remarks").value.trim();
    if (!remarks) { toast("A reason is required to reject a PO.", "error"); return; }
    closeModal();
    reviewPO(id, "reject", remarks);
  });
}

$("new-po-btn").addEventListener("click", () => {
  openModal("New purchase order", `
    <form id="po-form">
      <div class="field"><label>PO no<input class="input" name="po_no" required></label></div>
      <div class="field"><label>Vendor<input class="input" name="vendor" required></label></div>
      <div class="field"><label>Amount<input class="input" name="amount" type="number" min="0" step="0.01" required></label></div>
      <button class="btn btn-primary btn-block" type="submit">Create PO</button>
    </form>`);
  $("po-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const r = await api("POST", "/purchase-orders", {
      po_no: f.get("po_no").trim(), vendor: f.get("vendor").trim(), amount: Number(f.get("amount")),
    });
    if (!r.ok) { toast(apiErr(r, "Could not create PO."), "error"); return; }
    closeModal(); toast("Purchase order created.", "success"); loadPOs();
  });
});


async function loadPayments() {
  const status = $("payment-status-filter").value;
  const q = status ? "?status=" + encodeURIComponent(status) : "";
  const tbody = $("payments-tbody");
  tbody.innerHTML = `<tr><td colspan="8" class="muted">Loading...</td></tr>`;
  const r = await api("GET", "/payments" + q);
  if (!r.ok) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">Could not load payments.</td></tr>`;
    toast(apiErr(r, "Could not load payments."), "error");
    return;
  }
  const rows = r.data;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">No payments found.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((p) => {
    let actions = "";
    if (p.status === "scheduled" && canManagePayments()) {
      actions = `<button class="btn btn-success btn-small" data-act="paid" data-id="${p.id}">Mark paid</button>
                 <button class="btn btn-danger btn-small" data-act="cancel" data-id="${p.id}">Cancel</button>`;
    }
    return `<tr>
      <td>${esc(p.reference_no || ("PAY-" + p.id))}</td>
      <td>${esc(p.invoice_no)}</td>
      <td>${esc(p.vendor)}</td>
      <td>${fmtRs(p.amount)}</td>
      <td>${esc(p.payment_date || "")}</td>
      <td>${esc(p.method || "")}</td>
      <td><span class="badge ${esc(p.status)}">${esc(p.status)}</span></td>
      <td>${actions}</td>
    </tr>`;
  }).join("");
  tbody.querySelectorAll("button[data-act]").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.id;
      if (b.dataset.act === "paid") markPaymentPaid(id);
      else cancelPayment(id);
    }));
}
$("payment-status-filter").addEventListener("change", loadPayments);

async function markPaymentPaid(id) {
  const r = await api("PATCH", "/payments/" + id + "/mark-paid");
  if (!r.ok) { toast(apiErr(r, "Could not mark payment as paid."), "error"); return; }
  toast("Payment marked as paid.", "success");
  loadPayments();
}

async function cancelPayment(id) {
  if (!confirm("Cancel this scheduled payment?")) return;
  const r = await api("PATCH", "/payments/" + id + "/cancel");
  if (!r.ok) { toast(apiErr(r, "Could not cancel payment."), "error"); return; }
  toast("Payment cancelled.", "info");
  loadPayments();
}

$("new-payment-btn").addEventListener("click", async () => {
  const r = await api("GET", "/payments/payable");
  if (!r.ok) { toast(apiErr(r, "Could not load payable invoices."), "error"); return; }
  const options = r.data;
  if (!options.length) { toast("No approved invoices with unpaid balance.", "info"); return; }
  openModal("Record payment", `
    <form id="payment-form">
      <div class="field"><label>Invoice
        <select class="input" name="invoice_id" id="pay-invoice" required>
          ${options.map((o) => `<option value="${o.id}">${esc(o.invoice_no)} — ${esc(o.vendor)} (unpaid ${fmtRs(o.remaining)})</option>`).join("")}
        </select></label></div>
      <div id="pay-bank-info" class="muted" style="margin-bottom:12px;font-size:13px"></div>
      <div class="field"><label>Amount (Rs)<input class="input" name="amount" type="number" min="0.01" step="0.01" required></label></div>
      <div class="field"><label>Payment date<input class="input" name="payment_date" type="date" required></label></div>
      <div class="field"><label>Method
        <select class="input" name="method">
          <option value="bank_transfer">Bank transfer</option>
          <option value="upi">UPI</option>
          <option value="cheque">Cheque</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
        </select></label></div>
      <div class="field"><label>Reference no<input class="input" name="reference_no" placeholder="UTR / cheque no"></label></div>
      <button class="btn btn-primary btn-block" type="submit">Schedule payment</button>
    </form>`);
  const payable = {};
  options.forEach((o) => { payable[o.id] = o; });
  const showBank = (id) => {
    const sel = payable[id];
    const parts = [];
    if (sel) {
      if (sel.bank_name) parts.push(sel.bank_name);
      if (sel.account_no) parts.push("A/c " + sel.account_no);
      if (sel.ifsc) parts.push("IFSC " + sel.ifsc);
    }
    $("pay-bank-info").textContent = parts.length ? "Pay to: " + parts.join(" • ") : "No bank details on file for this vendor.";
  };
  $("pay-invoice").addEventListener("change", (e) => {
    const sel = payable[e.target.value];
    if (sel) document.querySelector('#payment-form [name="amount"]').value = sel.remaining;
    showBank(e.target.value);
  });
  document.querySelector('#payment-form [name="amount"]').value = options[0].remaining;
  showBank(options[0].id);
  $("payment-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const r2 = await api("POST", "/payments", {
      invoice_id: Number(f.get("invoice_id")),
      amount: Number(f.get("amount")),
      payment_date: f.get("payment_date"),
      method: f.get("method"),
      reference_no: (f.get("reference_no") || "").trim(),
    });
    if (!r2.ok) { toast(apiErr(r2, "Could not record payment."), "error"); return; }
    closeModal();
    toast("Payment scheduled.", "success");
    loadPayments();
  });
});


function downloadTemplate() {
  const csv = "invoice_no,vendor,amount,invoice_date,due_date\nINV-1001,Acme Corp,50000,2026-09-20,2026-10-20\nINV-1002,Globex Ltd,25000,2026-09-21,\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "invoice_upload_template.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

async function apiUpload(path, formData) {
  const headers = {};
  if (state.token) headers["Authorization"] = "Bearer " + state.token;
  let res;
  try {
    res = await fetch(API_BASE + path, { method: "POST", headers, body: formData });
  } catch (e) {
    return { ok: false, data: { detail: "Network error: could not reach the server." } };
  }
  if (res.status === 401) {
    logout(true);
    return { ok: false, data: { detail: "Session expired. Please sign in again." } };
  }
  let data = null;
  try { data = await res.json(); } catch (e) {  }
  return { ok: res.ok, status: res.status, data: data || {} };
}

$("bulk-upload-btn").addEventListener("click", () => {
  openModal("Bulk upload invoices", `
    <form id="bulk-form">
      <p class="muted" style="margin-bottom:12px">Upload a CSV or Excel file with columns:
        <strong>invoice_no, vendor, amount, invoice_date</strong> (YYYY-MM-DD), due_date (optional).</p>
      <div class="btn-row" style="margin-bottom:14px">
        <button type="button" class="btn" id="bulk-template-btn">Download CSV template</button>
      </div>
      <div class="field"><label>File<input class="input" type="file" id="bulk-file" accept=".csv,.xlsx,.xlsm" required></label></div>
      <div id="bulk-result" style="margin-bottom:12px"></div>
      <button class="btn btn-primary btn-block" type="submit">Upload</button>
    </form>`);
  $("bulk-template-btn").addEventListener("click", downloadTemplate);
  $("bulk-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = $("bulk-file").files[0];
    if (!file) return;
    const res = $("bulk-result");
    res.innerHTML = `<span class="muted">Uploading...</span>`;
    const fd = new FormData();
    fd.append("file", file);
    const r = await apiUpload("/invoices/bulk-upload", fd);
    if (!r.ok) { res.innerHTML = `<span class="badge rejected">${esc(apiErr(r, "Upload failed."))}</span>`; return; }
    const d = r.data;
    let html = `<div class="btn-row"><span class="badge approved">Added: ${d.added}</span>
      <span class="badge ${d.skipped.length ? "rejected" : "approved"}">Skipped: ${d.skipped.length}</span></div>`;
    if (d.skipped.length) {
      html += `<ul class="muted" style="margin-top:8px;font-size:13px">` +
        d.skipped.map((s) => `<li>Row ${s.row} (${esc(s.invoice_no || "-")}): ${esc(s.reason)}</li>`).join("") + `</ul>`;
    }
    res.innerHTML = html;
    if (d.added) { toast(`${d.added} invoices added.`, "success"); loadInvoices(); }
  });
});


async function loadEvents() {
  const tbody = $("events-tbody");
  tbody.innerHTML = `<tr><td colspan="8" class="muted">Loading...</td></tr>`;
  const r = await api("GET", "/events");
  if (!r.ok) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">Could not load events.</td></tr>`;
    toast(apiErr(r, "Could not load events."), "error");
    return;
  }
  const rows = r.data;
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="8" class="muted">No events found.</td></tr>`; return; }
  tbody.innerHTML = rows.map((ev) => {
    const vendorBtn = canManageEvents()
      ? `<button class="btn btn-ghost btn-small" data-event-vendor="${ev.id}">${ev.vendor_name ? "Change vendor" : "Set vendor"}</button>`
      : "";
    return `<tr><td>${esc(ev.name)}</td><td>${esc(fmtDate(ev.date))}</td><td>${esc(ev.location || "-")}</td>
    <td>${fmtRs(ev.budget)}</td><td>${esc(ev.vendor_name || "—")}</td>
    <td><button class="btn btn-ghost btn-small" data-event-bills="${ev.id}">${ev.invoice_count || 0} bills</button></td>
    <td>${badge(ev.status)}</td>
    <td>${vendorBtn || `<span class="muted">-</span>`}</td></tr>`;
  }).join("");
  tbody.querySelectorAll("[data-event-vendor]").forEach((b) =>
    b.addEventListener("click", () => openEventVendorModal(Number(b.dataset.eventVendor))));
  tbody.querySelectorAll("[data-event-bills]").forEach((b) =>
    b.addEventListener("click", () => showEventBills(Number(b.dataset.eventBills))));
}

function showEventBills(eventId) {
  showView("invoices");
  const sel = $("invoice-event-filter");
  if ([...sel.options].some((o) => o.value == String(eventId))) {
    sel.value = String(eventId);
    loadInvoices();
  } else {
    loadEventFilterOptions().then(() => { sel.value = String(eventId); loadInvoices(); });
  }
}

async function openEventVendorModal(eventId) {
  const vr = await api("GET", "/vendors?status=active");
  const vendors = vr.ok ? vr.data : [];
  openModal("Partner vendor for event", `
    <form id="event-vendor-form">
      <div class="field"><label>Partner vendor
        <select class="input" name="vendor_id">
          <option value="">No vendor</option>
          ${vendors.map((v) => `<option value="${v.id}">${esc(v.name)}</option>`).join("")}
        </select></label></div>
      <button class="btn btn-primary btn-block" type="submit">Save</button>
    </form>`);
  $("event-vendor-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const val = f.get("vendor_id");
    const r = await api("PATCH", "/events/" + eventId, { vendor_id: val ? Number(val) : null });
    if (!r.ok) { toast(apiErr(r, "Could not set vendor."), "error"); return; }
    closeModal();
    toast("Partner vendor updated.", "success");
    loadEvents();
  });
}

$("new-event-btn").addEventListener("click", async () => {
  const vr = await api("GET", "/vendors?status=active");
  const vendors = vr.ok ? vr.data : [];
  openModal("New event", `
    <form id="event-form">
      <div class="field"><label>Name<input class="input" name="name" required></label></div>
      <div class="field"><label>Date<input class="input" name="date" type="date" required></label></div>
      <div class="field"><label>Location<input class="input" name="location" required></label></div>
      <div class="field"><label>Budget<input class="input" name="budget" type="number" min="0" step="0.01" required></label></div>
      <div class="field"><label>Partner vendor
        <select class="input" name="vendor_id">
          <option value="">No vendor</option>
          ${vendors.map((v) => `<option value="${v.id}">${esc(v.name)}</option>`).join("")}
        </select></label></div>
      <button class="btn btn-primary btn-block" type="submit">Create event</button>
    </form>`);
  $("event-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const val = f.get("vendor_id");
    const r = await api("POST", "/events", {
      name: f.get("name").trim(), date: f.get("date"),
      location: f.get("location").trim(), budget: Number(f.get("budget")),
      vendor_id: val ? Number(val) : null,
    });
    if (!r.ok) { toast(apiErr(r, "Could not create event."), "error"); return; }
    closeModal(); toast("Event created.", "success"); loadEvents();
  });
});


let vendorSearchTimer = null;

async function loadVendors() {
  const search = $("vendor-search").value.trim();
  const q = search ? "?search=" + encodeURIComponent(search) : "";
  const tbody = $("vendors-tbody");
  tbody.innerHTML = `<tr><td colspan="7" class="muted">Loading...</td></tr>`;
  const r = await api("GET", "/vendors" + q);
  if (!r.ok) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">Could not load vendors.</td></tr>`;
    toast(apiErr(r, "Could not load vendors."), "error");
    return;
  }
  const rows = r.data;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">No vendors found.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((v) => {
    const bank = v.bank_name ? `${esc(v.bank_name)}${v.account_no ? " • " + esc(v.account_no) : ""}` : "—";
    const contact = v.contact_name || v.contact_email || "—";
    let actions = "";
    if (canManageVendors())
      actions += `<button class="btn btn-ghost btn-small" data-vendor-edit="${v.id}">Edit</button>`;
    if (canDeleteVendor())
      actions += ` <button class="btn btn-danger btn-small" data-vendor-delete="${v.id}">Delete</button>`;
    if (!actions) actions = `<span class="muted">-</span>`;
    return `<tr>
      <td><strong>${esc(v.name)}</strong></td>
      <td>${esc(contact)}</td>
      <td>${esc(v.contact_phone || "—")}</td>
      <td>${bank}</td>
      <td>${v.invoice_count}</td>
      <td><span class="badge ${v.status === "active" ? "approved" : "rejected"}">${esc(v.status)}</span></td>
      <td>${actions}</td>
    </tr>`;
  }).join("");
  tbody.querySelectorAll("[data-vendor-edit]").forEach((b) =>
    b.addEventListener("click", () => openVendorModal(Number(b.dataset.vendorEdit))));
  tbody.querySelectorAll("[data-vendor-delete]").forEach((b) =>
    b.addEventListener("click", () => deleteVendor(Number(b.dataset.vendorDelete))));
}

async function deleteVendor(id) {
  if (!confirm("Delete this vendor? This cannot be undone.")) return;
  const r = await api("DELETE", "/vendors/" + id);
  if (!r.ok) { toast(apiErr(r, "Could not delete vendor."), "error"); return; }
  toast("Vendor deleted.", "success");
  loadVendors();
}
$("vendor-search").addEventListener("input", () => {
  clearTimeout(vendorSearchTimer);
  vendorSearchTimer = setTimeout(loadVendors, 350);
});

function vendorFormHtml(v) {
  v = v || {};
  return `
    <form id="vendor-form">
      <div class="field"><label>Vendor name<input class="input" name="name" required value="${esc(v.name || "")}" ${v.id ? "disabled" : ""}></label></div>
      <div class="field"><label>Contact person<input class="input" name="contact_name" value="${esc(v.contact_name || "")}"></label></div>
      <div class="field"><label>Contact email<input class="input" name="contact_email" type="email" value="${esc(v.contact_email || "")}"></label></div>
      <div class="field"><label>Contact phone<input class="input" name="contact_phone" value="${esc(v.contact_phone || "")}"></label></div>
      <div class="field"><label>Bank name<input class="input" name="bank_name" value="${esc(v.bank_name || "")}"></label></div>
      <div class="field"><label>Account no<input class="input" name="account_no" value="${esc(v.account_no || "")}"></label></div>
      <div class="field"><label>IFSC<input class="input" name="ifsc" value="${esc(v.ifsc || "")}"></label></div>
      <div class="field"><label>Address<input class="input" name="address" value="${esc(v.address || "")}"></label></div>
      ${v.id ? `<div class="field"><label>Status
        <select class="input" name="status">
          <option value="active" ${v.status === "active" ? "selected" : ""}>Active</option>
          <option value="inactive" ${v.status === "inactive" ? "selected" : ""}>Inactive</option>
        </select></label></div>` : ""}
      <button class="btn btn-primary btn-block" type="submit">${v.id ? "Save changes" : "Add vendor"}</button>
    </form>`;
}

async function openVendorModal(id) {
  let v = null;
  if (id) {
    const r = await api("GET", "/vendors/" + id);
    if (!r.ok) { toast(apiErr(r, "Could not load vendor."), "error"); return; }
    v = r.data;
  }
  openModal(id ? "Edit vendor" : "New vendor", vendorFormHtml(v));
  $("vendor-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const payload = {
      contact_name: f.get("contact_name").trim(),
      contact_email: f.get("contact_email").trim(),
      contact_phone: f.get("contact_phone").trim(),
      bank_name: f.get("bank_name").trim(),
      account_no: f.get("account_no").trim(),
      ifsc: f.get("ifsc").trim(),
      address: f.get("address").trim(),
    };
    let r;
    if (id) {
      payload.status = f.get("status");
      r = await api("PATCH", "/vendors/" + id, payload);
    } else {
      payload.name = f.get("name").trim();
      r = await api("POST", "/vendors", payload);
    }
    if (!r.ok) { toast(apiErr(r, "Could not save vendor."), "error"); return; }
    closeModal();
    toast(id ? "Vendor updated." : "Vendor added.", "success");
    loadVendors();
  });
}
$("new-vendor-btn").addEventListener("click", () => openVendorModal(null));


async function loadCodes() {
  const tbody = $("codes-tbody");
  tbody.innerHTML = `<tr><td colspan="4" class="muted">Loading...</td></tr>`;
  const r = await api("GET", "/account-codes");
  if (!r.ok) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Could not load account codes.</td></tr>`;
    toast(apiErr(r, "Could not load account codes."), "error");
    return;
  }
  const rows = r.data;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">No account codes found.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((c) => {
    const active = c.status === "active";
    const toggle = canManageCodes()
      ? `<button class="btn btn-ghost btn-small" data-code-toggle="${c.id}" data-to="${active ? "inactive" : "active"}">${active ? "Deactivate" : "Activate"}</button>`
      : `<span class="muted">-</span>`;
    return `<tr>
      <td><strong>${esc(c.code)}</strong></td><td>${esc(c.name)}</td>
      <td><span class="badge ${active ? "approved" : "rejected"}">${esc(c.status)}</span></td>
      <td>${toggle}</td></tr>`;
  }).join("");
  tbody.querySelectorAll("[data-code-toggle]").forEach((b) =>
    b.addEventListener("click", () => toggleCode(Number(b.dataset.codeToggle), b.dataset.to)));
}

async function toggleCode(id, to) {
  const r = await api("PATCH", "/account-codes/" + id, { status: to });
  if (!r.ok) { toast(apiErr(r, "Could not update code."), "error"); return; }
  state.codesCache = null;
  toast("Account code updated.", "success");
  loadCodes();
}

$("new-code-btn").addEventListener("click", () => {
  openModal("New account code", `
    <form id="code-form">
      <div class="field"><label>Code<input class="input" name="code" required placeholder="e.g. 6100"></label></div>
      <div class="field"><label>Name<input class="input" name="name" required placeholder="e.g. Travel"></label></div>
      <button class="btn btn-primary btn-block" type="submit">Add code</button>
    </form>`);
  $("code-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const r = await api("POST", "/account-codes", {
      code: f.get("code").trim(), name: f.get("name").trim(),
    });
    if (!r.ok) { toast(apiErr(r, "Could not add code."), "error"); return; }
    state.codesCache = null;
    closeModal();
    toast("Account code added.", "success");
    loadCodes();
  });
});


async function loadUsers() {
  const roleFilter = $("user-role-filter").value;
  const q = roleFilter ? "?role=" + encodeURIComponent(roleFilter) : "";
  const tbody = $("users-tbody");
  tbody.innerHTML = `<tr><td colspan="6" class="muted">Loading...</td></tr>`;
  const r = await api("GET", "/users" + q);
  if (!r.ok) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Could not load users.</td></tr>`;
    toast(apiErr(r, "Could not load users."), "error");
    return;
  }
  state.usersCache = Array.isArray(r.data) ? r.data : [];
  if (!state.usersCache.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">No users found.</td></tr>`;
    return;
  }
  tbody.innerHTML = state.usersCache.map((u) => {
    const st = String(u.status || "").toLowerCase();
    let actions = `<span class="muted">-</span>`;
    if (isAdmin() && st === "pending")
      actions = `<button class="btn btn-success btn-small" data-approve="${u.id}">Approve</button>`;
    else if (isAdmin() && st === "locked")
      actions = `<button class="btn btn-ghost btn-small" data-unlock="${u.id}">Unlock</button>`;
    return `<tr>
      <td>${esc(u.name)}</td><td>${esc(u.username || "-")}</td><td style="text-transform:capitalize">${esc(u.role)}</td>
      <td>${esc(u.location || "-")}</td><td>${badge(u.status)}</td>
      <td class="actions-cell">${actions}</td></tr>`;
  }).join("");
  tbody.querySelectorAll("[data-approve]").forEach((b) =>
    b.addEventListener("click", () => approveUser(b.dataset.approve)));
  tbody.querySelectorAll("[data-unlock]").forEach((b) =>
    b.addEventListener("click", () => unlockUser(b.dataset.unlock)));
}

$("user-role-filter").addEventListener("change", loadUsers);


function roleOptionsForCreator() {
  const opts = isAdmin()
    ? ["admin", "manager", "finance", "employee", "viewer"]
    : ["manager", "finance", "employee", "viewer"];
  return opts.map((r) => `<option value="${r}">${r[0].toUpperCase() + r.slice(1)}</option>`).join("");
}

$("new-user-btn").addEventListener("click", () => {
  openModal("New user", `
    <form id="user-form">
      <div class="field"><label>Full name<input class="input" name="name" required></label></div>
      <div class="field"><label>Role<select class="input" name="role">${roleOptionsForCreator()}</select></label></div>
      <div class="field"><label>Location<input class="input" name="location" required></label></div>
      <p class="muted" style="font-size:13px">${isAdmin()
        ? "The account is activated immediately and login credentials are generated."
        : "The request is sent to an admin for approval."}</p>
      <button class="btn btn-primary btn-block" type="submit">Create user</button>
    </form>`);
  $("user-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const r = await api("POST", "/users", {
      name: f.get("name").trim(), role: f.get("role"), location: f.get("location").trim(),
    });
    if (!r.ok) { toast(apiErr(r, "Could not create user."), "error"); return; }
    closeModal();
    handleUserCredentialsResponse(r.data, "User created.");
    loadUsers();
  });
});


function handleUserCredentialsResponse(data, fallbackMsg) {
  if (data && data.username && data.password) {
    openModal("Login credentials", `
      <p><strong>${esc(data.message || fallbackMsg)}</strong></p>
      <div class="creds-box">
        <div class="cred-row"><span>Username</span><span>${esc(data.username)}</span></div>
        <div class="cred-row"><span>Password</span><span>${esc(data.password)}</span></div>
      </div>
      <p class="creds-note">Share these credentials with the new user securely.</p>
      <button class="btn btn-primary btn-block" id="creds-done">Done</button>`);
    $("creds-done").addEventListener("click", closeModal);
  } else {
    toast((data && data.message) || fallbackMsg, "success");
  }
}

async function approveUser(id) {
  const r = await api("PATCH", `/users/${id}/approve`);
  if (!r.ok) { toast(apiErr(r, "Could not approve user."), "error"); return; }
  handleUserCredentialsResponse(r.data, "User approved.");
  loadUsers();
}

async function unlockUser(id) {
  const r = await api("PATCH", `/users/${id}/unlock`);
  if (!r.ok) { toast(apiErr(r, "Could not unlock user."), "error"); return; }
  toast("Account unlocked.", "success");
  loadUsers();
}


(async function init() {
  if (!state.token) return; 
  const r = await api("GET", "/auth/me");
  if (r.ok && r.data) {
    state.user = r.data;
    enterApp();
  }
  
})();
