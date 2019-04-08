/*
 * Tests to asssure global accessers are placed in global space.
 */
const assert = require('assert');
const fs = require( "fs" );

describe('Global context and init tests', () => {

  before( () => {
    fs.mkdirSync( "tests/testcase" );
    fs.writeFileSync( "tests/testcase/dynamic.js", fs.readFileSync( "dynamic.js" ) );
    fs.writeFileSync( "tests/testcase/mainfile.js", `let init = require( "./dynamic" ).initialize( {
      persistentObjectVariable : "inital value"
    });
    require( "./dynamic" ).globalSyntax();
    exports.persistObject = init;` );
    fs.writeFileSync( "tests/testcase/classfile.js", "test" );
    fs.writeFileSync( "tests/testcase/objectfile.js", "test" );
    fs.writeFileSync( "tests/testcase/classinheritancefile.js", "test" );
    fs.writeFileSync( "tests/testcase/classinheritancedeepfile.js", "test" );
    fs.writeFileSync( "tests/testcase/methodfile.js", "test" );
    fs.writeFileSync( "tests/testcase/rawfile.dat", "xyz" );
    fs.mkdirSync( "tests/testcase/dirtest" );
  });

  it('should create a global accesser in global space after including dynamic', () => {
    require( "./testcase/mainfile.js" );
    assert.notEqual( global.dynamic, undefined );
    assert.notEqual( global.superDynamic, undefined );
    assert.notEqual( global.dynamicFile, undefined );
    assert.notEqual( global.dynamicDirectory, undefined );
  } );

  it( 'should keep track of persistent object changes', ( next ) => {
    persistObject = require( "./testcase/mainfile.js" ).persistObject;
    assert.equal( persistObject.addingValue, undefined );
    
    fs.writeFileSync( "tests/testcase/mainfile.js", `let init = require( "./dynamic" ).initialize( {
      persistentObjectVariable : "inital value"
    });
    require( "./dynamic" ).globalSyntax();
    
    init.addingValue = "test";
    
    exports.persistObject = init;` );
    setTimeout( () => {
      assert.equal( persistObject.addingValue, "test" );
      next();
    }, 100 );
    
  });

  /*it( 'should keep discard changes to the init of the persistent object changes', ( next ) => {
    persistObject = require( "./testcase/mainfile.js" ).persistObject;
    
    fs.writeFileSync( "tests/testcase/mainfile.js", `let init = require( "./dynamic" ).initialize( {
      persistentObjectVariable : "inital value",
      addingValue: "bad",
      newValue: "missing"
    });
    require( "./dynamic" ).globalSyntax();
    
    exports.persistObject = init;` );
    setTimeout( () => {
      assert.equal( persistObject.addingValue, "test" );
      assert.equal( persistObject.newValue, undefined );
      next();
    }, 100 );
    
  });*/
} );
