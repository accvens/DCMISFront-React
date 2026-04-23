import assert from "node:assert/strict";
import test from "node:test";
import {
  filterCatalogProductsByVendorAssignedTypes,
  mergeVendorRowWithPaymentDetailCache,
  normalizeAssignedProductTypeIds,
  typeIdsFromVendorProductLinks,
  vendorAssignedTypeIds,
} from "./assignedProductTypeIds.js";

test("normalizeAssignedProductTypeIds: Postgres array text", () => {
  assert.deepEqual(normalizeAssignedProductTypeIds("{1,2,15}"), [1, 2, 15]);
});

test("vendorAssignedTypeIds: uses assigned_product_types when ids missing", () => {
  const row = {
    assigned_product_types: [
      { product_type_id: 15, product_name: "Package" },
      { product_type_id: 1, product_name: "Hotel" },
    ],
  };
  assert.deepEqual(vendorAssignedTypeIds(row), [15, 1]);
});

test("vendorAssignedTypeIds: prefers assigned_product_type_ids when present", () => {
  const row = {
    assigned_product_type_ids: [1, 2, 15],
    assigned_product_types: [{ product_type_id: 99, product_name: "X" }],
  };
  assert.deepEqual(vendorAssignedTypeIds(row), [1, 2, 15]);
});

test("vendorAssignedTypeIds: prefers vendor_products link order over assigned_product_type_ids", () => {
  const row = {
    vendor_products: [
      { id: 10, vendor_id: 1, product_type_id: 15 },
      { id: 11, vendor_id: 1, product_type_id: 1 },
    ],
    assigned_product_type_ids: [1, 2, 99],
  };
  assert.deepEqual(vendorAssignedTypeIds(row), [15, 1]);
});

test("typeIdsFromVendorProductLinks: camelCase keys", () => {
  assert.deepEqual(
    typeIdsFromVendorProductLinks({
      vendorProducts: [{ productTypeId: 3 }, { product_type_id: 7 }],
    }),
    [3, 7],
  );
});

test("filterCatalogProductsByVendorAssignedTypes: uses vendor_products type ids", () => {
  const vendor = {
    vendor_products: [
      { id: 1, vendor_id: 210, product_type_id: 1 },
      { id: 2, vendor_id: 210, product_type_id: 15 },
    ],
  };
  const products = [
    { product_id: 10, product_type_id: 1, product_name: "A" },
    { product_id: 11, product_type_id: 99, product_name: "B" },
  ];
  const out = filterCatalogProductsByVendorAssignedTypes(products, vendor, true);
  assert.equal(out.length, 1);
  assert.equal(out[0].product_id, 10);
});

test("filterCatalogProductsByVendorAssignedTypes: narrows masters rows by assigned ids", () => {
  const vendor = { assigned_product_type_ids: [1, 2] };
  const products = [
    { product_id: 10, product_type_id: 1, product_name: "A" },
    { product_id: 11, product_type_id: 99, product_name: "B" },
  ];
  const out = filterCatalogProductsByVendorAssignedTypes(products, vendor, true);
  assert.equal(out.length, 1);
  assert.equal(out[0].product_id, 10);
});

test("filterCatalogProductsByVendorAssignedTypes: no vendor id keeps full list", () => {
  const vendor = { assigned_product_type_ids: [1] };
  const products = [{ product_id: 11, product_type_id: 99 }];
  const out = filterCatalogProductsByVendorAssignedTypes(products, vendor, false);
  assert.equal(out.length, 1);
});

test("filterCatalogProductsByVendorAssignedTypes: no assigned types keeps full list", () => {
  const vendor = {};
  const products = [{ product_id: 11, product_type_id: 99 }];
  const out = filterCatalogProductsByVendorAssignedTypes(products, vendor, true);
  assert.equal(out.length, 1);
});

test("filterCatalogProductsByVendorAssignedTypes: falls back when filter matches nothing", () => {
  const vendor = { assigned_product_type_ids: [1] };
  const products = [{ product_id: 11, product_type_id: 99 }];
  const out = filterCatalogProductsByVendorAssignedTypes(products, vendor, true);
  assert.equal(out.length, 1);
  assert.equal(out[0].product_id, 11);
});

