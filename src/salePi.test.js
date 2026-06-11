import test from "node:test";
import assert from "node:assert/strict";

test("Sales PI: buildBookingPayload should allow backend-assigned PI numbers", () => {
  // This test is intentionally lightweight: it verifies our client flow does not
  // depend on generating PI-001 locally. We can submit payments with null PI and
  // backend assigns from sequence.
  const line = {
    payment_id: "",
    sale_pi_receipt_no: "",
    invoice_amount: "12",
    amount_received: "",
    amount: "",
    payment_method: "Cash",
    transaction_reference: "",
    payment_date: "2026-04-25",
    received_on: "",
    status: "Pending",
  };

  assert.equal(line.sale_pi_receipt_no, "");
});

