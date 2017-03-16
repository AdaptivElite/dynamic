/*

TODO: Dynamic clean-up via delete trap

*/
const crypto = require( "crypto" );
const fs = require( "fs" );
const path = require( "path" );

/**
 * Class that is injected as a replacement of the object extention, returns Proxy rather then instance of DynamicReflection.
 */
class DynamicReflection{
  /**
   * Constructor for DynamicReflection class.
   * @returns Proxy trap object that points to correct internal stored copy of real object.
   */
  constructor(){
    let dynamicInstance = new.target();
    let context = Reflect.construct( Object, [], dynamicInstance.initialDynamic );
    if( dynamic.dynamicDataMap[dynamicInstance.fileName][dynamicInstance.dynamicName][dynamicInstance.dynamic] !== undefined ){
      let priorContext = dynamic.dynamicDataMap[dynamicInstance.fileName][dynamicInstance.dynamicName][dynamicInstance.dynamic];
      for( let property in priorContext ){
        context[property] = priorContext[property];
      }
    }
    dynamic.dynamicDataMap[dynamicInstance.fileName][dynamicInstance.dynamicName][dynamicInstance.dynamic] = context;
    return dynamic.GenerateProxy( context, dynamicInstance.dynamic, dynamicInstance.fileName, dynamicInstance.dynamicName );
  }
}

/*
 * Works as a start-up error recoverable class, used to allow broken classes to be dynamicly updated without reboots.
 */
class ErrorInitalDynamic extends DynamicReflection{
  /**
   * Constructor of ErrorInitalDynamic error class.
   */
  constructor(){
    super();
  }
}

/**
 * Primary class for the dynamic system, this is instanced as a singleton.
 */
class DynamicSystem{

  /**
   * Constructor of DynamicSystem class.
   */
  constructor(){
    //****************************PUBLIC VARIABLES**************************//
    /**
     *
     */
    this.dynamicDataMap = {};

    //***************************PRIVATE VARIABLES*************************//
    /**
     *
     */
    this._boundDynamics = {};
    /**
     *
     */
    this._dependList = {};
    /**
     *
     */
    this._dynamics = {};
    /**
     *
     */
    this._dynamicInstanceMap = {};
    /**
     *
     */
    this._dynamicMethodMap = {};
    /**
     *
     */
    this._dynamicProxyMap = {};
    /**
     *
     */
    this._dynamicUpdate = {};
    /**
     *
     */
    this._expandedWatchers = {};
    /**
     *
     */
    this._fileWatchers = {};
    /**
     *
     */
    this._hashList = {};
    /**
     *
     */
    this._objectDynamics = {};
    /**
     *
     */
    this._objectDynamicsSets = {};
    /**
     *
     */
    this._rawUpdate = {};
    /**
     *
     */
    this._selfFile = "";
    /**
     *
     */
    this._startupPoints = {};
    /**
     *
     */
    this._uidTracker = 0;
    /**
     *
     */
    this._watchFiles = {};
  }

  //****************************PUBLIC METHODS**************************//

  /**
   * Way to figure out what file performed a call.
   * @param depth - How deep back the stack trace will go to find the callee file.
   * @returns File name of the callee.
   */
  Caller( depth ) {
    let pst, stack, file, frame;

    pst = Error.prepareStackTrace;
    Error.prepareStackTrace = function (_, stack) {
      Error.prepareStackTrace = pst;
      return stack;
    };

    stack = (new Error()).stack;
    depth = !depth || isNaN(depth) ? 1 : (depth > stack.length - 2 ? stack.length - 2 : depth);
    stack = stack.slice(depth + 1);

    do {
      frame = stack.shift();
      file = frame && frame.getFileName();
    } while (stack.length && file === 'module.js');

    return file;
  }

