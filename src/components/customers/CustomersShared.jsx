import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { AutocompleteField } from "../access/AccessShared.jsx";

export function CustomersSubmenu({ links }) {
  const submenuLinks = links?.length
    ? links
    : [{ to: "/customers/list", label: "Manage Customer" }];

  return (
    <div className="card">
      <div className="card-body py-3">
        <div className="ta-submenu">
          {submenuLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `btn btn-sm ${isActive ? "btn-primary" : "btn-light"}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Build `?page=&page_size=&search=` for list APIs that support server-side search. */
export function buildPagedSearchUrl(path, page, pageSize, search) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  const q = String(search ?? "").trim();
  if (q) {
    params.set("search", q);
  }
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${p}?${params.toString()}`;
}

export function buildTravelersListUrl(page, pageSize, search, customerId) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  const q = String(search ?? "").trim();
  if (q) {
    params.set("search", q);
  }
  if (customerId != null && String(customerId).trim() !== "") {
    params.set("customer_id", String(customerId));
  }
  return `/travelers?${params.toString()}`;
}

export function mergeUniqueById(existing, incoming, idKey = "id") {
  const map = new Map((existing || []).map((x) => [String(x[idKey]), x]));
  for (const item of incoming || []) {
    if (item == null) continue;
    map.set(String(item[idKey]), item);
  }
  return Array.from(map.values());
}

function linkedCustomerFromTraveler(t) {
  if (!t) {
    return null;
  }
  return {
    id: t.customer_id,
    first_name: t.customer_first_name,
    last_name: t.customer_last_name,
    customer_id: t.customer_ref,
  };
}

export function createEmptyCustomerForm() {
  return {
    id: "",
    customer_id: "",
    first_name: "",
    last_name: "",
    email: "",
    contact_number: "",
    gender: "",
    address: "",
    city: "",
    country_id: "",
  };
}

export function validateCustomerForm(form) {
  if (!String(form.first_name || "").trim()) {
    return "First name is required.";
  }
  if (!String(form.last_name || "").trim()) {
    return "Last name is required.";
  }

  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "Enter a valid email address.";
  }

  if (!form.gender) {
    return "Gender is required.";
  }

  return "";
}

export function customerDisplayLine(c) {
  if (!c) {
    return "";
  }
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  const bits = [name || null, c.customer_id || null].filter(Boolean);
  return bits.join(" · ") || `Customer #${c.id}`;
}

