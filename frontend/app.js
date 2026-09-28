

const API_BASE = "http://localhost:8000/api";

const state = {
  token: localStorage.getItem("token") || null,
  user: null,
  view: "dashboard",
  usersCache: [],
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

/* role helpers */
const role = () => (state.user && state.user.role) || "";
const isAdmin = () => role() === "admin";
const isManager = () => role() === "manager";
const canManageUsers = () => isAdmin() || isManager();       // Users nav + create
const canCreateInvoice = () => ["admin", "manager", "finance"].includes(role());
const canVerifyInvoice = () => ["admin", "manager", "finance"].includes(role());
const canAssignInvoice = () => isAdmin() || isManager();
const canManagePO = () => isAdmin() || isManager();           // create + review
const canManageEvents = () => isAdmin() || isManager();

/* ---------------- toasts ---------------- */
function toast(msg, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  $("toasts").appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

/* ---------------- modal ---------------- */
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

/* ---------------- drawer ---------------- */
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

/* ---------------- API wrapper ----------------
   Adds the JWT, parses JSON, and on 401 clears the token and
   returns to the login screen. Never throws for HTTP errors. */
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
    logout(true); // silent: session expired / token invalid
    return { ok: false, status: 401, data: { detail: "Session expired. Please sign in again." } };
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON body */ }
  return { ok: res.ok, status: res.status, data: data || {} };
}

const apiErr = (r, fallback) =>
  (r.data && (r.data.detail || r.data.message)) || fallback || "Something went wrong.";

/* ---------------- auth ---------------- */
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
      // 401 -> invalid credentials, 423 -> locked account: show server text
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

/* Show/hide UI elements based on the signed-in user's role */
function applyRoleVisibility() {
  $("nav-users").classList.toggle("hidden", !canManageUsers());
  $("new-invoice-btn").classList.toggle("hidden", !canCreateInvoice());
  $("new-po-btn").classList.toggle("hidden", !canManagePO());
  $("new-event-btn").classList.toggle("hidden", !canManageEvents());
  // Managers must not see the Admins filter option
  $("role-filter-admin").classList.toggle("hidden", !isAdmin());
}

$("login-form").addEventListener("submit", handleLogin);
$("logout-btn").addEventListener("click", () => logout(false));

/* ---------------- navigation ---------------- */
function showView(name) {
  state.view = name;
  document.querySelectorAll(".nav-item").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  $("view-" + name).classList.remove("hidden");
  // (re)load data for the view
  if (name === "dashboard") loadDashboard();
  if (name === "invoices") loadInvoices();
  if (name === "pos") loadPOs();
  if (name === "events") loadEvents();
  if (name === "users") loadUsers();
}
document.querySelectorAll(".nav-item").forEach((b) =>
  b.addEventListener("click", () => showView(b.dataset.view)));

/* ---------------- dashboard ---------------- */
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
    ["Pending user requests", d.pending_users],
    ["Open POs", d.open_pos],
  ];
  wrap.innerHTML = cards.map(([label, value]) =>
    `<div class="card"><div class="card-label">${esc(label)}</div><div class="card-value">${esc(value)}</div></div>`
  ).join("");
}

/* ---------------- invoices ---------------- */
let invoiceSearchTimer = null;

