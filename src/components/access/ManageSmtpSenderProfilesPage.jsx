import { useEffect, useState } from "react";
import {
  AccessPageHeader,
  AlertMessage,
  CardLoader,
  ConfirmDeleteModal,
  SelectField,
  SimpleTable,
  SuccessModal,
  TextField,
} from "./AccessShared.jsx";

const ENCRYPTION_OPTIONS = [
  { value: "auto", label: "Auto (recommended)" },
  { value: "tls", label: "STARTTLS" },
  { value: "ssl", label: "SSL (e.g. port 465)" },
  { value: "none", label: "No encryption" },
];

function emptyForm() {
  return {
    id: null,
    profile_name: "",
    from_email: "",
    from_name: "",
    smtp_host: "",
    smtp_port: "587",
    smtp_encryption: "auto",
    smtp_username: "",
    smtp_password: "",
    test_to_email: "",
  };
}

function buildPayload(form, { forCreate, forTest } = { forCreate: false, forTest: false }) {
  const smtpPort = Math.min(65535, Math.max(1, parseInt(String(form.smtp_port), 10) || 587));
  const base = {
    profile_name: form.profile_name.trim(),
    from_email: form.from_email.trim(),
    from_name: form.from_name.trim() || null,
    smtp_host: form.smtp_host.trim(),
    smtp_port: smtpPort,
    smtp_encryption: form.smtp_encryption,
    smtp_username: form.smtp_username.trim() || null,
    reply_to_email: null,
    is_default: false,
    internal_notes: null,
  };
  if (forTest) {
    if (!form.smtp_password || !String(form.smtp_password).trim()) {
      throw new Error("SMTP password is required to test the connection from the form.");
    }
    return {
      ...base,
      smtp_password: String(form.smtp_password).trim(),
      test_to_email: form.test_to_email.trim() || null,
    };
  }
  if (forCreate) {
    if (!form.smtp_password || !String(form.smtp_password).trim()) {
      throw new Error("SMTP password is required.");
    }
    return { ...base, smtp_password: String(form.smtp_password).trim() };
  }
  const upd = { ...base };
  if (form.smtp_password && String(form.smtp_password).trim()) {
    upd.smtp_password = String(form.smtp_password).trim();
  } else {
    upd.smtp_password = null;
  }
  return upd;
}

function validateForm(form, { forCreate } = { forCreate: false }) {
  if (!form.profile_name.trim()) {
    return "Profile name is required.";
  }
  if (!form.from_email.trim()) {
    return "From email is required.";
  }
  if (!form.smtp_host.trim()) {
    return "The SMTP host field is required.";
  }
  if (!form.smtp_port) {
    return "SMTP port is required.";
  }
  if (forCreate && !String(form.smtp_password || "").trim()) {
    return "SMTP password is required.";
  }
  return "";
}