export function travelerDisplayLine(traveler, customer) {
  const tn = [traveler?.first_name, traveler?.last_name].filter(Boolean).join(" ").trim();
  const cn = customer
    ? [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim()
    : "";
  if (tn && cn) {
    return `${tn} · ${cn}`;
  }
  return tn || cn || (traveler ? `Traveler #${traveler.id}` : "");
}

export function CustomerAutocomplete({
  label = "Customer",
  value,
  onChange,
  customers = [],
  apiRequest,
  token,
  searchPageSize = 100,
  onResolvedRecord,
  required,
  onAddNew,
  addNewLabel,
  wrapperClassName,
  hideLabel = false,
}) {
  const serverMode = Boolean(apiRequest && token);
  const [remoteCustomers, setRemoteCustomers] = useState([]);
  const [fetchQuery, setFetchQuery] = useState("");
  const [selectedExtra, setSelectedExtra] = useState(null);

  useEffect(() => {
    if (!serverMode) {
      return;
    }
    let cancelled = false;
    apiRequest(buildPagedSearchUrl("/customers", 1, searchPageSize, fetchQuery), { token })
      .then((r) => {
        if (!cancelled) {
          setRemoteCustomers(Array.isArray(r?.items) ? r.items : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRemoteCustomers([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [serverMode, apiRequest, token, searchPageSize, fetchQuery]);

  useEffect(() => {
    if (!serverMode || !value) {
      setSelectedExtra(null);
      return;
    }
    const id = String(value);
    if (remoteCustomers.some((c) => String(c.id) === id)) {
      setSelectedExtra(null);
      return;
    }
    let cancelled = false;
    apiRequest(`/customers/${id}`, { token })
      .then((c) => {
        if (!cancelled) {
          setSelectedExtra(c || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedExtra(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [serverMode, value, remoteCustomers, apiRequest, token]);

  const mergedCustomers = useMemo(() => {
    if (!serverMode) {
      return customers;
    }
    const map = new Map();
    for (const c of remoteCustomers) {
      map.set(String(c.id), c);
    }
    if (selectedExtra) {
      map.set(String(selectedExtra.id), selectedExtra);
    }
    return Array.from(map.values());
  }, [serverMode, customers, remoteCustomers, selectedExtra]);

  const options = useMemo(
    () =>
      mergedCustomers.map((c) => ({
        value: String(c.id),
        label: customerDisplayLine(c),
        searchText: `${c.customer_id || ""} ${[c.first_name, c.last_name].filter(Boolean).join(" ")}`,
      })),
    [mergedCustomers],
  );

  function handleChange(v) {
    onChange(v);
    if (!serverMode || !onResolvedRecord || !v) {
      return;
    }
    const row = mergedCustomers.find((c) => String(c.id) === String(v));
    if (row) {
      onResolvedRecord(row);
    }
  }

  return (
    <AutocompleteField
      label={label}
      value={value}
      onChange={handleChange}
      options={options}
      required={required}
      onAddNew={onAddNew}
      addNewLabel={addNewLabel}
      wrapperClassName={wrapperClassName || "col-12 col-md-6"}
      hideLabel={hideLabel}
      onDebouncedInputChange={serverMode ? (q) => setFetchQuery(q) : undefined}
    />
  );
}

export function TravelerAutocomplete({
  label = "Traveler",
  value,
  onChange,
  travelers,
  customers,
  customerIdFilter,
  apiRequest,
  token,
  searchPageSize = 100,
  onResolvedRecord,
  required,
  onAddNew,
  addNewLabel,
  wrapperClassName,
  hideLabel = false,
  placeholder,
  disabled = false,
  inputClassName,
}) {
  const serverMode = Boolean(apiRequest && token);
  const [remoteTravelers, setRemoteTravelers] = useState([]);
  const [fetchQuery, setFetchQuery] = useState("");
  const [selectedExtra, setSelectedExtra] = useState(null);

  const cid = String(customerIdFilter || "").trim();

  useEffect(() => {
    if (!serverMode) {
      return;
    }
    if (disabled) {
      setRemoteTravelers([]);
      return;
    }
    let cancelled = false;
    const customerParam = cid ? cid : null;
    apiRequest(buildTravelersListUrl(1, searchPageSize, fetchQuery, customerParam), { token })
      .then((r) => {
        if (!cancelled) {
          setRemoteTravelers(Array.isArray(r?.items) ? r.items : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRemoteTravelers([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [serverMode, disabled, cid, apiRequest, token, searchPageSize, fetchQuery]);

  useEffect(() => {
    if (!serverMode || !value || disabled) {
      setSelectedExtra(null);
      return;
    }
    const id = String(value);
    if (remoteTravelers.some((t) => String(t.id) === id)) {
      setSelectedExtra(null);
      return;
    }
    let cancelled = false;
    apiRequest(`/travelers/${id}`, { token })
      .then((t) => {
        if (!cancelled) {
          setSelectedExtra(t || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedExtra(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [serverMode, value, disabled, remoteTravelers, apiRequest, token]);

  const mergedTravelersForResolve = useMemo(() => {
    if (!serverMode) {
      return null;
    }
    const map = new Map();
    for (const t of remoteTravelers) {
      map.set(String(t.id), t);
    }
    if (selectedExtra) {
      map.set(String(selectedExtra.id), selectedExtra);
    }
    return Array.from(map.values());
  }, [serverMode, remoteTravelers, selectedExtra]);

  const options = useMemo(() => {
    if (!serverMode) {
      const customerMap = Object.fromEntries((customers || []).map((c) => [String(c.id), c]));
      const filtered = customerIdFilter
        ? travelers.filter((t) => String(t.customer_id) === String(customerIdFilter))
        : travelers;
      return filtered.map((t) => {
        const cust = customerMap[String(t.customer_id)];
        const line = travelerDisplayLine(t, cust);
        const tName = [t.first_name, t.last_name].filter(Boolean).join(" ");
        const cName = cust ? [cust.first_name, cust.last_name].filter(Boolean).join(" ") : "";
        return {
          value: String(t.id),
          label: line,
          searchText: `${tName} ${cName} ${t.email || ""} ${t.contact_number || ""}`.trim(),
        };
      });
    }
    const list = mergedTravelersForResolve || [];
    return list.map((t) => {
      const cust = linkedCustomerFromTraveler(t);
      const line = travelerDisplayLine(t, cust);
      const tName = [t.first_name, t.last_name].filter(Boolean).join(" ");
      const cName = cust ? [cust.first_name, cust.last_name].filter(Boolean).join(" ") : "";
      const cref = t.customer_ref || "";
      return {
        value: String(t.id),
        label: line,
        searchText: `${tName} ${cName} ${cref} ${t.email || ""} ${t.contact_number || ""}`.trim(),
      };
    });
  }, [
    serverMode,
    travelers,
    customers,
    customerIdFilter,
    mergedTravelersForResolve,
  ]);

  function handleChange(v) {
    onChange(v);
    if (!serverMode || !onResolvedRecord || !v || !mergedTravelersForResolve) {
      return;
    }
    const row = mergedTravelersForResolve.find((t) => String(t.id) === String(v));
    if (row) {
      onResolvedRecord(row);
    }
  }

  return (
    <AutocompleteField
      label={label}
      value={value}
      onChange={handleChange}
      options={options}
      required={required}
      onAddNew={onAddNew}
      addNewLabel={addNewLabel}
      wrapperClassName={wrapperClassName || "col-12 col-md-6"}
      hideLabel={hideLabel || !label}
      placeholder={placeholder}
      disabled={disabled}
      inputClassName={inputClassName}
      onDebouncedInputChange={serverMode && !disabled ? (q) => setFetchQuery(q) : undefined}
    />
  );
}