async function loadInvoices() {
  const status = $("invoice-status-filter").value;
  const search = $("invoice-search").value.trim();
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  if (search) q.set("search", search);
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
$("invoice-search").addEventListener("input", () => {
  clearTimeout(invoiceSearchTimer);
  invoiceSearchTimer = setTimeout(loadInvoices, 350);
});
$("new-invoice-btn").addEventListener("click", () => {
  openModal("New invoice", `
    <form id="invoice-form">
      <div class="field"><label>Invoice no<input class="input" name="invoice_no" required></label></div>
      <div class="field"><label>Vendor<input class="input" name="vendor" required></label></div>
      <div class="field"><label>Amount<input class="input" name="amount" type="number" min="0" step="0.01" required></label></div>
      <div class="field"><label>Invoice date<input class="input" name="invoice_date" type="date" required></label></div>
      <div class="field"><label>Due date<input class="input" name="due_date" type="date" required></label></div>
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
    });
    if (!r.ok) { toast(apiErr(r, "Could not create invoice."), "error"); return; }
    closeModal();
    toast("Invoice created.", "success");
    loadInvoices();
  });
});

/* Fetch users once and cache for the assign dropdown */
async function getUsers() {
  if (state.usersCache.length) return state.usersCache;
  const r = await api("GET", "/users");
  if (r.ok && Array.isArray(r.data)) state.usersCache = r.data;
  return state.usersCache;
}

/* Invoice detail drawer with history + role-based actions */
async function openInvoiceDrawer(id) {
  openDrawer("Invoice");
  $("drawer-body").innerHTML = `<p class="muted">Loading...</p>`;
  const r = await api("GET", `/invoices/${id}`);
  if (!r.ok) { $("drawer-body").innerHTML = `<p class="muted">Could not load invoice.</p>`; toast(apiErr(r), "error"); return; }
  renderInvoiceDrawer(r.data);
}

function renderInvoiceDrawer(inv) {
  $("drawer-title").textContent = `Invoice ${inv.invoice_no || ""}`;
  const st = String(inv.status || "").toLowerCase();
  const history = (inv.history || []).map((h) => `
    <li><strong>${esc(h.action)}</strong> — ${esc(h.by || "")}
      <div class="t-meta">${esc(h.at || "")}${h.remarks ? " · " + esc(h.remarks) : ""}</div>
    </li>`).join("");

  let actions = "";
  // Assign (admin/manager), hidden once approved
  if (canAssignInvoice() && st !== "approved") {
    actions += `
      <div class="drawer-section"><h4>Assign</h4>
        <div class="inline-form">
          <select id="assign-select" class="input"><option value="">Select user...</option></select>
          <button class="btn btn-primary" id="assign-btn">Assign</button>
        </div>
      </div>`;
  }
  // Verify (admin/manager/finance)
  if (canVerifyInvoice() && st !== "approved") {
    actions += `
      <div class="drawer-section"><h4>Verify</h4>
        <div class="field"><label>Remarks (required to reject)</label>
          <textarea id="verify-remarks" class="input" rows="3" placeholder="Reason for rejection..."></textarea></div>
        <div class="btn-row">
          <button class="btn btn-success" id="verify-approve">Approve</button>
          <button class="btn btn-danger" id="verify-reject">Reject</button>
        </div>
      </div>`;
  }
  // Send back for correction (admin/manager, only when rejected)
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
      <dt>Amount</dt><dd>${fmtRs(inv.amount)}</dd>
      <dt>Invoice date</dt><dd>${esc(fmtDate(inv.invoice_date))}</dd>
      <dt>Due date</dt><dd>${esc(fmtDate(inv.due_date))}</dd>
      <dt>Status</dt><dd>${badge(inv.status)}</dd>
      <dt>Assignee</dt><dd>${esc(inv.assignee_name || "-")}</dd>
      <dt>Remarks</dt><dd>${esc(inv.remarks || "-")}</dd>
    </dl>
    <div class="drawer-section"><h4>History</h4>
      ${history ? `<ul class="timeline">${history}</ul>` : `<p class="muted">No history yet.</p>`}
    </div>
    ${actions}`;

  // Wire actions
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
  if (r.ok) renderInvoiceDrawer(r.data);
  loadInvoices(); // keep the list in sync
}

/* ---------------- purchase orders ---------------- */
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

/* Rejecting a PO requires a reason: collect it in a modal */
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

/* ---------------- events ---------------- */
async function loadEvents() {
  const tbody = $("events-tbody");
  tbody.innerHTML = `<tr><td colspan="5" class="muted">Loading...</td></tr>`;
  const r = await api("GET", "/events");
  if (!r.ok) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Could not load events.</td></tr>`;
    toast(apiErr(r, "Could not load events."), "error");
    return;
  }
  const rows = r.data;
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="5" class="muted">No events found.</td></tr>`; return; }
  tbody.innerHTML = rows.map((ev) => `
    <tr><td>${esc(ev.name)}</td><td>${esc(fmtDate(ev.date))}</td><td>${esc(ev.location || "-")}</td>
    <td>${fmtRs(ev.budget)}</td><td>${badge(ev.status)}</td></tr>`).join("");
}

$("new-event-btn").addEventListener("click", () => {
  openModal("New event", `
    <form id="event-form">
      <div class="field"><label>Name<input class="input" name="name" required></label></div>
      <div class="field"><label>Date<input class="input" name="date" type="date" required></label></div>
      <div class="field"><label>Location<input class="input" name="location" required></label></div>
      <div class="field"><label>Budget<input class="input" name="budget" type="number" min="0" step="0.01" required></label></div>
      <button class="btn btn-primary btn-block" type="submit">Create event</button>
    </form>`);
  $("event-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const r = await api("POST", "/events", {
      name: f.get("name").trim(), date: f.get("date"),
      location: f.get("location").trim(), budget: Number(f.get("budget")),
    });
    if (!r.ok) { toast(apiErr(r, "Could not create event."), "error"); return; }
    closeModal(); toast("Event created.", "success"); loadEvents();
  });
});

/* ---------------- users ---------------- */
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

/* Role options for the create form depend on who is creating */
function roleOptionsForCreator() {
  const opts = isAdmin()
    ? ["admin", "manager", "finance", "viewer"]
    : ["manager", "finance", "viewer"]; // manager cannot create admins
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

/* Shared handler for create/approve responses: show credentials prominently
   when the server generated them (admin flow), otherwise show the message. */
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

/* ---------------- init ---------------- */
(async function init() {
  if (!state.token) return; // no token: stay on login screen
  const r = await api("GET", "/auth/me");
  if (r.ok && r.data) {
    state.user = r.data;
    enterApp();
  }
  // on 401, api() already cleared the token and we stay on login
})();