  /**
   * Primary quility of life method that acts like require but adds needed dynamic binding.
   * @param fileName - Name of the file to be required.
   * @param [caller] - File that called the require optionally overrided for dependency resolution.
   * @returns Required file with dynamic bindings attached, should act just like using require with all the buffs dynamic adds.
   */
  Dynamic( fileName, caller = null ){
    if( !fileName.endsWith( ".js" ) ){
      fileName = fileName + ".js";
    }
    caller = caller || this.Caller();
    if( !path.isAbsolute( fileName ) ){
      fileName = path.resolve( path.dirname( caller ), fileName );
    }
    this._AddDependent( fileName, caller );

    return this._CreateDynamics(fileName);
  }

  DynamicDirectory(){

  }

  /**
   * Used for non JavaScript file or files that need to be watched for updates but have a different applied action.
   * @param fileName - File name of file to add to dynamic watch table.
   * @param updateCallback - Method callback that performs action when the file is updated. Not inital load!
   * @param [updateDependent] - If set to true the caller will update based on dependent update.
   * @param [caller] - File that called the require optionally overrided for dependency resolution.
   * @returns Promise which resolve to the file data or rejection with file load error.
   */
  DynamicFile( fileName, updateCallback, updateDependent = false, caller = null ){
    return new Promise( ( resolve, reject ) => {
      let initResolve = false;
      caller = caller || this.Caller();
      if( !path.isAbsolute( fileName ) ){
        fileName = path.resolve( path.dirname( caller ), fileName );
      }
      if( updateDependent ){
        this._AddDependent( fileName, caller );
      }

      this._rawUpdate[fileName] = updateCallback;
      if( this._hashList[fileName] === undefined ){
        fs.readFile( fileName, ( err, fileData ) => {
          if( !err ){
            if( !initResolve ){
              initResolve = true;
              resolve( fileData );
            }
            else{
              updateCallback( fileData );
            }
          }
          else{
            if( !initResolve ){
              initResolve = true;
              reject( err );
            }
            else{
              console.error( "Unable to update dynamic file " + fileName );
            }
          }
        });
      }
      this._SetupWatch( fileName );
    });
  }

  /**
   * Generates the proxy object for the dynamic binding traps.
   * @param context - Context for the proxy.
   * @param dynamicId - Referance to the dynamic instance.
   * @param fileName - Name of the file that generated the dynamic.
   * @param dynamicName - Orignal name of object prior to dynamic binding.
   * @returns Proxy object that directs requests to appropreate dynamic object.
   */
  GenerateProxy( context, dynamicId, fileName, dynamicName ){
    if( dynamic._dynamicProxyMap[fileName][dynamicName][dynamicId] === undefined ){
      dynamic._dynamicProxyMap[fileName][dynamicName][dynamicId] = new Proxy( context, {
        get( target, key ){
          return dynamic.dynamicDataMap[fileName][dynamicName][dynamicId][key];
        },
        set( target, key, value ){
          dynamic.dynamicDataMap[fileName][dynamicName][dynamicId][key] = value;
          target[key] = value;
          return true;
        }
      });
    }
    return dynamic._dynamicProxyMap[fileName][dynamicName][dynamicId];
  }

  /**
   * Attaches dynamic system to global conext.
   */
  GlobalSyntax(){
    global.dynamic = this.Dynamic.bind( this );
    global.superDynamic = this.SuperDynamic.bind( this );
    global.dynamicCaller = this.Caller.bind( this );
    global.dynamicFile = this.DynamicFile.bind( this );
    global.dynamicDir = this.DynamicDirectory.bind( this );
  }

  /**
   * Initializes dynamic system in a bootstrap file.
   * @param persistObject - Object inside core file that will contain persist data after modifications.
   * @param destroyMethod - Teardown method done prior to new version of persist object being constructed.
   * @returns Instance of persistObject that was passed into the method but with dynamic binding.
   */
  Initialize( persistObject, destroyMethod ){
    let initializeFile = this.Caller();
    destroyMethod = destroyMethod || function(){};
    if( this._startupPoints[initializeFile] === undefined ){
      dynamic._SetStartup( initializeFile, destroyMethod, persistObject );
      dynamic._SetSelf( __filename );
    }
    else{
      if( this._startupPoints[initializeFile] !== undefined ){
        this._startupPoints[initializeFile].destroy.call( this._startupPoints[initializeFile].persist );
        for( let persist in this._startupPoints[initializeFile].persist ){
          persistObject[persist] = this._startupPoints[initializeFile].persist[persist];
        }
        this._startupPoints[initializeFile].persist = persistObject;
        this._startupPoints[initializeFile].destroy = destroyMethod;
      }
    }

    return persistObject;
  }

