# dynamic
Dynamic loader for ES6+ Javascript systems.

Install
=======
`npm install dynamicjs`

Use
===
Replaces require with `dynamic` and `superDynamic`.
* dynamic : Allows the system to load objects or classes with the dynamic system which will reload them on file change in a clean way.
* superDynamic : Allows the system to use a class as a dependency that can be updated but will not reload existing objects created via the `new` operator. 

Example
=======
```
let init = require( "dynamicjs" ).initialize( {
  persistentObjectVariable : "inital value"
});

let dynamicModuleClass = dynamic( "./dynamicModuleName.js" ).ClassDeff;
init.instance = init.instance || new dynamicModuleClass( { "settings" : "Object" } );
```

Preparations
============
Because of the way the dynamic system works any classes that will be included need to extend Object, which they already do but the super call is required.
```
class myClass extends Object{
  constructor(){
    super();
  }
}
```

Road Map
========
Folder watching is a plan however not implemented as of yet.