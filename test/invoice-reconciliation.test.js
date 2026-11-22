var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function billedOrder(items, coupon) {
  var totals = pricing.computeTotals(items, coupon);
  return {
    id: 1001,
    date: '2026-11-22',
    customer: 'Test Customer',
    items: items,
    coupon: coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice uses the billed HSN GST rate when the line has no gstRate', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 1000,
    qty: 1
  }];
  var order = billedOrder(items, '');

  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 50);
  assert.equal(order.total, 1050);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, 50);
  assert.equal(invoiceFigures.cgst, 25);
  assert.equal(invoiceFigures.sgst, 25);
  assert.equal(invoiceFigures.total, 1050);
});

test('invoice applies SAVE10 to the same subtotal as the billed order', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 1000,
    qty: 1
  }];
  var order = billedOrder(items, 'SAVE10');

  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 100);
  assert.equal(order.tax, 45);
  assert.equal(order.total, 945);
  assert.equal(invoiceFigures.discount, 100);
  assert.equal(invoiceFigures.tax, 45);
  assert.equal(invoiceFigures.total, 945);
});

test('invoice figures match the GST breakdown and amount billed for an HSN order with SAVE10', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 1000,
    qty: 1
  }];
  var order = billedOrder(items, 'SAVE10');

  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(invoiceFigures, {
    subtotal: 1000,
    discount: 100,
    tax: 45,
    cgst: 22.5,
    sgst: 22.5,
    total: 945,
    rows: [{
      name: 'Rice',
      sku: '-',
      hsn: '1006',
      qty: 1,
      price: 1000,
      gstPercent: 5,
      line: 1000,
      lineTax: 45
    }]
  });
});

test('GST reconciliation marks matching invoice and billed figures from in-memory orders', function () {
  var order = billedOrder([{
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 1000,
    qty: 1
  }], 'SAVE10');

  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.deepEqual(reconciliation, {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 1001,
      date: '2026-11-22',
      customer: 'Test Customer',
      coupon: 'SAVE10',
      ledgerSubtotal: 1000,
      ledgerDiscount: 100,
      ledgerTax: 45,
      ledgerTotal: 945,
      invoiceDiscount: 100,
      invoiceTax: 45,
      invoiceTotal: 945,
      delta: 0,
      matched: true
    }]
  });
});