function ManageSmtpSenderProfilesPage({ token, apiRequest }) {
  const [view, setView] = useState("list");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [successModal, setSuccessModal] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [testListBusy, setTestListBusy] = useState(false);

  useEffect(() => {
    document.title = "SMTP sender profiles | Travel Agency";
  }, []);

  useEffect(() => {
    if (view !== "list") {
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    apiRequest("/smtp-sender-profiles", { token })
      .then((data) => {
        if (!active) {
          return;
        }
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) {
          return;
        }
        setError(e.message || "Unable to load SMTP profiles.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apiRequest, token, view, refreshKey]);

  function goNew() {
    setForm(emptyForm());
    setFormError("");
    setTestMessage("");
    setView("form");
  }

  function goEdit(row) {
    setFormError("");
    setTestMessage("");
    setDetailLoading(true);
    apiRequest(`/smtp-sender-profiles/${row.id}`, { token })
      .then((data) => {
        setForm({
          id: data.id,
          profile_name: data.profile_name || "",
          from_email: data.from_email || "",
          from_name: data.from_name || "",
          smtp_host: data.smtp_host || "",
          smtp_port: String(data.smtp_port || 587),
          smtp_encryption: data.smtp_encryption || "auto",
          smtp_username: data.smtp_username || "",
          smtp_password: "",
          test_to_email: data.from_email || "",
        });
        setView("form");
      })
      .catch((e) => {
        setError(e.message || "Unable to load profile.");
      })
      .finally(() => {
        setDetailLoading(false);
      });
  }

  async function handleSave(event) {
    event.preventDefault();
    setFormError("");
    const isCreate = !form.id;
    const v = validateForm(form, { forCreate: isCreate });
    if (v) {
      setFormError(v);
      return;
    }
    setSaving(true);
    try {
      if (isCreate) {
        const body = buildPayload(form, { forCreate: true });
        await apiRequest("/smtp-sender-profiles", { method: "POST", token, body });
        setSuccessModal({ title: "Profile created", message: "The SMTP profile was saved." });
      } else {
        const body = buildPayload(form, { forCreate: false });
        await apiRequest(`/smtp-sender-profiles/${form.id}`, { method: "PUT", token, body });
        setSuccessModal({ title: "Profile updated", message: "The SMTP profile was updated." });
      }
      setView("list");
      setForm(emptyForm());
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setFormError(e.message || "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await apiRequest(`/smtp-sender-profiles/${id}`, { method: "DELETE", token });
      setDeleteTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setError(e.message || "Unable to delete profile.");
    }
  }

  async function runTestForm() {
    setFormError("");
    setTestMessage("");
    let payload;
    try {
      payload = buildPayload(form, { forTest: true });
    } catch (e) {
      setFormError(e.message || "Check the form.");
      return;
    }
    const v = validateForm(form, { forCreate: !form.id });
    if (v) {
      setFormError(v);
      return;
    }
    if (!form.smtp_host.trim()) {
      setFormError("The SMTP host field is required.");
      return;
    }
    setTestLoading(true);
    try {
      const res = await apiRequest("/smtp-sender-profiles/test", { method: "POST", token, body: payload });
      setTestMessage(res?.message || "Test completed.");
    } catch (e) {
      setTestMessage("");
      setFormError(e.message || "SMTP test failed.");
    } finally {
      setTestLoading(false);
    }
  }

  async function runTestSaved(row) {
    setError("");
    setTestMessage("");
    const testTo = window.prompt("Send test message to (email):", row.from_email || "");
    if (testTo == null) {
      return;
    }
    setTestListBusy(true);
    try {
      const res = await apiRequest(`/smtp-sender-profiles/${row.id}/test`, {
        method: "POST",
        token,
        body: { test_to_email: testTo.trim() || null },
      });
      setSuccessModal({
        title: "Test sent",
        message: res?.message || "Check the inbox for the test email.",
      });
    } catch (e) {
      setError(e.message || "SMTP test failed.");
    } finally {
      setTestListBusy(false);
    }
  }

  if (view === "form") {
    if (detailLoading) {
      return <CardLoader message="Loading profile…" />;
    }
    return (
      <>
        <SuccessModal
          open={Boolean(successModal)}
          title={successModal?.title || ""}
          message={successModal?.message || ""}
          onClose={() => setSuccessModal(null)}
        />
        <AccessPageHeader
          title={form.id ? "Edit sender profile" : "New sender profile"}
          subtitle="Configure outbound email. Nothing is sent until you test or use this profile in the app."
        />
        <AlertMessage message={error} variant="danger" />
        <form onSubmit={handleSave} noValidate>
          <div className="row g-3">
            <div className="col-lg-8">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">Connection</h5>
                  <p className="text-muted small">
                    Server and credentials used to deliver mail. Profile name is an internal label.
                  </p>
                  <div className="row g-2">
                    <TextField
                      label="Profile name *"
                      value={form.profile_name}
                      onChange={(v) => setForm((f) => ({ ...f, profile_name: v }))}
                      required
                    />
                    <TextField
                      label="From email *"
                      value={form.from_email}
                      onChange={(v) => setForm((f) => ({ ...f, from_email: v }))}
                      required
                    />
                    <TextField
                      label="From name"
                      value={form.from_name}
                      onChange={(v) => setForm((f) => ({ ...f, from_name: v }))}
                    />
                    <TextField
                      label="SMTP host *"
                      value={form.smtp_host}
                      onChange={(v) => setForm((f) => ({ ...f, smtp_host: v }))}
                      placeholder="smtp.example.com"
                      required
                    />
                    <TextField
                      label="SMTP port *"
                      value={form.smtp_port}
                      onChange={(v) => setForm((f) => ({ ...f, smtp_port: v }))}
                      type="number"
                      min={1}
                      max={65535}
                      required
                    />
                    <SelectField
                      label="Encryption"
                      value={form.smtp_encryption}
                      onChange={(v) => setForm((f) => ({ ...f, smtp_encryption: v }))}
                      options={ENCRYPTION_OPTIONS}
                    />
                    <TextField
                      label="SMTP username"
                      value={form.smtp_username}
                      onChange={(v) => setForm((f) => ({ ...f, smtp_username: v }))}
                    />
                    <div className="col-12">
                      <div className="text-muted small mt-1">
                        Use the Test SMTP box (or test from the list) before relying on this profile.
                      </div>
                    </div>
                    <TextField
                      label={form.id ? "SMTP password (optional)" : "SMTP password *"}
                      value={form.smtp_password}
                      onChange={(v) => setForm((f) => ({ ...f, smtp_password: v }))}
                      type="password"
                      autoComplete="new-password"
                    />
                    {form.id ? (
                      <p className="text-muted small col-12">Leave password blank to keep the saved password.</p>
                    ) : null}
                    <div className="col-12 d-flex flex-wrap align-items-center gap-2 mt-1">
                      <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => {
                          setView("list");
                          setForm(emptyForm());
                          setFormError("");
                        }}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {formError ? <AlertMessage message={formError} variant="danger" /> : null}
            </div>
            <div className="col-lg-4">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title">Test SMTP</h5>
                  <p className="text-muted small">
                    Try the values in the form before saving. Enter password above for a draft test.
                  </p>
                  <TextField
                    label="Test recipient (optional)"
                    value={form.test_to_email}
                    onChange={(v) => setForm((f) => ({ ...f, test_to_email: v }))}
                    placeholder="Defaults to From email"
                  />
                  {testMessage ? <p className="text-success small mb-0">{testMessage}</p> : null}
                  <button
                    type="button"
                    className="btn btn-outline-primary w-100 mt-2"
                    onClick={runTestForm}
                    disabled={testLoading}
                  >
                    {testLoading ? "Testing…" : "Test SMTP connection"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </>
    );
  }

  const tableRows = items.map((row) => [
    <span className="fw-medium" key="n">
      {row.profile_name}
    </span>,
    row.from_email,
    `${row.smtp_host}:${row.smtp_port} (${row.smtp_encryption})`,
    <div className="d-inline-flex flex-wrap justify-content-end gap-1" key="a">
      <button
        type="button"
        className="btn btn-sm btn-light"
        onClick={() => goEdit(row)}
        disabled={loading || testListBusy}
      >
        Edit
      </button>
      <button
        type="button"
        className="btn btn-sm btn-outline-primary"
        onClick={() => runTestSaved(row)}
        disabled={loading || testListBusy}
      >
        Test
      </button>
      <button
        type="button"
        className="btn btn-sm btn-outline-danger"
        onClick={() => setDeleteTarget(row)}
        disabled={loading || testListBusy}
      >
        Delete
      </button>
    </div>,
  ]);

  return (
    <>
      <SuccessModal
        open={Boolean(successModal)}
        title={successModal?.title || ""}
        message={successModal?.message || ""}
        onClose={() => setSuccessModal(null)}
      />
      <AlertMessage message={error} variant="danger" />
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete profile"
        message={
          deleteTarget
            ? `Are you sure you want to delete “${deleteTarget.profile_name}”? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget.id)}
      />
      {loading ? <CardLoader message="Loading profiles…" /> : null}
      <div className="card">
        <div className="card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div>
              <h4 className="header-title mb-0">Sender profiles</h4>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={goNew} disabled={loading}>
              New sender profile
            </button>
          </div>
          <SimpleTable
            columns={["Profile", "From", "Host", "Actions"]}
            rows={tableRows}
            emptyMessage={
              loading
                ? "…"
                : "No sender profiles yet. Add one to store SMTP settings in the database."
            }
          />
        </div>
      </div>
    </>
  );
}

export default ManageSmtpSenderProfilesPage;
