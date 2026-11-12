import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPriceText } from "../assets/app/utils.js";

test("formatPriceText_come_nella_tabella", () => {
  assert.equal(formatPriceText("3.4€"), "3,40€");
  assert.equal(formatPriceText("12.38€/kg"), "12,38€/kg");
  assert.equal(formatPriceText("1,29€"), "1,29€");
  assert.equal(formatPriceText("??€/kg"), "??€/kg");
  assert.equal(formatPriceText("prezzo strano"), "prezzo strano");
});
