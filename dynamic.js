/*

TODO: Dynamic clean-up via delete trap

*/
var crypto = require( "crypto" );
var fs = require( "fs" );
var path = require( "path" );

class DynamicReflection{
  constructor(){
    let dynamicInstance = new.target();
    let context = Reflect.construct( Object, [], dynamicInstance.initialDynamic );
    if( dynamic._dynamicDataMap[dynamicInstance.fileName][dynamicInstance.dynamicName][dynamicInstance.dynamic] !== undefined ){
      let priorContext = dynamic._dynamicDataMap[dynamicInstance.fileName][dynamicInstance.dynamicName][dynamicInstance.dynamic];
      for( let property in priorContext ){
        context[property] = priorContext[property];
      }
    }
    dynamic._dynamicDataMap[dynamicInstance.fileName][dynamicInstance.dynamicName][dynamicInstance.dynamic] = context;
    return dynamic.GenerateProxy( context, dynamicInstance.dynamic, dynamicInstance.fileName, dynamicInstance.dynamicName );
  }
}

//Works as a start-up error recoverable class.
class ErrorInitalDynamic extends DynamicReflection{
  constructor(){
    super();
  }
}

function caller (depth) {
  var pst, stack, file, frame;

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
};

global.dynamicCaller = caller;

var dynamic = {
  _SetupWatch : function( fileName ){
    if( this._watchFiles[fileName] === undefined ){
      this._watchFiles[fileName] = {};
      var changeUpdate = false;
      try{
        this._fileWatchers[fileName] = fs.watch( fileName, ( e ) => {
          switch( e ){
            case "change":
              changeUpdate = true;
              this._ReloadFile( e, fileName, ( ) => {
                changeUpdate = false;
              } );
              break;
          }
        } );
      }
      catch( ex ){
        console.warn( "Unable to setup watcher for " + fileName );
      }
      this._GetHash( fileName, ( hash ) => {
        this._hashList[fileName] = hash;
      } );
    }
  },

  _dependList : { },
  _hashList : { },
  _fileWatchers : { },
  _watchFiles : { },

  _ReloadFile : function( trigger, filePath, callback ){
    this._GetHash( filePath, ( changeHash ) => {
      if( changeHash !== null && changeHash !== this._hashList[filePath] ){
        this._dynamicUpdate[filePath] = true;
        this._ReloadPath( filePath );
        this._hashList[filePath] = changeHash;
        callback();
        this._ResolveDependencies( filePath );
      }
      else{
        callback();
      }

    });

  },

  _ReloadPath : function( filePath ){
    var oldCache = null;
    if( this._startupPoints[filePath] === undefined && filePath != this._selfFile ){
      try{
        oldCache = this._ClearRequireCache( filePath );
        this.CreateDynamics( filePath );
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
  },

  _RestoreRequireCache : function( filePath, oldCache, exception ){
    if( oldCache !== null ){
      console.error( "Unable to rebuild cache object, " + filePath );
      console.error( exception );
      console.error( exception.stack );
      require.cache[filePath] = oldCache;
    }
    else{
      console.error( "Unable to rebuild cache object and unable to restore crash" );
      console.error( "WHAT HAVE YOU DONE!" );
      console.error( exception );
      console.error( exception.stack );
    }
  },

  _ResolveDependencies : function( filePath ){
    if( this._dependList[filePath] !== undefined ){
      for( var i = 0; i < this._dependList[filePath].length; i++ ){
        this._dynamicUpdate[this._dependList[filePath][i]] = true;
        this._ReloadPath( this._dependList[filePath][i] );
      }
    }
  },

  _ClearRequireCache : function( filePath ){
    var oldCache = null;
    if( require.cache[filePath] !== undefined ){
      oldCache = require.cache[filePath];
      delete require.cache[filePath];
    }
    else{
      console.log( "Unable to find require cache for " + filePath );
    }

    return oldCache;
  },

  _GetHash( fileName, callback ){
    var hash = crypto.createHash('md5');
    hash.setEncoding('hex');
    fs.readFile( fileName, ( error, data ) => {
      if( !error ){
        hash.write( data );
        hash.end();
        callback( hash.read() );
      }
      else{
        console.error( "Hash error with " + fileName );
        callback( null );
      }
    } );

  },

  _dynamicUpdate : {},
  _boundDynamics : {},

  BindDynamics : function( fileName ){
    if( this._boundDynamics[fileName] === undefined ){
      this._boundDynamics[fileName] = true;
    }
    return this.CreateDynamics( fileName );
  },

  CreateDynamics : function( fileName ){
    if( this._dynamics[fileName] === undefined || this._dynamicUpdate[fileName] === true ){
      this._dynamicUpdate[fileName] = false;
      var initialDynamics = require( fileName );
      this._SetupWatch( fileName );

      if( this._dynamics[fileName] === undefined ){
        this._dynamics[fileName] = {};
      }

      for( var exportData in initialDynamics ){
        this._dynamics[fileName][exportData] = this._CreateDynamic( fileName, exportData, initialDynamics[exportData] );
      }

      for( var excludedData in this._dynamics ){
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

  },

  _dynamics : {},
  _objectDynamics : {},
  _objectDynamicsSets : {},
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
  },

  _CreateDynamic : function( fileName, dynamicName, initialDynamic ){
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
  },

  _dynamicMethodMap : {},
  _dynamicDataMap : { },
  _dynamicInstanceMap : { },
  _dynamicProxyMap : { },

  _UniqueNumber : function(){
    return this._uidTracker++;
  },

  _uidTracker : 0,

  _UpdateDynamicMethod : function( fileName, dynamicName, initialDynamic ){
    //Deal with object reconstructing.
    for( var dynamicId in this._dynamicInstanceMap[fileName][dynamicName] ){
      this._dynamicInstanceMap[fileName][dynamicName][dynamicId].__rebuild( initialDynamic );
    }

    return this._dynamicMethodMap[fileName][dynamicName];
  },

  GenerateProxy : function( context, dynamicId, fileName, dynamicName ){
    if( dynamic._dynamicProxyMap[fileName][dynamicName][dynamicId] === undefined ){
      dynamic._dynamicProxyMap[fileName][dynamicName][dynamicId] = new Proxy( context, {
        get( target, key ){
          return dynamic._dynamicDataMap[fileName][dynamicName][dynamicId][key];
        },
        set( target, key, value ){
          dynamic._dynamicDataMap[fileName][dynamicName][dynamicId][key] = value;
          target[key] = value;
          return true;
        }
      });
    }
    return dynamic._dynamicProxyMap[fileName][dynamicName][dynamicId];
  },
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
  },

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
  },

  _NewDynamicMethod( fileName, dynamicName, initialDynamic ){

    //Magic method that is a wraper for the orignal method.
    function dynamicMethod(){

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
          dynamic._ReplaceDeepPrototype( initialDynamic );
          var newProxy = Reflect.construct( initialDynamic, priorArgs, surrogateProxy );
        }
        catch( ex ){
          console.error( "Unable to load dynamic class, a placeholder was used for requested instance." );
          console.error( ex );
          initialDynamic = oldInitialDynamic;
          var newProxy = Reflect.construct( initialDynamic, priorArgs, surrogateProxy );
        }

      }

      dynamic._dynamicInstanceMap[fileName][dynamicName][this.__dynamicId] = this;
      return proxyInstance;
    };

    //Make sure mapping exists
    if( this._dynamicMethodMap[fileName] === undefined ){
      this._dynamicMethodMap[fileName] = {};
      this._dynamicInstanceMap[fileName] = {};
      this._dynamicDataMap[fileName] = {};
      this._dynamicProxyMap[fileName] = {};
    }
    if( this._dynamicMethodMap[fileName][dynamicName] === undefined ){
      this._dynamicMethodMap[fileName][dynamicName] = dynamicMethod;
      this._dynamicInstanceMap[fileName][dynamicName] = {};
      this._dynamicDataMap[fileName][dynamicName] = {};
      this._dynamicProxyMap[fileName][dynamicName] = {};
    }

    return this._dynamicMethodMap[fileName][dynamicName];
  },

  _AddDependent( fileName, caller ){
    if( caller !== null ){
      if( this._dependList[fileName] === undefined ){
        this._dependList[fileName] = [];
      }

      if( this._dependList[fileName].indexOf( caller ) === -1 ){
        this._dependList[fileName].push( caller );
      }
    }
  },

  _GetMethodDynamicProperty( fileName, dynamicName, property ){
    return function() {
      return dynamic._dynamicDataMap[fileName][dynamicName][this.__dynamicId][property].apply( this, arguments );
    }
  },

  SetStartup( initialFile, destroyMethod, persistObject ){
    this._startupPoints[initialFile] = {
      destroy : destroyMethod,
      persist : persistObject
    };
    this._SetupWatch( initialFile );
  },
  SetSelf( dynamicLoaderPath ){
    //TODO check if npm sub requirements setup two locations for dynamic.
    this._selfFile = path.resolve( dynamicLoaderPath );
    this._SetupWatch( this._selfFile );
  },
  _selfFile : "",
  _startupPoints : {}
};