  /**
   * Action that is called when the dynamic system has been updated.
   * @param oldDynamicLoader - The current running version of the dynamic system to copy data tables from.
   */
  Reload( oldDynamicLoader ){
    this._dynamics = oldDynamicLoader._dynamics;
    this._boundDynamics = oldDynamicLoader._boundDynamics;
    for( let startup in oldDynamicLoader._startupPoints ){
      this._SetStartup( startup, oldDynamicLoader._startupPoints[startup].destroy, oldDynamicLoader._startupPoints[startup].persist );
    }
    this._SetSelf( __filename ); //Todo if moved clear old file watcher.
    this._dependList = oldDynamicLoader._dependList;
    this._hashList = oldDynamicLoader._hashList;
    this._dynamicMethodMap = oldDynamicLoader._dynamicMethodMap;
    this._dynamicInstanceMap = oldDynamicLoader._dynamicInstanceMap;
    this._rawUpdate = oldDynamicLoader._rawUpdate;
    for( let filename in oldDynamicLoader._fileWatchers ){
      oldDynamicLoader._fileWatchers[filename].close();
      if( this._startupPoints[filename] === undefined && filename !== oldDynamicLoader._selfFile ){
        this._CreateDynamics( filename );
      }
    }
  }

  /**
   * Acts like require without dynamic binding but adds file to dependency tables, which will update once file has been updated. Use case for classes that extended but not instanced.
   * @param fileName - Name of the file to require as super dynamic.
   * @param [caller] - File that called the require optionally overrided for dependency resolution.
   * @returns Required file without dynamic bindings.
   */
  SuperDynamic( fileName, caller = null ){
    if( !fileName.endsWith( ".js" ) ){
      fileName = fileName + ".js";
    }
    caller = caller || this.Caller();
    if( !path.isAbsolute( fileName ) ){
      fileName = path.resolve( path.dirname( caller ), fileName );
    }
    this._AddDependent( fileName, caller );

    return this._BindDynamics(fileName);
  }

  //***************************PRIVATE METHODS*************************//

  /**
   * Adds a file as a dependent that will recycle when dependencies are changed.
   * @param fileName - Name of the file marked as dependent.
   * @param caller - Calling file for the dependent to trace changes of to.
   */
  _AddDependent( fileName, caller ){
    if( caller !== null ){
      if( this._dependList[fileName] === undefined ){
        this._dependList[fileName] = [];
      }

      if( this._dependList[fileName].indexOf( caller ) === -1 ){
        this._dependList[fileName].push( caller );
      }
    }
  }

  /**
   * Creates and binds dynamics to all the exports in given file.
   * @param fileName - Name of the file to bind dynamics to.
   * @returns Exports from the file bound to the dynamic system.
   */
  _BindDynamics( fileName ){
    if( this._boundDynamics[fileName] === undefined ){
      this._boundDynamics[fileName] = true;
    }
    return this._CreateDynamics( fileName );
  }

  /**
   * Clears the require cache for a file.
   * @param filePath - Path of the file in the require cache. Must already be sanitized.
   * @returns Pre-reloaded cached version that can be loaded for errors.
   */
  _ClearRequireCache( filePath ){
    let oldCache = null;
    if( require.cache[filePath] !== undefined ){
      oldCache = require.cache[filePath];
      delete require.cache[filePath];
    }
    else{
      console.log( "Unable to find require cache for " + filePath );
    }

    return oldCache;
  }

