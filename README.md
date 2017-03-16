# dynamicjs
Dynamic loader for ES6+ Javascript systems.

### Install
===========
`npm install dynamicjs`

### Use
=======
Replaces require with `dynamic` and `superDynamic`.
* dynamic : Allows the system to load objects or classes with the dynamic system which will reload them on file change in a clean way.
* superDynamic : Allows the system to use a class as a dependency that can be updated but will not reload existing objects created via the `new` operator.
* dynamicFile : This sets a raw file up for watching, which will help with frequent accessed files via a local cache.
* dynamicDir : Watches a directory for both JavaScript changes and raw file changes.
* dynamicCaller : Useful for knowing a files callee; can be used for debugging and is only a utility method.

### Example
===========
```
let init = require( "dynamicjs" ).initialize( {
  persistentObjectVariable : "inital value"
});
require( "dynamicjs" ).makeGlobal();

let dynamicModuleClass = dynamic( "./dynamicModuleName.js" ).ClassDeff;
init.instance = init.instance || new dynamicModuleClass( { "settings" : "Object" } );
```

### Preparations
================
Because of the way the dynamic system works any classes that will be included need to extend Object, which they already do but the super call is required.
```
class myClass extends Object{
  constructor(){
    super();
  }
}
```
This only has to be on the root of an objects inheritance chain.

### Notes
=========
* To replace require make sure to run `require( "dynamicjs" ).makeGlobal();` once.
* ES6 is required to run.
* This is for backend only and will not work in browsers.

### Road Map
============
* Delete trap needs to be implemented.
* Memory management; as at the moment memory use of the system is poor at best.
