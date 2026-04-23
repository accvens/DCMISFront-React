import assert from "node:assert/strict";
import test from "node:test";
import {
  extractPaymentCatalogArray,
  extractVendorDetailPaymentCatalog,
  mergeVendorPaymentCatalogRows,
  mergeVendorPaymentPickerRows,
  productTypeOptgroupLabelByIdMap,
  productTypeOptgroupLabelMapFromVendorDetail,
  vendorPaymentProductSelectGroups,
} from "./vendorPaymentCatalog.js";

test("extractPaymentCatalogArray: plain array", () => {
  assert.deepEqual(extractPaymentCatalogArray([{ product_id: 1 }]), [{ product_id: 1 }]);
});

test("extractPaymentCatalogArray: null / undefined", () => {
  assert.deepEqual(extractPaymentCatalogArray(null), []);
  assert.deepEqual(extractPaymentCatalogArray(undefined), []);
});

test("extractPaymentCatalogArray: paginated items wrapper", () => {
  assert.deepEqual(
    extractPaymentCatalogArray({ items: [{ product_id: 2 }], total: 1 }),
    [{ product_id: 2 }],
  );
});

test("extractPaymentCatalogArray: unknown shape", () => {
  assert.deepEqual(extractPaymentCatalogArray({ foo: 1 }), []);
});

test("extractVendorDetailPaymentCatalog: from VendorDetailOut body", () => {
  assert.deepEqual(
    extractVendorDetailPaymentCatalog({
      id: 210,
      payment_catalogue_products: [{ product_id: 1, product_name: "A" }],
    }),
    [{ product_id: 1, product_name: "A" }],
  );
  assert.deepEqual(extractVendorDetailPaymentCatalog(null), []);
  assert.deepEqual(extractVendorDetailPaymentCatalog({ id: 1 }), []);
});

test("extractVendorDetailPaymentCatalog: camelCase paymentCatalogueProducts", () => {
  assert.deepEqual(
    extractVendorDetailPaymentCatalog({
      id: 210,
      paymentCatalogueProducts: [{ product_id: 2, product_name: "B" }],
    }),
    [{ product_id: 2, product_name: "B" }],
  );
});

test("extractVendorDetailPaymentCatalog: nested data wrapper", () => {
  assert.deepEqual(
    extractVendorDetailPaymentCatalog({
      data: {
        payment_catalogue_products: [{ product_id: 3, product_name: "C" }],
      },
    }),
    [{ product_id: 3, product_name: "C" }],
  );
});

test("mergeVendorPaymentCatalogRows: fills product_name from master", () => {
  const master = new Map([
    [
      "10",
      {
        product_id: 10,
        product_name: "Hotel Dubai",
        product_type_id: 1,
        destination: "Dubai",
        vendor_id: 5,
        price: "100.00",
      },
    ],
  ]);
  const apiRow = { product_id: 10, product_name: "", product_type_id: 1, destination: "Dubai", vendor_id: null };
  const out = mergeVendorPaymentCatalogRows([apiRow], master);
  assert.equal(out.length, 1);
  assert.equal(out[0].product_name, "Hotel Dubai");
  assert.equal(String(out[0].product_id), "10");
});

test("mergeVendorPaymentCatalogRows: empty master map still normalizes", () => {
  const out = mergeVendorPaymentCatalogRows(
    [{ product_id: 7, product_name: "X", product_type_id: 1, destination: "A", vendor_id: 1, price: 1 }],
    new Map(),
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].product_name, "X");
});

test("mergeVendorPaymentPickerRows: uses fallback when API rows lack selectable product id", () => {
  const master = new Map([
    [
      "10",
      {
        product_id: 10,
        product_name: "Hotel Dubai",
        product_type_id: 1,
        destination: "Dubai",
        vendor_id: 5,
        price: "100.00",
      },
    ],
  ]);
  const badApi = [{ product_name: "broken row", destination: "Dubai" }];
  const fallback = [
    {
      product_id: 10,
      product_name: "Hotel Dubai",
      product_type_id: 1,
      destination: "Dubai",
      vendor_id: 5,
    },
  ];
  const out = mergeVendorPaymentPickerRows(badApi, fallback, master);
  assert.equal(out.length, 1);
  assert.equal(String(out[0].product_id), "10");
});

