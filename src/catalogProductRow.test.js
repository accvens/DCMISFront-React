import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogProductPickerLabel,
  catalogProductPrimaryId,
  catalogRowsHaveSelectableProductId,
} from "./catalogProductRow.js";

test("catalogRowsHaveSelectableProductId: false for empty / non-array", () => {
  assert.equal(catalogRowsHaveSelectableProductId([]), false);
  assert.equal(catalogRowsHaveSelectableProductId(null), false);
  assert.equal(catalogRowsHaveSelectableProductId(undefined), false);
});

test("catalogRowsHaveSelectableProductId: true when product_id present", () => {
  assert.equal(catalogRowsHaveSelectableProductId([{ product_id: 12, product_name: "Tour" }]), true);
});

test("catalogRowsHaveSelectableProductId: false when rows lack any id", () => {
  assert.equal(catalogRowsHaveSelectableProductId([{ product_name: "orphan" }]), false);
});

test("catalogProductPrimaryId reads id fallback", () => {
  assert.equal(catalogProductPrimaryId({ id: 9, product_name: "x" }), 9);
});

test("catalogProductPickerLabel appends product_master_name when present", () => {
  assert.equal(
    catalogProductPickerLabel({
      product_id: 1,
      product_name: "Deluxe room",
      product_master_name: "Hotel",
    }),
    "Deluxe room — Hotel",
  );
  assert.equal(catalogProductPickerLabel({ product_id: 2, product_name: "Only name" }), "Only name");
});
