/*
 * Tests to asssure global accessers are placed in global space.
 */
const assert = require('assert');
const dynamic = require('../dynamic');

describe('Global context tests', () => {
  it('should create a global accesser in global space', () => {
    dynamic.makeGlobal();
    assert.notEqual( global["dynamic"], undefined );
    assert.notEqual( global["superDynamic"], undefined );
    assert.notEqual( global["dynamicCaller"], undefined );
    assert.notEqual( global["dynamicFile"], undefined );
    assert.notEqual( global["dynamicDir"], undefined );
  } );
} );
