import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertMessage,
  FormModal,
  SelectField,
  TextField,
} from "../access/AccessShared.jsx";
import {
  createEmptyCustomerForm,
  validateCustomerForm,
} from "../customers/CustomersShared.jsx";

function emptyDestinationForm() {
  return { destination_name: "", city: "", country_id: "", status: "Active" };
}

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
    traveler_type_id: "",
  };
}

function validateDestinationForm(f) {
  if (!String(f.destination_name || "").trim()) {
    return "Destination name is required.";
  }
  return "";
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
  return "";
}

/**
 * Portaled modals + handlers for "Create …" rows on booking autocomplete fields.
 */
export function useBookingReferenceCreateModals({
  token,
  apiRequest,
  canCreateCustomer,
  canCreateDestination,
  canCreateTraveler,
  customers,
  setCustomers,
  destinations,
  setDestinations,
  travelers,
  setTravelers,
  selectedCustomerId,
  onCustomerCreated,
  onDestinationCreated,
  onTravelerCreated,
}) {
  const [custOpen, setCustOpen] = useState(false);
  const [custForm, setCustForm] = useState(createEmptyCustomerForm());
  const [custErr, setCustErr] = useState("");
  const [custSaving, setCustSaving] = useState(false);

  const [destOpen, setDestOpen] = useState(false);
  const [destForm, setDestForm] = useState(emptyDestinationForm());
  const [destErr, setDestErr] = useState("");
  const [destSaving, setDestSaving] = useState(false);

  const [trOpen, setTrOpen] = useState(false);
  const [trForm, setTrForm] = useState(emptyTravelerForm(""));
  const [trErr, setTrErr] = useState("");
  const [trSaving, setTrSaving] = useState(false);
  const [trRowIndex, setTrRowIndex] = useState(null);

  const [countries, setCountries] = useState([]);
  const [travelerTypes, setTravelerTypes] = useState([]);

  const countryOptions = useMemo(
    () => [
      { value: "", label: "—" },
      ...countries.map((c) => ({ value: String(c.id), label: c.name || `Country #${c.id}` })),
    ],
    [countries],
  );

  const travelerTypeOptions = useMemo(
    () => [
      { value: "", label: "—" },
      ...travelerTypes.map((t) => ({ value: String(t.id), label: t.name || `Type #${t.id}` })),
    ],
    [travelerTypes],
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest("/masters/countries/options", { token }),
      apiRequest("/masters/traveler-types/options", { token }),
    ])
      .then(([co, tt]) => {
        if (!active) {
          return;
        }
        setCountries(Array.isArray(co) ? co : []);
        setTravelerTypes(Array.isArray(tt) ? tt : []);
      })
      .catch(() => {
        if (active) {
          setCountries([]);
          setTravelerTypes([]);
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

  const openDestination = useCallback((q) => {
    setDestForm({
      ...emptyDestinationForm(),
      destination_name: String(q || "").trim(),
    });
    setDestErr("");
    setDestOpen(true);
  }, []);

  const openTraveler = useCallback((q, rowIndex) => {
    if (!selectedCustomerId) {
      return;
    }
    setTrForm({
      ...emptyTravelerForm(selectedCustomerId),
      first_name: String(q || "").trim(),
    });
    setTrErr("");
    setTrRowIndex(rowIndex ?? null);
    setTrOpen(true);
  }, [selectedCustomerId]);

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
          contact_number: custForm.contact_number.trim() || null,
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

  async function submitDestination(e) {
    e.preventDefault();
    setDestErr("");
    const ve = validateDestinationForm(destForm);
    if (ve) {
      setDestErr(ve);
      return;
    }
    setDestSaving(true);
    try {
      const created = await apiRequest("/masters/destinations", {
        method: "POST",
        token,
        body: {
          destination_name: destForm.destination_name.trim(),
          city: destForm.city.trim() || null,
          country_id: destForm.country_id ? Number(destForm.country_id) : null,
          status: destForm.status || "Active",
        },
      });
      setDestinations((list) => [...list, created]);
      onDestinationCreated?.(created);
      setDestOpen(false);
      setDestForm(emptyDestinationForm());
    } catch (err) {
      setDestErr(err.message || "Unable to create destination.");
    } finally {
      setDestSaving(false);
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
          contact_number: trForm.contact_number.trim() || null,
          email: trForm.email.trim() || null,
          traveler_type_id: trForm.traveler_type_id ? Number(trForm.traveler_type_id) : null,
        },
      });
      setTravelers((list) => [...list, created]);
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
            <AlertMessage message={custErr} variant="danger" />
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
                label="Contact"
                value={custForm.contact_number}
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

        {destOpen ? (
          <FormModal
            open
            title="Create destination"
            saveLabel="Create"
            saving={destSaving}
            onCancel={() => {
              setDestOpen(false);
              setDestForm(emptyDestinationForm());
              setDestErr("");
            }}
            onSubmit={submitDestination}
          >
            <AlertMessage message={destErr} variant="danger" />
            <div className="row g-3">
              <TextField
                label="Destination name"
                value={destForm.destination_name}
                required
                onChange={(v) => setDestForm((c) => ({ ...c, destination_name: v }))}
              />
              <TextField
                label="City"
                value={destForm.city}
                onChange={(v) => setDestForm((c) => ({ ...c, city: v }))}
              />
              <SelectField
                label="Country"
                value={destForm.country_id}
                onChange={(v) => setDestForm((c) => ({ ...c, country_id: v }))}
                options={countryOptions}
              />
              <SelectField
                label="Status"
                value={destForm.status}
                onChange={(v) => setDestForm((c) => ({ ...c, status: v }))}
                options={[
                  { value: "Active", label: "Active" },
                  { value: "Inactive", label: "Inactive" },
                ]}
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
            <AlertMessage message={trErr} variant="danger" />
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
                label="Contact"
                value={trForm.contact_number}
                onChange={(v) => setTrForm((c) => ({ ...c, contact_number: v }))}
              />
              <TextField
                label="Email"
                type="email"
                value={trForm.email}
                onChange={(v) => setTrForm((c) => ({ ...c, email: v }))}
              />
              <SelectField
                label="Traveler type"
                value={trForm.traveler_type_id}
                onChange={(v) => setTrForm((c) => ({ ...c, traveler_type_id: v }))}
                options={travelerTypeOptions}
              />
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
    destinationAutocompleteExtras: canCreateDestination
      ? {
          onAddNew: openDestination,
          addNewLabel: (q) => `Create destination "${q}"`,
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
