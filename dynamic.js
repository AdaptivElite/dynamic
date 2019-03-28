/*

TODO: Dynamic clean-up via delete trap

*/
const crypto = require( "crypto" );
const fs = require( "fs" );
const path = require( "path" );
const chokidar = require('chokidar');

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
    if( dynamicSystem.dynamicDataMap[dynamicInstance.fileName][dynamicInstance.dynamicName][dynamicInstance.dynamic] !== undefined ){
      let priorContext = dynamicSystem.dynamicDataMap[dynamicInstance.fileName][dynamicInstance.dynamicName][dynamicInstance.dynamic];
      for( let property in priorContext ){
        context[property] = priorContext[property];
      }
    }
    dynamicSystem.dynamicDataMap[dynamicInstance.fileName][dynamicInstance.dynamicName][dynamicInstance.dynamic] = context;
    return dynamicSystem.generateProxy( context, dynamicInstance.dynamic, dynamicInstance.fileName, dynamicInstance.dynamicName );
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
     * Map of non-dynamic counter parts to dynamic proxies.
     */
    this.dynamicDataMap = {};
    /**
     * Set to true to have the dynamic and superDynamic calls bypass the hot reload system. Good for production systems.
     */
    this.bypass = false;

    //***************************PRIVATE VARIABLES*************************//
    /**
     * Map of boolean values to quickly determain if the dynamic is already loaded in memory.
     */
    this._boundDynamics = {};
    /**
     * Prevent file writes from happening when the filesystem triggers more then one event for filewrite.
     */
    this._debounce = {};
    /**
     * Map of dependencies for a file.
     */
    this._dependList = {};
    /**
     * Map of dynamic instances for fast multi instancing.
     */
    this._dynamics = {};
    /**
     * Map of the dynamic creation method or "new" traps.
     */
    this._dynamicInstanceMap = {};
    /**
     * Map of dynamic methods.
     */
    this._dynamicMethodMap = {};
    /**
     * Map of dynamic proxy instances.
     */
    this._dynamicProxyMap = {};
    /**
     * Map of flags to require updates for a dynamic instance.
     */
    this._dynamicUpdate = {};
    /**
     * @todo Will be used to help determain a files life.
     */
    this._expandedWatchers = {};
    /**
     * Map of files that are being watched within a directory.
     */
    this._fileWatchers = {};
    /**
     * Map of current hashes for files.
     */
    this._hashList = {};
    /**
     * Map of dynamic objects, not classes or methods.
     */
    this._objectDynamics = {};
    /**
     * Map of setters for a dynamic object.
     */
    this._objectDynamicsSets = {};
    /**
     * Map of files that use the raw update feature.
     */
    this._rawUpdate = {};
    /**
     * Path to this file; which is the dynamic system.
     */
    this._selfFile = "";
    /**
     * Map of startup points that create a persist dynamic object.
     */
    this._startupPoints = {};
    /**
     * Incromenter for unique id tracking.
     */
    this._uidTracker = 0;
    /**
     * Map of directories that are currently being watched and files within that are watched.
     */
    this._watchFiles = {};
  }

  //****************************PUBLIC METHODS**************************//

  /**
   * Way to figure out what file performed a call.
   * @param depth - How deep back the stack trace will go to find the callee file.
   * @returns File name of the callee.
   */
  caller( depth ) {

    if( depth !== null && typeof( depth ) === "string" ){
      return depth;
    }
    
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
  dynamic( fileName, caller = null ){
    caller = this.caller( caller );
    fileName = require.resolve( fileName, { paths: [ path.dirname( caller ) ] } );
    this._addDependent( fileName, caller );

    return this._createDynamics(fileName);
  }

  /**
   * Used to watching directories for new files and deleted files and allow acknowlagment of it.
   * @param directory - Directory to perform operation on.
   * @param options - Options for how to filter and deal with the files.
   *  @param filter - The filter to be used accepting * as wild card.
   *  @param includeSubDirectories - Should subdirectoies be watched?
   *  @param dynamicType - How to deal with the file.
   *    @option source - Use dynamic to include the files.
   *    @option super - Use superDynamic to include the files.
   *    @option raw - Only return raw file buffer.
   *    @option text - Return a encoded string of the raw file buffer.
   * @param predicate - The predicate called on updates to the files.
   * @note feature still in testing, and is unstable.
   */
  async dynamicDirectory( directory, options, predicate, caller = null ){
    caller = this.caller(caller);
    options.filter = options.filter || "*";
    options.includeSubDirectories = options.includeSubDirectories || false;
    let dynamicFiles = await this._walkDirectory( path.join( path.dirname( caller ), directory ), options.filter, options.includeSubDirectories );
    for( let i = 0; i < dynamicFiles.files.length; i++ ){
      let dynamicLinks = null;
      switch( options.dynamicType ){
        case "source":
          dynamicLinks = this.dynamic( "./" + path.join( directory, dynamicFiles.files[i].directory, dynamicFiles.files[i].name ), caller );
          Object.keys( dynamicLinks ).filter( dynamicLink => dynamicLink !== "__dynamicLoader" ).forEach( dynamicLink => predicate( dynamicLink, dynamicLinks[dynamicLink], dynamicFiles.files[i], "add" ) );
          break;
        case "super":
          dynamicLinks = this.superDynamic( path.join( dynamicFiles.files[i].directory, dynamicFiles.files[i].name ), caller );
          Object.keys( dynamicLinks ).filter( dynamicLink => dynamicLink !== "__dynamicLoader" ).forEach( dynamicLink => predicate( dynamicLink, dynamicLinks[dynamicLink], dynamicFiles.files[i], "add" ) );
          break;
        case "raw":
          break;
        case "text":
          break;
      }
    }
  }

  /**
   * Used for non JavaScript file or files that need to be watched for updates but have a different applied action.
   * @param fileName - File name of file to add to dynamic watch table.
   * @param updateCallback - Method callback that performs action when the file is updated. Not inital load!
   * @param [updateDependent] - If set to true the caller will update based on dependent update.
   * @param [caller] - File that called the require optionally overrided for dependency resolution.
   * @returns Promise which resolve to the file data or rejection with file load error.
   */
  dynamicFile( fileName, updateCallback, updateDependent = false, caller = null ){
    return new Promise( ( resolve, reject ) => {
      let initResolve = false;
      caller = this.caller(caller);
      if( !path.isAbsolute( fileName ) ){
        fileName = path.resolve( path.dirname( caller ), fileName );
      }
      if( updateDependent ){
        this._addDependent( fileName, caller );
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
      this._setupWatch( fileName );
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
  generateProxy( context, dynamicId, fileName, dynamicName ){
    if( this._dynamicProxyMap[fileName][dynamicName][dynamicId] === undefined ){
      this._dynamicProxyMap[fileName][dynamicName][dynamicId] = new Proxy( context, {
        get: ( target, key ) => {
          return this.dynamicDataMap[fileName][dynamicName][dynamicId][key];
        },
        set: ( target, key, value ) => {
          this.dynamicDataMap[fileName][dynamicName][dynamicId][key] = value;
          target[key] = value;
          return true;
        },
        ownKeys: (_) => {
          return [
            ...Object.getOwnPropertyNames(this.dynamicDataMap[fileName][dynamicName][dynamicId]),
            ...Object.getOwnPropertyNames(this._dynamicMethodMap[fileName][dynamicName].__original.prototype),
          ];
        }
      });
    }
    return this._dynamicProxyMap[fileName][dynamicName][dynamicId];
  }

  /**
   * Attaches dynamic system to global conext.
   */
  globalSyntax(){
    global.dynamic = this.dynamic.bind( this );
    global.superDynamic = this.superDynamic.bind( this );
    global.dynamicFile = this.dynamicFile.bind( this );
    global.dynamicDirectory = this.dynamicDirectory.bind( this );
  }

  /**
   * Initializes dynamic system in a bootstrap file.
   * @param persistObject - Object inside core file that will contain persist data after modifications.
   * @param destroyMethod - Teardown method done prior to new version of persist object being constructed.
   * @returns Instance of persistObject that was passed into the method but with dynamic binding.
   */
  initialize( persistObject, destroyMethod ){
    let initializeFile = this.caller( null );
    destroyMethod = destroyMethod || function(){};
    if( this._startupPoints[initializeFile] === undefined ){
      this._setStartup( initializeFile, destroyMethod, persistObject );
      this._setSelf( __filename );
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

    return this._createDynamic( initializeFile, "init", persistObject );
  }

  /**
   * Action that is called when the dynamic system has been updated.
   * @param oldDynamicLoader - The current running version of the dynamic system to copy data tables from.
   */
  reload( oldDynamicLoader ){
    this._dynamics = oldDynamicLoader._dynamics;
    this._boundDynamics = oldDynamicLoader._boundDynamics;
    for( let startup in oldDynamicLoader._startupPoints ){
      this._setStartup( startup, oldDynamicLoader._startupPoints[startup].destroy, oldDynamicLoader._startupPoints[startup].persist );
    }
    this._setSelf( __filename ); //Todo if moved clear old file watcher.
    this._dependList = oldDynamicLoader._dependList;
    this._hashList = oldDynamicLoader._hashList;
    this._dynamicMethodMap = oldDynamicLoader._dynamicMethodMap;
    this._dynamicInstanceMap = oldDynamicLoader._dynamicInstanceMap;
    this._rawUpdate = oldDynamicLoader._rawUpdate;
    for( let dirName in oldDynamicLoader._fileWatchers ){
      oldDynamicLoader._fileWatchers[dirName].close();
      this._watchDir( dirName );
    }
  }

  /**
   * Acts like require without dynamic binding but adds file to dependency tables, which will update once file has been updated. Use case for classes that extended but not instanced.
   * @param fileName - Name of the file to require as super dynamic.
   * @param [caller] - File that called the require optionally overrided for dependency resolution.
   * @returns Required file without dynamic bindings.
   */
  superDynamic( fileName, caller = null ){
    caller = this.caller(caller);
    fileName = require.resolve( fileName, { paths: [ path.dirname( caller ) ] } );
    
    this._addDependent( fileName, caller );
    return this._bindDynamics(fileName);
  }

  //***************************PRIVATE METHODS*************************//

  /**
   * Adds a file as a dependent that will recycle when dependencies are changed.
   * @param fileName - Name of the file marked as dependent.
   * @param caller - Calling file for the dependent to trace changes of to.
   */
  _addDependent( fileName, caller ){
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
  _bindDynamics( fileName ){
    if( this._boundDynamics[fileName] === undefined ){
      this._boundDynamics[fileName] = true;
    }
    return this._createDynamics( fileName );
  }

  /**
   * Clears the require cache for a file.
   * @param filePath - Path of the file in the require cache. Must already be sanitized.
   * @returns Pre-reloaded cached version that can be loaded for errors.
   */
  _clearRequireCache( filePath ){
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
  _createDynamics( fileName ){
    if( this._dynamics[fileName] === undefined || this._dynamicUpdate[fileName] === true ){
      this._dynamicUpdate[fileName] = false;
      let initialDynamics = require( fileName );
      this._setupWatch( fileName );

      if( this._dynamics[fileName] === undefined ){
        this._dynamics[fileName] = {};
      }

      for( let exportData in initialDynamics ){
        this._dynamics[fileName][exportData] = this._createDynamic( fileName, exportData, initialDynamics[exportData] );
      }

      for( let excludedData in this._dynamics ){
        //TODO clean-up parts of the application that no longer exist.
        //convertedStructure[exportData] = this._createDynamic( initialDynamics[exportData] );
      }

      //Update the dynamic loader
      this._dynamics[fileName].__dynamicLoader = this;

      return this._dynamics[fileName];
    }
    else{
      this._setupWatch( fileName );
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
  _createDynamic( fileName, dynamicName, initialDynamic ){
    if( initialDynamic instanceof Function && !this._boundDynamics[fileName] ){
      if( this._dynamicMethodMap[fileName] === undefined || this._dynamicMethodMap[fileName][dynamicName] === undefined ){
        return this._newDynamicMethod( fileName, dynamicName, initialDynamic );
      }
      else{
        return this._updateDynamicMethod( fileName, dynamicName, initialDynamic );
      }
    }
    else if( initialDynamic instanceof Object && !this._boundDynamics[fileName] ){
      return this._createObjectDynamics( fileName, dynamicName, initialDynamic );
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
  _createObjectDynamics( fileName, dynamicName, dynamicObject ){
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

    return new Proxy( dynamicObject, {
      get: ( _, key ) => {
        return this._objectDynamics[fileName][dynamicName][key];
      },
      set: ( target, key, value ) => {
        this._objectDynamicsSets[fileName][dynamicName][key] = value;
        this._objectDynamics[fileName][dynamicName][key] = value;
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
  _getDeepPrototype( startingClass ){
    let prototype = Object.getPrototypeOf( startingClass );
    if( prototype === Object ){
      return startingClass;
    }
    else{
      if( prototype.prototype !== undefined ){
        return this._getDeepPrototype( prototype );
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
  _getHash( fileName ){
    return new Promise( ( resolve, reject ) => {
      let hash = crypto.createHash('md5');
      hash.setEncoding('hex');
      fs.readFile( fileName, ( error, data ) => {
        if( !error ){
          hash.write( data );
          hash.end();
          resolve( hash.read() );
        }
        else{
          console.error( "Hash error with " + fileName );
          console.error( error );
          reject( error ); 
        }
      } );
    });

  }

  /**
   * Creates a dynamic class.
   * @param fileName - Name of the file for referance.
   * @param dynamicName - Name of the dynamic class for referance.
   * @param initialDynamic - Prototype of the first file load of the class.
   * @returns Dynamic version of method prototype that can be created via "new".
   */
  _newDynamicMethod( fileName, dynamicName, initialDynamic ){
    let dynamic = this;
    let dynamicMethod = null;
    //Magic method that is a wraper for the orignal method.
    dynamicMethod = function(){
      //If we are rebuilding the object then make sure we copy it first//
      let dynamicId = dynamic._uniqueNumber();
      let priorArgs = arguments;
      let surrogateProxy = function(){
        return {
          dynamic : dynamicId,
          fileName : fileName,
          dynamicName : dynamicName,
          initialDynamic : initialDynamic
        };
      };
      dynamic._replaceDeepPrototype( initialDynamic );
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
          dynamicMethod.__original = initialDynamic;
          dynamic._replaceDeepPrototype( initialDynamic );
          let newProxy = Reflect.construct( initialDynamic, priorArgs, surrogateProxy );
          dynamicMethod.__dynamicLoadMethod();
        }
        catch( ex ){
          console.error( "Unable to load dynamic class, a placeholder was used for requested instance." );
          console.error( ex );
          initialDynamic = oldInitialDynamic;
          let newProxy = Reflect.construct( initialDynamic, priorArgs, surrogateProxy );
        }

      }

      dynamic._dynamicInstanceMap[fileName][dynamicName][this.__dynamicId] = this;
      setTimeout( () => dynamicMethod.__dynamicLoadMethod() );
      return proxyInstance;
    };

    dynamicMethod.__dynamicLoadMethod = () => {};
    dynamicMethod.dynamicLoad = ( loadMethod ) => {
      dynamicMethod.__dynamicLoadMethod = loadMethod;
    }
    dynamicMethod.dynamicUnload = function( unloadMethod ){
      
    }
    dynamicMethod.instanceof = function( prototype ){
      return dynamicMethod.__original.prototype instanceof prototype
    }

    dynamicMethod.toString = () => {
      return dynamicMethod.__original.toString();
    }

    dynamicMethod.__original = initialDynamic;

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
  async _reloadFile( trigger, filePath, callback ){
    try{
      let changeHash = await this._getHash( filePath );
      if( changeHash !== this._hashList[filePath] ){
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
          this._reloadPath( filePath );
        }
        this._hashList[filePath] = changeHash;
        setTimeout( () => {
          this._resolveDependencies( filePath );
        });
      }
    }
    catch( ex ){
      /* Throw away */
    }
  }

  /**
   * Reload trigger for full path changes.
   * @param filePath - Path that triggered a reload.
   */
  _reloadPath( filePath ){
    let oldCache = null;
    if( !this._debounce[filePath] ){
      this._debounce[filePath] = true;
      if( this._startupPoints[filePath] === undefined && filePath != this._selfFile ){
        try{
          oldCache = this._clearRequireCache( filePath );
          this._createDynamics( filePath );
        }
        catch( ex ){
          this._restoreRequireCache( filePath, oldCache, ex );
        }
      }
      else{
        if( this._startupPoints[filePath] !== undefined ){
          try{
            //Dynamic loader re-include startup script.
            oldCache = this._clearRequireCache( filePath );
            require( filePath );
          }
          catch( ex ){
            this._restoreRequireCache( filePath, oldCache, ex );
          }
        }
        else {
          try{
            //Dynamic loader reload system
            oldCache = this._clearRequireCache( this._selfFile );
            require( __filename ).reload( this );
          }
          catch( ex ){
            this._restoreRequireCache( filePath, oldCache, ex );
          }
        }
      }
      
      setTimeout( () => {
        this._debounce[filePath] = false;
      }, 50 );
    }
  }

  /**
   * Replaces the low layer object prototype with DynamicReflection class to make dynamics work.
   * @param startingClass - Prototype that has a deep class to replace.
   */
  _replaceDeepPrototype( startingClass ){
    let deepPrototype = this._getDeepPrototype( startingClass );
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
  _resolveDependencies( filePath ){
    if( this._dependList[filePath] !== undefined ){
      for( let i = 0; i < this._dependList[filePath].length; i++ ){
        this._dynamicUpdate[this._dependList[filePath][i]] = true;
        this._reloadPath( this._dependList[filePath][i] );
      }
    }
  }

  /**
   * Restore an object to a working state when the object crashes.
   * @param filePath - File path for require cache must be sanitized.
   * @param oldCache - Old cache that will be restored as the current running dynamic object.
   * @param exception - Exception that triggered the file to be unable to compile/instance.
   */
  _restoreRequireCache( filePath, oldCache, exception ){
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
  _setSelf( dynamicLoaderPath ){
    //TODO check if npm sub requirements setup two locations for dynamic.
    this._selfFile = path.resolve( dynamicLoaderPath );
    this._setupWatch( this._selfFile );


  }

  /**
   * Creates the start-up file watching system so that the file that called dynamic is also dynamic, making the whole use case dynamic.
   * @param initialFile - Path of the file that called dynamic.
   * @param destroyMethod - Method called when the inital file is reloaded.
   * @param persistObject - A collection of data in an object that will persist if able after reloads.
   */
  _setStartup( initialFile, destroyMethod, persistObject ){
    this._startupPoints[initialFile] = {
      destroy : destroyMethod,
      persist : persistObject
    };
    this._setupWatch( initialFile );
  }

  /**
   * Starts a file watch for a file by making sure the directory is watched and adding the file into the list of file for that directory.
   * @param fileName - Name of the file to add to the watch list.
   */
  async _setupWatch( fileName ){
    if( this._watchFiles[path.dirname( fileName )] === undefined ){
      this._watchDir( path.dirname( fileName ) );
    }
    if( this._watchFiles[path.dirname( fileName )][path.basename( fileName )] === undefined ){
      this._watchFiles[path.dirname( fileName )][path.basename( fileName )] = false;
      try{
        let hash = await this._getHash( fileName );
        this._hashList[fileName] = hash;
      }
      catch( error ){
        /* Throw away */
      }
      
    }
  }

  /**
   * Incroments a unique id tracker for lookup of dynamic objects.
   * @returns Next unique id.
   * @todo Currently this will break after long term use because it does not reset, and rather then reseting it a new approch is needed to make it consistant.
   */
  _uniqueNumber(){
    return this._uidTracker++;
  }

  /**
   * Updates the current dynamic method and issues a rebuild of the internals of that dynamic object.
   * @param fileName - File name used for referance.
   * @param dynamicName - Name of the dynamic object for referance.
   * @param initialDynamic - Non dynamic version of current build vs. last build. Used to map one instanced to another.
   * @returns Rebuild dynamic bound object.
   */
  _updateDynamicMethod( fileName, dynamicName, initialDynamic ){
    //Deal with object reconstructing.
    for( let dynamicId in this._dynamicInstanceMap[fileName][dynamicName] ){
      this._dynamicInstanceMap[fileName][dynamicName][dynamicId].__rebuild( initialDynamic );
    }

    return this._dynamicMethodMap[fileName][dynamicName];
  }

  async _walkDirectory( directory, filter, includeSubDirectories = false ){
    if( !directory.endsWith( "/" ) ){
      directory = directory + "/";
    }
    let fullFilesList = await this._walk( directory, includeSubDirectories );
    filter = new RegExp( "^" + filter.replace( /\./gi, "\\.").replace( /\*/gi, ".*" ) + "$" );
    fullFilesList.forEach( file => {
      file.absolutePath = path.join( file.directory, file.name );
      file.directory = file.directory.replace( directory, "./" );
    });
    
    return {
      directories: fullFilesList.filter( ( file ) => file.isDirectory() ).map( directory => ( {
        absolutePath: directory.absolutePath,
        directory: directory.directory,
        name: directory.name
      } )),
      files: fullFilesList.filter( ( file ) => file.isFile() && filter.test( file.name ) ).map( file => ( {
        absolutePath: file.absolutePath,
        directory: file.directory,
        name: file.name
      } ))
    };

  }

  _walk( directory, includeSubDirectories ){
    return new Promise( ( resolve, reject ) => {
      fs.readdir(directory, { withFileTypes: true }, async (err, list) => {
        if (err) return reject(err);
        let results = [];
        for( let i = 0; i < list.length; i++ ){
          list[i].directory = directory;
          if( list[i].isDirectory() && includeSubDirectories ){
            results.push( list[i] );
            results = [ ...results, ...await this._walk( path.join( directory, list[i].name ), true ) ];
          }
          else if( list[i].isFile() ){
            results.push( list[i] );
          }
        }

        resolve( results );
      } );
    });
    
  }

  _wait( delay ){
    return new Promise( ( resolve ) => {
      setTimeout( resolve, delay );
    });
  }

  /**
   * Watches a directory for changes and issues appropreate triggers on changes.
   * @param dirname - Name of the directory to be watched.
   * @todo Sometimes the file changes are not caught because rather then doing a direct save a temp file is renamed and this needs to be accounted for.
   * @note Known program issues with: VIM, WebStorm
   * @todo Deal with logic for added and removed files from directories.
   */
  _watchDir( dirname, watchHook = null ){
    if( this.bypass ){
      if( this._fileWatchers[dirname] === undefined ){
        this._watchFiles[dirname] = {};
      }
      return;
    }
    if( this._fileWatchers[dirname] === undefined ){
      this._watchFiles[dirname] = {};
      try{
        const newWatcher = chokidar.watch( dirname, {
          persistent: true,
          alwaysStat: false,
          ignoreInitial: true,
          depth : 0
        } );

        let renameHook = null;

        const watchEventMethod = async ( event, fileName, originalFile ) => {
          fileName = path.basename( fileName );

          //File rename hooks
          //@todo fix rename
          /*if( event === "change" && renameHook === null ){
            renameHook = { original: fileName };
            await this._wait( 150 );
            if( renameHook.new && renameHook.released ){
              return;
            }
            else{
              renameHook = null;
            }
          }
          else if( event === "add" && renameHook !== null ){
            renameHook.new = fileName;
            await this._wait( 100 );
            if( renameHook.new && renameHook.released ){
              return;
            }
          }
          else if( event === "unlink" && renameHook !== null ){
            renameHook.released = true;
            await this._wait( 50 );
            let innerHook = renameHook;
            renameHook = null;
            watchEventMethod( "rename", innerHook.new, innerHook.original );
            return;
          }
          //Folder rename hooks
          if( event === "unlinkDir" && renameHook === null ){
            renameHook = { original: fileName };
            await this._wait( 150 );
            if( renameHook.new && renameHook.released ){
              return;
            }
            else{
              renameHook = null;
            }
          }
          else if( event === "addDir" && renameHook === null ){
            renameHook.new = fileName;
            renameHook.released = true;
            await this._wait( 50 );
            let innerHook = renameHook;
            renameHook = null;
            watchEventMethod( "renameDir", innerHook.new, innerHook.original );
            return;
          }*/

          if( this._expandedWatchers[dirname] !== undefined ){
            //@TODO Allow new and deleted files//
          }
          if( this._watchFiles[dirname][fileName] === false ){
            this._watchFiles[dirname][fileName] = true;
            await this._reloadFile( event, path.normalize( dirname + "/" + fileName ) );
            this._watchFiles[dirname][fileName] = false;
            if( event === "rename" ){
              //@TODO Check to see if it is a new file

              //@TODO Check to see if it still exists

              //@TODO Figure out how to do a real rename
            }
          }
        }
        
        newWatcher
        .on( 'add', ( fileName ) => watchEventMethod( 'add', fileName ) )
        .on( 'change', ( fileName ) => watchEventMethod( 'change', fileName ) )
        .on( 'unlink', ( fileName ) => watchEventMethod( 'unlink', fileName ) )
        .on( 'addDir', ( fileName ) => watchEventMethod( 'addDir', fileName ) )
        .on( 'unlinkDir', ( fileName ) => watchEventMethod( 'unlinkDir', fileName ) )
        .on( 'error', ( error ) => {
          console.error( `Watcher error for ${dirname}.` );
          console.error( error );
        } );

        this._fileWatchers[dirname] = newWatcher;
      }
      catch( ex ){
        console.warn( "Unable to setup watcher for " + fileName );
      }
    }

    if( this._fileWatchers[dirname] && watchHook !== null ){
      this._fileWatchers[dirname].watchHook = watchHook;
    }
  }

}

////////////////////////////////EXPORTS//////////////////////////////////////////
const dynamicSystem = new DynamicSystem();
module.exports = dynamicSystem;
