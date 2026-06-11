import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FormModal, SelectField, TextField } from "../access/AccessShared.jsx";
import { BookingAlertMessage } from "./BookingAlertMessage.jsx";
import {
  createEmptyCustomerForm,
  parseOptionalTenDigitMobile,
  validateCustomerForm,
  validateOptionalTenDigitContact,
} from "../customers/CustomersShared.jsx";

function emptyTravelerForm(customerId) {
  return {
    customer_id: customerId ? String(customerId) : "",
    first_name: "",
    last_name: "",
    gender: "",
    dob: "",
    nationality_country_id: "",
    contact_number: "",
    email: "",
    pan_number: "",
    aadhaar_number: "",
    passport_number: "",
    name_as_per_passport: "",
    passport_expiry_date: "",
    address: "",
  };
}

function validateTravelerQuick(f) {
  if (!f.customer_id) {
    return "Customer is required.";
  }
  if (!String(f.first_name || "").trim()) {
    return "First name is required.";
  }
  if (!f.gender) {
    return "Gender is required.";
  }
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) {
    return "Enter a valid email address.";
  }
  const contactErr = validateOptionalTenDigitContact(f.contact_number);
  if (contactErr) {
    return contactErr;
  }
  const pan = String(f.pan_number || "").trim();
  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(pan)) {
    return "Enter a valid PAN Number (e.g. ABCDE1234F).";
  }
  const aadDigits = String(f.aadhaar_number || "").replace(/\D/g, "");
  if (String(f.aadhaar_number || "").trim() && aadDigits.length !== 12) {
    return "Aadhaar number must be exactly 12 digits.";
  }
  const passNum = String(f.passport_number || "").trim();
  const passName = String(f.name_as_per_passport || "").trim();
  const passExpiry = String(f.passport_expiry_date || "").trim();
  if ((passName || passExpiry) && !passNum) {
    return "Passport number is required when passport name or expiry date is filled in.";
  }
  return "";
}

/**
 * Portaled modals + handlers for "Create …" rows on booking autocomplete fields.
 */