test("mergeVendorPaymentPickerRows: empty API and empty fallback still uses masters map pool", () => {
  const master = new Map([
    [
      "99",
      {
        product_id: 99,
        product_name: "Orphan row",
        product_type_id: 3,
        destination: "Dubai",
        vendor_id: null,
        price: "50.00",
      },
    ],
  ]);
  const out = mergeVendorPaymentPickerRows([], [], master);
  assert.equal(out.length, 1);
  assert.equal(String(out[0].product_id), "99");
});

test("vendorPaymentProductSelectGroups: optgroups follow assigned_product_type_ids order", () => {
  const vendorRow = { assigned_product_type_ids: [15, 1] };
  const productTypes = [
    { id: 1, product_name: "Hotel", description: "Hotel Accommodation" },
    { id: 15, product_name: "Package", description: "Package" },
  ];
  const products = [
    { product_id: 10, product_name: "P1", product_type_id: 15 },
    { product_id: 11, product_name: "H1", product_type_id: 1 },
  ];
  const groups = vendorPaymentProductSelectGroups(products, vendorRow, productTypes);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].label, "Package");
  assert.equal(groups[0].items.length, 1);
  assert.equal(groups[1].label, "Hotel Accommodation");
});

test("productTypeOptgroupLabelByIdMap: description wins over name", () => {
  const m = productTypeOptgroupLabelByIdMap([
    { id: 2, product_name: "Flight", description: "Flight Ticket" },
  ]);
  assert.equal(m.get(2), "Flight Ticket");
});

test("productTypeOptgroupLabelByIdMap: accepts product_type_id instead of id", () => {
  const m = productTypeOptgroupLabelByIdMap([
    { product_type_id: 1, product_name: "Hotel", description: "Hotel Accommodation" },
  ]);
  assert.equal(m.get(1), "Hotel Accommodation");
});

test("vendorPaymentProductSelectGroups: skips empty types, no placeholder group", () => {
  const vendorRow = { assigned_product_type_ids: [1, 2, 15] };
  const productTypes = [
    { id: 1, product_name: "Hotel", description: "Hotel Accommodation" },
    { id: 2, product_name: "Flight", description: "Flight Ticket" },
    { id: 15, product_name: "Package", description: "Package" },
  ];
  const products = [{ product_id: 5, product_name: "Only hotel", product_type_id: 1 }];
  const groups = vendorPaymentProductSelectGroups(products, vendorRow, productTypes);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "Hotel Accommodation");
});

test("vendorPaymentProductSelectGroups: optgroup labels from vendor detail when masters list empty", () => {
  const vendorRow = {
    assigned_product_type_ids: [15, 1],
    assigned_product_types: [
      { product_type_id: 15, product_name: "Package", description: "Package tours" },
      { product_type_id: 1, product_name: "Hotel", description: "Hotel Accommodation" },
    ],
  };
  const products = [
    { product_id: 10, product_name: "P1", product_type_id: 15 },
    { product_id: 11, product_name: "H1", product_type_id: 1 },
  ];
  const groups = vendorPaymentProductSelectGroups(products, vendorRow, []);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].label, "Package tours");
  assert.equal(groups[1].label, "Hotel Accommodation");
});

test("vendorPaymentProductSelectGroups: legacy briefs without product_type_id zip by order", () => {
  const vendorRow = {
    assigned_product_type_ids: [2, 1],
    assigned_product_types: [
      { product_name: "Flight", description: "Flight Ticket" },
      { product_name: "Hotel", description: "Hotel Accommodation" },
    ],
  };
  const products = [
    { product_id: 10, product_name: "F1", product_type_id: 2 },
    { product_id: 11, product_name: "H1", product_type_id: 1 },
  ];
  const groups = vendorPaymentProductSelectGroups(products, vendorRow, []);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].label, "Flight Ticket");
  assert.equal(groups[1].label, "Hotel Accommodation");
});

test("productTypeOptgroupLabelMapFromVendorDetail: maps ids from API briefs", () => {
  const m = productTypeOptgroupLabelMapFromVendorDetail({
    assigned_product_type_ids: [1, 15],
    assigned_product_types: [
      { product_type_id: 1, product_name: "Hotel", description: "Stay" },
      { product_type_id: 15, product_name: "Package", description: "" },
    ],
  });
  assert.equal(m.get(1), "Stay");
  assert.equal(m.get(15), "Package");
});
