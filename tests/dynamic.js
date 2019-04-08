/*
 * Tests to make sure dynamic system is also performing dynamics.
 */
const assert = require('assert');
const fs = require( "fs" );

describe('Dynamic system tests', () => {
  it( 'should recompile dynamic system with changes', () => {
    assert.equal( true, false );
  });

  after( () => {
    fs.unlinkSync( "tests/testcase/methodfile.js" );
    fs.unlinkSync( "tests/testcase/classinheritancedeepfile.js" );
    fs.unlinkSync( "tests/testcase/classinheritancefile.js" );
    fs.unlinkSync( "tests/testcase/objectfile.js" );
    fs.unlinkSync( "tests/testcase/classfile.js" );
    fs.unlinkSync( "tests/testcase/mainfile.js" );
    fs.unlinkSync( "tests/testcase/dynamic.js" );
    fs.unlinkSync( "tests/testcase/rawfile.dat" );
    fs.rmdirSync( "tests/testcase/dirtest" );
    fs.rmdirSync( "tests/testcase" );
  });
} );