  /**
   * Creates the dynamics for a files exports.
   * @param fileName - File name to create dynamics for.
   * @returns Exports with dynamics created and bound to the objects/functions/classes.
   * @todo Memory clean up for non existing parts of the application.
   */
  _CreateDynamics( fileName ){
    if( this._dynamics[fileName] === undefined || this._dynamicUpdate[fileName] === true ){
      this._dynamicUpdate[fileName] = false;
      let initialDynamics = require( fileName );
      this._SetupWatch( fileName );

      if( this._dynamics[fileName] === undefined ){
        this._dynamics[fileName] = {};
      }

      for( let exportData in initialDynamics ){
        this._dynamics[fileName][exportData] = this._CreateDynamic( fileName, exportData, initialDynamics[exportData] );
      }

      for( let excludedData in this._dynamics ){
        //TODO clean-up parts of the application that no longer exist.
        //convertedStructure[exportData] = this._CreateDynamic( initialDynamics[exportData] );
      }

      //Update the dynamic loader
      this._dynamics[fileName].__dynamicLoader = this;

      return this._dynamics[fileName];
    }
    else{
      this._SetupWatch( fileName );
    }

    return this._dynamics[fileName];

  }

  /**
   * Creates dynamics for functions and objects.
   * @param fileName - Name of the file for caching.
   * @param dynamicName - Name of the function, class, or object that will be bound.
   * @param initialDynamic - Required function, class, or object prototype to create without dynamics.
   * @returns Bound version of function, object, or class.
   */
  _CreateDynamic( fileName, dynamicName, initialDynamic ){
    if( initialDynamic instanceof Function && !this._boundDynamics[fileName] ){
      if( this._dynamicMethodMap[fileName] === undefined || this._dynamicMethodMap[fileName][dynamicName] === undefined ){
        return this._NewDynamicMethod( fileName, dynamicName, initialDynamic );
      }
      else{
        return this._UpdateDynamicMethod( fileName, dynamicName, initialDynamic );
      }
    }
    else if( initialDynamic instanceof Object && !this._boundDynamics[fileName] ){
      return this._CreateObjectDynamics( fileName, dynamicName, initialDynamic );
    }

    return initialDynamic;
  }

  /**
   * Creates dynamics on a object.
   * @param fileName - Name of the file for caching.
   * @param dynamicName - Name of the object for caching.
   * @param dynamicObject - Non-dynamic version of the object that will be bound.
   * @returns Proxy of the Non-dynamic object with needed traps to redirect i/o.
   */
  _CreateObjectDynamics( fileName, dynamicName, dynamicObject ){
    if( this._objectDynamics[fileName] === undefined ){
      this._objectDynamics[fileName] = {};
      this._objectDynamicsSets[fileName] = {};
      this._objectDynamics[fileName][dynamicName] = dynamicObject;
      this._objectDynamicsSets[fileName][dynamicName] = {};
    }
    else{
      this._objectDynamics[fileName][dynamicName] = dynamicObject;
      for( let set in this._objectDynamicsSets[fileName][dynamicName] ){
        this._objectDynamics[set] = this._objectDynamicsSets[fileName][dynamicName][set];
      }
    }

    return new Proxy( {}, {
      get( target, key ){
        return dynamic._objectDynamics[fileName][dynamicName][key];
      },
      set( target, key, value ){
        this._objectDynamicsSets[fileName][dynamicName][key] = value;
        dynamic._objectDynamics[fileName][dynamicName][key] = value;
        target[key] = value;
        return true;
      }
    } );
  }

  /**
   * Get the lowest non-object prototype of an object.
   * @param startingClass - Prototype that will be searched down for low prototype.
   * @returns Lowest prototype inside inheritance chain that is not an Object.
   */
  _GetDeepPrototype( startingClass ){
    let prototype = Object.getPrototypeOf( startingClass );
    if( prototype === Object ){
      return startingClass;
    }
    else{
      if( prototype.prototype !== undefined ){
        return this._GetDeepPrototype( prototype );
      }
      else{
        return startingClass;
      }
    }
  }

  /**
   * Simple md5 checksum on the file to check if the file has changes.
   * @param fileName - Name of the file to get the current md5 checksum for.
   * @param callback - Method to callback with error if any and checksum of file.
   */
  _GetHash( fileName, callback ){
    let hash = crypto.createHash('md5');
    hash.setEncoding('hex');
    fs.readFile( fileName, ( error, data ) => {
      if( !error ){
        hash.write( data );
        hash.end();
        callback( null, hash.read() );
      }
      else{
        console.error( "Hash error with " + fileName );
        callback( error, null );
      }
    } );

  }

