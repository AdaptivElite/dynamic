/**
 * Tests to make sure file watching and updates act as intended.
 */
const assert = require('assert');
const fs = require( "fs" );

describe('Watcher tests', () => {
  let persistObject = null;

  it( 'should be notified when the file that included dynamic changes', ( next ) => {
    assert.equal( true, false );
  });

  it( 'should be notified when an object file changes and recompile',  () => {
    assert.equal( true, false );
  });

  it( 'should be notified when an object file changes with errors and use old object', () => {
    assert.equal( true, false );
  });

  it( 'should be notified when a raw file changes', () => {
    assert.equal( true, false );
  });

  it( 'should be notified when a file is created and erased', () => {
    assert.equal( true, false );
  } );

} );