global.dynamic = function( fileName, caller ){
  if( !fileName.endsWith( ".js" ) ){
    fileName = fileName + ".js";
  }
  caller = caller || dynamicCaller();
  if( !path.isAbsolute( fileName ) ){
    fileName = path.resolve( path.dirname( caller ), fileName );
  }
  this._AddDependent( fileName, caller );

  return this.CreateDynamics(fileName);
}.bind( dynamic );

//When extending classes only the last class in the call chain should be dynamic.
//To avoid this a dependecy is added but the original require is returned.
global.superDynamic = function( fileName, caller ){
  caller = caller || dynamicCaller();
  if( !path.isAbsolute( fileName ) ){
    fileName = path.resolve( path.dirname( caller ), fileName );
  }
  this._AddDependent( fileName, caller );

  return this.BindDynamics(fileName);
}.bind( dynamic );

exports.reload = function( oldDynamicLoader ){
  this._dynamics = oldDynamicLoader._dynamics;
  this._boundDynamics = oldDynamicLoader._boundDynamics;
  for( var startup in oldDynamicLoader._startupPoints ){
    this.SetStartup( startup, oldDynamicLoader._startupPoints[startup].destroy, oldDynamicLoader._startupPoints[startup].persist );
  }
  this.SetSelf( __filename ); //Todo if moved clear old file watcher.
  this._dependList = oldDynamicLoader._dependList;
  this._hashList = oldDynamicLoader._hashList;
  this._dynamicMethodMap = oldDynamicLoader._dynamicMethodMap;
  this._dynamicInstanceMap = oldDynamicLoader._dynamicInstanceMap;
  for( var filename in oldDynamicLoader._fileWatchers ){
    oldDynamicLoader._fileWatchers[filename].close();
    if( this._startupPoints[filename] === undefined && filename !== oldDynamicLoader._selfFile ){
      this.CreateDynamics( filename );
    }
  }
}.bind( dynamic );

exports.initialize = function( persistObject, destroyMethod ){
  var initializeFile = dynamicCaller();
  destroyMethod = destroyMethod || function(){};
  if( this._startupPoints[initializeFile] === undefined ){
    dynamic.SetStartup( initializeFile, destroyMethod, persistObject );
    dynamic.SetSelf( __filename );
  }
  else{
    if( this._startupPoints[initializeFile] !== undefined ){
      this._startupPoints[initializeFile].destroy.call( this._startupPoints[initializeFile].persist );
      for( var persist in this._startupPoints[initializeFile].persist ){
        persistObject[persist] = this._startupPoints[initializeFile].persist[persist];
      }
      this._startupPoints[initializeFile].persist = persistObject;
      this._startupPoints[initializeFile].destroy = destroyMethod;
    }
  }

  return persistObject;
}.bind( dynamic );