  /**
   * Creates a dynamic class.
   * @param fileName - Name of the file for referance.
   * @param dynamicName - Name of the dynamic class for referance.
   * @param initialDynamic - Prototype of the first file load of the class.
   * @returns Dynamic version of method prototype that can be created via "new".
   */
  _NewDynamicMethod( fileName, dynamicName, initialDynamic ){

    let dynamicMethod = null;
    //Magic method that is a wraper for the orignal method.
    dynamicMethod = function(){

      //If we are rebuilding the object then make sure we copy it first//
      let dynamicId = dynamic._UniqueNumber();
      let priorArgs = arguments;
      let surrogateProxy = function(){
        return {
          dynamic : dynamicId,
          fileName : fileName,
          dynamicName : dynamicName,
          initialDynamic : initialDynamic
        };
      };
      dynamic._ReplaceDeepPrototype( initialDynamic );
      let proxyInstance = null;
      try{
        proxyInstance = Reflect.construct( initialDynamic, priorArgs, surrogateProxy );
      }
      catch( ex ){
        console.error( "Unable to load dynamic class, a placeholder was used for requested instance." );
        console.error( ex );
        initialDynamic = ErrorInitalDynamic;
        proxyInstance = Reflect.construct( ErrorInitalDynamic, priorArgs, surrogateProxy );
      }
      this.__rebuild = function( nextInitialDynamic ){
        let oldInitialDynamic = initialDynamic;
        initialDynamic = nextInitialDynamic;
        try{
          dynamicMethod.prototype.__original = initialDynamic;
          dynamic._ReplaceDeepPrototype( initialDynamic );
          let newProxy = Reflect.construct( initialDynamic, priorArgs, surrogateProxy );
        }
        catch( ex ){
          console.error( "Unable to load dynamic class, a placeholder was used for requested instance." );
          console.error( ex );
          initialDynamic = oldInitialDynamic;
          let newProxy = Reflect.construct( initialDynamic, priorArgs, surrogateProxy );
        }

      }

      dynamic._dynamicInstanceMap[fileName][dynamicName][this.__dynamicId] = this;
      return proxyInstance;
    };

    dynamicMethod.prototype.__original = initialDynamic;

    //Make sure mapping exists
    if( this._dynamicMethodMap[fileName] === undefined ){
      this._dynamicMethodMap[fileName] = {};
      this._dynamicInstanceMap[fileName] = {};
      this.dynamicDataMap[fileName] = {};
      this._dynamicProxyMap[fileName] = {};
    }
    if( this._dynamicMethodMap[fileName][dynamicName] === undefined ){
      this._dynamicMethodMap[fileName][dynamicName] = dynamicMethod;
      this._dynamicInstanceMap[fileName][dynamicName] = {};
      this.dynamicDataMap[fileName][dynamicName] = {};
      this._dynamicProxyMap[fileName][dynamicName] = {};
    }

    return this._dynamicMethodMap[fileName][dynamicName];
  }

  /**
   * Reload event when files change, which checks has and reloads dynamics if it changed.
   * @param trigger - Event that triggered the reload call, from fs.watch.
   * @param filePath - Path of the file that changed, must be sanitized.
   * @param callback - Callback when the file is loaded which can include errors.
   */
  _ReloadFile( trigger, filePath, callback ){
    this._GetHash( filePath, ( error, changeHash ) => {
      if( !error && changeHash !== this._hashList[filePath] ){
        if( this._rawUpdate[filePath] !== undefined ){
          fs.readFile( filePath, ( err, fileData ) => {
            if( !err ){
              this._rawUpdate[filePath](fileData);
            }
            else{
              console.error( "Unable to update changes to file " + filePath );
            }
          });
        }
        else{
          this._dynamicUpdate[filePath] = true;
          this._ReloadPath( filePath );
        }
        this._hashList[filePath] = changeHash;
        callback( null );
        this._ResolveDependencies( filePath );
      }
      else{
        callback( error );
      }

    });

  }

