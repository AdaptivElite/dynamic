# dynamicjs
Dynamic loader for NodeJS servers or programs. Accelerate development by only having to turn your head.

### Install
`npm install dynamicjs`

### Use
Replaces require with `dynamic` and `superDynamic`.
* dynamic : Allows the system to load objects or classes with the dynamic system which will reload them on file change in a clean way.
* superDynamic : Allows the system to use a class as a dependency that can be updated but will not reload existing objects created via the `new` operator.
* dynamicFile : This sets a raw file up for watching, which will help with frequent accessed files via a local cache.
* dynamicDirectory : Watches a directory for both source changes and raw file changes. This feature is still in flux and will change.

### Example
```
const init = require( "dynamicjs" ).initialize( {
  persistentObjectVariable : "inital value"
});
require( "dynamicjs" ).globalSyntax();
require( "dynamicjs" ).bypass = process.env.NODE_ENV === "production";
const { ClassDeff } = dynamic( "./dynamicModuleName.js" );
init.instance = init.instance || new ClassDeff( { "settings" : "Object" } );
```

### Preparations
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
* To use dynamic without a require statement each time make sure to run `require( "dynamicjs" ).globalSyntax();` once.
* This is for backend only and will not work in browsers. For browsers use a HMR.
* Minimum nodejs version 10.x

### Road Map
* Delete trap needs to be implemented.
* Memory management; as at the moment memory use of the system is poor at best and only sutied for a development a test environment.