test("vendorAssignedTypeIds: brief uses id when product_type_id missing", () => {
  const row = {
    assigned_product_types: [
      { id: 2, product_name: "Flight" },
      { id: 1, product_name: "Hotel" },
    ],
  };
  const ids = vendorAssignedTypeIds(row);
  assert.deepEqual(ids, [2, 1]);
});

test("mergeVendorRowWithPaymentDetailCache: derives ids from briefs when cache ids empty", () => {
  const base = { id: 210, vendor_name: "Dubai Travel LLC" };
  const cache = {
    "210": {
      assigned_product_type_ids: [],
      assigned_product_types: [
        { product_type_id: 1, product_name: "Hotel" },
        { product_type_id: 15, product_name: "Package" },
      ],
    },
  };
  const merged = mergeVendorRowWithPaymentDetailCache(base, "210", cache);
  assert.deepEqual(merged.assigned_product_type_ids, [1, 15]);
  assert.equal(merged.assigned_product_types.length, 2);
});

test("mergeVendorRowWithPaymentDetailCache: brief id fallback when cache ids empty", () => {
  const base = { id: 210, vendor_name: "V" };
  const cache = {
    "210": {
      assigned_product_type_ids: [],
      assigned_product_types: [
        { id: 3, product_name: "X" },
        { id: 5, product_name: "Y" },
      ],
    },
  };
  const merged = mergeVendorRowWithPaymentDetailCache(base, "210", cache);
  assert.deepEqual(merged.assigned_product_type_ids, [3, 5]);
});

test("mergeVendorRowWithPaymentDetailCache: prefers explicit cache ids over brief order", () => {
  const base = { id: 1, vendor_name: "A" };
  const cache = {
    "1": {
      assigned_product_type_ids: [15, 1, 2],
      assigned_product_types: [{ product_type_id: 1, product_name: "Hotel" }],
    },
  };
  const merged = mergeVendorRowWithPaymentDetailCache(base, "1", cache);
  assert.deepEqual(merged.assigned_product_type_ids, [15, 1, 2]);
});

test("mergeVendorRowWithPaymentDetailCache: no cache returns base unchanged", () => {
  const base = { id: 1, vendor_name: "A" };
  assert.strictEqual(mergeVendorRowWithPaymentDetailCache(base, "99", {}), base);
});

test("mergeVendorRowWithPaymentDetailCache: camelCase cache keys on entry", () => {
  const base = { id: 5, vendor_name: "B" };
  const cache = {
    "5": {
      assignedProductTypeIds: [2],
      assignedProductTypes: [{ productTypeId: 2, product_name: "Flight" }],
    },
  };
  const merged = mergeVendorRowWithPaymentDetailCache(base, "5", cache);
  assert.deepEqual(merged.assigned_product_type_ids, [2]);
});

test("mergeVendorRowWithPaymentDetailCache: copies vendor_products from cache entry", () => {
  const base = { id: 9, vendor_name: "V" };
  const links = [
    { id: 1, vendor_id: 9, product_type_id: 2 },
    { id: 2, vendor_id: 9, product_type_id: 5 },
  ];
  const merged = mergeVendorRowWithPaymentDetailCache(base, "9", {
    "9": { vendor_products: links, assigned_product_types: [] },
  });
  assert.deepEqual(merged.vendor_products, links);
  assert.deepEqual(merged.assigned_product_type_ids, [2, 5]);
});

test("filterCatalogProductsByVendorAssignedTypes: product_master_id only row", () => {
  const vendor = { assigned_product_type_ids: [7] };
  const products = [{ product_id: 100, product_master_id: 7, product_name: "Only master col" }];
  const out = filterCatalogProductsByVendorAssignedTypes(products, vendor, true);
  assert.equal(out.length, 1);
  assert.equal(out[0].product_id, 100);
});

test("filterCatalogProductsByVendorAssignedTypes: mixed types strict subset", () => {
  const vendor = { assigned_product_type_ids: [1, 15] };
  const products = [
    { product_id: 1, product_type_id: 1, product_name: "H" },
    { product_id: 2, product_type_id: 2, product_name: "F" },
    { product_id: 3, product_type_id: 15, product_name: "P" },
  ];
  const out = filterCatalogProductsByVendorAssignedTypes(products, vendor, true);
  assert.equal(out.length, 2);
  assert.ok(out.some((p) => p.product_id === 1));
  assert.ok(out.some((p) => p.product_id === 3));
});