  /**
   * Reload trigger for full path changes.
   * @param filePath - Path that triggered a reload.
   */
  _ReloadPath( filePath ){
    let oldCache = null;
    if( this._startupPoints[filePath] === undefined && filePath != this._selfFile ){
      try{
        oldCache = this._ClearRequireCache( filePath );
        this._CreateDynamics( filePath );
      }
      catch( ex ){
        this._RestoreRequireCache( filePath, oldCache, ex );
      }
    }
    else{
      if( this._startupPoints[filePath] !== undefined ){
        try{
          //Dynamic loader re-include startup script.
          oldCache = this._ClearRequireCache( filePath );
          require( filePath );
        }
        catch( ex ){
          this._RestoreRequireCache( filePath, oldCache, ex );
        }
      }
      else {
        try{
          //Dynamic loader reload system
          oldCache = this._ClearRequireCache( this._selfFile );
          require( __filename ).reload( this );
        }
        catch( ex ){
          this._RestoreRequireCache( filePath, oldCache, ex );
        }
      }
    }
  }

  /**
   * Replaces the low layer object prototype with DynamicReflection class to make dynamics work.
   * @param startingClass - Prototype that has a deep class to replace.
   */
  _ReplaceDeepPrototype( startingClass ){
    let deepPrototype = this._GetDeepPrototype( startingClass );
    if( deepPrototype instanceof Object ){
      if( deepPrototype !== DynamicReflection ){
        Object.setPrototypeOf( deepPrototype, DynamicReflection );
      }
    }
    else if( !( deepPrototype instanceof DynamicReflection ) ){
      console.error( "Deep prototype for " + startingClass + " was not found" );
      //Warn that this object cannot be attached to dynamic system at this time.
    }
  }

  /**
   * Resolves the dependency tree for a given file path, and issues reloads.
   * @param filePath - File path to do a dependency trace on.
   */
  _ResolveDependencies( filePath ){
    if( this._dependList[filePath] !== undefined ){
      for( let i = 0; i < this._dependList[filePath].length; i++ ){
        this._dynamicUpdate[this._dependList[filePath][i]] = true;
        this._ReloadPath( this._dependList[filePath][i] );
      }
    }
  }

  /**
   * Restore an object to a working state when the object crashes.
   * @param filePath - File path for require cache must be sanitized.
   * @param oldCache - Old cache that will be restored as the current running dynamic object.
   * @param exception - Exception that triggered the file to be unable to compile/instance.
   */
  _RestoreRequireCache( filePath, oldCache, exception ){
    if( oldCache !== null ){
      console.error( "Unable to rebuild cache object, " + filePath );
      console.error( exception );
      console.error( exception.stack );
      require.cache[filePath] = oldCache;
    }
    else{
      //This should never happen, and if it does there is a very bad nodejs error that caused memory corruption.
      console.error( "Unable to rebuild cache object and unable to restore crash." );
      console.error( "Memory corruption error. Restart nodejs and perhaps the server as well." );
      console.error( exception );
      console.error( exception.stack );
    }
  }

  /**
   * Setup the path of dynamic to watch for changes to itself.
   * @param dynamicLoaderPath - Path of the dynamic loader that just loaded and instanced this very class.
   * @todo Because the dynamic system needs to work in a singleton pattern a check needs to take place to prevent multi instanced versions.
   */
  _SetSelf( dynamicLoaderPath ){
    //TODO check if npm sub requirements setup two locations for dynamic.
    this._selfFile = path.resolve( dynamicLoaderPath );
    this._SetupWatch( this._selfFile );
  }

  /**
   * Creates the start-up file watching system so that the file that called dynamic is also dynamic, making the whole use case dynamic.
   * @param initialFile - Path of the file that called dynamic.
   * @param destroyMethod - Method called when the inital file is reloaded.
   * @param persistObject - A collection of data in an object that will persist if able after reloads.
   */
  _SetStartup( initialFile, destroyMethod, persistObject ){
    this._startupPoints[initialFile] = {
      destroy : destroyMethod,
      persist : persistObject
    };
    this._SetupWatch( initialFile );
  }