export function useBookingReferenceCreateModals({
  token,
  apiRequest,
  canCreateCustomer,
  canCreateTraveler,
  customers,
  setCustomers,
  selectedCustomerId,
  onCustomerCreated,
  onTravelerCreated,
}) {
  const [custOpen, setCustOpen] = useState(false);
  const [custForm, setCustForm] = useState(createEmptyCustomerForm());
  const [custErr, setCustErr] = useState("");
  const [custSaving, setCustSaving] = useState(false);

  const [trOpen, setTrOpen] = useState(false);
  const [trForm, setTrForm] = useState(emptyTravelerForm(""));
  const [trErr, setTrErr] = useState("");
  const [trSaving, setTrSaving] = useState(false);
  const [trRowIndex, setTrRowIndex] = useState(null);

  const [countries, setCountries] = useState([]);

  const countryOptions = useMemo(
    () => countries.map((c) => ({ value: String(c.id), label: c.name || `Country #${c.id}` })),
    [countries],
  );


  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest("/masters/countries/options", { token }),
    ])
      .then(([co]) => {
        if (!active) {
          return;
        }
        setCountries(Array.isArray(co) ? co : []);
      })
      .catch(() => {
        if (active) {
          setCountries([]);
        }
      });
    return () => {
      active = false;
    };
  }, [apiRequest, token]);

  const openCustomer = useCallback((q) => {
    setCustForm({
      ...createEmptyCustomerForm(),
      first_name: String(q || "").trim(),
    });
    setCustErr("");
    setCustOpen(true);
  }, []);

  const openTraveler = useCallback((q, rowIndex) => {
    if (!selectedCustomerId) {
      return;
    }
    const selectedCustomer = (customers || []).find((c) => String(c?.id) === String(selectedCustomerId));
    setTrForm({
      ...emptyTravelerForm(selectedCustomerId),
      first_name: String(q || "").trim(),
      nationality_country_id:
        selectedCustomer?.country_id != null && String(selectedCustomer.country_id).trim() !== ""
          ? String(selectedCustomer.country_id)
          : "",
    });
    setTrErr("");
    setTrRowIndex(rowIndex ?? null);
    setTrOpen(true);
  }, [selectedCustomerId, customers]);

  async function submitCustomer(e) {
    e.preventDefault();
    setCustErr("");
    const ve = validateCustomerForm(custForm);
    if (ve) {
      setCustErr(ve);
      return;
    }
    setCustSaving(true);
    try {
      const created = await apiRequest("/customers", {
        method: "POST",
        token,
        body: {
          first_name: custForm.first_name.trim(),
          last_name: custForm.last_name.trim(),
          email: custForm.email.trim() || null,
          contact_number: parseOptionalTenDigitMobile(custForm.contact_number),
          gender: custForm.gender || null,
          address: custForm.address.trim() || null,
          city: custForm.city.trim() || null,
          country_id: custForm.country_id ? Number(custForm.country_id) : null,
        },
      });
      setCustomers((list) => [...list, created]);
      onCustomerCreated?.(created);
      setCustOpen(false);
      setCustForm(createEmptyCustomerForm());
    } catch (err) {
      setCustErr(err.message || "Unable to create customer.");
    } finally {
      setCustSaving(false);
    }
  }

  async function submitTraveler(e) {
    e.preventDefault();
    setTrErr("");
    const ve = validateTravelerQuick(trForm);
    if (ve) {
      setTrErr(ve);
      return;
    }
    setTrSaving(true);
    try {
      const created = await apiRequest("/travelers", {
        method: "POST",
        token,
        body: {
          customer_id: Number(trForm.customer_id),
          first_name: trForm.first_name.trim(),
          last_name: trForm.last_name.trim() || null,
          gender: trForm.gender || null,
          dob: trForm.dob || null,
          nationality_country_id: trForm.nationality_country_id
            ? Number(trForm.nationality_country_id)
            : null,
          contact_number: parseOptionalTenDigitMobile(trForm.contact_number),
          email: trForm.email.trim() || null,
          pan_number: trForm.pan_number.trim() || null,
          aadhaar_number: (() => {
            const d = String(trForm.aadhaar_number || "").replace(/\D/g, "");
            return d.length === 12 ? d : null;
          })(),
          address: trForm.address.trim() || null,
          passport_number: String(trForm.passport_number || "").trim() || null,
          passport_expiry_date: String(trForm.passport_expiry_date || "").trim() || null,
          name_as_per_passport: String(trForm.name_as_per_passport || "").trim() || null,
        },
      });
      onTravelerCreated?.(created, trRowIndex);
      setTrOpen(false);
      setTrForm(emptyTravelerForm(""));
      setTrRowIndex(null);
    } catch (err) {
      setTrErr(err.message || "Unable to create traveler.");
    } finally {
      setTrSaving(false);
    }
  }

  const renderModals = () =>
    createPortal(
      <>
        {custOpen ? (
          <FormModal
            open
            title="Create customer"
            saveLabel="Create"
            saving={custSaving}
            onCancel={() => {
              setCustOpen(false);
              setCustForm(createEmptyCustomerForm());
              setCustErr("");
            }}
            onSubmit={submitCustomer}
            size="modal-lg"
            scrollableBody
          >
            <BookingAlertMessage message={custErr} variant="danger" onDismiss={() => setCustErr("")} />
            <div className="row g-3">
              <TextField
                label="First name"
                value={custForm.first_name}
                required
                onChange={(v) => setCustForm((c) => ({ ...c, first_name: v }))}
              />
              <TextField
                label="Last name"
                value={custForm.last_name}
                required
                onChange={(v) => setCustForm((c) => ({ ...c, last_name: v }))}
              />
              <TextField
                label="Email"
                type="email"
                value={custForm.email}
                onChange={(v) => setCustForm((c) => ({ ...c, email: v }))}
              />
              <TextField
                label="Contact number"
                value={custForm.contact_number}
                inputMode="numeric"
                maxLength={15}
                autoComplete="tel"
                title="Enter a 10-digit mobile number (optional +91), or leave blank"
                onChange={(v) => setCustForm((c) => ({ ...c, contact_number: v }))}
              />
              <SelectField
                label="Gender"
                value={custForm.gender}
                required
                onChange={(v) => setCustForm((c) => ({ ...c, gender: v }))}
                options={[
                  { value: "", label: "Select" },
                  { value: "Male", label: "Male" },
                  { value: "Female", label: "Female" },
                  { value: "Other", label: "Other" },
                ]}
              />
              <TextField
                label="Address"
                value={custForm.address}
                onChange={(v) => setCustForm((c) => ({ ...c, address: v }))}
              />
              <TextField
                label="City"
                value={custForm.city}
                onChange={(v) => setCustForm((c) => ({ ...c, city: v }))}
              />
              <SelectField
                label="Country"
                value={custForm.country_id}
                onChange={(v) => setCustForm((c) => ({ ...c, country_id: v }))}
                options={countryOptions}
              />
            </div>
          </FormModal>
        ) : null}

        {trOpen ? (
          <FormModal
            open
            title="Create traveler"
            saveLabel="Create"
            saving={trSaving}
            onCancel={() => {
              setTrOpen(false);
              setTrForm(emptyTravelerForm(""));
              setTrErr("");
              setTrRowIndex(null);
            }}
            onSubmit={submitTraveler}
            size="modal-lg"
            scrollableBody
          >
            <BookingAlertMessage message={trErr} variant="danger" onDismiss={() => setTrErr("")} />
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label">Customer</label>
                <input
                  type="text"
                  className="form-control"
                  readOnly
                  value={
                    customers.find((c) => String(c.id) === String(trForm.customer_id))
                      ? [
                          customers.find((c) => String(c.id) === String(trForm.customer_id))
                            .first_name,
                          customers.find((c) => String(c.id) === String(trForm.customer_id))
                            .last_name,
                        ]
                          .filter(Boolean)
                          .join(" ")
                      : trForm.customer_id
                  }
                />
              </div>
              <TextField
                label="First name"
                value={trForm.first_name}
                required
                onChange={(v) => setTrForm((c) => ({ ...c, first_name: v }))}
              />
              <TextField
                label="Last name"
                value={trForm.last_name}
                onChange={(v) => setTrForm((c) => ({ ...c, last_name: v }))}
              />
              <SelectField
                label="Gender"
                value={trForm.gender}
                required
                onChange={(v) => setTrForm((c) => ({ ...c, gender: v }))}
                options={[
                  { value: "", label: "Select" },
                  { value: "Male", label: "Male" },
                  { value: "Female", label: "Female" },
                  { value: "Other", label: "Other" },
                ]}
              />
              <TextField
                label="Date of birth"
                type="date"
                value={trForm.dob}
                onChange={(v) => setTrForm((c) => ({ ...c, dob: v }))}
              />
              <SelectField
                label="Nationality (country)"
                value={trForm.nationality_country_id}
                onChange={(v) => setTrForm((c) => ({ ...c, nationality_country_id: v }))}
                options={countryOptions}
              />
              <TextField
                label="Contact number"
                value={trForm.contact_number}
                inputMode="numeric"
                maxLength={15}
                autoComplete="tel"
                title="Enter a 10-digit mobile number (optional +91), or leave blank"
                onChange={(v) => setTrForm((c) => ({ ...c, contact_number: v }))}
              />
              <TextField
                label="Email"
                type="email"
                value={trForm.email}
                onChange={(v) => setTrForm((c) => ({ ...c, email: v }))}
              />
              <TextField
                label="PAN Number"
                value={trForm.pan_number}
                maxLength={20}
                placeholder="e.g. ABCDE1234F"
                onChange={(v) => setTrForm((c) => ({ ...c, pan_number: v }))}
              />
              <TextField
                label="Aadhaar number"
                value={trForm.aadhaar_number}
                inputMode="numeric"
                maxLength={14}
                placeholder="12 digits (spaces optional)"
                title="12-digit Aadhaar; spaces are ignored"
                onChange={(v) => setTrForm((c) => ({ ...c, aadhaar_number: v }))}
              />
              <TextField
                label="Passport No"
                value={trForm.passport_number}
                maxLength={100}
                onChange={(v) => setTrForm((c) => ({ ...c, passport_number: v }))}
              />
              <TextField
                label="Name as per passport"
                value={trForm.name_as_per_passport}
                maxLength={250}
                onChange={(v) => setTrForm((c) => ({ ...c, name_as_per_passport: v }))}
              />
              <TextField
                label="Passport validity (expiry)"
                type="date"
                value={trForm.passport_expiry_date}
                onChange={(v) => setTrForm((c) => ({ ...c, passport_expiry_date: v }))}
              />
              <div className="col-12 col-md-6">
                <label className="form-label">Address</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={trForm.address}
                  onChange={(e) => setTrForm((c) => ({ ...c, address: e.target.value }))}
                />
              </div>
            </div>
          </FormModal>
        ) : null}
      </>,
      document.body,
    );

  return {
    renderModals,
    customerAutocompleteExtras: canCreateCustomer
      ? {
          onAddNew: openCustomer,
          addNewLabel: (q) => `Create customer "${q}"`,
        }
      : {},
    travelerAutocompleteExtrasForRow: (rowIndex) =>
      canCreateTraveler && selectedCustomerId
        ? {
            onAddNew: (q) => openTraveler(q, rowIndex),
            addNewLabel: (q) => `Create traveler "${q}"`,
          }
        : {},
  };
}
