/*! Terraformer JS - 0.0.1 - 2013-01-08
*   https://github.com/geoloqi/Terraformer
*   Copyright (c) 2013 Environmental Systems Research Institute, Inc.
*   Licensed MIT */

(function (root, factory) {

  if(typeof module === 'object' && typeof module.exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like enviroments that support module.exports,
    // like Node.
    exports = module.exports = factory();
  }else if(typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(factory);
  } else {
    root.Terraformer = factory();
  }

  if(typeof jasmine === "object") {
    root.Terraformer = factory();
  }

}(this, function(){
  var exports = {},
      EarthRadius = 6378137,
      DegreesPerRadian = 57.295779513082320,
      RadiansPerDegree =  0.017453292519943,
      MercatorCRS = {
        "type": "link",
        "properties": {
          "href": "http://spatialreference.org/ref/sr-org/6928/ogcwkt/",
          "type": "ogcwkt"
        }
      },
      GeographicCRS = {
        "type": "link",
        "properties": {
          "href": "http://spatialreference.org/ref/epsg/4326/ogcwkt/",
          "type": "ogcwkt"
        }
      };

  /*
  Internal: Extend one object with another.
  */
  function extend(destination, source) {
    for (var k in source) {
      if (source.hasOwnProperty(k)) {
        destination[k] = source[k];
      }
    }
    return destination;
  }

  /*
  Internal: Merge two objects togather.
  */
  function mergeObjects (base, add) {
    add = add || {};

    var keys = Object.keys(add);
    for (var i in keys) {
      base[keys[i]] = add[keys[i]];
    }

    return base;
  }

  /*
  Public: Calculate an bounding box for a geojson object
  */
  function calculateBounds (geojson) {
    switch (geojson.type) {
      case 'Point':
        return [ geojson.coordinates[0], geojson.coordinates[1], geojson.coordinates[0], geojson.coordinates[1]];

      case 'MultiPoint':
        return calculateBoundsFromArray(geojson.coordinates);

      case 'LineString':
        return calculateBoundsFromArray(geojson.coordinates);

      case 'MultiLineString':
        return calculateBoundsFromNestedArrays(geojson.coordinates);

      case 'Polygon':
        return calculateBoundsFromNestedArrays(geojson.coordinates);

      case 'MultiPolygon':
        return calculateBoundsFromNestedArrays(geojson.coordinates);

      case 'Feature':
        return calculateBounds(geojson.geometry);

      case 'FeatureCollection':
        return calculateBoundsForFeatureCollection(geojson);

      case 'GeometryCollection':
        return calculateBoundsForGeometryCollection(geojson);

      default:
        throw new Error("Unknown type: " + geojson.type);
    }
  }

  /*
  Internal: Calculate an bounding box from an nested array of positions
  */
  function calculateBoundsFromNestedArrays (array) {
    var extents = [], extent;

    for (var i = array.length - 1; i >= 0; i--) {
      if(typeof array[i][0] === "number"){
        extent = calculateBoundsFromArray(array);
        extents.push([extent[0],extent[1]]);
        extents.push([extent[2],extent[3]]);
      } else if(typeof array[i][0] === "object"){
        extent = calculateBoundsFromNestedArrays(array[i]);
        extents.push([extent[0],extent[1]]);
        extents.push([extent[2],extent[3]]);
      }
    }
    return calculateBoundsFromArray(extents);
  }

  /*
  Internal: Calculate an bounding box from an array of positions
  */
  function calculateBoundsFromArray (array) {
    var x1, x2, y1, y2;

    for (var i = array.length - 1; i >= 0; i--) {
      var lonlat = array[i];
      var lon = lonlat[0];

      var lat = lonlat[1];
      if (x1 === undefined) {
        x1 = lon;
      } else if (lon < x1) {
        x1 = lon;
      }

      if (y1 === undefined) {
        y1 = lat;
      } else if (lat < y1) {
        y1 = lat;
      }

      // define or smaller num
      if (x2 === undefined) {
        x2 = lon;
      } else if (lon > x2) {
        x2 = lon;
      }

      // define or smaller num
      if (y2 === undefined) {
        y2 = lat;
      } else if (lat > y2) {
        y2 = lat;
      }
    }

    return [x1, y1, x2, y2 ];
  }

  /*
  Internal: Calculate an bounding box for a feature collection
  */
  function calculateBoundsForFeatureCollection(featureCollection){
    var extents = [], extent;
    for (var i = featureCollection.features.length - 1; i >= 0; i--) {
      extent = calculateBounds(featureCollection.features[i].geometry);
      extents.push([extent[0],extent[1]]);
      extents.push([extent[2],extent[3]]);
    }

    return calculateBoundsFromArray(extents);
  }

  /*
  Internal: Calculate an bounding box for a geometry collection
  */
  function calculateBoundsForGeometryCollection(geometryCollection){
    var extents = [], extent;

    for (var i = geometryCollection.geometries.length - 1; i >= 0; i--) {
      extent = calculateBounds(geometryCollection.geometries[i]);
      extents.push([extent[0],extent[1]]);
      extents.push([extent[2],extent[3]]);
    }

    return calculateBoundsFromArray(extents);
  }

  /*
  Internal: Convert radians to degrees. Used by spatial reference converters.
  */
  function radToDeg(rad) {
    return rad * DegreesPerRadian;
  }

  /*
  Internal: Convert degrees to radians. Used by spatial reference converters.
  */
  function degToRad(deg) {
    return deg * RadiansPerDegree;
  }

  /*
  Internal: Loop over each geometry in a geojson object and apply a function to it. Used by spatial reference converters.
  */
  function eachGeometry(geojson, func){
    for (var i = 0; i < geojson.geometries.length; i++) {
      geojson.geometries[i].geometry = eachPosition(geojson.features[i].geometry, func);
    }
    return geojson;
  }

  /*
  Internal: Loop over each feature in a geojson object and apply a function to it. Used by spatial reference converters.
  */
  function eachFeature(geojson, func){
    for (var i = 0; i < geojson.features.length; i++) {
      geojson.features[i].geometry = eachPosition(geojson.features[i].geometry, func);
    }
    return geojson;
  }

  /*
  Internal: Loop over each array in a geojson object and apply a function to it. Used by spatial reference converters.
  */
  function eachPosition(coordinates, func) {
    for (var i = 0; i < coordinates.length; i++) {
      // we found a number so lets convert this pair
      if(typeof coordinates[i][0] === "number"){
        coordinates[i] = func(coordinates[i]);
      }
      // we found an coordinates array it again and run THIS function against it
      if(typeof coordinates[i] === "object"){
        coordinates[i] = eachPosition(coordinates[i], func);
      }
    }
    return coordinates;
  }

  /*
  Public: Convert a GeoJSON Position object to Geographic (4326)
  */
  function positionToGeographic(position) {
    var x = position[0];
    var y = position[1];
    return [radToDeg(x / EarthRadius) - (Math.floor((radToDeg(x / EarthRadius) + 180) / 360) * 360), radToDeg((Math.PI / 2) - (2 * Math.atan(Math.exp(-1.0 * y / EarthRadius))))];
  }

  /*
  Public: Convert a GeoJSON Position object to Web Mercator (102100)
  */
  function positionToMercator(position) {
    var lng = position[0];
    var lat = Math.max(Math.min(position[1], 89.99999), -89.99999);
    return [degToRad(lng) * EarthRadius, EarthRadius/2.0 * Math.log( (1.0 + Math.sin(degToRad(lat))) / (1.0 - Math.sin(degToRad(lat))) )];
  }

  /*
  Public: Apply a function agaist all positions in a geojson object. Used by spatial reference converters.
  */
  function applyConverter(geojson, converter){
    if(geojson.type === "Point") {
      geojson.coordinates = converter(geojson.coordinates);
    } else if(geojson.type === "Feature") {
      geojson.geometry = applyConverter(geojson, converter);
    } else if(geojson.type === "FeatureCollection") {
      geojson.features = eachFeature(geojson, converter);
    } else if(geojson.type === "GeometryCollection") {
      geojson.geometries = eachGeometry(geojson, converter);
    } else {
      geojson.coordinates = eachPosition(geojson.coordinates, converter);
    }

    if(converter === positionToMercator){
      geojson.crs = MercatorCRS;
    }

    if(converter === positionToGeographic){
      delete geojson.crs;
    }

    return geojson;
  }

  /*
  Public: Convert a GeoJSON object to ESRI Web Mercator (102100)
  */
  function toMercator(geojson) {
    return applyConverter(geojson, positionToMercator);
  }

  /*
  Convert a GeoJSON object to Geographic coordinates (WSG84, 4326)
  */
  function toGeographic(geojson) {
    return applyConverter(geojson, positionToGeographic);
  }

  /*
  Internal: An array of variables that will be excluded form JSON objects.
  */
  var excludeFromJSON = ["length"];

  /*
  Internal: Base GeoJSON Primitive
  */
  function Primitive(){}

  Primitive.prototype = {
    toMercator: function(){
      return toMercator(this);
    },
    toGeographic: function(){
      return toGeographic(this);
    },
    toJSON: function(){
      var obj = {};
      for (var key in this) {
        if (this.hasOwnProperty(key) && this[key] && excludeFromJSON.indexOf(key)) {
          obj[key] = this[key];
        }
      }
      return obj;
    },
    toJson: function () {
      return JSON.stringify(this);
    }
  };

  /*
  GeoJSON Point Class
    new Point();
    new Point(x,y,z,wtf);
    new Point([x,y,z,wtf]);
    new Point([x,y]);
    new Point({
      type: "Point",
      coordinates: [x,y]
    });
  */
  function Point(input){
    var args = Array.prototype.slice.call(arguments);

    console.log(input && input.type === "Point" && input.coordinates);
    console.log(args.length && Array.isArray(args[0]));
    console.log(args.length && Array.isArray(input));
    console.log(!args.length);

    // geojson
    if(input && input.type === "Point" && input.coordinates){
      extend(this, input);

    // as position
    } else if(input && Array.isArray(input)) {
      this.type = "Point";
      this.coordinates = input;

    // as x,y,z,wtf
    } else if(args.length >= 2) {
      this.coordinates = args;

    // no args
    } else if(!args.length) {
      this.type = "Point";

    // throw an error
    } else {
      throw "Terraformer: invalid input for Terraformer.Point";
    }

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });

  }

  Point.prototype = new Primitive();
  Point.prototype.constructor = Point;

  /*
  GeoJSON MultiPoint Class
      new MultiPoint();
      new MultiPoint([[x,y], [x1,y1]]);
      new MultiPoint({
        type: "MultiPoint",
        coordinates: [x,y]
      });
  */
  function MultiPoint(input){
    if(input && input.type === "MultiPoint" && input.coordinates){
      extend(this, input);
    } else if(Array.isArray(input)) {
      this.type = "MultiPoint";
      this.coordinates = input;
    } else if(!input) {
      this.type = "MultiPoint";
    } else {
      throw "Terraformer: invalid input for Terraformer.MultiPoint";
    }

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });

    this.__defineGetter__('length', function () {
      return this.coordinates ? this.coordinates.length : 0;
    });

  }

  MultiPoint.prototype = new Primitive();
  MultiPoint.prototype.constructor = MultiPoint;
  MultiPoint.prototype.forEach = function(func){
    for (var i = 0; i < this.coodinates.length; i++) {
      func.apply(this, [this.coodinates[i], i, this.coodinates]);
    }
  };

  /*
  GeoJSON LineString Class
      new LineString();
      new LineString([[x,y], [x1,y1]]);
      new LineString({
        type: "LineString",
        coordinates: [x,y]
      });
  */
  function LineString(input){
    if(input && input.type === "LineString" && input.coordinates){
      extend(this, input);
    } else if(Array.isArray(input)) {
      this.type = "LineString";
      this.coordinates = input;
    } else if(!input) {
      this.type = "LineString";
    } else {
      throw "Terraformer: invalid input for Terraformer.LineString";
    }

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });

  }

  LineString.prototype = new Primitive();
  LineString.prototype.constructor = LineString;

  /*
  GeoJSON MultiLineString Class
      new MultiLineString();
      new MultiLineString([ [[x,y], [x1,y1]], [[x2,y2], [x3,y3]] ]);
      new MultiLineString({
        type: "MultiLineString",
        coordinates: [ [[x,y], [x1,y1]], [[x2,y2], [x3,y3]] ]
      });
  */
  function MultiLineString(input){
    if(input && input.type === "MultiLineString" && input.coordinates){
      extend(this, input);
    } else if(Array.isArray(input)) {
      this.type = "MultiLineString";
      this.coordinates = input;
    } else if(!input) {
      this.type = "MultiLineString";
    } else {
      throw "Terraformer: invalid input for Terraformer.MultiLineString";
    }

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });

    this.__defineGetter__('length', function () {
      return this.coordinates ? this.coordinates.length : 0;
    });

  }

  MultiLineString.prototype = new Primitive();
  MultiLineString.prototype.constructor = MultiLineString;
  MultiLineString.prototype.forEach = function(func){
    for (var i = 0; i < this.coodinates.length; i++) {
      func.apply(this, [this.coodinates[i], i, this.coodinates ]);
    }
  };

  /*
  GeoJSON Polygon Class
      new Polygon();
      new Polygon([ [[x,y], [x1,y1], [x2,y2]] ]);
      new Polygon({
        type: "Polygon",
        coordinates: [ [[x,y], [x1,y1], [x2,y2]] ]
      });
  */
  function Polygon(input){
    if(input && input.type === "Polygon" && input.coordinates){
      extend(this, input);
    } else if(Array.isArray(input)) {
      this.type = "Polygon";
      this.coordinates = input;
    } else if(!input) {
      this.type = "Polygon";
    } else {
      throw "Terraformer: invalid input for Terraformer.Polygon";
    }

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });
  }

  Polygon.prototype = new Primitive();
  Polygon.prototype.constructor = Polygon;

  /*
  GeoJSON MultiPolygon Class
      new MultiPolygon();
      new MultiPolygon([ [ [[x,y], [x1,y1]], [[x2,y2], [x3,y3]] ] ]);
      new MultiPolygon({
        type: "MultiPolygon",
        coordinates: [ [ [[x,y], [x1,y1]], [[x2,y2], [x3,y3]] ] ]
      });
  */
  function MultiPolygon(input){
    if(input && input.type === "MultiPolygon" && input.coordinates){
      extend(this, input);
    } else if(Array.isArray(input)) {
      this.type = "MultiPolygon";
      this.coordinates = input;
    } else if(!input) {
      this.type = "MultiPolygon";
    } else {
      throw "Terraformer: invalid input for Terraformer.MultiPolygon";
    }

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });

    this.__defineGetter__('length', function () {
      return this.coordinates ? this.coordinates.length : 0;
    });
  }

  MultiPolygon.prototype = new Primitive();
  MultiPolygon.prototype.constructor = MultiPolygon;
  MultiPolygon.prototype.forEach = function(func){
    for (var i = 0; i < this.coodinates.length; i++) {
      func.apply(this, [this.coodinates[i], i, this.coodinates ]);
    }
  };

  /*
  GeoJSON Feature Class
      new Feature();
      new Feature({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [ [ [[x,y], [x1,y1]], [[x2,y2], [x3,y3]] ] ]
        }
      });
      new Feature({
        type: "Polygon",
        coordinates: [ [ [[x,y], [x1,y1]], [[x2,y2], [x3,y3]] ] ]
      });
  */
  function Feature(input){
    if(input && input.type === "Feature" && input.geometry){
      extend(this, input);
    } else if(input && input.type && input.coordinates) {
      this.type = "Feature";
      this.geometry = input;
    } else if(!input) {
      this.type = "Feature";
    } else {
      throw "Terraformer: invalid input for Terraformer.Feature";
    }

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });

  }

  Feature.prototype = new Primitive();
  Feature.prototype.constructor = Feature;

  /*
  GeoJSON FeatureCollection Class
      new FeatureCollection();
      new FeatureCollection([feature, feature1]);
      new FeatureCollection({
        type: "FeatureCollection",
        coordinates: [feature, feature1]
      });
  */
  function FeatureCollection(input){
    if(input && input.type === "FeatureCollection" && input.features){
      extend(this, input);
    } else if(Array.isArray(input)) {
      this.type = "FeatureCollection";
      this.features = input;
    } else if(!input) {
      this.type = "FeatureCollection";
    } else {
      throw "Terraformer: invalid input for Terraformer.FeatureCollection";
    }

    this.__defineGetter__('length', function () {
      return this.features ? this.features.length : 0;
    });

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });

  }

  FeatureCollection.prototype = new Primitive();
  FeatureCollection.prototype.constructor = FeatureCollection;
  FeatureCollection.prototype.forEach = function(func){
    for (var i = 0; i < this.features.length; i++) {
      func.apply(this, [this.features[i], i, this.features]);
    }
  };

  /*
  GeoJSON GeometryCollection Class
      new GeometryCollection();
      new GeometryCollection([geometry, geometry1]);
      new GeometryCollection({
        type: "GeometryCollection",
        coordinates: [geometry, geometry1]
      });
  */
  function GeometryCollection(input){
    if(input && input.type === "GeometryCollection" && input.geometries){
      extend(this, input);
    } else if(Array.isArray(input)) {
      this.type = "GeometryCollection";
      this.geometries = input;
    } else if(!input) {
      this.type = "GeometryCollection";
    } else {
      throw "Terraformer: invalid input for Terraformer.GeometryCollection";
    }

    this.__defineGetter__('length', function () {
      return this.geometries ? this.geometries.length : 0;
    });

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });

  }

  GeometryCollection.prototype = new Primitive();
  GeometryCollection.prototype.constructor = GeometryCollection;
  GeometryCollection.prototype.forEach = function(func){
    for (var i = 0; i < this.geometries.length; i++) {
      func.apply(this, [this.geometries[i], i, this.geometries]);
    }
  };

  function Circle (position, radius, steps) {
    steps = steps || 64;
    var mercatorPosition = positionToMercator(position);
    var polygon = {
      type: "Polygon",
      coordinates: [[]]
    };

    for(var i=1; i<=steps; i++) {
      // convert angle to raidans
      var radians = i * (360/steps) * Math.PI / 180;
      // add point to the circle
      polygon.coordinates[0].push([mercatorPosition[0] + radius * Math.cos(radians), mercatorPosition[1] + radius * Math.sin(radians)]);
    }

    extend(this, new Feature({
      type: "Feature",
      geometry: toGeographic(polygon),
      properties: {
        radius: radius,
        position: position,
        steps: steps
      }
    }));

    this.__defineGetter__("bbox", function(){
      return calculateBounds(this);
    });
  }

  Circle.prototype = new Primitive();
  Circle.prototype.constructor = Circle;

  exports.Point = Point;
  exports.MultiPoint = MultiPoint;
  exports.LineString = LineString;
  exports.MultiLineString = MultiLineString;
  exports.Polygon = Polygon;
  exports.MultiPolygon = MultiPolygon;
  exports.Feature = Feature;
  exports.FeatureCollection = FeatureCollection;
  exports.GeometryCollection = GeometryCollection;
  exports.Circle = Circle;

  exports.toMercator = toMercator;
  exports.toGeographic = toGeographic;

  exports.Tools = {};
  exports.Tools.positionToMercator = positionToMercator;
  exports.Tools.positionToGeographic = positionToGeographic;
  exports.Tools.applyConverter = applyConverter;
  exports.Tools.toMercator = toMercator;
  exports.Tools.toGeographic = toGeographic;

  exports.Tools.calculateBounds = calculateBounds;

  exports.Stores = {};

  return exports;
}));