  /**
   * Starts a file watch for a file by making sure the directory is watched and adding the file into the list of file for that directory.
   * @param fileName - Name of the file to add to the watch list.
   */
  _SetupWatch( fileName ){
    if( this._watchFiles[path.dirname( fileName )] === undefined ){
      this._WatchDir( path.dirname( fileName ) );
    }
    if( this._watchFiles[path.dirname( fileName )][path.basename( fileName )] === undefined ){
      this._watchFiles[path.dirname( fileName )][path.basename( fileName )] = false;
      this._GetHash( fileName, ( error, hash ) => {
        if( !error ){
          this._hashList[fileName] = hash;
        }
      } );
    }
  }

  /**
   * Incroments a unique id tracker for lookup of dynamic objects.
   * @returns Next unique id.
   * @todo Currently this will break after long term use because it does not reset, and rather then reseting it a new approch is needed to make it consistant.
   */
  _UniqueNumber(){
    return this._uidTracker++;
  }

  /**
   * Updates the current dynamic method and issues a rebuild of the internals of that dynamic object.
   * @param fileName - File name used for referance.
   * @param dynamicName - Name of the dynamic object for referance.
   * @param initialDynamic - Non dynamic version of current build vs. last build. Used to map one instanced to another.
   * @returns Rebuild dynamic bound object.
   */
  _UpdateDynamicMethod( fileName, dynamicName, initialDynamic ){
    //Deal with object reconstructing.
    for( let dynamicId in this._dynamicInstanceMap[fileName][dynamicName] ){
      this._dynamicInstanceMap[fileName][dynamicName][dynamicId].__rebuild( initialDynamic );
    }

    return this._dynamicMethodMap[fileName][dynamicName];
  }

  /**
   * Watches a directory for changes and issues appropreate triggers on changes.
   * @param dirname - Name of the directory to be watched.
   * @todo Sometimes the file changes are not caught because rather then doing a direct save a temp file is renamed and this needs to be accounted for.
   * @note Known program issues with: VIM, WebStorm
   * @todo Deal with logic for added and removed files from directories.
   */
  _WatchDir( dirname ){
    if( this._fileWatchers[dirname] !== undefined ){
      return;
    }
    this._watchFiles[dirname] = {};
    try{
      this._fileWatchers[dirname] = fs.watch( dirname, ( e, eFileName ) => {
        if( this._expandedWatchers[dirname] !== undefined ){
          //@TODO Allow new and deleted files//
        }
        if( this._watchFiles[dirname][eFileName] === false ){
          this._watchFiles[dirname][eFileName] = true;
          this._ReloadFile( e, path.normalize( dirname + "/" + eFileName ), ( ) => {
            this._watchFiles[dirname][eFileName] = false;
          } );
          if( e === "rename" ){
            //@TODO Check to see if it is a new file

            //@TODO Check to see if it still exists

            //@TODO Figure out how to do a real rename
          }
        }
      } );
    }
    catch( ex ){
      console.warn( "Unable to setup watcher for " + fileName );
    }
  }

}

////////////////////////////////EXPORTS//////////////////////////////////////////
const dynamicSystem = new DynamicSystem();
exports.dynamic = dynamicSystem.Dynamic.bind( dynamicSystem );
exports.superDynamic = dynamicSystem.SuperDynamic.bind( dynamicSystem );
exports.dynamicFile = dynamicSystem.DynamicFile.bind( dynamicSystem );
exports.dynamicDir = dynamicSystem.DynamicDirectory.bind( dynamicSystem );
exports.reload = dynamicSystem.Reload.bind( dynamicSystem );
exports.initialize = dynamicSystem.Initialize.bind( dynamicSystem );
exports.dynamicCaller = dynamicSystem.Caller.bind( dynamicSystem );
exports.makeGlobal = dynamicSystem.GlobalSyntax.bind( dynamicSystem );
