"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var assert = require("assert");
suite('Extension Test Suite', function () {
    test('Sample test', function () {
        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    });
});
