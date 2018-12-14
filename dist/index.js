'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var reactiveDict = require('meteor/reactive-dict');
var templating = require('meteor/templating');
var blaze = require('meteor/blaze');
var tracker = require('meteor/tracker');
require('simpl-schema');
require('meteor/check');
var cornerstoneMath = _interopDefault(require('cornerstone-math'));
var meteor = require('meteor/meteor');
var session = require('meteor/session');
var ohif_cornerstone = require('meteor/ohif:cornerstone');
var ohif_core = require('meteor/ohif:core');
var reactiveVar = require('meteor/reactive-var');

var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function unwrapExports (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x.default : x;
}

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var dicomwebClient = createCommonjsModule(function (module, exports) {
(function (global, factory) {
  factory(exports);
})(commonjsGlobal, function (exports) {
  /**
   * Converts a Uint8Array to a String.
   * @param {Uint8Array} array that should be converted
   * @param {Number} offset array offset in case only subset of array items should be extracted (default: 0)
   * @param {Number} limit maximum number of array items that should be extracted (defaults to length of array)
   * @returns {String}
   */

  function uint8ArrayToString(arr, offset, limit) {
    offset = offset || 0;
    limit = limit || arr.length - offset;
    let str = '';

    for (let i = offset; i < offset + limit; i++) {
      str += String.fromCharCode(arr[i]);
    }

    return str;
  }
  /**
   * Converts a String to a Uint8Array.
   * @param {String} str string that should be converted
   * @returns {Uint8Array}
   */


  function stringToUint8Array(str) {
    const arr = new Uint8Array(str.length);

    for (let i = 0, j = str.length; i < j; i++) {
      arr[i] = str.charCodeAt(i);
    }

    return arr;
  }
  /**
   * Identifies the boundary in a multipart/related message header.
   * @param {String} header message header
   * @returns {String} boundary
   */


  function identifyBoundary(header) {
    const parts = header.split('\r\n');

    for (let i = 0; i < parts.length; i++) {
      if (parts[i].substr(0, 2) === '--') {
        return parts[i];
      }
    }
  }
  /**
   * Checks whether a given token is contained by a message at a given offset.
   * @param {Uint8Array} message message content
   * @param {Uint8Array} token substring that should be present
   * @param {String} offset offset in message content from where search should start
   * @returns {Boolean} whether message contains token at offset
   */


  function containsToken(message, token, offset = 0) {
    if (message + token.length > message.length) {
      return false;
    }

    let index = offset;

    for (let i = 0; i < token.length; i++) {
      if (token[i] !== message[index++]) {
        return false;
      }
    }

    return true;
  }
  /**
   * Finds a given token in a message at a given offset.
   * @param {Uint8Array} message message content
   * @param {Uint8Array} token substring that should be found
   * @param {String} offset message body offset from where search should start
   * @returns {Boolean} whether message has a part at given offset or not
   */


  function findToken(message, token, offset = 0) {
    const messageLength = message.length;

    for (let i = offset; i < messageLength; i++) {
      // If the first value of the message matches
      // the first value of the token, check if
      // this is the full token.
      if (message[i] === token[0]) {
        if (containsToken(message, token, i)) {
          return i;
        }
      }
    }

    return -1;
  }
  /**
   * @typedef {Object} MultipartEncodedData
   * @property {ArrayBuffer} data The encoded Multipart Data
   * @property {String} boundary The boundary used to divide pieces of the encoded data
   */

  /**
   * Encode one or more DICOM datasets into a single body so it can be
   * sent using the Multipart Content-Type.
   *
   * @param {ArrayBuffer[]} datasets Array containing each file to be encoded in the multipart body, passed as ArrayBuffers.
   * @param {String} [boundary] Optional string to define a boundary between each part of the multipart body. If this is not specified, a random GUID will be generated.
   * @return {MultipartEncodedData} The Multipart encoded data returned as an Object. This contains both the data itself, and the boundary string used to divide it.
   */


  function multipartEncode(datasets, boundary = guid(), contentType = 'application/dicom') {
    const contentTypeString = `Content-Type: ${contentType}`;
    const header = `\r\n--${boundary}\r\n${contentTypeString}\r\n\r\n`;
    const footer = `\r\n--${boundary}--`;
    const headerArray = stringToUint8Array(header);
    const footerArray = stringToUint8Array(footer);
    const headerLength = headerArray.length;
    const footerLength = footerArray.length;
    let length = 0; // Calculate the total length for the final array

    const contentArrays = datasets.map(datasetBuffer => {
      const contentArray = new Uint8Array(datasetBuffer);
      const contentLength = contentArray.length;
      length += headerLength + contentLength + footerLength;
      return contentArray;
    }); // Allocate the array

    const multipartArray = new Uint8Array(length); // Set the initial header

    multipartArray.set(headerArray, 0); // Write each dataset into the multipart array

    let position = 0;
    contentArrays.forEach(contentArray => {
      const contentLength = contentArray.length;
      multipartArray.set(headerArray, position);
      multipartArray.set(contentArray, position + headerLength);
      position += headerLength + contentArray.length;
    });
    multipartArray.set(footerArray, position);
    return {
      data: multipartArray.buffer,
      boundary
    };
  }
  /**
   * Decode a Multipart encoded ArrayBuffer and return the components as an Array.
   *
   * @param {ArrayBuffer} response Data encoded as a 'multipart/related' message
   * @returns {Array} The content
   */


  function multipartDecode(response) {
    const message = new Uint8Array(response); // First look for the multipart mime header

    const separator = stringToUint8Array('\r\n\r\n');
    const headerIndex = findToken(message, separator);

    if (headerIndex === -1) {
      throw new Error('Response message has no multipart mime header');
    }

    const header = uint8ArrayToString(message, 0, headerIndex);
    const boundaryString = identifyBoundary(header);

    if (!boundaryString) {
      throw new Error('Header of response message does not specify boundary');
    }

    const boundary = stringToUint8Array(boundaryString);
    const boundaryLength = boundary.length;
    const components = [];
    let offset = headerIndex + separator.length; // Loop until we cannot find any more boundaries

    let boundaryIndex;

    while (boundaryIndex !== -1) {
      // Search for the next boundary in the message, starting
      // from the current offset position
      boundaryIndex = findToken(message, boundary, offset); // If no further boundaries are found, stop here.

      if (boundaryIndex === -1) {
        break;
      } // Extract data from response message, excluding "\r\n"


      const spacingLength = 2;
      const length = boundaryIndex - offset - spacingLength;
      const data = response.slice(offset, offset + length); // Add the data to the array of results

      components.push(data); // Move the offset to the end of the current section,
      // plus the identified boundary

      offset += length + spacingLength + boundaryLength;
    }

    return components;
  }
  /**
   * Create a random GUID
   *
   * @return {string}
   */


  function guid() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
  }

  function isEmptyObject(obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
  }

  const getFirstResult = result => result[0];

  const MIMETYPES = {
    DICOM: 'application/dicom',
    DICOM_JSON: 'application/dicom+json',
    OCTET_STREAM: 'application/octet-stream'
  };
  /**
  * Class for interacting with DICOMweb RESTful services.
  */

  class DICOMwebClient {
    /**
    * @constructor
    * @param {Object} options (choices: "url", "username", "password", "headers")
    */
    constructor(options) {
      this.baseURL = options.url;

      if (!this.baseURL) {
        console.error('DICOMweb base url provided - calls will fail');
      }

      if ('username' in options) {
        this.username = options.username;

        if (!('password' in options)) {
          console.error('no password provided to authenticate with DICOMweb service');
        }

        this.password = options.password;
      }

      this.headers = options.headers || {};
    }

    static _parseQueryParameters(params = {}) {
      let queryString = '?';
      Object.keys(params).forEach(function (key, index) {
        if (index !== 0) {
          queryString += '&';
        }

        queryString += key + '=' + encodeURIComponent(params[key]);
      });
      return queryString;
    }

    _httpRequest(url, method, headers, options = {}) {
      return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open(method, url, true);

        if ('responseType' in options) {
          request.responseType = options.responseType;
        }

        if (typeof headers === 'object') {
          Object.keys(headers).forEach(function (key) {
            request.setRequestHeader(key, headers[key]);
          });
        } // now add custom headers from the user
        // (e.g. access tokens)


        const userHeaders = this.headers;
        Object.keys(userHeaders).forEach(function (key) {
          request.setRequestHeader(key, userHeaders[key]);
        }); // Event triggered when upload starts

        request.onloadstart = function (event) {//console.log('upload started: ', url)
        }; // Event triggered when upload ends


        request.onloadend = function (event) {//console.log('upload finished')
        }; // Handle response message


        request.onreadystatechange = function (event) {
          if (request.readyState === 4) {
            if (request.status === 200) {
              resolve(request.response);
            } else if (request.status === 202) {
              console.warn('some resources already existed: ', request);
              resolve(request.response);
            } else if (request.status === 204) {
              console.warn('empty response for request: ', request);
              resolve([]);
            } else {
              console.error('request failed: ', request);
              const error = new Error('request failed');
              error.request = request;
              error.response = request.response;
              error.status = request.status;
              console.error(error);
              console.error(error.response);
              reject(error);
            }
          }
        }; // Event triggered while download progresses


        if ('progressCallback' in options) {
          if (typeof options.progressCallback === 'function') {
            request.onprogress = options.progressCallback;
          }
        } // request.onprogress = function (event) {
        //   const loaded = progress.loaded;
        //   let total;
        //   let percentComplete;
        //   if (progress.lengthComputable) {
        //     total = progress.total;
        //     percentComplete = Math.round((loaded / total) * 100);
        //   j
        //   // console.log('download progress: ', percentComplete, ' %');
        //   return(percentComplete);
        // };


        if ('data' in options) {
          request.send(options.data);
        } else {
          request.send();
        }
      });
    }

    _httpGet(url, headers, responseType, progressCallback) {
      return this._httpRequest(url, 'get', headers, {
        responseType,
        progressCallback
      });
    }

    _httpGetApplicationJson(url, params = {}, progressCallback) {
      if (typeof params === 'object') {
        if (!isEmptyObject(params)) {
          url += DICOMwebClient._parseQueryParameters(params);
        }
      }

      const headers = {
        'Accept': MIMETYPES.DICOM_JSON
      };
      const responseType = 'json';
      return this._httpGet(url, headers, responseType, progressCallback);
    }

    _httpGetByMimeType(url, mimeType, params, responseType = 'arraybuffer', progressCallback) {
      if (typeof params === 'object') {
        if (!isEmptyObject(params)) {
          url += DICOMwebClient._parseQueryParameters(params);
        }
      }

      const headers = {
        'Accept': `multipart/related; type="${mimeType}"`
      };
      return this._httpGet(url, headers, responseType, progressCallback);
    }

    _httpPost(url, headers, data, progressCallback) {
      return this._httpRequest(url, 'post', headers, {
        data,
        progressCallback
      });
    }

    _httpPostApplicationJson(url, data, progressCallback) {
      const headers = {
        'Content-Type': MIMETYPES.DICOM_JSON
      };
      return this._httpPost(url, headers, data, progressCallback);
    }
    /**
     * Searches for DICOM studies.
     * @param {Object} options options object - "queryParams" optional query parameters (choices: "fuzzymatching", "offset", "limit" or any valid DICOM attribute identifier)
     * @return {Array} study representations (http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7.1-2)
     */


    searchForStudies(options = {}) {
      console.log('search for studies');
      let url = this.baseURL + '/studies';

      if ('queryParams' in options) {
        url += DICOMwebClient._parseQueryParameters(options.queryParams);
      }

      return this._httpGetApplicationJson(url);
    }
    /**
     * Retrieves metadata for a DICOM study.
     * @param {String} studyInstanceUID Study Instance UID
     * @returns {Array} metadata elements in DICOM JSON format for each instance belonging to the study
     */


    retrieveStudyMetadata(options) {
      if (!('studyInstanceUID' in options)) {
        throw new Error('Study Instance UID is required for retrieval of study metadata');
      }

      console.log(`retrieve metadata of study ${options.studyInstanceUID}`);
      const url = this.baseURL + '/studies/' + options.studyInstanceUID + '/metadata';
      return this._httpGetApplicationJson(url);
    }
    /**
     * Searches for DICOM series.
     * @param {Object} options optional DICOM identifiers (choices: "studyInstanceUID")
     * @param {Object} queryParams optional query parameters (choices: "fuzzymatching", "offset", "limit" or any valid DICOM attribute identifier)
     * @returns {Array} series representations (http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7.1-2a)
     */


    searchForSeries(options = {}) {
      let url = this.baseURL;

      if ('studyInstanceUID' in options) {
        console.log(`search series of study ${options.studyInstanceUID}`);
        url += '/studies/' + options.studyInstanceUID;
      }

      url += '/series';

      if ('queryParams' in options) {
        url += DICOMwebClient._parseQueryParameters(options.queryParams);
      }

      return this._httpGetApplicationJson(url);
    }
    /**
     * Retrieves metadata for a DICOM series.
     * @param {String} studyInstanceUID Study Instance UID
     * @param {String} seriesInstanceUID Series Instance UID
     * @returns {Array} metadata elements in DICOM JSON format for each instance belonging to the series
     */


    retrieveSeriesMetadata(options) {
      if (!('studyInstanceUID' in options)) {
        throw new Error('Study Instance UID is required for retrieval of series metadata');
      }

      if (!('seriesInstanceUID' in options)) {
        throw new Error('Series Instance UID is required for retrieval of series metadata');
      }

      console.log(`retrieve metadata of series ${options.seriesInstanceUID}`);
      const url = this.baseURL + '/studies/' + options.studyInstanceUID + '/series/' + options.seriesInstanceUID + '/metadata';
      return this._httpGetApplicationJson(url);
    }
    /**
     * Searches for DICOM instances.
     * @param {Object} options optional DICOM identifiers (choices: "studyInstanceUID", "seriesInstanceUID")
     * @param {Object} queryParams optional query parameters (choices: "fuzzymatching", "offset", "limit" or any valid DICOM attribute identifier)
     * @returns {Array} instance representations (http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7.1-2b)
     */


    searchForInstances(options = {}) {
      let url = this.baseURL;

      if ('studyInstanceUID' in options) {
        url += '/studies/' + options.studyInstanceUID;

        if ('seriesInstanceUID' in options) {
          console.log(`search for instances of series ${options.seriesInstanceUID}`);
          url += '/series/' + options.seriesInstanceUID;
        } else {
          console.log(`search for instances of study ${options.studyInstanceUID}`);
        }
      } else {
        console.log('search for instances');
      }

      url += '/instances';

      if ('queryParams' in options) {
        url += DICOMwebClient._parseQueryParameters(options.queryParams);
      }

      return this._httpGetApplicationJson(url);
    }
    /** Returns a WADO-URI URL for an instance
     *
     * @param {Object} options
     * @returns {String} WADO-URI URL
     */


    buildInstanceWadoURIUrl(options) {
      if (!('studyInstanceUID' in options)) {
        throw new Error('Study Instance UID is required.');
      }

      if (!('seriesInstanceUID' in options)) {
        throw new Error('Series Instance UID is required.');
      }

      if (!('sopInstanceUID' in options)) {
        throw new Error('SOP Instance UID is required.');
      }

      const contentType = options.contentType || MIMETYPES.DICOM;
      const transferSyntax = options.transferSyntax || '*';
      const params = [];
      params.push('requestType=WADO');
      params.push(`studyUID=${options.studyInstanceUID}`);
      params.push(`seriesUID=${options.seriesInstanceUID}`);
      params.push(`objectUID=${options.sopInstanceUID}`);
      params.push(`contentType=${contentType}`);
      params.push(`transferSyntax=${transferSyntax}`);
      const paramString = params.join('&');
      return `${this.baseURL}?${paramString}`;
    }
    /**
     * Retrieves metadata for a DICOM instance.
     * @param {String} studyInstanceUID Study Instance UID
     * @param {String} seriesInstanceUID Series Instance UID
     * @param {String} sopInstanceUID SOP Instance UID
     * @returns {Object} metadata elements in DICOM JSON format
     */


    retrieveInstanceMetadata(options) {
      if (!('studyInstanceUID' in options)) {
        throw new Error('Study Instance UID is required for retrieval of instance metadata');
      }

      if (!('seriesInstanceUID' in options)) {
        throw new Error('Series Instance UID is required for retrieval of instance metadata');
      }

      if (!('sopInstanceUID' in options)) {
        throw new Error('SOP Instance UID is required for retrieval of instance metadata');
      }

      console.log(`retrieve metadata of instance ${options.sopInstanceUID}`);
      const url = this.baseURL + '/studies/' + options.studyInstanceUID + '/series/' + options.seriesInstanceUID + '/instances/' + options.sopInstanceUID + '/metadata';
      return this._httpGetApplicationJson(url);
    }
    /**
     * Retrieves frames for a DICOM instance.
     * @param {String} studyInstanceUID Study Instance UID
     * @param {String} seriesInstanceUID Series Instance UID
     * @param {String} sopInstanceUID SOP Instance UID
     * @param {Array} frameNumbers one-based index of frames
     * @param {Object} options optional parameters (key "imageSubtype" to specify MIME image subtypes)
     * @returns {Array} frame items as byte arrays of the pixel data element
     */


    retrieveInstanceFrames(options) {
      if (!('studyInstanceUID' in options)) {
        throw new Error('Study Instance UID is required for retrieval of instance metadata');
      }

      if (!('seriesInstanceUID' in options)) {
        throw new Error('Series Instance UID is required for retrieval of instance metadata');
      }

      if (!('sopInstanceUID' in options)) {
        throw new Error('SOP Instance UID is required for retrieval of instance metadata');
      }

      if (!('frameNumbers' in options)) {
        throw new Error('frame numbers are required for retrieval of instance frames');
      }

      console.log(`retrieve frames ${options.frameNumbers.toString()} of instance ${options.sopInstanceUID}`);
      const url = this.baseURL + '/studies/' + options.studyInstanceUID + '/series/' + options.seriesInstanceUID + '/instances/' + options.sopInstanceUID + '/frames/' + options.frameNumbers.toString(); // TODO: Easier if user just provided mimetype directly? What is the benefit of adding 'image/'?

      const mimeType = options.imageSubType ? `image/${options.imageSubType}` : MIMETYPES.OCTET_STREAM;
      return this._httpGetByMimeType(url, mimeType).then(multipartDecode);
    }
    /**
     * Retrieves a DICOM instance.
     *
     * @param {String} studyInstanceUID Study Instance UID
     * @param {String} seriesInstanceUID Series Instance UID
     * @param {String} sopInstanceUID SOP Instance UID
     * @returns {Arraybuffer} DICOM Part 10 file as Arraybuffer
     */


    retrieveInstance(options) {
      if (!('studyInstanceUID' in options)) {
        throw new Error('Study Instance UID is required');
      }

      if (!('seriesInstanceUID' in options)) {
        throw new Error('Series Instance UID is required');
      }

      if (!('sopInstanceUID' in options)) {
        throw new Error('SOP Instance UID is required');
      }

      const url = this.baseURL + '/studies/' + options.studyInstanceUID + '/series/' + options.seriesInstanceUID + '/instances/' + options.sopInstanceUID;
      return this._httpGetByMimeType(url, MIMETYPES.DICOM).then(multipartDecode).then(getFirstResult);
    }
    /**
     * Retrieves a set of DICOM instance for a series.
     *
     * @param {String} studyInstanceUID Study Instance UID
     * @param {String} seriesInstanceUID Series Instance UID
     * @returns {Arraybuffer[]} Array of DICOM Part 10 files as Arraybuffers
     */


    retrieveSeries(options) {
      if (!('studyInstanceUID' in options)) {
        throw new Error('Study Instance UID is required');
      }

      if (!('seriesInstanceUID' in options)) {
        throw new Error('Series Instance UID is required');
      }

      const url = this.baseURL + '/studies/' + options.studyInstanceUID + '/series/' + options.seriesInstanceUID;
      return this._httpGetByMimeType(url, MIMETYPES.DICOM).then(multipartDecode);
    }
    /**
     * Retrieves a set of DICOM instance for a study.
     *
     * @param {String} studyInstanceUID Study Instance UID
     * @returns {Arraybuffer[]} Array of DICOM Part 10 files as Arraybuffers
     */


    retrieveStudy(options) {
      if (!('studyInstanceUID' in options)) {
        throw new Error('Study Instance UID is required');
      }

      const url = this.baseURL + '/studies/' + options.studyInstanceUID;
      return this._httpGetByMimeType(url, MIMETYPES.DICOM).then(multipartDecode);
    }
    /**
     * Retrieve and parse BulkData from a BulkDataURI location.
     * Decodes the multipart encoded data and returns the resulting data
     * as an ArrayBuffer.
     *
     * See http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.5.5.html
     *
     * @param {Object} options
     * @return {Promise}
     */


    retrieveBulkData(options) {
      if (!('BulkDataURI' in options)) {
        throw new Error('BulkDataURI is required.');
      }

      return this._httpGetByMimeType(options.BulkDataURI, MIMETYPES.OCTET_STREAM).then(multipartDecode).then(getFirstResult);
    }
    /**
     * Stores DICOM instances.
     * @param {Array} datasets DICOM datasets of instances that should be stored in DICOM JSON format
     * @param {Object} options optional parameters (key "studyInstanceUID" to only store instances of a given study)
     */


    storeInstances(options) {
      if (!('datasets' in options)) {
        throw new Error('datasets are required for storing');
      }

      let url = `${this.baseURL}/studies`;

      if ('studyInstanceUID' in options) {
        url += `/${options.studyInstanceUID}`;
      }

      const {
        data,
        boundary
      } = multipartEncode(options.datasets);
      const headers = {
        'Content-Type': `multipart/related; type=application/dicom; boundary=${boundary}`
      };
      return this._httpPost(url, headers, data, options.progressCallback);
    }

  }

  function findSubstring(str, before, after) {
    const beforeIndex = str.lastIndexOf(before) + before.length;

    if (beforeIndex < before.length) {
      return null;
    }

    if (after !== undefined) {
      const afterIndex = str.lastIndexOf(after);

      if (afterIndex < 0) {
        return null;
      } else {
        return str.substring(beforeIndex, afterIndex);
      }
    }

    return str.substring(beforeIndex);
  }

  function getStudyInstanceUIDFromUri(uri) {
    var uid = findSubstring(uri, "studies/", "/series");

    if (!uid) {
      var uid = findSubstring(uri, "studies/");
    }

    if (!uid) {
      console.debug('Study Instance UID could not be dertermined from URI "' + uri + '"');
    }

    return uid;
  }

  function getSeriesInstanceUIDFromUri(uri) {
    var uid = findSubstring(uri, "series/", "/instances");

    if (!uid) {
      var uid = findSubstring(uri, "series/");
    }

    if (!uid) {
      console.debug('Series Instance UID could not be dertermined from URI "' + uri + '"');
    }

    return uid;
  }

  function getSOPInstanceUIDFromUri(uri) {
    var uid = findSubstring(uri, "/instances/", "/frames");

    if (!uid) {
      var uid = findSubstring(uri, "/instances/", "/metadata");
    }

    if (!uid) {
      var uid = findSubstring(uri, "/instances/");
    }

    if (!uid) {
      console.debug('SOP Instance UID could not be dertermined from URI"' + uri + '"');
    }

    return uid;
  }

  function getFrameNumbersFromUri(uri) {
    let numbers = findSubstring(uri, "/frames/");

    if (numbers === undefined) {
      console.debug('Frames Numbers could not be dertermined from URI"' + uri + '"');
    }

    return numbers.split(',');
  }

  let api = {
    DICOMwebClient
  };
  let utils = {
    getStudyInstanceUIDFromUri,
    getSeriesInstanceUIDFromUri,
    getSOPInstanceUIDFromUri,
    getFrameNumbersFromUri
  };
  exports.api = api;
  exports.utils = utils;
  Object.defineProperty(exports, '__esModule', {
    value: true
  });
});
});

var DICOMwebClient = unwrapExports(dicomwebClient);

/**
 * Parses data returned from a QIDO search and transforms it into
 * an array of series that are present in the study
 *
 * @param server The DICOM server
 * @param studyInstanceUid
 * @param resultData
 * @returns {Array} Series List
 */

function resultDataToStudyMetadata(server, studyInstanceUid, resultData) {
  const {
    DICOMWeb
  } = ohif_core.OHIF;
  var seriesMap = {};
  var seriesList = [];
  resultData.forEach(function (instance) {
    // Use seriesMap to cache series data
    // If the series instance UID has already been used to
    // process series data, continue using that series
    var seriesInstanceUid = DICOMWeb.getString(instance['0020000E']);
    var series = seriesMap[seriesInstanceUid]; // If no series data exists in the seriesMap cache variable,
    // process any available series data

    if (!series) {
      series = {
        seriesInstanceUid: seriesInstanceUid,
        seriesNumber: DICOMWeb.getString(instance['00200011']),
        instances: []
      }; // Save this data in the seriesMap cache variable

      seriesMap[seriesInstanceUid] = series;
      seriesList.push(series);
    } // The uri for the dicomweb
    // NOTE: DCM4CHEE seems to return the data zipped
    // NOTE: Orthanc returns the data with multi-part mime which cornerstoneWADOImageLoader doesn't
    //       know how to parse yet
    //var uri = DICOMWeb.getString(instance['00081190']);
    //uri = uri.replace('wado-rs', 'dicom-web');
    // manually create a WADO-URI from the UIDs
    // NOTE: Haven't been able to get Orthanc's WADO-URI to work yet - maybe its not configured?


    var sopInstanceUid = DICOMWeb.getString(instance['00080018']);
    var uri = server.wadoUriRoot + '?requestType=WADO&studyUID=' + studyInstanceUid + '&seriesUID=' + seriesInstanceUid + '&objectUID=' + sopInstanceUid + '&contentType=application%2Fdicom'; // Add this instance to the current series

    series.instances.push({
      sopClassUid: DICOMWeb.getString(instance['00080016']),
      sopInstanceUid: sopInstanceUid,
      uri: uri,
      instanceNumber: DICOMWeb.getString(instance['00200013'])
    });
  });
  return seriesList;
}
/**
 * Retrieve a set of instances using a QIDO call
 * @param server
 * @param studyInstanceUid
 * @throws ECONNREFUSED
 * @returns {{wadoUriRoot: String, studyInstanceUid: String, seriesList: Array}}
 */


function Instances(server, studyInstanceUid) {
  // TODO: Are we using this function anywhere?? Can we remove it?
  const config = {
    url: server.qidoRoot,
    headers: ohif_core.OHIF.DICOMWeb.getAuthorizationHeader()
  };
  const dicomWeb = new DICOMwebClient.api.DICOMwebClient(config);
  const queryParams = getQIDOQueryParams(filter, server.qidoSupportsIncludeField);
  const options = {
    studyInstanceUID: studyInstanceUid
  };
  return dicomWeb.searchForInstances(options).then(result => {
    return {
      wadoUriRoot: server.wadoUriRoot,
      studyInstanceUid: studyInstanceUid,
      seriesList: resultDataToStudyMetadata(server, studyInstanceUid, result.data)
    };
  });
}

if (Meteor.isServer) {
  var XMLHttpRequest$1 = require('xhr2');

  global.XMLHttpRequest = XMLHttpRequest$1;
}
/**
 * Creates a QIDO date string for a date range query
 * Assumes the year is positive, at most 4 digits long.
 *
 * @param date The Date object to be formatted
 * @returns {string} The formatted date string
 */


function dateToString(date) {
  if (!date) return '';
  let year = date.getFullYear().toString();
  let month = (date.getMonth() + 1).toString();
  let day = date.getDate().toString();
  year = '0'.repeat(4 - year.length).concat(year);
  month = '0'.repeat(2 - month.length).concat(month);
  day = '0'.repeat(2 - day.length).concat(day);
  return ''.concat(year, month, day);
}
/**
 * Produces a QIDO URL given server details and a set of specified search filter
 * items
 *
 * @param filter
 * @param serverSupportsQIDOIncludeField
 * @returns {string} The URL with encoded filter query data
 */


function getQIDOQueryParams$1(filter, serverSupportsQIDOIncludeField) {
  const commaSeparatedFields = ['00081030', // Study Description
  '00080060' //Modality
  // Add more fields here if you want them in the result
  ].join(',');
  const parameters = {
    PatientName: filter.patientName,
    PatientID: filter.patientId,
    AccessionNumber: filter.accessionNumber,
    StudyDescription: filter.studyDescription,
    ModalitiesInStudy: filter.modalitiesInStudy,
    limit: filter.limit,
    offset: filter.offset,
    includefield: serverSupportsQIDOIncludeField ? commaSeparatedFields : 'all'
  }; // build the StudyDate range parameter

  if (filter.studyDateFrom || filter.studyDateTo) {
    const dateFrom = dateToString(new Date(filter.studyDateFrom));
    const dateTo = dateToString(new Date(filter.studyDateTo));
    parameters.StudyDate = `${dateFrom}-${dateTo}`;
  } // Build the StudyInstanceUID parameter


  if (filter.studyInstanceUid) {
    let studyUids = filter.studyInstanceUid;
    studyUids = Array.isArray(studyUids) ? studyUids.join() : studyUids;
    studyUids = studyUids.replace(/[^0-9.]+/g, '\\');
    parameters.StudyInstanceUID = studyUids;
  } // Clean query params of undefined values.


  const params = {};
  Object.keys(parameters).forEach(key => {
    if (parameters[key] !== undefined && parameters[key] !== "") {
      params[key] = parameters[key];
    }
  });
  return params;
}
/**
 * Parses resulting data from a QIDO call into a set of Study MetaData
 *
 * @param resultData
 * @returns {Array} An array of Study MetaData objects
 */


function resultDataToStudies(resultData) {
  const {
    DICOMWeb
  } = ohif_core.OHIF;
  const studies = [];
  if (!resultData || !resultData.length) return;
  resultData.forEach(study => studies.push({
    studyInstanceUid: DICOMWeb.getString(study['0020000D']),
    // 00080005 = SpecificCharacterSet
    studyDate: DICOMWeb.getString(study['00080020']),
    studyTime: DICOMWeb.getString(study['00080030']),
    accessionNumber: DICOMWeb.getString(study['00080050']),
    referringPhysicianName: DICOMWeb.getString(study['00080090']),
    // 00081190 = URL
    patientName: DICOMWeb.getName(study['00100010']),
    patientId: DICOMWeb.getString(study['00100020']),
    patientBirthdate: DICOMWeb.getString(study['00100030']),
    patientSex: DICOMWeb.getString(study['00100040']),
    studyId: DICOMWeb.getString(study['00200010']),
    numberOfStudyRelatedSeries: DICOMWeb.getString(study['00201206']),
    numberOfStudyRelatedInstances: DICOMWeb.getString(study['00201208']),
    studyDescription: DICOMWeb.getString(study['00081030']),
    // modality: DICOMWeb.getString(study['00080060']),
    // modalitiesInStudy: DICOMWeb.getString(study['00080061']),
    modalities: DICOMWeb.getString(DICOMWeb.getModalities(study['00080060'], study['00080061']))
  }));
  return studies;
}

function Studies(server, filter) {
  const config = {
    url: server.qidoRoot,
    headers: ohif_core.OHIF.DICOMWeb.getAuthorizationHeader()
  };
  const dicomWeb = new DICOMwebClient.api.DICOMwebClient(config);
  const queryParams = getQIDOQueryParams$1(filter, server.qidoSupportsIncludeField);
  const options = {
    queryParams
  };
  return dicomWeb.searchForStudies(options).then(resultDataToStudies);
}

const parseFloatArray = function (obj) {
  var result = [];

  if (!obj) {
    return result;
  }

  var objs = obj.split("\\");

  for (var i = 0; i < objs.length; i++) {
    result.push(parseFloat(objs[i]));
  }

  return result;
};

WADOProxy = {
  convertURL: (url, server) => {
    // TODO: Remove all WADOProxy stuff from this file
    return url;
  }
  /**
   * Simple cache schema for retrieved color palettes.
   */

};
const paletteColorCache = {
  count: 0,
  maxAge: 24 * 60 * 60 * 1000,
  // 24h cache?
  entries: {},
  isValidUID: function (paletteUID) {
    return typeof paletteUID === 'string' && paletteUID.length > 0;
  },
  get: function (paletteUID) {
    let entry = null;

    if (this.entries.hasOwnProperty(paletteUID)) {
      entry = this.entries[paletteUID]; // check how the entry is...

      if (Date.now() - entry.time > this.maxAge) {
        // entry is too old... remove entry.
        delete this.entries[paletteUID];
        this.count--;
        entry = null;
      }
    }

    return entry;
  },
  add: function (entry) {
    if (this.isValidUID(entry.uid)) {
      let paletteUID = entry.uid;

      if (this.entries.hasOwnProperty(paletteUID) !== true) {
        this.count++; // increment cache entry count...
      }

      entry.time = Date.now();
      this.entries[paletteUID] = entry; // @TODO: Add logic to get rid of old entries and reduce memory usage...
    }
  }
};
/** Returns a WADO url for an instance
 *
 * @param studyInstanceUid
 * @param seriesInstanceUid
 * @param sopInstanceUid
 * @returns  {string}
 */

function buildInstanceWadoUrl(server, studyInstanceUid, seriesInstanceUid, sopInstanceUid) {
  // TODO: This can be removed, since DICOMWebClient has the same function. Not urgent, though
  const params = [];
  params.push('requestType=WADO');
  params.push(`studyUID=${studyInstanceUid}`);
  params.push(`seriesUID=${seriesInstanceUid}`);
  params.push(`objectUID=${sopInstanceUid}`);
  params.push('contentType=application/dicom');
  params.push('transferSyntax=*');
  const paramString = params.join('&');
  return `${server.wadoUriRoot}?${paramString}`;
}

function buildInstanceWadoRsUri(server, studyInstanceUid, seriesInstanceUid, sopInstanceUid) {
  return `${server.wadoRoot}/studies/${studyInstanceUid}/series/${seriesInstanceUid}/instances/${sopInstanceUid}`;
}

function buildInstanceFrameWadoRsUri(server, studyInstanceUid, seriesInstanceUid, sopInstanceUid, frame) {
  const baseWadoRsUri = buildInstanceWadoRsUri(server, studyInstanceUid, seriesInstanceUid, sopInstanceUid);
  frame = frame != null || 1;
  return `${baseWadoRsUri}/frames/${frame}`;
}
/**
 * Parses the SourceImageSequence, if it exists, in order
 * to return a ReferenceSOPInstanceUID. The ReferenceSOPInstanceUID
 * is used to refer to this image in any accompanying DICOM-SR documents.
 *
 * @param instance
 * @returns {String} The ReferenceSOPInstanceUID
 */


function getSourceImageInstanceUid(instance) {
  // TODO= Parse the whole Source Image Sequence
  // This is a really poor workaround for now.
  // Later we should probably parse the whole sequence.
  var SourceImageSequence = instance['00082112'];

  if (SourceImageSequence && SourceImageSequence.Value && SourceImageSequence.Value.length) {
    return SourceImageSequence.Value[0]['00081155'].Value[0];
  }
}

function getPaletteColor(server, instance, tag, lutDescriptor) {
  const numLutEntries = lutDescriptor[0];
  const bits = lutDescriptor[2];
  let uri = WADOProxy.convertURL(instance[tag].BulkDataURI, server); // TODO: Workaround for dcm4chee behind SSL-terminating proxy returning
  // incorrect bulk data URIs

  if (server.wadoRoot.indexOf('https') === 0 && !uri.includes('https')) {
    uri = uri.replace('http', 'https');
  }

  const config = {
    url: server.wadoRoot,
    //BulkDataURI is absolute, so this isn't used
    headers: ohif_core.OHIF.DICOMWeb.getAuthorizationHeader()
  };
  const dicomWeb = new DICOMwebClient.api.DICOMwebClient(config);
  const options = {
    BulkDataURI: uri
  };

  const readUInt16 = (byteArray, position) => {
    return byteArray[position] + byteArray[position + 1] * 256;
  };

  const arrayBufferToPaletteColorLUT = arraybuffer => {
    const byteArray = new Uint8Array(arraybuffer);
    const lut = [];

    for (let i = 0; i < numLutEntries; i++) {
      if (bits === 16) {
        lut[i] = readUInt16(byteArray, i * 2);
      } else {
        lut[i] = byteArray[i];
      }
    }

    return lut;
  };

  return dicomWeb.retrieveBulkData(options).then(arrayBufferToPaletteColorLUT);
}
/**
 * Fetch palette colors for instances with "PALETTE COLOR" photometricInterpretation.
 *
 * @param server {Object} Current server;
 * @param instance {Object} The retrieved instance metadata;
 * @returns {String} The ReferenceSOPInstanceUID
 */


async function getPaletteColors(server, instance, lutDescriptor) {
  const {
    DICOMWeb
  } = ohif_core.OHIF;
  let paletteUID = DICOMWeb.getString(instance['00281199']);
  return new Promise((resolve, reject) => {
    if (paletteColorCache.isValidUID(paletteUID)) {
      const entry = paletteColorCache.get(paletteUID);

      if (entry) {
        return resolve(entry);
      }
    } // no entry in cache... Fetch remote data.


    const r = getPaletteColor(server, instance, '00281201', lutDescriptor);
    const g = getPaletteColor(server, instance, '00281202', lutDescriptor);
    const b = getPaletteColor(server, instance, '00281203', lutDescriptor);
    const promises = [r, g, b];
    Promise.all(promises).then(args => {
      entry = {
        red: args[0],
        green: args[1],
        blue: args[2]
      }; // when paletteUID is present, the entry can be cached...

      entry.uid = paletteUID;
      paletteColorCache.add(entry);
      resolve(entry);
    });
  });
}

function getFrameIncrementPointer(element) {
  const frameIncrementPointerNames = {
    '00181065': 'frameTimeVector',
    '00181063': 'frameTime'
  };

  if (!element || !element.Value || !element.Value.length) {
    return;
  }

  const value = element.Value[0];
  return frameIncrementPointerNames[value];
}

function getRadiopharmaceuticalInfo(instance) {
  const {
    DICOMWeb
  } = ohif_core.OHIF;
  const modality = DICOMWeb.getString(instance['00080060']);

  if (modality !== 'PT') {
    return;
  }

  const radiopharmaceuticalInfo = instance['00540016'];

  if (radiopharmaceuticalInfo === undefined || !radiopharmaceuticalInfo.Value || !radiopharmaceuticalInfo.Value.length) {
    return;
  }

  const firstPetRadiopharmaceuticalInfo = radiopharmaceuticalInfo.Value[0];
  return {
    radiopharmaceuticalStartTime: DICOMWeb.getString(firstPetRadiopharmaceuticalInfo['00181072']),
    radionuclideTotalDose: DICOMWeb.getNumber(firstPetRadiopharmaceuticalInfo['00181074']),
    radionuclideHalfLife: DICOMWeb.getNumber(firstPetRadiopharmaceuticalInfo['00181075'])
  };
}
/**
 * Parses result data from a WADO search into Study MetaData
 * Returns an object populated with study metadata, including the
 * series list.
 *
 * @param server
 * @param studyInstanceUid
 * @param resultData
 * @returns {{seriesList: Array, patientName: *, patientId: *, accessionNumber: *, studyDate: *, modalities: *, studyDescription: *, imageCount: *, studyInstanceUid: *}}
 */


async function resultDataToStudyMetadata$1(server, studyInstanceUid, resultData) {
  const {
    DICOMWeb
  } = ohif_core.OHIF;

  if (!resultData.length) {
    return;
  }

  const anInstance = resultData[0];

  if (!anInstance) {
    return;
  }

  const studyData = {
    seriesList: [],
    studyInstanceUid,
    wadoUriRoot: server.wadoUriRoot,
    patientName: DICOMWeb.getName(anInstance['00100010']),
    patientId: DICOMWeb.getString(anInstance['00100020']),
    patientAge: DICOMWeb.getNumber(anInstance['00101010']),
    patientSize: DICOMWeb.getNumber(anInstance['00101020']),
    patientWeight: DICOMWeb.getNumber(anInstance['00101030']),
    accessionNumber: DICOMWeb.getString(anInstance['00080050']),
    studyDate: DICOMWeb.getString(anInstance['00080020']),
    modalities: DICOMWeb.getString(anInstance['00080061']),
    studyDescription: DICOMWeb.getString(anInstance['00081030']),
    imageCount: DICOMWeb.getString(anInstance['00201208']),
    studyInstanceUid: DICOMWeb.getString(anInstance['0020000D']),
    institutionName: DICOMWeb.getString(anInstance['00080080'])
  };
  const seriesMap = {};
  await Promise.all(resultData.map(async function (instance) {
    const seriesInstanceUid = DICOMWeb.getString(instance['0020000E']);
    let series = seriesMap[seriesInstanceUid];

    if (!series) {
      series = {
        seriesDescription: DICOMWeb.getString(instance['0008103E']),
        modality: DICOMWeb.getString(instance['00080060']),
        seriesInstanceUid: seriesInstanceUid,
        seriesNumber: DICOMWeb.getNumber(instance['00200011']),
        seriesDate: DICOMWeb.getString(instance['00080021']),
        seriesTime: DICOMWeb.getString(instance['00080031']),
        instances: []
      };
      seriesMap[seriesInstanceUid] = series;
      studyData.seriesList.push(series);
    }

    const sopInstanceUid = DICOMWeb.getString(instance['00080018']);
    const wadouri = buildInstanceWadoUrl(server, studyInstanceUid, seriesInstanceUid, sopInstanceUid);
    const baseWadoRsUri = buildInstanceWadoRsUri(server, studyInstanceUid, seriesInstanceUid, sopInstanceUid);
    const wadorsuri = buildInstanceFrameWadoRsUri(server, studyInstanceUid, seriesInstanceUid, sopInstanceUid);
    const instanceSummary = {
      imageType: DICOMWeb.getString(instance['00080008']),
      sopClassUid: DICOMWeb.getString(instance['00080016']),
      modality: DICOMWeb.getString(instance['00080060']),
      sopInstanceUid,
      instanceNumber: DICOMWeb.getNumber(instance['00200013']),
      imagePositionPatient: DICOMWeb.getString(instance['00200032']),
      imageOrientationPatient: DICOMWeb.getString(instance['00200037']),
      frameOfReferenceUID: DICOMWeb.getString(instance['00200052']),
      sliceLocation: DICOMWeb.getNumber(instance['00201041']),
      samplesPerPixel: DICOMWeb.getNumber(instance['00280002']),
      photometricInterpretation: DICOMWeb.getString(instance['00280004']),
      planarConfiguration: DICOMWeb.getNumber(instance['00280006']),
      rows: DICOMWeb.getNumber(instance['00280010']),
      columns: DICOMWeb.getNumber(instance['00280011']),
      pixelSpacing: DICOMWeb.getString(instance['00280030']),
      pixelAspectRatio: DICOMWeb.getString(instance['00280034']),
      bitsAllocated: DICOMWeb.getNumber(instance['00280100']),
      bitsStored: DICOMWeb.getNumber(instance['00280101']),
      highBit: DICOMWeb.getNumber(instance['00280102']),
      pixelRepresentation: DICOMWeb.getNumber(instance['00280103']),
      smallestPixelValue: DICOMWeb.getNumber(instance['00280106']),
      largestPixelValue: DICOMWeb.getNumber(instance['00280107']),
      windowCenter: DICOMWeb.getString(instance['00281050']),
      windowWidth: DICOMWeb.getString(instance['00281051']),
      rescaleIntercept: DICOMWeb.getNumber(instance['00281052']),
      rescaleSlope: DICOMWeb.getNumber(instance['00281053']),
      rescaleType: DICOMWeb.getNumber(instance['00281054']),
      sourceImageInstanceUid: getSourceImageInstanceUid(instance),
      laterality: DICOMWeb.getString(instance['00200062']),
      viewPosition: DICOMWeb.getString(instance['00185101']),
      acquisitionDateTime: DICOMWeb.getString(instance['0008002A']),
      numberOfFrames: DICOMWeb.getNumber(instance['00280008']),
      frameIncrementPointer: getFrameIncrementPointer(instance['00280009']),
      frameTime: DICOMWeb.getNumber(instance['00181063']),
      frameTimeVector: parseFloatArray(DICOMWeb.getString(instance['00181065'])),
      sliceThickness: DICOMWeb.getNumber(instance['00180050']),
      lossyImageCompression: DICOMWeb.getString(instance['00282110']),
      derivationDescription: DICOMWeb.getString(instance['00282111']),
      lossyImageCompressionRatio: DICOMWeb.getString(instance['00282112']),
      lossyImageCompressionMethod: DICOMWeb.getString(instance['00282114']),
      echoNumber: DICOMWeb.getString(instance['00180086']),
      contrastBolusAgent: DICOMWeb.getString(instance['00180010']),
      radiopharmaceuticalInfo: getRadiopharmaceuticalInfo(instance),
      baseWadoRsUri: baseWadoRsUri,
      wadouri: WADOProxy.convertURL(wadouri, server),
      wadorsuri: WADOProxy.convertURL(wadorsuri, server),
      imageRendering: server.imageRendering,
      thumbnailRendering: server.thumbnailRendering
    }; // Get additional information if the instance uses "PALETTE COLOR" photometric interpretation

    if (instanceSummary.photometricInterpretation === 'PALETTE COLOR') {
      const redPaletteColorLookupTableDescriptor = parseFloatArray(DICOMWeb.getString(instance['00281101']));
      const greenPaletteColorLookupTableDescriptor = parseFloatArray(DICOMWeb.getString(instance['00281102']));
      const bluePaletteColorLookupTableDescriptor = parseFloatArray(DICOMWeb.getString(instance['00281103']));
      const palettes = await getPaletteColors(server, instance, redPaletteColorLookupTableDescriptor);

      if (palettes) {
        if (palettes.uid) {
          instanceSummary.paletteColorLookupTableUID = palettes.uid;
        }

        instanceSummary.redPaletteColorLookupTableData = palettes.red;
        instanceSummary.greenPaletteColorLookupTableData = palettes.green;
        instanceSummary.bluePaletteColorLookupTableData = palettes.blue;
        instanceSummary.redPaletteColorLookupTableDescriptor = redPaletteColorLookupTableDescriptor;
        instanceSummary.greenPaletteColorLookupTableDescriptor = greenPaletteColorLookupTableDescriptor;
        instanceSummary.bluePaletteColorLookupTableDescriptor = bluePaletteColorLookupTableDescriptor;
      }
    }

    series.instances.push(instanceSummary);
  }));
  return studyData;
}
/**
 * Retrieve Study MetaData from a DICOM server using a WADO call
 *
 * @param server
 * @param studyInstanceUid
 * @returns {Promise}
 */


async function RetrieveMetadata(server, studyInstanceUid) {
  const config = {
    url: server.wadoRoot,
    headers: ohif_core.OHIF.DICOMWeb.getAuthorizationHeader()
  };
  const dicomWeb = new DICOMwebClient.api.DICOMwebClient(config);
  const options = {
    studyInstanceUID: studyInstanceUid
  };
  return dicomWeb.retrieveStudyMetadata(options).then(result => {
    return resultDataToStudyMetadata$1(server, studyInstanceUid, result);
  });
}

// DICOMWeb instance, study, and metadata retrieval
const WADO = {
  RetrieveMetadata
};
const QIDO = {
  Studies,
  Instances
};

ohif_core.OHIF.blaze = {}; // Clone a template and return the clone

ohif_core.OHIF.blaze.cloneTemplate = (template, newName) => {
  if (!template) {
    return;
  }

  const name = newName || template.viewName;
  const clone = new templating.Template(name, template.renderFunction);
  clone.inheritsEventsFrom(template);
  clone.inheritsHelpersFrom(template);
  clone.inheritsHooksFrom(template);
  return clone;
}; // Navigate upwards the component and get the parent with the given view name


ohif_core.OHIF.blaze.getParentView = (view, parentViewName) => {
  let currentView = view;

  while (currentView) {
    if (currentView.name === parentViewName) {
      break;
    }

    currentView = currentView.originalParentView || currentView.parentView;
  }

  return currentView;
}; // Search for the parent component of the given view


ohif_core.OHIF.blaze.getParentComponent = (view, property = '_component') => {
  let currentView = view;

  while (currentView) {
    currentView = currentView.originalParentView || currentView.parentView;

    if (currentView && currentView[property]) {
      return currentView[property];
    }
  }
}; // Search for the parent template of the given view


ohif_core.OHIF.blaze.getParentTemplateView = view => {
  let currentView = view;

  while (currentView) {
    currentView = currentView.originalParentView || currentView.parentView;
    if (!currentView || !currentView.name) return;

    if (currentView.name.indexOf('Template.') > -1 && currentView.name.indexOf('Template.__dynamic') === -1) {
      return currentView;
    }
  }
}; // Get the view that contains the desired section's content and return it


ohif_core.OHIF.blaze.getSectionContent = (view, sectionName) => {
  let currentView = view;

  while (!currentView._sectionMap || !currentView._sectionMap.get(sectionName)) {
    currentView = ohif_core.OHIF.blaze.getParentTemplateView(currentView);
    if (!currentView) return;
  }

  return currentView._sectionMap.get(sectionName);
};

var underscore = createCommonjsModule(function (module, exports) {
//     Underscore.js 1.9.1
//     http://underscorejs.org
//     (c) 2009-2018 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` (`self`) in the browser, `global`
  // on the server, or `this` in some virtual machines. We use `self`
  // instead of `window` for `WebWorker` support.
  var root = typeof self == 'object' && self.self === self && self ||
            typeof commonjsGlobal == 'object' && commonjsGlobal.global === commonjsGlobal && commonjsGlobal ||
            this ||
            {};

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype;
  var SymbolProto = typeof Symbol !== 'undefined' ? Symbol.prototype : null;

  // Create quick reference variables for speed access to core prototypes.
  var push = ArrayProto.push,
      slice = ArrayProto.slice,
      toString = ObjProto.toString,
      hasOwnProperty = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var nativeIsArray = Array.isArray,
      nativeKeys = Object.keys,
      nativeCreate = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for their old module API. If we're in
  // the browser, add `_` as a global object.
  // (`nodeType` is checked to ensure that `module`
  // and `exports` are not HTML elements.)
  if (!exports.nodeType) {
    if (!module.nodeType && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.9.1';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      // The 2-argument case is omitted because we’re not using it.
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  var builtinIteratee;

  // An internal function to generate callbacks that can be applied to each
  // element in a collection, returning the desired result — either `identity`,
  // an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (_.iteratee !== builtinIteratee) return _.iteratee(value, context);
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value) && !_.isArray(value)) return _.matcher(value);
    return _.property(value);
  };

  // External wrapper for our callback generator. Users may customize
  // `_.iteratee` if they want additional predicate/iteratee shorthand styles.
  // This abstraction hides the internal-only argCount argument.
  _.iteratee = builtinIteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // Some functions take a variable number of arguments, or a few expected
  // arguments at the beginning and then a variable number of values to operate
  // on. This helper accumulates all remaining arguments past the function’s
  // argument length (or an explicit `startIndex`), into an array that becomes
  // the last argument. Similar to ES6’s "rest parameter".
  var restArguments = function(func, startIndex) {
    startIndex = startIndex == null ? func.length - 1 : +startIndex;
    return function() {
      var length = Math.max(arguments.length - startIndex, 0),
          rest = Array(length),
          index = 0;
      for (; index < length; index++) {
        rest[index] = arguments[index + startIndex];
      }
      switch (startIndex) {
        case 0: return func.call(this, rest);
        case 1: return func.call(this, arguments[0], rest);
        case 2: return func.call(this, arguments[0], arguments[1], rest);
      }
      var args = Array(startIndex + 1);
      for (index = 0; index < startIndex; index++) {
        args[index] = arguments[index];
      }
      args[startIndex] = rest;
      return func.apply(this, args);
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var shallowProperty = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  var has = function(obj, path) {
    return obj != null && hasOwnProperty.call(obj, path);
  };

  var deepGet = function(obj, path) {
    var length = path.length;
    for (var i = 0; i < length; i++) {
      if (obj == null) return void 0;
      obj = obj[path[i]];
    }
    return length ? obj : void 0;
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object.
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = shallowProperty('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  var createReduce = function(dir) {
    // Wrap code that reassigns argument variables in a separate function than
    // the one that accesses `arguments.length` to avoid a perf hit. (#1991)
    var reducer = function(obj, iteratee, memo, initial) {
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      if (!initial) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    };

    return function(obj, iteratee, memo, context) {
      var initial = arguments.length >= 3;
      return reducer(obj, optimizeCb(iteratee, context, 4), memo, initial);
    };
  };

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var keyFinder = isArrayLike(obj) ? _.findIndex : _.findKey;
    var key = keyFinder(obj, predicate, context);
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = restArguments(function(obj, path, args) {
    var contextPath, func;
    if (_.isFunction(path)) {
      func = path;
    } else if (_.isArray(path)) {
      contextPath = path.slice(0, -1);
      path = path[path.length - 1];
    }
    return _.map(obj, function(context) {
      var method = func;
      if (!method) {
        if (contextPath && contextPath.length) {
          context = deepGet(context, contextPath);
        }
        if (context == null) return void 0;
        method = context[path];
      }
      return method == null ? method : method.apply(context, args);
    });
  });

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null || typeof iteratee == 'number' && typeof obj[0] != 'object' && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value != null && value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(v, index, list) {
        computed = iteratee(v, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = v;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null || typeof iteratee == 'number' && typeof obj[0] != 'object' && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value != null && value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(v, index, list) {
        computed = iteratee(v, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = v;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection.
  _.shuffle = function(obj) {
    return _.sample(obj, Infinity);
  };

  // Sample **n** random values from a collection using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    var sample = isArrayLike(obj) ? _.clone(obj) : _.values(obj);
    var length = getLength(sample);
    n = Math.max(Math.min(n, length), 0);
    var last = length - 1;
    for (var index = 0; index < n; index++) {
      var rand = _.random(index, last);
      var temp = sample[index];
      sample[index] = sample[rand];
      sample[rand] = temp;
    }
    return sample.slice(0, n);
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    var index = 0;
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, key, list) {
      return {
        value: value,
        index: index++,
        criteria: iteratee(value, key, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior, partition) {
    return function(obj, iteratee, context) {
      var result = partition ? [[], []] : {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (has(result, key)) result[key]++; else result[key] = 1;
  });

  var reStrSymbol = /[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;
  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (_.isString(obj)) {
      // Keep surrogate pair characters together
      return obj.match(reStrSymbol);
    }
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = group(function(result, value, pass) {
    result[pass ? 0 : 1].push(value);
  }, true);

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null || array.length < 1) return n == null ? void 0 : [];
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null || array.length < 1) return n == null ? void 0 : [];
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, Boolean);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, output) {
    output = output || [];
    var idx = output.length;
    for (var i = 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        // Flatten current level of array or arguments object.
        if (shallow) {
          var j = 0, len = value.length;
          while (j < len) output[idx++] = value[j++];
        } else {
          flatten(value, shallow, strict, output);
          idx = output.length;
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = restArguments(function(array, otherArrays) {
    return _.difference(array, otherArrays);
  });

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // The faster algorithm will not work with an iteratee if the iteratee
  // is not a one-to-one function, so providing an iteratee will disable
  // the faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted && !iteratee) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = restArguments(function(arrays) {
    return _.uniq(flatten(arrays, true, true));
  });

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      var j;
      for (j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = restArguments(function(array, rest) {
    rest = flatten(rest, true, true);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  });

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices.
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = restArguments(_.unzip);

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values. Passing by pairs is the reverse of _.pairs.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions.
  var createPredicateIndexFinder = function(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  };

  // Returns the first index on an array-like that passes a predicate test.
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions.
  var createIndexFinder = function(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
          i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
          length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  };

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    if (!step) {
      step = stop < start ? -1 : 1;
    }

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Chunk a single array into multiple arrays, each containing `count` or fewer
  // items.
  _.chunk = function(array, count) {
    if (count == null || count < 1) return [];
    var result = [];
    var i = 0, length = array.length;
    while (i < length) {
      result.push(slice.call(array, i, i += count));
    }
    return result;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments.
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = restArguments(function(func, context, args) {
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var bound = restArguments(function(callArgs) {
      return executeBound(func, bound, context, this, args.concat(callArgs));
    });
    return bound;
  });

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder by default, allowing any combination of arguments to be
  // pre-filled. Set `_.partial.placeholder` for a custom placeholder argument.
  _.partial = restArguments(function(func, boundArgs) {
    var placeholder = _.partial.placeholder;
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === placeholder ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  });

  _.partial.placeholder = _;

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = restArguments(function(obj, keys) {
    keys = flatten(keys, false, false);
    var index = keys.length;
    if (index < 1) throw new Error('bindAll must be passed function names');
    while (index--) {
      var key = keys[index];
      obj[key] = _.bind(obj[key], obj);
    }
  });

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = restArguments(function(func, wait, args) {
    return setTimeout(function() {
      return func.apply(null, args);
    }, wait);
  });

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var timeout, context, args, result;
    var previous = 0;
    if (!options) options = {};

    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };

    var throttled = function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };

    throttled.cancel = function() {
      clearTimeout(timeout);
      previous = 0;
      timeout = context = args = null;
    };

    return throttled;
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, result;

    var later = function(context, args) {
      timeout = null;
      if (args) result = func.apply(context, args);
    };

    var debounced = restArguments(function(args) {
      if (timeout) clearTimeout(timeout);
      if (immediate) {
        var callNow = !timeout;
        timeout = setTimeout(later, wait);
        if (callNow) result = func.apply(this, args);
      } else {
        timeout = _.delay(later, wait, this, args);
      }

      return result;
    });

    debounced.cancel = function() {
      clearTimeout(timeout);
      timeout = null;
    };

    return debounced;
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  _.restArguments = restArguments;

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
    'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  var collectNonEnumProps = function(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = _.isFunction(constructor) && constructor.prototype || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  };

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`.
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object.
  // In contrast to _.map it returns an object.
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = _.keys(obj),
        length = keys.length,
        results = {};
    for (var index = 0; index < length; index++) {
      var currentKey = keys[index];
      results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  // The opposite of _.object.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`.
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, defaults) {
    return function(obj) {
      var length = arguments.length;
      if (defaults) obj = Object(obj);
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!defaults || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s).
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test.
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Internal pick helper function to determine if `obj` has key `key`.
  var keyInObj = function(value, key, obj) {
    return key in obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = restArguments(function(obj, keys) {
    var result = {}, iteratee = keys[0];
    if (obj == null) return result;
    if (_.isFunction(iteratee)) {
      if (keys.length > 1) iteratee = optimizeCb(iteratee, keys[1]);
      keys = _.allKeys(obj);
    } else {
      iteratee = keyInObj;
      keys = flatten(keys, false, false);
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  });

  // Return a copy of the object without the blacklisted properties.
  _.omit = restArguments(function(obj, keys) {
    var iteratee = keys[0], context;
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
      if (keys.length > 1) context = keys[1];
    } else {
      keys = _.map(flatten(keys, false, false), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  });

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq, deepEq;
  eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // `null` or `undefined` only equal to itself (strict comparison).
    if (a == null || b == null) return false;
    // `NaN`s are equivalent, but non-reflexive.
    if (a !== a) return b !== b;
    // Exhaust primitive checks
    var type = typeof a;
    if (type !== 'function' && type !== 'object' && typeof b != 'object') return false;
    return deepEq(a, b, aStack, bStack);
  };

  // Internal recursive comparison function for `isEqual`.
  deepEq = function(a, b, aStack, bStack) {
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN.
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
      case '[object Symbol]':
        return SymbolProto.valueOf.call(a) === SymbolProto.valueOf.call(b);
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError, isMap, isWeakMap, isSet, isWeakSet.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error', 'Symbol', 'Map', 'WeakMap', 'Set', 'WeakSet'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), Safari 8 (#1929), and PhantomJS (#2236).
  var nodelist = root.document && root.document.childNodes;
  if (typeof Int8Array != 'object' && typeof nodelist != 'function') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return !_.isSymbol(obj) && isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`?
  _.isNaN = function(obj) {
    return _.isNumber(obj) && isNaN(obj);
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, path) {
    if (!_.isArray(path)) {
      return has(obj, path);
    }
    var length = path.length;
    for (var i = 0; i < length; i++) {
      var key = path[i];
      if (obj == null || !hasOwnProperty.call(obj, key)) {
        return false;
      }
      obj = obj[key];
    }
    return !!length;
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  // Creates a function that, when passed an object, will traverse that object’s
  // properties down the given `path`, specified as an array of keys or indexes.
  _.property = function(path) {
    if (!_.isArray(path)) {
      return shallowProperty(path);
    }
    return function(obj) {
      return deepGet(obj, path);
    };
  };

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    if (obj == null) {
      return function(){};
    }
    return function(path) {
      return !_.isArray(path) ? obj[path] : deepGet(obj, path);
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

  // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped.
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // Traverses the children of `obj` along `path`. If a child is a function, it
  // is invoked with its parent as context. Returns the value of the final
  // child, or `fallback` if any child is undefined.
  _.result = function(obj, path, fallback) {
    if (!_.isArray(path)) path = [path];
    var length = path.length;
    if (!length) {
      return _.isFunction(fallback) ? fallback.call(obj) : fallback;
    }
    for (var i = 0; i < length; i++) {
      var prop = obj == null ? void 0 : obj[path[i]];
      if (prop === void 0) {
        prop = fallback;
        i = length; // Ensure we don't continue iterating.
      }
      obj = _.isFunction(prop) ? prop.call(obj) : prop;
    }
    return obj;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate: /<%([\s\S]+?)%>/g,
    interpolate: /<%=([\s\S]+?)%>/g,
    escape: /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'": "'",
    '\\': '\\',
    '\r': 'r',
    '\n': 'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escapeRegExp = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escapeRegExp, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offset.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    var render;
    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var chainResult = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return chainResult(this, func.apply(_, args));
      };
    });
    return _;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return chainResult(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return chainResult(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return String(this._wrapped);
  };
}());
});
var underscore_1 = underscore._;

ohif_core.OHIF.cornerstone = {};

ohif_core.OHIF.cornerstone.getBoundingBox = (context, textLines, x, y, options) => {
  if (Object.prototype.toString.call(textLines) !== '[object Array]') {
    textLines = [textLines];
  }

  const padding = 5;
  const font = cornerstoneTools.textStyle.getFont();
  const fontSize = cornerstoneTools.textStyle.getFontSize();
  context.save();
  context.font = font;
  context.textBaseline = 'top'; // Find the longest text width in the array of text data

  let maxWidth = 0;
  textLines.forEach(text => {
    // Get the text width in the current font
    const width = context.measureText(text).width; // Find the maximum with for all the text rows;

    maxWidth = Math.max(maxWidth, width);
  }); // Calculate the bounding box for this text box

  const boundingBox = {
    width: maxWidth + padding * 2,
    height: padding + textLines.length * (fontSize + padding)
  };

  if (options && options.centering && options.centering.x === true) {
    x -= boundingBox.width / 2;
  }

  if (options && options.centering && options.centering.y === true) {
    y -= boundingBox.height / 2;
  }

  boundingBox.left = x;
  boundingBox.top = y;
  context.restore(); // Return the bounding box so it can be used for pointNearHandle

  return boundingBox;
};

ohif_core.OHIF.cornerstone.pixelToPage = (element, position) => {
  const enabledElement = cornerstone.getEnabledElement(element);
  const result = {
    x: 0,
    y: 0
  }; // Stop here if the cornerstone element is not enabled or position is not an object

  if (!enabledElement || typeof position !== 'object') {
    return result;
  }

  const canvas = enabledElement.canvas;
  const canvasOffset = $(canvas).offset();
  result.x += canvasOffset.left;
  result.y += canvasOffset.top;
  const canvasPosition = cornerstone.pixelToCanvas(element, position);
  result.x += canvasPosition.x;
  result.y += canvasPosition.y;
  return result;
};

ohif_core.OHIF.cornerstone.repositionTextBox = (eventData, measurementData, config) => {
  // Stop here if it's not a measurement creating
  if (!measurementData.isCreating) {
    return;
  }

  const element = eventData.element;
  const enabledElement = cornerstone.getEnabledElement(element);
  const image = enabledElement.image;
  const allowedBorders = ohif_core.OHIF.uiSettings.autoPositionMeasurementsTextCallOuts;
  const allow = {
    T: !allowedBorders || underscore.contains(allowedBorders, 'T'),
    R: !allowedBorders || underscore.contains(allowedBorders, 'R'),
    B: !allowedBorders || underscore.contains(allowedBorders, 'B'),
    L: !allowedBorders || underscore.contains(allowedBorders, 'L')
  };

  const getAvailableBlankAreas = (enabledElement, labelWidth, labelHeight) => {
    const {
      element,
      canvas,
      image
    } = enabledElement;
    const topLeft = cornerstone.pixelToCanvas(element, {
      x: 0,
      y: 0
    });
    const bottomRight = cornerstone.pixelToCanvas(element, {
      x: image.width,
      y: image.height
    });
    const $canvas = $(canvas);
    const canvasWidth = $canvas.outerWidth();
    const canvasHeight = $canvas.outerHeight();
    const result = {};
    result['x-1'] = allow.L && topLeft.x > labelWidth;
    result['y-1'] = allow.T && topLeft.y > labelHeight;
    result.x1 = allow.R && canvasWidth - bottomRight.x > labelWidth;
    result.y1 = allow.B && canvasHeight - bottomRight.y > labelHeight;
    return result;
  };

  const getRenderingInformation = (limits, tool) => {
    const mid = {};
    mid.x = limits.x / 2;
    mid.y = limits.y / 2;
    const directions = {};
    directions.x = tool.x < mid.x ? -1 : 1;
    directions.y = tool.y < mid.y ? -1 : 1;
    const diffX = directions.x < 0 ? tool.x : limits.x - tool.x;
    const diffY = directions.y < 0 ? tool.y : limits.y - tool.y;
    let cornerAxis = diffY < diffX ? 'y' : 'x';
    const map = {
      'x-1': 'L',
      'y-1': 'T',
      x1: 'R',
      y1: 'B'
    };
    let current = 0;

    while (current < 4 && !allow[map[cornerAxis + directions[cornerAxis]]]) {
      // Invert the direction for the next iteration
      directions[cornerAxis] *= -1; // Invert the tempCornerAxis

      cornerAxis = cornerAxis === 'x' ? 'y' : 'x';
      current++;
    }

    return {
      directions,
      cornerAxis
    };
  };

  const calculateAxisCenter = (axis, start, end) => {
    const a = start[axis];
    const b = end[axis];
    const lowest = Math.min(a, b);
    const highest = Math.max(a, b);
    return lowest + (highest - lowest) / 2;
  };

  const getTextBoxSizeInPixels = (element, bounds) => {
    const topLeft = cornerstone.pageToPixel(element, 0, 0);
    const bottomRight = cornerstone.pageToPixel(element, bounds.x, bounds.y);
    return {
      x: bottomRight.x - topLeft.x,
      y: bottomRight.y - topLeft.y
    };
  };

  function getTextBoxOffset(config, cornerAxis, toolAxis, boxSize) {
    config = config || {};
    const centering = config.centering || {};
    const centerX = !!centering.x;
    const centerY = !!centering.y;
    const halfBoxSizeX = boxSize.x / 2;
    const halfBoxSizeY = boxSize.y / 2;
    const offset = {
      x: [],
      y: []
    };

    if (cornerAxis === 'x') {
      const offsetY = centerY ? 0 : halfBoxSizeY;
      offset.x[-1] = centerX ? halfBoxSizeX : 0;
      offset.x[1] = centerX ? -halfBoxSizeX : -boxSize.x;
      offset.y[-1] = offsetY;
      offset.y[1] = offsetY;
    } else {
      const offsetX = centerX ? 0 : halfBoxSizeX;
      offset.x[-1] = offsetX;
      offset.x[1] = offsetX;
      offset.y[-1] = centerY ? halfBoxSizeY : 0;
      offset.y[1] = centerY ? -halfBoxSizeY : -boxSize.y;
    }

    return offset;
  }

  const handles = measurementData.handles;
  const textBox = handles.textBox;
  const $canvas = $(enabledElement.canvas);
  const canvasWidth = $canvas.outerWidth();
  const canvasHeight = $canvas.outerHeight();
  const offset = $canvas.offset();
  const canvasDimensions = {
    x: canvasWidth,
    y: canvasHeight
  };
  const bounds = {};
  bounds.x = textBox.boundingBox.width;
  bounds.y = textBox.boundingBox.height;

  const getHandlePosition = key => underscore.pick(handles[key], ['x', 'y']);

  const start = getHandlePosition('start');
  const end = getHandlePosition('end');
  const tool = {};
  tool.x = calculateAxisCenter('x', start, end);
  tool.y = calculateAxisCenter('y', start, end);
  let limits = {};
  limits.x = image.width;
  limits.y = image.height;
  let {
    directions,
    cornerAxis
  } = getRenderingInformation(limits, tool);
  const availableAreas = getAvailableBlankAreas(enabledElement, bounds.x, bounds.y);

  const tempDirections = underscore.clone(directions);

  let tempCornerAxis = cornerAxis;
  let foundPlace = false;
  let current = 0;

  while (current < 4) {
    if (availableAreas[tempCornerAxis + tempDirections[tempCornerAxis]]) {
      foundPlace = true;
      break;
    } // Invert the direction for the next iteration


    tempDirections[tempCornerAxis] *= -1; // Invert the tempCornerAxis

    tempCornerAxis = tempCornerAxis === 'x' ? 'y' : 'x';
    current++;
  }

  let cornerAxisPosition;

  if (foundPlace) {
    underscore.extend(directions, tempDirections);

    cornerAxis = tempCornerAxis;
    cornerAxisPosition = directions[cornerAxis] < 0 ? 0 : limits[cornerAxis];
  } else {
    underscore.extend(limits, canvasDimensions);

    const toolPositionOnCanvas = cornerstone.pixelToCanvas(element, tool);
    const renderingInformation = getRenderingInformation(limits, toolPositionOnCanvas);
    directions = renderingInformation.directions;
    cornerAxis = renderingInformation.cornerAxis;
    const position = {
      x: directions.x < 0 ? offset.left : offset.left + canvasWidth,
      y: directions.y < 0 ? offset.top : offset.top + canvasHeight
    };
    const pixelPosition = cornerstone.pageToPixel(element, position.x, position.y);
    cornerAxisPosition = pixelPosition[cornerAxis];
  }

  const toolAxis = cornerAxis === 'x' ? 'y' : 'x';
  const boxSize = getTextBoxSizeInPixels(element, bounds);
  textBox[cornerAxis] = cornerAxisPosition;
  textBox[toolAxis] = tool[toolAxis]; // Adjust the text box position reducing its size from the corner axis

  const textBoxOffset = getTextBoxOffset(config, cornerAxis, toolAxis, boxSize);
  textBox[cornerAxis] += textBoxOffset[cornerAxis][directions[cornerAxis]]; // Preventing the text box from partially going outside the canvas area

  const topLeft = cornerstone.pixelToCanvas(element, textBox);
  const bottomRight = {
    x: topLeft.x + bounds.x,
    y: topLeft.y + bounds.y
  };
  const canvasBorders = {
    x0: offset.left,
    y0: offset.top,
    x1: offset.left + canvasWidth,
    y1: offset.top + canvasHeight
  };

  if (topLeft[toolAxis] < 0) {
    const x = canvasBorders.x0;
    const y = canvasBorders.y0;
    const pixelPosition = cornerstone.pageToPixel(element, x, y);
    textBox[toolAxis] = pixelPosition[toolAxis];
  } else if (bottomRight[toolAxis] > canvasDimensions[toolAxis]) {
    const x = canvasBorders.x1 - bounds.x;
    const y = canvasBorders.y1 - bounds.y;
    const pixelPosition = cornerstone.pageToPixel(element, x, y);
    textBox[toolAxis] = pixelPosition[toolAxis];
  }
};

var jquery = createCommonjsModule(function (module) {
/*!
 * jQuery JavaScript Library v3.3.1
 * https://jquery.com/
 *
 * Includes Sizzle.js
 * https://sizzlejs.com/
 *
 * Copyright JS Foundation and other contributors
 * Released under the MIT license
 * https://jquery.org/license
 *
 * Date: 2018-01-20T17:24Z
 */
( function( global, factory ) {

	{

		// For CommonJS and CommonJS-like environments where a proper `window`
		// is present, execute the factory and get jQuery.
		// For environments that do not have a `window` with a `document`
		// (such as Node.js), expose a factory as module.exports.
		// This accentuates the need for the creation of a real `window`.
		// e.g. var jQuery = require("jquery")(window);
		// See ticket #14549 for more info.
		module.exports = global.document ?
			factory( global, true ) :
			function( w ) {
				if ( !w.document ) {
					throw new Error( "jQuery requires a window with a document" );
				}
				return factory( w );
			};
	}

// Pass this if window is not defined yet
} )( typeof window !== "undefined" ? window : commonjsGlobal, function( window, noGlobal ) {

var arr = [];

var document = window.document;

var getProto = Object.getPrototypeOf;

var slice = arr.slice;

var concat = arr.concat;

var push = arr.push;

var indexOf = arr.indexOf;

var class2type = {};

var toString = class2type.toString;

var hasOwn = class2type.hasOwnProperty;

var fnToString = hasOwn.toString;

var ObjectFunctionString = fnToString.call( Object );

var support = {};

var isFunction = function isFunction( obj ) {

      // Support: Chrome <=57, Firefox <=52
      // In some browsers, typeof returns "function" for HTML <object> elements
      // (i.e., `typeof document.createElement( "object" ) === "function"`).
      // We don't want to classify *any* DOM node as a function.
      return typeof obj === "function" && typeof obj.nodeType !== "number";
  };


var isWindow = function isWindow( obj ) {
		return obj != null && obj === obj.window;
	};




	var preservedScriptAttributes = {
		type: true,
		src: true,
		noModule: true
	};

	function DOMEval( code, doc, node ) {
		doc = doc || document;

		var i,
			script = doc.createElement( "script" );

		script.text = code;
		if ( node ) {
			for ( i in preservedScriptAttributes ) {
				if ( node[ i ] ) {
					script[ i ] = node[ i ];
				}
			}
		}
		doc.head.appendChild( script ).parentNode.removeChild( script );
	}


function toType( obj ) {
	if ( obj == null ) {
		return obj + "";
	}

	// Support: Android <=2.3 only (functionish RegExp)
	return typeof obj === "object" || typeof obj === "function" ?
		class2type[ toString.call( obj ) ] || "object" :
		typeof obj;
}
/* global Symbol */
// Defining this global in .eslintrc.json would create a danger of using the global
// unguarded in another place, it seems safer to define global only for this module



var
	version = "3.3.1",

	// Define a local copy of jQuery
	jQuery = function( selector, context ) {

		// The jQuery object is actually just the init constructor 'enhanced'
		// Need init if jQuery is called (just allow error to be thrown if not included)
		return new jQuery.fn.init( selector, context );
	},

	// Support: Android <=4.0 only
	// Make sure we trim BOM and NBSP
	rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;

jQuery.fn = jQuery.prototype = {

	// The current version of jQuery being used
	jquery: version,

	constructor: jQuery,

	// The default length of a jQuery object is 0
	length: 0,

	toArray: function() {
		return slice.call( this );
	},

	// Get the Nth element in the matched element set OR
	// Get the whole matched element set as a clean array
	get: function( num ) {

		// Return all the elements in a clean array
		if ( num == null ) {
			return slice.call( this );
		}

		// Return just the one element from the set
		return num < 0 ? this[ num + this.length ] : this[ num ];
	},

	// Take an array of elements and push it onto the stack
	// (returning the new matched element set)
	pushStack: function( elems ) {

		// Build a new jQuery matched element set
		var ret = jQuery.merge( this.constructor(), elems );

		// Add the old object onto the stack (as a reference)
		ret.prevObject = this;

		// Return the newly-formed element set
		return ret;
	},

	// Execute a callback for every element in the matched set.
	each: function( callback ) {
		return jQuery.each( this, callback );
	},

	map: function( callback ) {
		return this.pushStack( jQuery.map( this, function( elem, i ) {
			return callback.call( elem, i, elem );
		} ) );
	},

	slice: function() {
		return this.pushStack( slice.apply( this, arguments ) );
	},

	first: function() {
		return this.eq( 0 );
	},

	last: function() {
		return this.eq( -1 );
	},

	eq: function( i ) {
		var len = this.length,
			j = +i + ( i < 0 ? len : 0 );
		return this.pushStack( j >= 0 && j < len ? [ this[ j ] ] : [] );
	},

	end: function() {
		return this.prevObject || this.constructor();
	},

	// For internal use only.
	// Behaves like an Array's method, not like a jQuery method.
	push: push,
	sort: arr.sort,
	splice: arr.splice
};

jQuery.extend = jQuery.fn.extend = function() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[ 0 ] || {},
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;

		// Skip the boolean and the target
		target = arguments[ i ] || {};
		i++;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !isFunction( target ) ) {
		target = {};
	}

	// Extend jQuery itself if only one argument is passed
	if ( i === length ) {
		target = this;
		i--;
	}

	for ( ; i < length; i++ ) {

		// Only deal with non-null/undefined values
		if ( ( options = arguments[ i ] ) != null ) {

			// Extend the base object
			for ( name in options ) {
				src = target[ name ];
				copy = options[ name ];

				// Prevent never-ending loop
				if ( target === copy ) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if ( deep && copy && ( jQuery.isPlainObject( copy ) ||
					( copyIsArray = Array.isArray( copy ) ) ) ) {

					if ( copyIsArray ) {
						copyIsArray = false;
						clone = src && Array.isArray( src ) ? src : [];

					} else {
						clone = src && jQuery.isPlainObject( src ) ? src : {};
					}

					// Never move original objects, clone them
					target[ name ] = jQuery.extend( deep, clone, copy );

				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};

jQuery.extend( {

	// Unique for each copy of jQuery on the page
	expando: "jQuery" + ( version + Math.random() ).replace( /\D/g, "" ),

	// Assume jQuery is ready without the ready module
	isReady: true,

	error: function( msg ) {
		throw new Error( msg );
	},

	noop: function() {},

	isPlainObject: function( obj ) {
		var proto, Ctor;

		// Detect obvious negatives
		// Use toString instead of jQuery.type to catch host objects
		if ( !obj || toString.call( obj ) !== "[object Object]" ) {
			return false;
		}

		proto = getProto( obj );

		// Objects with no prototype (e.g., `Object.create( null )`) are plain
		if ( !proto ) {
			return true;
		}

		// Objects with prototype are plain iff they were constructed by a global Object function
		Ctor = hasOwn.call( proto, "constructor" ) && proto.constructor;
		return typeof Ctor === "function" && fnToString.call( Ctor ) === ObjectFunctionString;
	},

	isEmptyObject: function( obj ) {

		/* eslint-disable no-unused-vars */
		// See https://github.com/eslint/eslint/issues/6125
		var name;

		for ( name in obj ) {
			return false;
		}
		return true;
	},

	// Evaluates a script in a global context
	globalEval: function( code ) {
		DOMEval( code );
	},

	each: function( obj, callback ) {
		var length, i = 0;

		if ( isArrayLike( obj ) ) {
			length = obj.length;
			for ( ; i < length; i++ ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		} else {
			for ( i in obj ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		}

		return obj;
	},

	// Support: Android <=4.0 only
	trim: function( text ) {
		return text == null ?
			"" :
			( text + "" ).replace( rtrim, "" );
	},

	// results is for internal usage only
	makeArray: function( arr, results ) {
		var ret = results || [];

		if ( arr != null ) {
			if ( isArrayLike( Object( arr ) ) ) {
				jQuery.merge( ret,
					typeof arr === "string" ?
					[ arr ] : arr
				);
			} else {
				push.call( ret, arr );
			}
		}

		return ret;
	},

	inArray: function( elem, arr, i ) {
		return arr == null ? -1 : indexOf.call( arr, elem, i );
	},

	// Support: Android <=4.0 only, PhantomJS 1 only
	// push.apply(_, arraylike) throws on ancient WebKit
	merge: function( first, second ) {
		var len = +second.length,
			j = 0,
			i = first.length;

		for ( ; j < len; j++ ) {
			first[ i++ ] = second[ j ];
		}

		first.length = i;

		return first;
	},

	grep: function( elems, callback, invert ) {
		var callbackInverse,
			matches = [],
			i = 0,
			length = elems.length,
			callbackExpect = !invert;

		// Go through the array, only saving the items
		// that pass the validator function
		for ( ; i < length; i++ ) {
			callbackInverse = !callback( elems[ i ], i );
			if ( callbackInverse !== callbackExpect ) {
				matches.push( elems[ i ] );
			}
		}

		return matches;
	},

	// arg is for internal usage only
	map: function( elems, callback, arg ) {
		var length, value,
			i = 0,
			ret = [];

		// Go through the array, translating each of the items to their new values
		if ( isArrayLike( elems ) ) {
			length = elems.length;
			for ( ; i < length; i++ ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}

		// Go through every key on the object,
		} else {
			for ( i in elems ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}
		}

		// Flatten any nested arrays
		return concat.apply( [], ret );
	},

	// A global GUID counter for objects
	guid: 1,

	// jQuery.support is not used in Core but other projects attach their
	// properties to it so it needs to exist.
	support: support
} );

if ( typeof Symbol === "function" ) {
	jQuery.fn[ Symbol.iterator ] = arr[ Symbol.iterator ];
}

// Populate the class2type map
jQuery.each( "Boolean Number String Function Array Date RegExp Object Error Symbol".split( " " ),
function( i, name ) {
	class2type[ "[object " + name + "]" ] = name.toLowerCase();
} );

function isArrayLike( obj ) {

	// Support: real iOS 8.2 only (not reproducible in simulator)
	// `in` check used to prevent JIT error (gh-2145)
	// hasOwn isn't used here due to false negatives
	// regarding Nodelist length in IE
	var length = !!obj && "length" in obj && obj.length,
		type = toType( obj );

	if ( isFunction( obj ) || isWindow( obj ) ) {
		return false;
	}

	return type === "array" || length === 0 ||
		typeof length === "number" && length > 0 && ( length - 1 ) in obj;
}
var Sizzle =
/*!
 * Sizzle CSS Selector Engine v2.3.3
 * https://sizzlejs.com/
 *
 * Copyright jQuery Foundation and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 *
 * Date: 2016-08-08
 */
(function( window ) {

var i,
	support,
	Expr,
	getText,
	isXML,
	tokenize,
	compile,
	select,
	outermostContext,
	sortInput,
	hasDuplicate,

	// Local document vars
	setDocument,
	document,
	docElem,
	documentIsHTML,
	rbuggyQSA,
	rbuggyMatches,
	matches,
	contains,

	// Instance-specific data
	expando = "sizzle" + 1 * new Date(),
	preferredDoc = window.document,
	dirruns = 0,
	done = 0,
	classCache = createCache(),
	tokenCache = createCache(),
	compilerCache = createCache(),
	sortOrder = function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
		}
		return 0;
	},

	// Instance methods
	hasOwn = ({}).hasOwnProperty,
	arr = [],
	pop = arr.pop,
	push_native = arr.push,
	push = arr.push,
	slice = arr.slice,
	// Use a stripped-down indexOf as it's faster than native
	// https://jsperf.com/thor-indexof-vs-for/5
	indexOf = function( list, elem ) {
		var i = 0,
			len = list.length;
		for ( ; i < len; i++ ) {
			if ( list[i] === elem ) {
				return i;
			}
		}
		return -1;
	},

	booleans = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",

	// Regular expressions

	// http://www.w3.org/TR/css3-selectors/#whitespace
	whitespace = "[\\x20\\t\\r\\n\\f]",

	// http://www.w3.org/TR/CSS21/syndata.html#value-def-identifier
	identifier = "(?:\\\\.|[\\w-]|[^\0-\\xa0])+",

	// Attribute selectors: http://www.w3.org/TR/selectors/#attribute-selectors
	attributes = "\\[" + whitespace + "*(" + identifier + ")(?:" + whitespace +
		// Operator (capture 2)
		"*([*^$|!~]?=)" + whitespace +
		// "Attribute values must be CSS identifiers [capture 5] or strings [capture 3 or capture 4]"
		"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + identifier + "))|)" + whitespace +
		"*\\]",

	pseudos = ":(" + identifier + ")(?:\\((" +
		// To reduce the number of selectors needing tokenize in the preFilter, prefer arguments:
		// 1. quoted (capture 3; capture 4 or capture 5)
		"('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|" +
		// 2. simple (capture 6)
		"((?:\\\\.|[^\\\\()[\\]]|" + attributes + ")*)|" +
		// 3. anything else (capture 2)
		".*" +
		")\\)|)",

	// Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
	rwhitespace = new RegExp( whitespace + "+", "g" ),
	rtrim = new RegExp( "^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g" ),

	rcomma = new RegExp( "^" + whitespace + "*," + whitespace + "*" ),
	rcombinators = new RegExp( "^" + whitespace + "*([>+~]|" + whitespace + ")" + whitespace + "*" ),

	rattributeQuotes = new RegExp( "=" + whitespace + "*([^\\]'\"]*?)" + whitespace + "*\\]", "g" ),

	rpseudo = new RegExp( pseudos ),
	ridentifier = new RegExp( "^" + identifier + "$" ),

	matchExpr = {
		"ID": new RegExp( "^#(" + identifier + ")" ),
		"CLASS": new RegExp( "^\\.(" + identifier + ")" ),
		"TAG": new RegExp( "^(" + identifier + "|[*])" ),
		"ATTR": new RegExp( "^" + attributes ),
		"PSEUDO": new RegExp( "^" + pseudos ),
		"CHILD": new RegExp( "^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" + whitespace +
			"*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" + whitespace +
			"*(\\d+)|))" + whitespace + "*\\)|)", "i" ),
		"bool": new RegExp( "^(?:" + booleans + ")$", "i" ),
		// For use in libraries implementing .is()
		// We use this for POS matching in `select`
		"needsContext": new RegExp( "^" + whitespace + "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" +
			whitespace + "*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)", "i" )
	},

	rinputs = /^(?:input|select|textarea|button)$/i,
	rheader = /^h\d$/i,

	rnative = /^[^{]+\{\s*\[native \w/,

	// Easily-parseable/retrievable ID or TAG or CLASS selectors
	rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,

	rsibling = /[+~]/,

	// CSS escapes
	// http://www.w3.org/TR/CSS21/syndata.html#escaped-characters
	runescape = new RegExp( "\\\\([\\da-f]{1,6}" + whitespace + "?|(" + whitespace + ")|.)", "ig" ),
	funescape = function( _, escaped, escapedWhitespace ) {
		var high = "0x" + escaped - 0x10000;
		// NaN means non-codepoint
		// Support: Firefox<24
		// Workaround erroneous numeric interpretation of +"0x"
		return high !== high || escapedWhitespace ?
			escaped :
			high < 0 ?
				// BMP codepoint
				String.fromCharCode( high + 0x10000 ) :
				// Supplemental Plane codepoint (surrogate pair)
				String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
	},

	// CSS string/identifier serialization
	// https://drafts.csswg.org/cssom/#common-serializing-idioms
	rcssescape = /([\0-\x1f\x7f]|^-?\d)|^-$|[^\0-\x1f\x7f-\uFFFF\w-]/g,
	fcssescape = function( ch, asCodePoint ) {
		if ( asCodePoint ) {

			// U+0000 NULL becomes U+FFFD REPLACEMENT CHARACTER
			if ( ch === "\0" ) {
				return "\uFFFD";
			}

			// Control characters and (dependent upon position) numbers get escaped as code points
			return ch.slice( 0, -1 ) + "\\" + ch.charCodeAt( ch.length - 1 ).toString( 16 ) + " ";
		}

		// Other potentially-special ASCII characters get backslash-escaped
		return "\\" + ch;
	},

	// Used for iframes
	// See setDocument()
	// Removing the function wrapper causes a "Permission Denied"
	// error in IE
	unloadHandler = function() {
		setDocument();
	},

	disabledAncestor = addCombinator(
		function( elem ) {
			return elem.disabled === true && ("form" in elem || "label" in elem);
		},
		{ dir: "parentNode", next: "legend" }
	);

// Optimize for push.apply( _, NodeList )
try {
	push.apply(
		(arr = slice.call( preferredDoc.childNodes )),
		preferredDoc.childNodes
	);
	// Support: Android<4.0
	// Detect silently failing push.apply
	arr[ preferredDoc.childNodes.length ].nodeType;
} catch ( e ) {
	push = { apply: arr.length ?

		// Leverage slice if possible
		function( target, els ) {
			push_native.apply( target, slice.call(els) );
		} :

		// Support: IE<9
		// Otherwise append directly
		function( target, els ) {
			var j = target.length,
				i = 0;
			// Can't trust NodeList.length
			while ( (target[j++] = els[i++]) ) {}
			target.length = j - 1;
		}
	};
}

function Sizzle( selector, context, results, seed ) {
	var m, i, elem, nid, match, groups, newSelector,
		newContext = context && context.ownerDocument,

		// nodeType defaults to 9, since context defaults to document
		nodeType = context ? context.nodeType : 9;

	results = results || [];

	// Return early from calls with invalid selector or context
	if ( typeof selector !== "string" || !selector ||
		nodeType !== 1 && nodeType !== 9 && nodeType !== 11 ) {

		return results;
	}

	// Try to shortcut find operations (as opposed to filters) in HTML documents
	if ( !seed ) {

		if ( ( context ? context.ownerDocument || context : preferredDoc ) !== document ) {
			setDocument( context );
		}
		context = context || document;

		if ( documentIsHTML ) {

			// If the selector is sufficiently simple, try using a "get*By*" DOM method
			// (excepting DocumentFragment context, where the methods don't exist)
			if ( nodeType !== 11 && (match = rquickExpr.exec( selector )) ) {

				// ID selector
				if ( (m = match[1]) ) {

					// Document context
					if ( nodeType === 9 ) {
						if ( (elem = context.getElementById( m )) ) {

							// Support: IE, Opera, Webkit
							// TODO: identify versions
							// getElementById can match elements by name instead of ID
							if ( elem.id === m ) {
								results.push( elem );
								return results;
							}
						} else {
							return results;
						}

					// Element context
					} else {

						// Support: IE, Opera, Webkit
						// TODO: identify versions
						// getElementById can match elements by name instead of ID
						if ( newContext && (elem = newContext.getElementById( m )) &&
							contains( context, elem ) &&
							elem.id === m ) {

							results.push( elem );
							return results;
						}
					}

				// Type selector
				} else if ( match[2] ) {
					push.apply( results, context.getElementsByTagName( selector ) );
					return results;

				// Class selector
				} else if ( (m = match[3]) && support.getElementsByClassName &&
					context.getElementsByClassName ) {

					push.apply( results, context.getElementsByClassName( m ) );
					return results;
				}
			}

			// Take advantage of querySelectorAll
			if ( support.qsa &&
				!compilerCache[ selector + " " ] &&
				(!rbuggyQSA || !rbuggyQSA.test( selector )) ) {

				if ( nodeType !== 1 ) {
					newContext = context;
					newSelector = selector;

				// qSA looks outside Element context, which is not what we want
				// Thanks to Andrew Dupont for this workaround technique
				// Support: IE <=8
				// Exclude object elements
				} else if ( context.nodeName.toLowerCase() !== "object" ) {

					// Capture the context ID, setting it first if necessary
					if ( (nid = context.getAttribute( "id" )) ) {
						nid = nid.replace( rcssescape, fcssescape );
					} else {
						context.setAttribute( "id", (nid = expando) );
					}

					// Prefix every selector in the list
					groups = tokenize( selector );
					i = groups.length;
					while ( i-- ) {
						groups[i] = "#" + nid + " " + toSelector( groups[i] );
					}
					newSelector = groups.join( "," );

					// Expand context for sibling selectors
					newContext = rsibling.test( selector ) && testContext( context.parentNode ) ||
						context;
				}

				if ( newSelector ) {
					try {
						push.apply( results,
							newContext.querySelectorAll( newSelector )
						);
						return results;
					} catch ( qsaError ) {
					} finally {
						if ( nid === expando ) {
							context.removeAttribute( "id" );
						}
					}
				}
			}
		}
	}

	// All others
	return select( selector.replace( rtrim, "$1" ), context, results, seed );
}

/**
 * Create key-value caches of limited size
 * @returns {function(string, object)} Returns the Object data after storing it on itself with
 *	property name the (space-suffixed) string and (if the cache is larger than Expr.cacheLength)
 *	deleting the oldest entry
 */
function createCache() {
	var keys = [];

	function cache( key, value ) {
		// Use (key + " ") to avoid collision with native prototype properties (see Issue #157)
		if ( keys.push( key + " " ) > Expr.cacheLength ) {
			// Only keep the most recent entries
			delete cache[ keys.shift() ];
		}
		return (cache[ key + " " ] = value);
	}
	return cache;
}

/**
 * Mark a function for special use by Sizzle
 * @param {Function} fn The function to mark
 */
function markFunction( fn ) {
	fn[ expando ] = true;
	return fn;
}

/**
 * Support testing using an element
 * @param {Function} fn Passed the created element and returns a boolean result
 */
function assert( fn ) {
	var el = document.createElement("fieldset");

	try {
		return !!fn( el );
	} catch (e) {
		return false;
	} finally {
		// Remove from its parent by default
		if ( el.parentNode ) {
			el.parentNode.removeChild( el );
		}
		// release memory in IE
		el = null;
	}
}

/**
 * Adds the same handler for all of the specified attrs
 * @param {String} attrs Pipe-separated list of attributes
 * @param {Function} handler The method that will be applied
 */
function addHandle( attrs, handler ) {
	var arr = attrs.split("|"),
		i = arr.length;

	while ( i-- ) {
		Expr.attrHandle[ arr[i] ] = handler;
	}
}

/**
 * Checks document order of two siblings
 * @param {Element} a
 * @param {Element} b
 * @returns {Number} Returns less than 0 if a precedes b, greater than 0 if a follows b
 */
function siblingCheck( a, b ) {
	var cur = b && a,
		diff = cur && a.nodeType === 1 && b.nodeType === 1 &&
			a.sourceIndex - b.sourceIndex;

	// Use IE sourceIndex if available on both nodes
	if ( diff ) {
		return diff;
	}

	// Check if b follows a
	if ( cur ) {
		while ( (cur = cur.nextSibling) ) {
			if ( cur === b ) {
				return -1;
			}
		}
	}

	return a ? 1 : -1;
}

/**
 * Returns a function to use in pseudos for input types
 * @param {String} type
 */
function createInputPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return name === "input" && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for buttons
 * @param {String} type
 */
function createButtonPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return (name === "input" || name === "button") && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for :enabled/:disabled
 * @param {Boolean} disabled true for :disabled; false for :enabled
 */
function createDisabledPseudo( disabled ) {

	// Known :disabled false positives: fieldset[disabled] > legend:nth-of-type(n+2) :can-disable
	return function( elem ) {

		// Only certain elements can match :enabled or :disabled
		// https://html.spec.whatwg.org/multipage/scripting.html#selector-enabled
		// https://html.spec.whatwg.org/multipage/scripting.html#selector-disabled
		if ( "form" in elem ) {

			// Check for inherited disabledness on relevant non-disabled elements:
			// * listed form-associated elements in a disabled fieldset
			//   https://html.spec.whatwg.org/multipage/forms.html#category-listed
			//   https://html.spec.whatwg.org/multipage/forms.html#concept-fe-disabled
			// * option elements in a disabled optgroup
			//   https://html.spec.whatwg.org/multipage/forms.html#concept-option-disabled
			// All such elements have a "form" property.
			if ( elem.parentNode && elem.disabled === false ) {

				// Option elements defer to a parent optgroup if present
				if ( "label" in elem ) {
					if ( "label" in elem.parentNode ) {
						return elem.parentNode.disabled === disabled;
					} else {
						return elem.disabled === disabled;
					}
				}

				// Support: IE 6 - 11
				// Use the isDisabled shortcut property to check for disabled fieldset ancestors
				return elem.isDisabled === disabled ||

					// Where there is no isDisabled, check manually
					/* jshint -W018 */
					elem.isDisabled !== !disabled &&
						disabledAncestor( elem ) === disabled;
			}

			return elem.disabled === disabled;

		// Try to winnow out elements that can't be disabled before trusting the disabled property.
		// Some victims get caught in our net (label, legend, menu, track), but it shouldn't
		// even exist on them, let alone have a boolean value.
		} else if ( "label" in elem ) {
			return elem.disabled === disabled;
		}

		// Remaining elements are neither :enabled nor :disabled
		return false;
	};
}

/**
 * Returns a function to use in pseudos for positionals
 * @param {Function} fn
 */
function createPositionalPseudo( fn ) {
	return markFunction(function( argument ) {
		argument = +argument;
		return markFunction(function( seed, matches ) {
			var j,
				matchIndexes = fn( [], seed.length, argument ),
				i = matchIndexes.length;

			// Match elements found at the specified indexes
			while ( i-- ) {
				if ( seed[ (j = matchIndexes[i]) ] ) {
					seed[j] = !(matches[j] = seed[j]);
				}
			}
		});
	});
}

/**
 * Checks a node for validity as a Sizzle context
 * @param {Element|Object=} context
 * @returns {Element|Object|Boolean} The input node if acceptable, otherwise a falsy value
 */
function testContext( context ) {
	return context && typeof context.getElementsByTagName !== "undefined" && context;
}

// Expose support vars for convenience
support = Sizzle.support = {};

/**
 * Detects XML nodes
 * @param {Element|Object} elem An element or a document
 * @returns {Boolean} True iff elem is a non-HTML XML node
 */
isXML = Sizzle.isXML = function( elem ) {
	// documentElement is verified for cases where it doesn't yet exist
	// (such as loading iframes in IE - #4833)
	var documentElement = elem && (elem.ownerDocument || elem).documentElement;
	return documentElement ? documentElement.nodeName !== "HTML" : false;
};

/**
 * Sets document-related variables once based on the current document
 * @param {Element|Object} [doc] An element or document object to use to set the document
 * @returns {Object} Returns the current document
 */
setDocument = Sizzle.setDocument = function( node ) {
	var hasCompare, subWindow,
		doc = node ? node.ownerDocument || node : preferredDoc;

	// Return early if doc is invalid or already selected
	if ( doc === document || doc.nodeType !== 9 || !doc.documentElement ) {
		return document;
	}

	// Update global variables
	document = doc;
	docElem = document.documentElement;
	documentIsHTML = !isXML( document );

	// Support: IE 9-11, Edge
	// Accessing iframe documents after unload throws "permission denied" errors (jQuery #13936)
	if ( preferredDoc !== document &&
		(subWindow = document.defaultView) && subWindow.top !== subWindow ) {

		// Support: IE 11, Edge
		if ( subWindow.addEventListener ) {
			subWindow.addEventListener( "unload", unloadHandler, false );

		// Support: IE 9 - 10 only
		} else if ( subWindow.attachEvent ) {
			subWindow.attachEvent( "onunload", unloadHandler );
		}
	}

	/* Attributes
	---------------------------------------------------------------------- */

	// Support: IE<8
	// Verify that getAttribute really returns attributes and not properties
	// (excepting IE8 booleans)
	support.attributes = assert(function( el ) {
		el.className = "i";
		return !el.getAttribute("className");
	});

	/* getElement(s)By*
	---------------------------------------------------------------------- */

	// Check if getElementsByTagName("*") returns only elements
	support.getElementsByTagName = assert(function( el ) {
		el.appendChild( document.createComment("") );
		return !el.getElementsByTagName("*").length;
	});

	// Support: IE<9
	support.getElementsByClassName = rnative.test( document.getElementsByClassName );

	// Support: IE<10
	// Check if getElementById returns elements by name
	// The broken getElementById methods don't pick up programmatically-set names,
	// so use a roundabout getElementsByName test
	support.getById = assert(function( el ) {
		docElem.appendChild( el ).id = expando;
		return !document.getElementsByName || !document.getElementsByName( expando ).length;
	});

	// ID filter and find
	if ( support.getById ) {
		Expr.filter["ID"] = function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				return elem.getAttribute("id") === attrId;
			};
		};
		Expr.find["ID"] = function( id, context ) {
			if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
				var elem = context.getElementById( id );
				return elem ? [ elem ] : [];
			}
		};
	} else {
		Expr.filter["ID"] =  function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				var node = typeof elem.getAttributeNode !== "undefined" &&
					elem.getAttributeNode("id");
				return node && node.value === attrId;
			};
		};

		// Support: IE 6 - 7 only
		// getElementById is not reliable as a find shortcut
		Expr.find["ID"] = function( id, context ) {
			if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
				var node, i, elems,
					elem = context.getElementById( id );

				if ( elem ) {

					// Verify the id attribute
					node = elem.getAttributeNode("id");
					if ( node && node.value === id ) {
						return [ elem ];
					}

					// Fall back on getElementsByName
					elems = context.getElementsByName( id );
					i = 0;
					while ( (elem = elems[i++]) ) {
						node = elem.getAttributeNode("id");
						if ( node && node.value === id ) {
							return [ elem ];
						}
					}
				}

				return [];
			}
		};
	}

	// Tag
	Expr.find["TAG"] = support.getElementsByTagName ?
		function( tag, context ) {
			if ( typeof context.getElementsByTagName !== "undefined" ) {
				return context.getElementsByTagName( tag );

			// DocumentFragment nodes don't have gEBTN
			} else if ( support.qsa ) {
				return context.querySelectorAll( tag );
			}
		} :

		function( tag, context ) {
			var elem,
				tmp = [],
				i = 0,
				// By happy coincidence, a (broken) gEBTN appears on DocumentFragment nodes too
				results = context.getElementsByTagName( tag );

			// Filter out possible comments
			if ( tag === "*" ) {
				while ( (elem = results[i++]) ) {
					if ( elem.nodeType === 1 ) {
						tmp.push( elem );
					}
				}

				return tmp;
			}
			return results;
		};

	// Class
	Expr.find["CLASS"] = support.getElementsByClassName && function( className, context ) {
		if ( typeof context.getElementsByClassName !== "undefined" && documentIsHTML ) {
			return context.getElementsByClassName( className );
		}
	};

	/* QSA/matchesSelector
	---------------------------------------------------------------------- */

	// QSA and matchesSelector support

	// matchesSelector(:active) reports false when true (IE9/Opera 11.5)
	rbuggyMatches = [];

	// qSa(:focus) reports false when true (Chrome 21)
	// We allow this because of a bug in IE8/9 that throws an error
	// whenever `document.activeElement` is accessed on an iframe
	// So, we allow :focus to pass through QSA all the time to avoid the IE error
	// See https://bugs.jquery.com/ticket/13378
	rbuggyQSA = [];

	if ( (support.qsa = rnative.test( document.querySelectorAll )) ) {
		// Build QSA regex
		// Regex strategy adopted from Diego Perini
		assert(function( el ) {
			// Select is set to empty string on purpose
			// This is to test IE's treatment of not explicitly
			// setting a boolean content attribute,
			// since its presence should be enough
			// https://bugs.jquery.com/ticket/12359
			docElem.appendChild( el ).innerHTML = "<a id='" + expando + "'></a>" +
				"<select id='" + expando + "-\r\\' msallowcapture=''>" +
				"<option selected=''></option></select>";

			// Support: IE8, Opera 11-12.16
			// Nothing should be selected when empty strings follow ^= or $= or *=
			// The test attribute must be unknown in Opera but "safe" for WinRT
			// https://msdn.microsoft.com/en-us/library/ie/hh465388.aspx#attribute_section
			if ( el.querySelectorAll("[msallowcapture^='']").length ) {
				rbuggyQSA.push( "[*^$]=" + whitespace + "*(?:''|\"\")" );
			}

			// Support: IE8
			// Boolean attributes and "value" are not treated correctly
			if ( !el.querySelectorAll("[selected]").length ) {
				rbuggyQSA.push( "\\[" + whitespace + "*(?:value|" + booleans + ")" );
			}

			// Support: Chrome<29, Android<4.4, Safari<7.0+, iOS<7.0+, PhantomJS<1.9.8+
			if ( !el.querySelectorAll( "[id~=" + expando + "-]" ).length ) {
				rbuggyQSA.push("~=");
			}

			// Webkit/Opera - :checked should return selected option elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			// IE8 throws error here and will not see later tests
			if ( !el.querySelectorAll(":checked").length ) {
				rbuggyQSA.push(":checked");
			}

			// Support: Safari 8+, iOS 8+
			// https://bugs.webkit.org/show_bug.cgi?id=136851
			// In-page `selector#id sibling-combinator selector` fails
			if ( !el.querySelectorAll( "a#" + expando + "+*" ).length ) {
				rbuggyQSA.push(".#.+[+~]");
			}
		});

		assert(function( el ) {
			el.innerHTML = "<a href='' disabled='disabled'></a>" +
				"<select disabled='disabled'><option/></select>";

			// Support: Windows 8 Native Apps
			// The type and name attributes are restricted during .innerHTML assignment
			var input = document.createElement("input");
			input.setAttribute( "type", "hidden" );
			el.appendChild( input ).setAttribute( "name", "D" );

			// Support: IE8
			// Enforce case-sensitivity of name attribute
			if ( el.querySelectorAll("[name=d]").length ) {
				rbuggyQSA.push( "name" + whitespace + "*[*^$|!~]?=" );
			}

			// FF 3.5 - :enabled/:disabled and hidden elements (hidden elements are still enabled)
			// IE8 throws error here and will not see later tests
			if ( el.querySelectorAll(":enabled").length !== 2 ) {
				rbuggyQSA.push( ":enabled", ":disabled" );
			}

			// Support: IE9-11+
			// IE's :disabled selector does not pick up the children of disabled fieldsets
			docElem.appendChild( el ).disabled = true;
			if ( el.querySelectorAll(":disabled").length !== 2 ) {
				rbuggyQSA.push( ":enabled", ":disabled" );
			}

			// Opera 10-11 does not throw on post-comma invalid pseudos
			el.querySelectorAll("*,:x");
			rbuggyQSA.push(",.*:");
		});
	}

	if ( (support.matchesSelector = rnative.test( (matches = docElem.matches ||
		docElem.webkitMatchesSelector ||
		docElem.mozMatchesSelector ||
		docElem.oMatchesSelector ||
		docElem.msMatchesSelector) )) ) {

		assert(function( el ) {
			// Check to see if it's possible to do matchesSelector
			// on a disconnected node (IE 9)
			support.disconnectedMatch = matches.call( el, "*" );

			// This should fail with an exception
			// Gecko does not error, returns false instead
			matches.call( el, "[s!='']:x" );
			rbuggyMatches.push( "!=", pseudos );
		});
	}

	rbuggyQSA = rbuggyQSA.length && new RegExp( rbuggyQSA.join("|") );
	rbuggyMatches = rbuggyMatches.length && new RegExp( rbuggyMatches.join("|") );

	/* Contains
	---------------------------------------------------------------------- */
	hasCompare = rnative.test( docElem.compareDocumentPosition );

	// Element contains another
	// Purposefully self-exclusive
	// As in, an element does not contain itself
	contains = hasCompare || rnative.test( docElem.contains ) ?
		function( a, b ) {
			var adown = a.nodeType === 9 ? a.documentElement : a,
				bup = b && b.parentNode;
			return a === bup || !!( bup && bup.nodeType === 1 && (
				adown.contains ?
					adown.contains( bup ) :
					a.compareDocumentPosition && a.compareDocumentPosition( bup ) & 16
			));
		} :
		function( a, b ) {
			if ( b ) {
				while ( (b = b.parentNode) ) {
					if ( b === a ) {
						return true;
					}
				}
			}
			return false;
		};

	/* Sorting
	---------------------------------------------------------------------- */

	// Document order sorting
	sortOrder = hasCompare ?
	function( a, b ) {

		// Flag for duplicate removal
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		// Sort on method existence if only one input has compareDocumentPosition
		var compare = !a.compareDocumentPosition - !b.compareDocumentPosition;
		if ( compare ) {
			return compare;
		}

		// Calculate position if both inputs belong to the same document
		compare = ( a.ownerDocument || a ) === ( b.ownerDocument || b ) ?
			a.compareDocumentPosition( b ) :

			// Otherwise we know they are disconnected
			1;

		// Disconnected nodes
		if ( compare & 1 ||
			(!support.sortDetached && b.compareDocumentPosition( a ) === compare) ) {

			// Choose the first element that is related to our preferred document
			if ( a === document || a.ownerDocument === preferredDoc && contains(preferredDoc, a) ) {
				return -1;
			}
			if ( b === document || b.ownerDocument === preferredDoc && contains(preferredDoc, b) ) {
				return 1;
			}

			// Maintain original order
			return sortInput ?
				( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
				0;
		}

		return compare & 4 ? -1 : 1;
	} :
	function( a, b ) {
		// Exit early if the nodes are identical
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		var cur,
			i = 0,
			aup = a.parentNode,
			bup = b.parentNode,
			ap = [ a ],
			bp = [ b ];

		// Parentless nodes are either documents or disconnected
		if ( !aup || !bup ) {
			return a === document ? -1 :
				b === document ? 1 :
				aup ? -1 :
				bup ? 1 :
				sortInput ?
				( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
				0;

		// If the nodes are siblings, we can do a quick check
		} else if ( aup === bup ) {
			return siblingCheck( a, b );
		}

		// Otherwise we need full lists of their ancestors for comparison
		cur = a;
		while ( (cur = cur.parentNode) ) {
			ap.unshift( cur );
		}
		cur = b;
		while ( (cur = cur.parentNode) ) {
			bp.unshift( cur );
		}

		// Walk down the tree looking for a discrepancy
		while ( ap[i] === bp[i] ) {
			i++;
		}

		return i ?
			// Do a sibling check if the nodes have a common ancestor
			siblingCheck( ap[i], bp[i] ) :

			// Otherwise nodes in our document sort first
			ap[i] === preferredDoc ? -1 :
			bp[i] === preferredDoc ? 1 :
			0;
	};

	return document;
};

Sizzle.matches = function( expr, elements ) {
	return Sizzle( expr, null, null, elements );
};

Sizzle.matchesSelector = function( elem, expr ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	// Make sure that attribute selectors are quoted
	expr = expr.replace( rattributeQuotes, "='$1']" );

	if ( support.matchesSelector && documentIsHTML &&
		!compilerCache[ expr + " " ] &&
		( !rbuggyMatches || !rbuggyMatches.test( expr ) ) &&
		( !rbuggyQSA     || !rbuggyQSA.test( expr ) ) ) {

		try {
			var ret = matches.call( elem, expr );

			// IE 9's matchesSelector returns false on disconnected nodes
			if ( ret || support.disconnectedMatch ||
					// As well, disconnected nodes are said to be in a document
					// fragment in IE 9
					elem.document && elem.document.nodeType !== 11 ) {
				return ret;
			}
		} catch (e) {}
	}

	return Sizzle( expr, document, null, [ elem ] ).length > 0;
};

Sizzle.contains = function( context, elem ) {
	// Set document vars if needed
	if ( ( context.ownerDocument || context ) !== document ) {
		setDocument( context );
	}
	return contains( context, elem );
};

Sizzle.attr = function( elem, name ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	var fn = Expr.attrHandle[ name.toLowerCase() ],
		// Don't get fooled by Object.prototype properties (jQuery #13807)
		val = fn && hasOwn.call( Expr.attrHandle, name.toLowerCase() ) ?
			fn( elem, name, !documentIsHTML ) :
			undefined;

	return val !== undefined ?
		val :
		support.attributes || !documentIsHTML ?
			elem.getAttribute( name ) :
			(val = elem.getAttributeNode(name)) && val.specified ?
				val.value :
				null;
};

Sizzle.escape = function( sel ) {
	return (sel + "").replace( rcssescape, fcssescape );
};

Sizzle.error = function( msg ) {
	throw new Error( "Syntax error, unrecognized expression: " + msg );
};

/**
 * Document sorting and removing duplicates
 * @param {ArrayLike} results
 */
Sizzle.uniqueSort = function( results ) {
	var elem,
		duplicates = [],
		j = 0,
		i = 0;

	// Unless we *know* we can detect duplicates, assume their presence
	hasDuplicate = !support.detectDuplicates;
	sortInput = !support.sortStable && results.slice( 0 );
	results.sort( sortOrder );

	if ( hasDuplicate ) {
		while ( (elem = results[i++]) ) {
			if ( elem === results[ i ] ) {
				j = duplicates.push( i );
			}
		}
		while ( j-- ) {
			results.splice( duplicates[ j ], 1 );
		}
	}

	// Clear input after sorting to release objects
	// See https://github.com/jquery/sizzle/pull/225
	sortInput = null;

	return results;
};

/**
 * Utility function for retrieving the text value of an array of DOM nodes
 * @param {Array|Element} elem
 */
getText = Sizzle.getText = function( elem ) {
	var node,
		ret = "",
		i = 0,
		nodeType = elem.nodeType;

	if ( !nodeType ) {
		// If no nodeType, this is expected to be an array
		while ( (node = elem[i++]) ) {
			// Do not traverse comment nodes
			ret += getText( node );
		}
	} else if ( nodeType === 1 || nodeType === 9 || nodeType === 11 ) {
		// Use textContent for elements
		// innerText usage removed for consistency of new lines (jQuery #11153)
		if ( typeof elem.textContent === "string" ) {
			return elem.textContent;
		} else {
			// Traverse its children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				ret += getText( elem );
			}
		}
	} else if ( nodeType === 3 || nodeType === 4 ) {
		return elem.nodeValue;
	}
	// Do not include comment or processing instruction nodes

	return ret;
};

Expr = Sizzle.selectors = {

	// Can be adjusted by the user
	cacheLength: 50,

	createPseudo: markFunction,

	match: matchExpr,

	attrHandle: {},

	find: {},

	relative: {
		">": { dir: "parentNode", first: true },
		" ": { dir: "parentNode" },
		"+": { dir: "previousSibling", first: true },
		"~": { dir: "previousSibling" }
	},

	preFilter: {
		"ATTR": function( match ) {
			match[1] = match[1].replace( runescape, funescape );

			// Move the given value to match[3] whether quoted or unquoted
			match[3] = ( match[3] || match[4] || match[5] || "" ).replace( runescape, funescape );

			if ( match[2] === "~=" ) {
				match[3] = " " + match[3] + " ";
			}

			return match.slice( 0, 4 );
		},

		"CHILD": function( match ) {
			/* matches from matchExpr["CHILD"]
				1 type (only|nth|...)
				2 what (child|of-type)
				3 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
				4 xn-component of xn+y argument ([+-]?\d*n|)
				5 sign of xn-component
				6 x of xn-component
				7 sign of y-component
				8 y of y-component
			*/
			match[1] = match[1].toLowerCase();

			if ( match[1].slice( 0, 3 ) === "nth" ) {
				// nth-* requires argument
				if ( !match[3] ) {
					Sizzle.error( match[0] );
				}

				// numeric x and y parameters for Expr.filter.CHILD
				// remember that false/true cast respectively to 0/1
				match[4] = +( match[4] ? match[5] + (match[6] || 1) : 2 * ( match[3] === "even" || match[3] === "odd" ) );
				match[5] = +( ( match[7] + match[8] ) || match[3] === "odd" );

			// other types prohibit arguments
			} else if ( match[3] ) {
				Sizzle.error( match[0] );
			}

			return match;
		},

		"PSEUDO": function( match ) {
			var excess,
				unquoted = !match[6] && match[2];

			if ( matchExpr["CHILD"].test( match[0] ) ) {
				return null;
			}

			// Accept quoted arguments as-is
			if ( match[3] ) {
				match[2] = match[4] || match[5] || "";

			// Strip excess characters from unquoted arguments
			} else if ( unquoted && rpseudo.test( unquoted ) &&
				// Get excess from tokenize (recursively)
				(excess = tokenize( unquoted, true )) &&
				// advance to the next closing parenthesis
				(excess = unquoted.indexOf( ")", unquoted.length - excess ) - unquoted.length) ) {

				// excess is a negative index
				match[0] = match[0].slice( 0, excess );
				match[2] = unquoted.slice( 0, excess );
			}

			// Return only captures needed by the pseudo filter method (type and argument)
			return match.slice( 0, 3 );
		}
	},

	filter: {

		"TAG": function( nodeNameSelector ) {
			var nodeName = nodeNameSelector.replace( runescape, funescape ).toLowerCase();
			return nodeNameSelector === "*" ?
				function() { return true; } :
				function( elem ) {
					return elem.nodeName && elem.nodeName.toLowerCase() === nodeName;
				};
		},

		"CLASS": function( className ) {
			var pattern = classCache[ className + " " ];

			return pattern ||
				(pattern = new RegExp( "(^|" + whitespace + ")" + className + "(" + whitespace + "|$)" )) &&
				classCache( className, function( elem ) {
					return pattern.test( typeof elem.className === "string" && elem.className || typeof elem.getAttribute !== "undefined" && elem.getAttribute("class") || "" );
				});
		},

		"ATTR": function( name, operator, check$$1 ) {
			return function( elem ) {
				var result = Sizzle.attr( elem, name );

				if ( result == null ) {
					return operator === "!=";
				}
				if ( !operator ) {
					return true;
				}

				result += "";

				return operator === "=" ? result === check$$1 :
					operator === "!=" ? result !== check$$1 :
					operator === "^=" ? check$$1 && result.indexOf( check$$1 ) === 0 :
					operator === "*=" ? check$$1 && result.indexOf( check$$1 ) > -1 :
					operator === "$=" ? check$$1 && result.slice( -check$$1.length ) === check$$1 :
					operator === "~=" ? ( " " + result.replace( rwhitespace, " " ) + " " ).indexOf( check$$1 ) > -1 :
					operator === "|=" ? result === check$$1 || result.slice( 0, check$$1.length + 1 ) === check$$1 + "-" :
					false;
			};
		},

		"CHILD": function( type, what, argument, first, last ) {
			var simple = type.slice( 0, 3 ) !== "nth",
				forward = type.slice( -4 ) !== "last",
				ofType = what === "of-type";

			return first === 1 && last === 0 ?

				// Shortcut for :nth-*(n)
				function( elem ) {
					return !!elem.parentNode;
				} :

				function( elem, context, xml ) {
					var cache, uniqueCache, outerCache, node, nodeIndex, start,
						dir = simple !== forward ? "nextSibling" : "previousSibling",
						parent = elem.parentNode,
						name = ofType && elem.nodeName.toLowerCase(),
						useCache = !xml && !ofType,
						diff = false;

					if ( parent ) {

						// :(first|last|only)-(child|of-type)
						if ( simple ) {
							while ( dir ) {
								node = elem;
								while ( (node = node[ dir ]) ) {
									if ( ofType ?
										node.nodeName.toLowerCase() === name :
										node.nodeType === 1 ) {

										return false;
									}
								}
								// Reverse direction for :only-* (if we haven't yet done so)
								start = dir = type === "only" && !start && "nextSibling";
							}
							return true;
						}

						start = [ forward ? parent.firstChild : parent.lastChild ];

						// non-xml :nth-child(...) stores cache data on `parent`
						if ( forward && useCache ) {

							// Seek `elem` from a previously-cached index

							// ...in a gzip-friendly way
							node = parent;
							outerCache = node[ expando ] || (node[ expando ] = {});

							// Support: IE <9 only
							// Defend against cloned attroperties (jQuery gh-1709)
							uniqueCache = outerCache[ node.uniqueID ] ||
								(outerCache[ node.uniqueID ] = {});

							cache = uniqueCache[ type ] || [];
							nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
							diff = nodeIndex && cache[ 2 ];
							node = nodeIndex && parent.childNodes[ nodeIndex ];

							while ( (node = ++nodeIndex && node && node[ dir ] ||

								// Fallback to seeking `elem` from the start
								(diff = nodeIndex = 0) || start.pop()) ) {

								// When found, cache indexes on `parent` and break
								if ( node.nodeType === 1 && ++diff && node === elem ) {
									uniqueCache[ type ] = [ dirruns, nodeIndex, diff ];
									break;
								}
							}

						} else {
							// Use previously-cached element index if available
							if ( useCache ) {
								// ...in a gzip-friendly way
								node = elem;
								outerCache = node[ expando ] || (node[ expando ] = {});

								// Support: IE <9 only
								// Defend against cloned attroperties (jQuery gh-1709)
								uniqueCache = outerCache[ node.uniqueID ] ||
									(outerCache[ node.uniqueID ] = {});

								cache = uniqueCache[ type ] || [];
								nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
								diff = nodeIndex;
							}

							// xml :nth-child(...)
							// or :nth-last-child(...) or :nth(-last)?-of-type(...)
							if ( diff === false ) {
								// Use the same loop as above to seek `elem` from the start
								while ( (node = ++nodeIndex && node && node[ dir ] ||
									(diff = nodeIndex = 0) || start.pop()) ) {

									if ( ( ofType ?
										node.nodeName.toLowerCase() === name :
										node.nodeType === 1 ) &&
										++diff ) {

										// Cache the index of each encountered element
										if ( useCache ) {
											outerCache = node[ expando ] || (node[ expando ] = {});

											// Support: IE <9 only
											// Defend against cloned attroperties (jQuery gh-1709)
											uniqueCache = outerCache[ node.uniqueID ] ||
												(outerCache[ node.uniqueID ] = {});

											uniqueCache[ type ] = [ dirruns, diff ];
										}

										if ( node === elem ) {
											break;
										}
									}
								}
							}
						}

						// Incorporate the offset, then check against cycle size
						diff -= last;
						return diff === first || ( diff % first === 0 && diff / first >= 0 );
					}
				};
		},

		"PSEUDO": function( pseudo, argument ) {
			// pseudo-class names are case-insensitive
			// http://www.w3.org/TR/selectors/#pseudo-classes
			// Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
			// Remember that setFilters inherits from pseudos
			var args,
				fn = Expr.pseudos[ pseudo ] || Expr.setFilters[ pseudo.toLowerCase() ] ||
					Sizzle.error( "unsupported pseudo: " + pseudo );

			// The user may use createPseudo to indicate that
			// arguments are needed to create the filter function
			// just as Sizzle does
			if ( fn[ expando ] ) {
				return fn( argument );
			}

			// But maintain support for old signatures
			if ( fn.length > 1 ) {
				args = [ pseudo, pseudo, "", argument ];
				return Expr.setFilters.hasOwnProperty( pseudo.toLowerCase() ) ?
					markFunction(function( seed, matches ) {
						var idx,
							matched = fn( seed, argument ),
							i = matched.length;
						while ( i-- ) {
							idx = indexOf( seed, matched[i] );
							seed[ idx ] = !( matches[ idx ] = matched[i] );
						}
					}) :
					function( elem ) {
						return fn( elem, 0, args );
					};
			}

			return fn;
		}
	},

	pseudos: {
		// Potentially complex pseudos
		"not": markFunction(function( selector ) {
			// Trim the selector passed to compile
			// to avoid treating leading and trailing
			// spaces as combinators
			var input = [],
				results = [],
				matcher = compile( selector.replace( rtrim, "$1" ) );

			return matcher[ expando ] ?
				markFunction(function( seed, matches, context, xml ) {
					var elem,
						unmatched = matcher( seed, null, xml, [] ),
						i = seed.length;

					// Match elements unmatched by `matcher`
					while ( i-- ) {
						if ( (elem = unmatched[i]) ) {
							seed[i] = !(matches[i] = elem);
						}
					}
				}) :
				function( elem, context, xml ) {
					input[0] = elem;
					matcher( input, null, xml, results );
					// Don't keep the element (issue #299)
					input[0] = null;
					return !results.pop();
				};
		}),

		"has": markFunction(function( selector ) {
			return function( elem ) {
				return Sizzle( selector, elem ).length > 0;
			};
		}),

		"contains": markFunction(function( text ) {
			text = text.replace( runescape, funescape );
			return function( elem ) {
				return ( elem.textContent || elem.innerText || getText( elem ) ).indexOf( text ) > -1;
			};
		}),

		// "Whether an element is represented by a :lang() selector
		// is based solely on the element's language value
		// being equal to the identifier C,
		// or beginning with the identifier C immediately followed by "-".
		// The matching of C against the element's language value is performed case-insensitively.
		// The identifier C does not have to be a valid language name."
		// http://www.w3.org/TR/selectors/#lang-pseudo
		"lang": markFunction( function( lang ) {
			// lang value must be a valid identifier
			if ( !ridentifier.test(lang || "") ) {
				Sizzle.error( "unsupported lang: " + lang );
			}
			lang = lang.replace( runescape, funescape ).toLowerCase();
			return function( elem ) {
				var elemLang;
				do {
					if ( (elemLang = documentIsHTML ?
						elem.lang :
						elem.getAttribute("xml:lang") || elem.getAttribute("lang")) ) {

						elemLang = elemLang.toLowerCase();
						return elemLang === lang || elemLang.indexOf( lang + "-" ) === 0;
					}
				} while ( (elem = elem.parentNode) && elem.nodeType === 1 );
				return false;
			};
		}),

		// Miscellaneous
		"target": function( elem ) {
			var hash = window.location && window.location.hash;
			return hash && hash.slice( 1 ) === elem.id;
		},

		"root": function( elem ) {
			return elem === docElem;
		},

		"focus": function( elem ) {
			return elem === document.activeElement && (!document.hasFocus || document.hasFocus()) && !!(elem.type || elem.href || ~elem.tabIndex);
		},

		// Boolean properties
		"enabled": createDisabledPseudo( false ),
		"disabled": createDisabledPseudo( true ),

		"checked": function( elem ) {
			// In CSS3, :checked should return both checked and selected elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			var nodeName = elem.nodeName.toLowerCase();
			return (nodeName === "input" && !!elem.checked) || (nodeName === "option" && !!elem.selected);
		},

		"selected": function( elem ) {
			// Accessing this property makes selected-by-default
			// options in Safari work properly
			if ( elem.parentNode ) {
				elem.parentNode.selectedIndex;
			}

			return elem.selected === true;
		},

		// Contents
		"empty": function( elem ) {
			// http://www.w3.org/TR/selectors/#empty-pseudo
			// :empty is negated by element (1) or content nodes (text: 3; cdata: 4; entity ref: 5),
			//   but not by others (comment: 8; processing instruction: 7; etc.)
			// nodeType < 6 works because attributes (2) do not appear as children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				if ( elem.nodeType < 6 ) {
					return false;
				}
			}
			return true;
		},

		"parent": function( elem ) {
			return !Expr.pseudos["empty"]( elem );
		},

		// Element/input types
		"header": function( elem ) {
			return rheader.test( elem.nodeName );
		},

		"input": function( elem ) {
			return rinputs.test( elem.nodeName );
		},

		"button": function( elem ) {
			var name = elem.nodeName.toLowerCase();
			return name === "input" && elem.type === "button" || name === "button";
		},

		"text": function( elem ) {
			var attr;
			return elem.nodeName.toLowerCase() === "input" &&
				elem.type === "text" &&

				// Support: IE<8
				// New HTML5 attribute values (e.g., "search") appear with elem.type === "text"
				( (attr = elem.getAttribute("type")) == null || attr.toLowerCase() === "text" );
		},

		// Position-in-collection
		"first": createPositionalPseudo(function() {
			return [ 0 ];
		}),

		"last": createPositionalPseudo(function( matchIndexes, length ) {
			return [ length - 1 ];
		}),

		"eq": createPositionalPseudo(function( matchIndexes, length, argument ) {
			return [ argument < 0 ? argument + length : argument ];
		}),

		"even": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 0;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"odd": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 1;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"lt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; --i >= 0; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"gt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; ++i < length; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		})
	}
};

Expr.pseudos["nth"] = Expr.pseudos["eq"];

// Add button/input type pseudos
for ( i in { radio: true, checkbox: true, file: true, password: true, image: true } ) {
	Expr.pseudos[ i ] = createInputPseudo( i );
}
for ( i in { submit: true, reset: true } ) {
	Expr.pseudos[ i ] = createButtonPseudo( i );
}

// Easy API for creating new setFilters
function setFilters() {}
setFilters.prototype = Expr.filters = Expr.pseudos;
Expr.setFilters = new setFilters();

tokenize = Sizzle.tokenize = function( selector, parseOnly ) {
	var matched, match, tokens, type,
		soFar, groups, preFilters,
		cached = tokenCache[ selector + " " ];

	if ( cached ) {
		return parseOnly ? 0 : cached.slice( 0 );
	}

	soFar = selector;
	groups = [];
	preFilters = Expr.preFilter;

	while ( soFar ) {

		// Comma and first run
		if ( !matched || (match = rcomma.exec( soFar )) ) {
			if ( match ) {
				// Don't consume trailing commas as valid
				soFar = soFar.slice( match[0].length ) || soFar;
			}
			groups.push( (tokens = []) );
		}

		matched = false;

		// Combinators
		if ( (match = rcombinators.exec( soFar )) ) {
			matched = match.shift();
			tokens.push({
				value: matched,
				// Cast descendant combinators to space
				type: match[0].replace( rtrim, " " )
			});
			soFar = soFar.slice( matched.length );
		}

		// Filters
		for ( type in Expr.filter ) {
			if ( (match = matchExpr[ type ].exec( soFar )) && (!preFilters[ type ] ||
				(match = preFilters[ type ]( match ))) ) {
				matched = match.shift();
				tokens.push({
					value: matched,
					type: type,
					matches: match
				});
				soFar = soFar.slice( matched.length );
			}
		}

		if ( !matched ) {
			break;
		}
	}

	// Return the length of the invalid excess
	// if we're just parsing
	// Otherwise, throw an error or return tokens
	return parseOnly ?
		soFar.length :
		soFar ?
			Sizzle.error( selector ) :
			// Cache the tokens
			tokenCache( selector, groups ).slice( 0 );
};

function toSelector( tokens ) {
	var i = 0,
		len = tokens.length,
		selector = "";
	for ( ; i < len; i++ ) {
		selector += tokens[i].value;
	}
	return selector;
}

function addCombinator( matcher, combinator, base ) {
	var dir = combinator.dir,
		skip = combinator.next,
		key = skip || dir,
		checkNonElements = base && key === "parentNode",
		doneName = done++;

	return combinator.first ?
		// Check against closest ancestor/preceding element
		function( elem, context, xml ) {
			while ( (elem = elem[ dir ]) ) {
				if ( elem.nodeType === 1 || checkNonElements ) {
					return matcher( elem, context, xml );
				}
			}
			return false;
		} :

		// Check against all ancestor/preceding elements
		function( elem, context, xml ) {
			var oldCache, uniqueCache, outerCache,
				newCache = [ dirruns, doneName ];

			// We can't set arbitrary data on XML nodes, so they don't benefit from combinator caching
			if ( xml ) {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						if ( matcher( elem, context, xml ) ) {
							return true;
						}
					}
				}
			} else {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						outerCache = elem[ expando ] || (elem[ expando ] = {});

						// Support: IE <9 only
						// Defend against cloned attroperties (jQuery gh-1709)
						uniqueCache = outerCache[ elem.uniqueID ] || (outerCache[ elem.uniqueID ] = {});

						if ( skip && skip === elem.nodeName.toLowerCase() ) {
							elem = elem[ dir ] || elem;
						} else if ( (oldCache = uniqueCache[ key ]) &&
							oldCache[ 0 ] === dirruns && oldCache[ 1 ] === doneName ) {

							// Assign to newCache so results back-propagate to previous elements
							return (newCache[ 2 ] = oldCache[ 2 ]);
						} else {
							// Reuse newcache so results back-propagate to previous elements
							uniqueCache[ key ] = newCache;

							// A match means we're done; a fail means we have to keep checking
							if ( (newCache[ 2 ] = matcher( elem, context, xml )) ) {
								return true;
							}
						}
					}
				}
			}
			return false;
		};
}

function elementMatcher( matchers ) {
	return matchers.length > 1 ?
		function( elem, context, xml ) {
			var i = matchers.length;
			while ( i-- ) {
				if ( !matchers[i]( elem, context, xml ) ) {
					return false;
				}
			}
			return true;
		} :
		matchers[0];
}

function multipleContexts( selector, contexts, results ) {
	var i = 0,
		len = contexts.length;
	for ( ; i < len; i++ ) {
		Sizzle( selector, contexts[i], results );
	}
	return results;
}

function condense( unmatched, map, filter, context, xml ) {
	var elem,
		newUnmatched = [],
		i = 0,
		len = unmatched.length,
		mapped = map != null;

	for ( ; i < len; i++ ) {
		if ( (elem = unmatched[i]) ) {
			if ( !filter || filter( elem, context, xml ) ) {
				newUnmatched.push( elem );
				if ( mapped ) {
					map.push( i );
				}
			}
		}
	}

	return newUnmatched;
}

function setMatcher( preFilter, selector, matcher, postFilter, postFinder, postSelector ) {
	if ( postFilter && !postFilter[ expando ] ) {
		postFilter = setMatcher( postFilter );
	}
	if ( postFinder && !postFinder[ expando ] ) {
		postFinder = setMatcher( postFinder, postSelector );
	}
	return markFunction(function( seed, results, context, xml ) {
		var temp, i, elem,
			preMap = [],
			postMap = [],
			preexisting = results.length,

			// Get initial elements from seed or context
			elems = seed || multipleContexts( selector || "*", context.nodeType ? [ context ] : context, [] ),

			// Prefilter to get matcher input, preserving a map for seed-results synchronization
			matcherIn = preFilter && ( seed || !selector ) ?
				condense( elems, preMap, preFilter, context, xml ) :
				elems,

			matcherOut = matcher ?
				// If we have a postFinder, or filtered seed, or non-seed postFilter or preexisting results,
				postFinder || ( seed ? preFilter : preexisting || postFilter ) ?

					// ...intermediate processing is necessary
					[] :

					// ...otherwise use results directly
					results :
				matcherIn;

		// Find primary matches
		if ( matcher ) {
			matcher( matcherIn, matcherOut, context, xml );
		}

		// Apply postFilter
		if ( postFilter ) {
			temp = condense( matcherOut, postMap );
			postFilter( temp, [], context, xml );

			// Un-match failing elements by moving them back to matcherIn
			i = temp.length;
			while ( i-- ) {
				if ( (elem = temp[i]) ) {
					matcherOut[ postMap[i] ] = !(matcherIn[ postMap[i] ] = elem);
				}
			}
		}

		if ( seed ) {
			if ( postFinder || preFilter ) {
				if ( postFinder ) {
					// Get the final matcherOut by condensing this intermediate into postFinder contexts
					temp = [];
					i = matcherOut.length;
					while ( i-- ) {
						if ( (elem = matcherOut[i]) ) {
							// Restore matcherIn since elem is not yet a final match
							temp.push( (matcherIn[i] = elem) );
						}
					}
					postFinder( null, (matcherOut = []), temp, xml );
				}

				// Move matched elements from seed to results to keep them synchronized
				i = matcherOut.length;
				while ( i-- ) {
					if ( (elem = matcherOut[i]) &&
						(temp = postFinder ? indexOf( seed, elem ) : preMap[i]) > -1 ) {

						seed[temp] = !(results[temp] = elem);
					}
				}
			}

		// Add elements to results, through postFinder if defined
		} else {
			matcherOut = condense(
				matcherOut === results ?
					matcherOut.splice( preexisting, matcherOut.length ) :
					matcherOut
			);
			if ( postFinder ) {
				postFinder( null, results, matcherOut, xml );
			} else {
				push.apply( results, matcherOut );
			}
		}
	});
}

function matcherFromTokens( tokens ) {
	var checkContext, matcher, j,
		len = tokens.length,
		leadingRelative = Expr.relative[ tokens[0].type ],
		implicitRelative = leadingRelative || Expr.relative[" "],
		i = leadingRelative ? 1 : 0,

		// The foundational matcher ensures that elements are reachable from top-level context(s)
		matchContext = addCombinator( function( elem ) {
			return elem === checkContext;
		}, implicitRelative, true ),
		matchAnyContext = addCombinator( function( elem ) {
			return indexOf( checkContext, elem ) > -1;
		}, implicitRelative, true ),
		matchers = [ function( elem, context, xml ) {
			var ret = ( !leadingRelative && ( xml || context !== outermostContext ) ) || (
				(checkContext = context).nodeType ?
					matchContext( elem, context, xml ) :
					matchAnyContext( elem, context, xml ) );
			// Avoid hanging onto element (issue #299)
			checkContext = null;
			return ret;
		} ];

	for ( ; i < len; i++ ) {
		if ( (matcher = Expr.relative[ tokens[i].type ]) ) {
			matchers = [ addCombinator(elementMatcher( matchers ), matcher) ];
		} else {
			matcher = Expr.filter[ tokens[i].type ].apply( null, tokens[i].matches );

			// Return special upon seeing a positional matcher
			if ( matcher[ expando ] ) {
				// Find the next relative operator (if any) for proper handling
				j = ++i;
				for ( ; j < len; j++ ) {
					if ( Expr.relative[ tokens[j].type ] ) {
						break;
					}
				}
				return setMatcher(
					i > 1 && elementMatcher( matchers ),
					i > 1 && toSelector(
						// If the preceding token was a descendant combinator, insert an implicit any-element `*`
						tokens.slice( 0, i - 1 ).concat({ value: tokens[ i - 2 ].type === " " ? "*" : "" })
					).replace( rtrim, "$1" ),
					matcher,
					i < j && matcherFromTokens( tokens.slice( i, j ) ),
					j < len && matcherFromTokens( (tokens = tokens.slice( j )) ),
					j < len && toSelector( tokens )
				);
			}
			matchers.push( matcher );
		}
	}

	return elementMatcher( matchers );
}

function matcherFromGroupMatchers( elementMatchers, setMatchers ) {
	var bySet = setMatchers.length > 0,
		byElement = elementMatchers.length > 0,
		superMatcher = function( seed, context, xml, results, outermost ) {
			var elem, j, matcher,
				matchedCount = 0,
				i = "0",
				unmatched = seed && [],
				setMatched = [],
				contextBackup = outermostContext,
				// We must always have either seed elements or outermost context
				elems = seed || byElement && Expr.find["TAG"]( "*", outermost ),
				// Use integer dirruns iff this is the outermost matcher
				dirrunsUnique = (dirruns += contextBackup == null ? 1 : Math.random() || 0.1),
				len = elems.length;

			if ( outermost ) {
				outermostContext = context === document || context || outermost;
			}

			// Add elements passing elementMatchers directly to results
			// Support: IE<9, Safari
			// Tolerate NodeList properties (IE: "length"; Safari: <number>) matching elements by id
			for ( ; i !== len && (elem = elems[i]) != null; i++ ) {
				if ( byElement && elem ) {
					j = 0;
					if ( !context && elem.ownerDocument !== document ) {
						setDocument( elem );
						xml = !documentIsHTML;
					}
					while ( (matcher = elementMatchers[j++]) ) {
						if ( matcher( elem, context || document, xml) ) {
							results.push( elem );
							break;
						}
					}
					if ( outermost ) {
						dirruns = dirrunsUnique;
					}
				}

				// Track unmatched elements for set filters
				if ( bySet ) {
					// They will have gone through all possible matchers
					if ( (elem = !matcher && elem) ) {
						matchedCount--;
					}

					// Lengthen the array for every element, matched or not
					if ( seed ) {
						unmatched.push( elem );
					}
				}
			}

			// `i` is now the count of elements visited above, and adding it to `matchedCount`
			// makes the latter nonnegative.
			matchedCount += i;

			// Apply set filters to unmatched elements
			// NOTE: This can be skipped if there are no unmatched elements (i.e., `matchedCount`
			// equals `i`), unless we didn't visit _any_ elements in the above loop because we have
			// no element matchers and no seed.
			// Incrementing an initially-string "0" `i` allows `i` to remain a string only in that
			// case, which will result in a "00" `matchedCount` that differs from `i` but is also
			// numerically zero.
			if ( bySet && i !== matchedCount ) {
				j = 0;
				while ( (matcher = setMatchers[j++]) ) {
					matcher( unmatched, setMatched, context, xml );
				}

				if ( seed ) {
					// Reintegrate element matches to eliminate the need for sorting
					if ( matchedCount > 0 ) {
						while ( i-- ) {
							if ( !(unmatched[i] || setMatched[i]) ) {
								setMatched[i] = pop.call( results );
							}
						}
					}

					// Discard index placeholder values to get only actual matches
					setMatched = condense( setMatched );
				}

				// Add matches to results
				push.apply( results, setMatched );

				// Seedless set matches succeeding multiple successful matchers stipulate sorting
				if ( outermost && !seed && setMatched.length > 0 &&
					( matchedCount + setMatchers.length ) > 1 ) {

					Sizzle.uniqueSort( results );
				}
			}

			// Override manipulation of globals by nested matchers
			if ( outermost ) {
				dirruns = dirrunsUnique;
				outermostContext = contextBackup;
			}

			return unmatched;
		};

	return bySet ?
		markFunction( superMatcher ) :
		superMatcher;
}

compile = Sizzle.compile = function( selector, match /* Internal Use Only */ ) {
	var i,
		setMatchers = [],
		elementMatchers = [],
		cached = compilerCache[ selector + " " ];

	if ( !cached ) {
		// Generate a function of recursive functions that can be used to check each element
		if ( !match ) {
			match = tokenize( selector );
		}
		i = match.length;
		while ( i-- ) {
			cached = matcherFromTokens( match[i] );
			if ( cached[ expando ] ) {
				setMatchers.push( cached );
			} else {
				elementMatchers.push( cached );
			}
		}

		// Cache the compiled function
		cached = compilerCache( selector, matcherFromGroupMatchers( elementMatchers, setMatchers ) );

		// Save selector and tokenization
		cached.selector = selector;
	}
	return cached;
};

/**
 * A low-level selection function that works with Sizzle's compiled
 *  selector functions
 * @param {String|Function} selector A selector or a pre-compiled
 *  selector function built with Sizzle.compile
 * @param {Element} context
 * @param {Array} [results]
 * @param {Array} [seed] A set of elements to match against
 */
select = Sizzle.select = function( selector, context, results, seed ) {
	var i, tokens, token, type, find,
		compiled = typeof selector === "function" && selector,
		match = !seed && tokenize( (selector = compiled.selector || selector) );

	results = results || [];

	// Try to minimize operations if there is only one selector in the list and no seed
	// (the latter of which guarantees us context)
	if ( match.length === 1 ) {

		// Reduce context if the leading compound selector is an ID
		tokens = match[0] = match[0].slice( 0 );
		if ( tokens.length > 2 && (token = tokens[0]).type === "ID" &&
				context.nodeType === 9 && documentIsHTML && Expr.relative[ tokens[1].type ] ) {

			context = ( Expr.find["ID"]( token.matches[0].replace(runescape, funescape), context ) || [] )[0];
			if ( !context ) {
				return results;

			// Precompiled matchers will still verify ancestry, so step up a level
			} else if ( compiled ) {
				context = context.parentNode;
			}

			selector = selector.slice( tokens.shift().value.length );
		}

		// Fetch a seed set for right-to-left matching
		i = matchExpr["needsContext"].test( selector ) ? 0 : tokens.length;
		while ( i-- ) {
			token = tokens[i];

			// Abort if we hit a combinator
			if ( Expr.relative[ (type = token.type) ] ) {
				break;
			}
			if ( (find = Expr.find[ type ]) ) {
				// Search, expanding context for leading sibling combinators
				if ( (seed = find(
					token.matches[0].replace( runescape, funescape ),
					rsibling.test( tokens[0].type ) && testContext( context.parentNode ) || context
				)) ) {

					// If seed is empty or no tokens remain, we can return early
					tokens.splice( i, 1 );
					selector = seed.length && toSelector( tokens );
					if ( !selector ) {
						push.apply( results, seed );
						return results;
					}

					break;
				}
			}
		}
	}

	// Compile and execute a filtering function if one is not provided
	// Provide `match` to avoid retokenization if we modified the selector above
	( compiled || compile( selector, match ) )(
		seed,
		context,
		!documentIsHTML,
		results,
		!context || rsibling.test( selector ) && testContext( context.parentNode ) || context
	);
	return results;
};

// One-time assignments

// Sort stability
support.sortStable = expando.split("").sort( sortOrder ).join("") === expando;

// Support: Chrome 14-35+
// Always assume duplicates if they aren't passed to the comparison function
support.detectDuplicates = !!hasDuplicate;

// Initialize against the default document
setDocument();

// Support: Webkit<537.32 - Safari 6.0.3/Chrome 25 (fixed in Chrome 27)
// Detached nodes confoundingly follow *each other*
support.sortDetached = assert(function( el ) {
	// Should return 1, but returns 4 (following)
	return el.compareDocumentPosition( document.createElement("fieldset") ) & 1;
});

// Support: IE<8
// Prevent attribute/property "interpolation"
// https://msdn.microsoft.com/en-us/library/ms536429%28VS.85%29.aspx
if ( !assert(function( el ) {
	el.innerHTML = "<a href='#'></a>";
	return el.firstChild.getAttribute("href") === "#" ;
}) ) {
	addHandle( "type|href|height|width", function( elem, name, isXML ) {
		if ( !isXML ) {
			return elem.getAttribute( name, name.toLowerCase() === "type" ? 1 : 2 );
		}
	});
}

// Support: IE<9
// Use defaultValue in place of getAttribute("value")
if ( !support.attributes || !assert(function( el ) {
	el.innerHTML = "<input/>";
	el.firstChild.setAttribute( "value", "" );
	return el.firstChild.getAttribute( "value" ) === "";
}) ) {
	addHandle( "value", function( elem, name, isXML ) {
		if ( !isXML && elem.nodeName.toLowerCase() === "input" ) {
			return elem.defaultValue;
		}
	});
}

// Support: IE<9
// Use getAttributeNode to fetch booleans when getAttribute lies
if ( !assert(function( el ) {
	return el.getAttribute("disabled") == null;
}) ) {
	addHandle( booleans, function( elem, name, isXML ) {
		var val;
		if ( !isXML ) {
			return elem[ name ] === true ? name.toLowerCase() :
					(val = elem.getAttributeNode( name )) && val.specified ?
					val.value :
				null;
		}
	});
}

return Sizzle;

})( window );



jQuery.find = Sizzle;
jQuery.expr = Sizzle.selectors;

// Deprecated
jQuery.expr[ ":" ] = jQuery.expr.pseudos;
jQuery.uniqueSort = jQuery.unique = Sizzle.uniqueSort;
jQuery.text = Sizzle.getText;
jQuery.isXMLDoc = Sizzle.isXML;
jQuery.contains = Sizzle.contains;
jQuery.escapeSelector = Sizzle.escape;




var dir = function( elem, dir, until ) {
	var matched = [],
		truncate = until !== undefined;

	while ( ( elem = elem[ dir ] ) && elem.nodeType !== 9 ) {
		if ( elem.nodeType === 1 ) {
			if ( truncate && jQuery( elem ).is( until ) ) {
				break;
			}
			matched.push( elem );
		}
	}
	return matched;
};


var siblings = function( n, elem ) {
	var matched = [];

	for ( ; n; n = n.nextSibling ) {
		if ( n.nodeType === 1 && n !== elem ) {
			matched.push( n );
		}
	}

	return matched;
};


var rneedsContext = jQuery.expr.match.needsContext;



function nodeName( elem, name ) {

  return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();

}var rsingleTag = ( /^<([a-z][^\/\0>:\x20\t\r\n\f]*)[\x20\t\r\n\f]*\/?>(?:<\/\1>|)$/i );



// Implement the identical functionality for filter and not
function winnow( elements, qualifier, not ) {
	if ( isFunction( qualifier ) ) {
		return jQuery.grep( elements, function( elem, i ) {
			return !!qualifier.call( elem, i, elem ) !== not;
		} );
	}

	// Single element
	if ( qualifier.nodeType ) {
		return jQuery.grep( elements, function( elem ) {
			return ( elem === qualifier ) !== not;
		} );
	}

	// Arraylike of elements (jQuery, arguments, Array)
	if ( typeof qualifier !== "string" ) {
		return jQuery.grep( elements, function( elem ) {
			return ( indexOf.call( qualifier, elem ) > -1 ) !== not;
		} );
	}

	// Filtered directly for both simple and complex selectors
	return jQuery.filter( qualifier, elements, not );
}

jQuery.filter = function( expr, elems, not ) {
	var elem = elems[ 0 ];

	if ( not ) {
		expr = ":not(" + expr + ")";
	}

	if ( elems.length === 1 && elem.nodeType === 1 ) {
		return jQuery.find.matchesSelector( elem, expr ) ? [ elem ] : [];
	}

	return jQuery.find.matches( expr, jQuery.grep( elems, function( elem ) {
		return elem.nodeType === 1;
	} ) );
};

jQuery.fn.extend( {
	find: function( selector ) {
		var i, ret,
			len = this.length,
			self = this;

		if ( typeof selector !== "string" ) {
			return this.pushStack( jQuery( selector ).filter( function() {
				for ( i = 0; i < len; i++ ) {
					if ( jQuery.contains( self[ i ], this ) ) {
						return true;
					}
				}
			} ) );
		}

		ret = this.pushStack( [] );

		for ( i = 0; i < len; i++ ) {
			jQuery.find( selector, self[ i ], ret );
		}

		return len > 1 ? jQuery.uniqueSort( ret ) : ret;
	},
	filter: function( selector ) {
		return this.pushStack( winnow( this, selector || [], false ) );
	},
	not: function( selector ) {
		return this.pushStack( winnow( this, selector || [], true ) );
	},
	is: function( selector ) {
		return !!winnow(
			this,

			// If this is a positional/relative selector, check membership in the returned set
			// so $("p:first").is("p:last") won't return true for a doc with two "p".
			typeof selector === "string" && rneedsContext.test( selector ) ?
				jQuery( selector ) :
				selector || [],
			false
		).length;
	}
} );


// Initialize a jQuery object


// A central reference to the root jQuery(document)
var rootjQuery,

	// A simple way to check for HTML strings
	// Prioritize #id over <tag> to avoid XSS via location.hash (#9521)
	// Strict HTML recognition (#11290: must start with <)
	// Shortcut simple #id case for speed
	rquickExpr = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]+))$/,

	init = jQuery.fn.init = function( selector, context, root ) {
		var match, elem;

		// HANDLE: $(""), $(null), $(undefined), $(false)
		if ( !selector ) {
			return this;
		}

		// Method init() accepts an alternate rootjQuery
		// so migrate can support jQuery.sub (gh-2101)
		root = root || rootjQuery;

		// Handle HTML strings
		if ( typeof selector === "string" ) {
			if ( selector[ 0 ] === "<" &&
				selector[ selector.length - 1 ] === ">" &&
				selector.length >= 3 ) {

				// Assume that strings that start and end with <> are HTML and skip the regex check
				match = [ null, selector, null ];

			} else {
				match = rquickExpr.exec( selector );
			}

			// Match html or make sure no context is specified for #id
			if ( match && ( match[ 1 ] || !context ) ) {

				// HANDLE: $(html) -> $(array)
				if ( match[ 1 ] ) {
					context = context instanceof jQuery ? context[ 0 ] : context;

					// Option to run scripts is true for back-compat
					// Intentionally let the error be thrown if parseHTML is not present
					jQuery.merge( this, jQuery.parseHTML(
						match[ 1 ],
						context && context.nodeType ? context.ownerDocument || context : document,
						true
					) );

					// HANDLE: $(html, props)
					if ( rsingleTag.test( match[ 1 ] ) && jQuery.isPlainObject( context ) ) {
						for ( match in context ) {

							// Properties of context are called as methods if possible
							if ( isFunction( this[ match ] ) ) {
								this[ match ]( context[ match ] );

							// ...and otherwise set as attributes
							} else {
								this.attr( match, context[ match ] );
							}
						}
					}

					return this;

				// HANDLE: $(#id)
				} else {
					elem = document.getElementById( match[ 2 ] );

					if ( elem ) {

						// Inject the element directly into the jQuery object
						this[ 0 ] = elem;
						this.length = 1;
					}
					return this;
				}

			// HANDLE: $(expr, $(...))
			} else if ( !context || context.jquery ) {
				return ( context || root ).find( selector );

			// HANDLE: $(expr, context)
			// (which is just equivalent to: $(context).find(expr)
			} else {
				return this.constructor( context ).find( selector );
			}

		// HANDLE: $(DOMElement)
		} else if ( selector.nodeType ) {
			this[ 0 ] = selector;
			this.length = 1;
			return this;

		// HANDLE: $(function)
		// Shortcut for document ready
		} else if ( isFunction( selector ) ) {
			return root.ready !== undefined ?
				root.ready( selector ) :

				// Execute immediately if ready is not present
				selector( jQuery );
		}

		return jQuery.makeArray( selector, this );
	};

// Give the init function the jQuery prototype for later instantiation
init.prototype = jQuery.fn;

// Initialize central reference
rootjQuery = jQuery( document );


var rparentsprev = /^(?:parents|prev(?:Until|All))/,

	// Methods guaranteed to produce a unique set when starting from a unique set
	guaranteedUnique = {
		children: true,
		contents: true,
		next: true,
		prev: true
	};

jQuery.fn.extend( {
	has: function( target ) {
		var targets = jQuery( target, this ),
			l = targets.length;

		return this.filter( function() {
			var i = 0;
			for ( ; i < l; i++ ) {
				if ( jQuery.contains( this, targets[ i ] ) ) {
					return true;
				}
			}
		} );
	},

	closest: function( selectors, context ) {
		var cur,
			i = 0,
			l = this.length,
			matched = [],
			targets = typeof selectors !== "string" && jQuery( selectors );

		// Positional selectors never match, since there's no _selection_ context
		if ( !rneedsContext.test( selectors ) ) {
			for ( ; i < l; i++ ) {
				for ( cur = this[ i ]; cur && cur !== context; cur = cur.parentNode ) {

					// Always skip document fragments
					if ( cur.nodeType < 11 && ( targets ?
						targets.index( cur ) > -1 :

						// Don't pass non-elements to Sizzle
						cur.nodeType === 1 &&
							jQuery.find.matchesSelector( cur, selectors ) ) ) {

						matched.push( cur );
						break;
					}
				}
			}
		}

		return this.pushStack( matched.length > 1 ? jQuery.uniqueSort( matched ) : matched );
	},

	// Determine the position of an element within the set
	index: function( elem ) {

		// No argument, return index in parent
		if ( !elem ) {
			return ( this[ 0 ] && this[ 0 ].parentNode ) ? this.first().prevAll().length : -1;
		}

		// Index in selector
		if ( typeof elem === "string" ) {
			return indexOf.call( jQuery( elem ), this[ 0 ] );
		}

		// Locate the position of the desired element
		return indexOf.call( this,

			// If it receives a jQuery object, the first element is used
			elem.jquery ? elem[ 0 ] : elem
		);
	},

	add: function( selector, context ) {
		return this.pushStack(
			jQuery.uniqueSort(
				jQuery.merge( this.get(), jQuery( selector, context ) )
			)
		);
	},

	addBack: function( selector ) {
		return this.add( selector == null ?
			this.prevObject : this.prevObject.filter( selector )
		);
	}
} );

function sibling( cur, dir ) {
	while ( ( cur = cur[ dir ] ) && cur.nodeType !== 1 ) {}
	return cur;
}

jQuery.each( {
	parent: function( elem ) {
		var parent = elem.parentNode;
		return parent && parent.nodeType !== 11 ? parent : null;
	},
	parents: function( elem ) {
		return dir( elem, "parentNode" );
	},
	parentsUntil: function( elem, i, until ) {
		return dir( elem, "parentNode", until );
	},
	next: function( elem ) {
		return sibling( elem, "nextSibling" );
	},
	prev: function( elem ) {
		return sibling( elem, "previousSibling" );
	},
	nextAll: function( elem ) {
		return dir( elem, "nextSibling" );
	},
	prevAll: function( elem ) {
		return dir( elem, "previousSibling" );
	},
	nextUntil: function( elem, i, until ) {
		return dir( elem, "nextSibling", until );
	},
	prevUntil: function( elem, i, until ) {
		return dir( elem, "previousSibling", until );
	},
	siblings: function( elem ) {
		return siblings( ( elem.parentNode || {} ).firstChild, elem );
	},
	children: function( elem ) {
		return siblings( elem.firstChild );
	},
	contents: function( elem ) {
        if ( nodeName( elem, "iframe" ) ) {
            return elem.contentDocument;
        }

        // Support: IE 9 - 11 only, iOS 7 only, Android Browser <=4.3 only
        // Treat the template element as a regular one in browsers that
        // don't support it.
        if ( nodeName( elem, "template" ) ) {
            elem = elem.content || elem;
        }

        return jQuery.merge( [], elem.childNodes );
	}
}, function( name, fn ) {
	jQuery.fn[ name ] = function( until, selector ) {
		var matched = jQuery.map( this, fn, until );

		if ( name.slice( -5 ) !== "Until" ) {
			selector = until;
		}

		if ( selector && typeof selector === "string" ) {
			matched = jQuery.filter( selector, matched );
		}

		if ( this.length > 1 ) {

			// Remove duplicates
			if ( !guaranteedUnique[ name ] ) {
				jQuery.uniqueSort( matched );
			}

			// Reverse order for parents* and prev-derivatives
			if ( rparentsprev.test( name ) ) {
				matched.reverse();
			}
		}

		return this.pushStack( matched );
	};
} );
var rnothtmlwhite = ( /[^\x20\t\r\n\f]+/g );



// Convert String-formatted options into Object-formatted ones
function createOptions( options ) {
	var object = {};
	jQuery.each( options.match( rnothtmlwhite ) || [], function( _, flag ) {
		object[ flag ] = true;
	} );
	return object;
}

/*
 * Create a callback list using the following parameters:
 *
 *	options: an optional list of space-separated options that will change how
 *			the callback list behaves or a more traditional option object
 *
 * By default a callback list will act like an event callback list and can be
 * "fired" multiple times.
 *
 * Possible options:
 *
 *	once:			will ensure the callback list can only be fired once (like a Deferred)
 *
 *	memory:			will keep track of previous values and will call any callback added
 *					after the list has been fired right away with the latest "memorized"
 *					values (like a Deferred)
 *
 *	unique:			will ensure a callback can only be added once (no duplicate in the list)
 *
 *	stopOnFalse:	interrupt callings when a callback returns false
 *
 */
jQuery.Callbacks = function( options ) {

	// Convert options from String-formatted to Object-formatted if needed
	// (we check in cache first)
	options = typeof options === "string" ?
		createOptions( options ) :
		jQuery.extend( {}, options );

	var // Flag to know if list is currently firing
		firing,

		// Last fire value for non-forgettable lists
		memory,

		// Flag to know if list was already fired
		fired,

		// Flag to prevent firing
		locked,

		// Actual callback list
		list = [],

		// Queue of execution data for repeatable lists
		queue = [],

		// Index of currently firing callback (modified by add/remove as needed)
		firingIndex = -1,

		// Fire callbacks
		fire = function() {

			// Enforce single-firing
			locked = locked || options.once;

			// Execute callbacks for all pending executions,
			// respecting firingIndex overrides and runtime changes
			fired = firing = true;
			for ( ; queue.length; firingIndex = -1 ) {
				memory = queue.shift();
				while ( ++firingIndex < list.length ) {

					// Run callback and check for early termination
					if ( list[ firingIndex ].apply( memory[ 0 ], memory[ 1 ] ) === false &&
						options.stopOnFalse ) {

						// Jump to end and forget the data so .add doesn't re-fire
						firingIndex = list.length;
						memory = false;
					}
				}
			}

			// Forget the data if we're done with it
			if ( !options.memory ) {
				memory = false;
			}

			firing = false;

			// Clean up if we're done firing for good
			if ( locked ) {

				// Keep an empty list if we have data for future add calls
				if ( memory ) {
					list = [];

				// Otherwise, this object is spent
				} else {
					list = "";
				}
			}
		},

		// Actual Callbacks object
		self = {

			// Add a callback or a collection of callbacks to the list
			add: function() {
				if ( list ) {

					// If we have memory from a past run, we should fire after adding
					if ( memory && !firing ) {
						firingIndex = list.length - 1;
						queue.push( memory );
					}

					( function add( args ) {
						jQuery.each( args, function( _, arg ) {
							if ( isFunction( arg ) ) {
								if ( !options.unique || !self.has( arg ) ) {
									list.push( arg );
								}
							} else if ( arg && arg.length && toType( arg ) !== "string" ) {

								// Inspect recursively
								add( arg );
							}
						} );
					} )( arguments );

					if ( memory && !firing ) {
						fire();
					}
				}
				return this;
			},

			// Remove a callback from the list
			remove: function() {
				jQuery.each( arguments, function( _, arg ) {
					var index;
					while ( ( index = jQuery.inArray( arg, list, index ) ) > -1 ) {
						list.splice( index, 1 );

						// Handle firing indexes
						if ( index <= firingIndex ) {
							firingIndex--;
						}
					}
				} );
				return this;
			},

			// Check if a given callback is in the list.
			// If no argument is given, return whether or not list has callbacks attached.
			has: function( fn ) {
				return fn ?
					jQuery.inArray( fn, list ) > -1 :
					list.length > 0;
			},

			// Remove all callbacks from the list
			empty: function() {
				if ( list ) {
					list = [];
				}
				return this;
			},

			// Disable .fire and .add
			// Abort any current/pending executions
			// Clear all callbacks and values
			disable: function() {
				locked = queue = [];
				list = memory = "";
				return this;
			},
			disabled: function() {
				return !list;
			},

			// Disable .fire
			// Also disable .add unless we have memory (since it would have no effect)
			// Abort any pending executions
			lock: function() {
				locked = queue = [];
				if ( !memory && !firing ) {
					list = memory = "";
				}
				return this;
			},
			locked: function() {
				return !!locked;
			},

			// Call all callbacks with the given context and arguments
			fireWith: function( context, args ) {
				if ( !locked ) {
					args = args || [];
					args = [ context, args.slice ? args.slice() : args ];
					queue.push( args );
					if ( !firing ) {
						fire();
					}
				}
				return this;
			},

			// Call all the callbacks with the given arguments
			fire: function() {
				self.fireWith( this, arguments );
				return this;
			},

			// To know if the callbacks have already been called at least once
			fired: function() {
				return !!fired;
			}
		};

	return self;
};


function Identity( v ) {
	return v;
}
function Thrower( ex ) {
	throw ex;
}

function adoptValue( value, resolve, reject, noValue ) {
	var method;

	try {

		// Check for promise aspect first to privilege synchronous behavior
		if ( value && isFunction( ( method = value.promise ) ) ) {
			method.call( value ).done( resolve ).fail( reject );

		// Other thenables
		} else if ( value && isFunction( ( method = value.then ) ) ) {
			method.call( value, resolve, reject );

		// Other non-thenables
		} else {

			// Control `resolve` arguments by letting Array#slice cast boolean `noValue` to integer:
			// * false: [ value ].slice( 0 ) => resolve( value )
			// * true: [ value ].slice( 1 ) => resolve()
			resolve.apply( undefined, [ value ].slice( noValue ) );
		}

	// For Promises/A+, convert exceptions into rejections
	// Since jQuery.when doesn't unwrap thenables, we can skip the extra checks appearing in
	// Deferred#then to conditionally suppress rejection.
	} catch ( value ) {

		// Support: Android 4.0 only
		// Strict mode functions invoked without .call/.apply get global-object context
		reject.apply( undefined, [ value ] );
	}
}

jQuery.extend( {

	Deferred: function( func ) {
		var tuples = [

				// action, add listener, callbacks,
				// ... .then handlers, argument index, [final state]
				[ "notify", "progress", jQuery.Callbacks( "memory" ),
					jQuery.Callbacks( "memory" ), 2 ],
				[ "resolve", "done", jQuery.Callbacks( "once memory" ),
					jQuery.Callbacks( "once memory" ), 0, "resolved" ],
				[ "reject", "fail", jQuery.Callbacks( "once memory" ),
					jQuery.Callbacks( "once memory" ), 1, "rejected" ]
			],
			state = "pending",
			promise = {
				state: function() {
					return state;
				},
				always: function() {
					deferred.done( arguments ).fail( arguments );
					return this;
				},
				"catch": function( fn ) {
					return promise.then( null, fn );
				},

				// Keep pipe for back-compat
				pipe: function( /* fnDone, fnFail, fnProgress */ ) {
					var fns = arguments;

					return jQuery.Deferred( function( newDefer ) {
						jQuery.each( tuples, function( i, tuple ) {

							// Map tuples (progress, done, fail) to arguments (done, fail, progress)
							var fn = isFunction( fns[ tuple[ 4 ] ] ) && fns[ tuple[ 4 ] ];

							// deferred.progress(function() { bind to newDefer or newDefer.notify })
							// deferred.done(function() { bind to newDefer or newDefer.resolve })
							// deferred.fail(function() { bind to newDefer or newDefer.reject })
							deferred[ tuple[ 1 ] ]( function() {
								var returned = fn && fn.apply( this, arguments );
								if ( returned && isFunction( returned.promise ) ) {
									returned.promise()
										.progress( newDefer.notify )
										.done( newDefer.resolve )
										.fail( newDefer.reject );
								} else {
									newDefer[ tuple[ 0 ] + "With" ](
										this,
										fn ? [ returned ] : arguments
									);
								}
							} );
						} );
						fns = null;
					} ).promise();
				},
				then: function( onFulfilled, onRejected, onProgress ) {
					var maxDepth = 0;
					function resolve( depth, deferred, handler, special ) {
						return function() {
							var that = this,
								args = arguments,
								mightThrow = function() {
									var returned, then;

									// Support: Promises/A+ section 2.3.3.3.3
									// https://promisesaplus.com/#point-59
									// Ignore double-resolution attempts
									if ( depth < maxDepth ) {
										return;
									}

									returned = handler.apply( that, args );

									// Support: Promises/A+ section 2.3.1
									// https://promisesaplus.com/#point-48
									if ( returned === deferred.promise() ) {
										throw new TypeError( "Thenable self-resolution" );
									}

									// Support: Promises/A+ sections 2.3.3.1, 3.5
									// https://promisesaplus.com/#point-54
									// https://promisesaplus.com/#point-75
									// Retrieve `then` only once
									then = returned &&

										// Support: Promises/A+ section 2.3.4
										// https://promisesaplus.com/#point-64
										// Only check objects and functions for thenability
										( typeof returned === "object" ||
											typeof returned === "function" ) &&
										returned.then;

									// Handle a returned thenable
									if ( isFunction( then ) ) {

										// Special processors (notify) just wait for resolution
										if ( special ) {
											then.call(
												returned,
												resolve( maxDepth, deferred, Identity, special ),
												resolve( maxDepth, deferred, Thrower, special )
											);

										// Normal processors (resolve) also hook into progress
										} else {

											// ...and disregard older resolution values
											maxDepth++;

											then.call(
												returned,
												resolve( maxDepth, deferred, Identity, special ),
												resolve( maxDepth, deferred, Thrower, special ),
												resolve( maxDepth, deferred, Identity,
													deferred.notifyWith )
											);
										}

									// Handle all other returned values
									} else {

										// Only substitute handlers pass on context
										// and multiple values (non-spec behavior)
										if ( handler !== Identity ) {
											that = undefined;
											args = [ returned ];
										}

										// Process the value(s)
										// Default process is resolve
										( special || deferred.resolveWith )( that, args );
									}
								},

								// Only normal processors (resolve) catch and reject exceptions
								process = special ?
									mightThrow :
									function() {
										try {
											mightThrow();
										} catch ( e ) {

											if ( jQuery.Deferred.exceptionHook ) {
												jQuery.Deferred.exceptionHook( e,
													process.stackTrace );
											}

											// Support: Promises/A+ section 2.3.3.3.4.1
											// https://promisesaplus.com/#point-61
											// Ignore post-resolution exceptions
											if ( depth + 1 >= maxDepth ) {

												// Only substitute handlers pass on context
												// and multiple values (non-spec behavior)
												if ( handler !== Thrower ) {
													that = undefined;
													args = [ e ];
												}

												deferred.rejectWith( that, args );
											}
										}
									};

							// Support: Promises/A+ section 2.3.3.3.1
							// https://promisesaplus.com/#point-57
							// Re-resolve promises immediately to dodge false rejection from
							// subsequent errors
							if ( depth ) {
								process();
							} else {

								// Call an optional hook to record the stack, in case of exception
								// since it's otherwise lost when execution goes async
								if ( jQuery.Deferred.getStackHook ) {
									process.stackTrace = jQuery.Deferred.getStackHook();
								}
								window.setTimeout( process );
							}
						};
					}

					return jQuery.Deferred( function( newDefer ) {

						// progress_handlers.add( ... )
						tuples[ 0 ][ 3 ].add(
							resolve(
								0,
								newDefer,
								isFunction( onProgress ) ?
									onProgress :
									Identity,
								newDefer.notifyWith
							)
						);

						// fulfilled_handlers.add( ... )
						tuples[ 1 ][ 3 ].add(
							resolve(
								0,
								newDefer,
								isFunction( onFulfilled ) ?
									onFulfilled :
									Identity
							)
						);

						// rejected_handlers.add( ... )
						tuples[ 2 ][ 3 ].add(
							resolve(
								0,
								newDefer,
								isFunction( onRejected ) ?
									onRejected :
									Thrower
							)
						);
					} ).promise();
				},

				// Get a promise for this deferred
				// If obj is provided, the promise aspect is added to the object
				promise: function( obj ) {
					return obj != null ? jQuery.extend( obj, promise ) : promise;
				}
			},
			deferred = {};

		// Add list-specific methods
		jQuery.each( tuples, function( i, tuple ) {
			var list = tuple[ 2 ],
				stateString = tuple[ 5 ];

			// promise.progress = list.add
			// promise.done = list.add
			// promise.fail = list.add
			promise[ tuple[ 1 ] ] = list.add;

			// Handle state
			if ( stateString ) {
				list.add(
					function() {

						// state = "resolved" (i.e., fulfilled)
						// state = "rejected"
						state = stateString;
					},

					// rejected_callbacks.disable
					// fulfilled_callbacks.disable
					tuples[ 3 - i ][ 2 ].disable,

					// rejected_handlers.disable
					// fulfilled_handlers.disable
					tuples[ 3 - i ][ 3 ].disable,

					// progress_callbacks.lock
					tuples[ 0 ][ 2 ].lock,

					// progress_handlers.lock
					tuples[ 0 ][ 3 ].lock
				);
			}

			// progress_handlers.fire
			// fulfilled_handlers.fire
			// rejected_handlers.fire
			list.add( tuple[ 3 ].fire );

			// deferred.notify = function() { deferred.notifyWith(...) }
			// deferred.resolve = function() { deferred.resolveWith(...) }
			// deferred.reject = function() { deferred.rejectWith(...) }
			deferred[ tuple[ 0 ] ] = function() {
				deferred[ tuple[ 0 ] + "With" ]( this === deferred ? undefined : this, arguments );
				return this;
			};

			// deferred.notifyWith = list.fireWith
			// deferred.resolveWith = list.fireWith
			// deferred.rejectWith = list.fireWith
			deferred[ tuple[ 0 ] + "With" ] = list.fireWith;
		} );

		// Make the deferred a promise
		promise.promise( deferred );

		// Call given func if any
		if ( func ) {
			func.call( deferred, deferred );
		}

		// All done!
		return deferred;
	},

	// Deferred helper
	when: function( singleValue ) {
		var

			// count of uncompleted subordinates
			remaining = arguments.length,

			// count of unprocessed arguments
			i = remaining,

			// subordinate fulfillment data
			resolveContexts = Array( i ),
			resolveValues = slice.call( arguments ),

			// the master Deferred
			master = jQuery.Deferred(),

			// subordinate callback factory
			updateFunc = function( i ) {
				return function( value ) {
					resolveContexts[ i ] = this;
					resolveValues[ i ] = arguments.length > 1 ? slice.call( arguments ) : value;
					if ( !( --remaining ) ) {
						master.resolveWith( resolveContexts, resolveValues );
					}
				};
			};

		// Single- and empty arguments are adopted like Promise.resolve
		if ( remaining <= 1 ) {
			adoptValue( singleValue, master.done( updateFunc( i ) ).resolve, master.reject,
				!remaining );

			// Use .then() to unwrap secondary thenables (cf. gh-3000)
			if ( master.state() === "pending" ||
				isFunction( resolveValues[ i ] && resolveValues[ i ].then ) ) {

				return master.then();
			}
		}

		// Multiple arguments are aggregated like Promise.all array elements
		while ( i-- ) {
			adoptValue( resolveValues[ i ], updateFunc( i ), master.reject );
		}

		return master.promise();
	}
} );


// These usually indicate a programmer mistake during development,
// warn about them ASAP rather than swallowing them by default.
var rerrorNames = /^(Eval|Internal|Range|Reference|Syntax|Type|URI)Error$/;

jQuery.Deferred.exceptionHook = function( error, stack ) {

	// Support: IE 8 - 9 only
	// Console exists when dev tools are open, which can happen at any time
	if ( window.console && window.console.warn && error && rerrorNames.test( error.name ) ) {
		window.console.warn( "jQuery.Deferred exception: " + error.message, error.stack, stack );
	}
};




jQuery.readyException = function( error ) {
	window.setTimeout( function() {
		throw error;
	} );
};




// The deferred used on DOM ready
var readyList = jQuery.Deferred();

jQuery.fn.ready = function( fn ) {

	readyList
		.then( fn )

		// Wrap jQuery.readyException in a function so that the lookup
		// happens at the time of error handling instead of callback
		// registration.
		.catch( function( error ) {
			jQuery.readyException( error );
		} );

	return this;
};

jQuery.extend( {

	// Is the DOM ready to be used? Set to true once it occurs.
	isReady: false,

	// A counter to track how many items to wait for before
	// the ready event fires. See #6781
	readyWait: 1,

	// Handle when the DOM is ready
	ready: function( wait ) {

		// Abort if there are pending holds or we're already ready
		if ( wait === true ? --jQuery.readyWait : jQuery.isReady ) {
			return;
		}

		// Remember that the DOM is ready
		jQuery.isReady = true;

		// If a normal DOM Ready event fired, decrement, and wait if need be
		if ( wait !== true && --jQuery.readyWait > 0 ) {
			return;
		}

		// If there are functions bound, to execute
		readyList.resolveWith( document, [ jQuery ] );
	}
} );

jQuery.ready.then = readyList.then;

// The ready event handler and self cleanup method
function completed() {
	document.removeEventListener( "DOMContentLoaded", completed );
	window.removeEventListener( "load", completed );
	jQuery.ready();
}

// Catch cases where $(document).ready() is called
// after the browser event has already occurred.
// Support: IE <=9 - 10 only
// Older IE sometimes signals "interactive" too soon
if ( document.readyState === "complete" ||
	( document.readyState !== "loading" && !document.documentElement.doScroll ) ) {

	// Handle it asynchronously to allow scripts the opportunity to delay ready
	window.setTimeout( jQuery.ready );

} else {

	// Use the handy event callback
	document.addEventListener( "DOMContentLoaded", completed );

	// A fallback to window.onload, that will always work
	window.addEventListener( "load", completed );
}




// Multifunctional method to get and set values of a collection
// The value/s can optionally be executed if it's a function
var access = function( elems, fn, key, value, chainable, emptyGet, raw ) {
	var i = 0,
		len = elems.length,
		bulk = key == null;

	// Sets many values
	if ( toType( key ) === "object" ) {
		chainable = true;
		for ( i in key ) {
			access( elems, fn, i, key[ i ], true, emptyGet, raw );
		}

	// Sets one value
	} else if ( value !== undefined ) {
		chainable = true;

		if ( !isFunction( value ) ) {
			raw = true;
		}

		if ( bulk ) {

			// Bulk operations run against the entire set
			if ( raw ) {
				fn.call( elems, value );
				fn = null;

			// ...except when executing function values
			} else {
				bulk = fn;
				fn = function( elem, key, value ) {
					return bulk.call( jQuery( elem ), value );
				};
			}
		}

		if ( fn ) {
			for ( ; i < len; i++ ) {
				fn(
					elems[ i ], key, raw ?
					value :
					value.call( elems[ i ], i, fn( elems[ i ], key ) )
				);
			}
		}
	}

	if ( chainable ) {
		return elems;
	}

	// Gets
	if ( bulk ) {
		return fn.call( elems );
	}

	return len ? fn( elems[ 0 ], key ) : emptyGet;
};


// Matches dashed string for camelizing
var rmsPrefix = /^-ms-/,
	rdashAlpha = /-([a-z])/g;

// Used by camelCase as callback to replace()
function fcamelCase( all, letter ) {
	return letter.toUpperCase();
}

// Convert dashed to camelCase; used by the css and data modules
// Support: IE <=9 - 11, Edge 12 - 15
// Microsoft forgot to hump their vendor prefix (#9572)
function camelCase( string ) {
	return string.replace( rmsPrefix, "ms-" ).replace( rdashAlpha, fcamelCase );
}
var acceptData = function( owner ) {

	// Accepts only:
	//  - Node
	//    - Node.ELEMENT_NODE
	//    - Node.DOCUMENT_NODE
	//  - Object
	//    - Any
	return owner.nodeType === 1 || owner.nodeType === 9 || !( +owner.nodeType );
};




function Data() {
	this.expando = jQuery.expando + Data.uid++;
}

Data.uid = 1;

Data.prototype = {

	cache: function( owner ) {

		// Check if the owner object already has a cache
		var value = owner[ this.expando ];

		// If not, create one
		if ( !value ) {
			value = {};

			// We can accept data for non-element nodes in modern browsers,
			// but we should not, see #8335.
			// Always return an empty object.
			if ( acceptData( owner ) ) {

				// If it is a node unlikely to be stringify-ed or looped over
				// use plain assignment
				if ( owner.nodeType ) {
					owner[ this.expando ] = value;

				// Otherwise secure it in a non-enumerable property
				// configurable must be true to allow the property to be
				// deleted when data is removed
				} else {
					Object.defineProperty( owner, this.expando, {
						value: value,
						configurable: true
					} );
				}
			}
		}

		return value;
	},
	set: function( owner, data, value ) {
		var prop,
			cache = this.cache( owner );

		// Handle: [ owner, key, value ] args
		// Always use camelCase key (gh-2257)
		if ( typeof data === "string" ) {
			cache[ camelCase( data ) ] = value;

		// Handle: [ owner, { properties } ] args
		} else {

			// Copy the properties one-by-one to the cache object
			for ( prop in data ) {
				cache[ camelCase( prop ) ] = data[ prop ];
			}
		}
		return cache;
	},
	get: function( owner, key ) {
		return key === undefined ?
			this.cache( owner ) :

			// Always use camelCase key (gh-2257)
			owner[ this.expando ] && owner[ this.expando ][ camelCase( key ) ];
	},
	access: function( owner, key, value ) {

		// In cases where either:
		//
		//   1. No key was specified
		//   2. A string key was specified, but no value provided
		//
		// Take the "read" path and allow the get method to determine
		// which value to return, respectively either:
		//
		//   1. The entire cache object
		//   2. The data stored at the key
		//
		if ( key === undefined ||
				( ( key && typeof key === "string" ) && value === undefined ) ) {

			return this.get( owner, key );
		}

		// When the key is not a string, or both a key and value
		// are specified, set or extend (existing objects) with either:
		//
		//   1. An object of properties
		//   2. A key and value
		//
		this.set( owner, key, value );

		// Since the "set" path can have two possible entry points
		// return the expected data based on which path was taken[*]
		return value !== undefined ? value : key;
	},
	remove: function( owner, key ) {
		var i,
			cache = owner[ this.expando ];

		if ( cache === undefined ) {
			return;
		}

		if ( key !== undefined ) {

			// Support array or space separated string of keys
			if ( Array.isArray( key ) ) {

				// If key is an array of keys...
				// We always set camelCase keys, so remove that.
				key = key.map( camelCase );
			} else {
				key = camelCase( key );

				// If a key with the spaces exists, use it.
				// Otherwise, create an array by matching non-whitespace
				key = key in cache ?
					[ key ] :
					( key.match( rnothtmlwhite ) || [] );
			}

			i = key.length;

			while ( i-- ) {
				delete cache[ key[ i ] ];
			}
		}

		// Remove the expando if there's no more data
		if ( key === undefined || jQuery.isEmptyObject( cache ) ) {

			// Support: Chrome <=35 - 45
			// Webkit & Blink performance suffers when deleting properties
			// from DOM nodes, so set to undefined instead
			// https://bugs.chromium.org/p/chromium/issues/detail?id=378607 (bug restricted)
			if ( owner.nodeType ) {
				owner[ this.expando ] = undefined;
			} else {
				delete owner[ this.expando ];
			}
		}
	},
	hasData: function( owner ) {
		var cache = owner[ this.expando ];
		return cache !== undefined && !jQuery.isEmptyObject( cache );
	}
};
var dataPriv = new Data();

var dataUser = new Data();



//	Implementation Summary
//
//	1. Enforce API surface and semantic compatibility with 1.9.x branch
//	2. Improve the module's maintainability by reducing the storage
//		paths to a single mechanism.
//	3. Use the same single mechanism to support "private" and "user" data.
//	4. _Never_ expose "private" data to user code (TODO: Drop _data, _removeData)
//	5. Avoid exposing implementation details on user objects (eg. expando properties)
//	6. Provide a clear path for implementation upgrade to WeakMap in 2014

var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,
	rmultiDash = /[A-Z]/g;

function getData( data ) {
	if ( data === "true" ) {
		return true;
	}

	if ( data === "false" ) {
		return false;
	}

	if ( data === "null" ) {
		return null;
	}

	// Only convert to a number if it doesn't change the string
	if ( data === +data + "" ) {
		return +data;
	}

	if ( rbrace.test( data ) ) {
		return JSON.parse( data );
	}

	return data;
}

function dataAttr( elem, key, data ) {
	var name;

	// If nothing was found internally, try to fetch any
	// data from the HTML5 data-* attribute
	if ( data === undefined && elem.nodeType === 1 ) {
		name = "data-" + key.replace( rmultiDash, "-$&" ).toLowerCase();
		data = elem.getAttribute( name );

		if ( typeof data === "string" ) {
			try {
				data = getData( data );
			} catch ( e ) {}

			// Make sure we set the data so it isn't changed later
			dataUser.set( elem, key, data );
		} else {
			data = undefined;
		}
	}
	return data;
}

jQuery.extend( {
	hasData: function( elem ) {
		return dataUser.hasData( elem ) || dataPriv.hasData( elem );
	},

	data: function( elem, name, data ) {
		return dataUser.access( elem, name, data );
	},

	removeData: function( elem, name ) {
		dataUser.remove( elem, name );
	},

	// TODO: Now that all calls to _data and _removeData have been replaced
	// with direct calls to dataPriv methods, these can be deprecated.
	_data: function( elem, name, data ) {
		return dataPriv.access( elem, name, data );
	},

	_removeData: function( elem, name ) {
		dataPriv.remove( elem, name );
	}
} );

jQuery.fn.extend( {
	data: function( key, value ) {
		var i, name, data,
			elem = this[ 0 ],
			attrs = elem && elem.attributes;

		// Gets all values
		if ( key === undefined ) {
			if ( this.length ) {
				data = dataUser.get( elem );

				if ( elem.nodeType === 1 && !dataPriv.get( elem, "hasDataAttrs" ) ) {
					i = attrs.length;
					while ( i-- ) {

						// Support: IE 11 only
						// The attrs elements can be null (#14894)
						if ( attrs[ i ] ) {
							name = attrs[ i ].name;
							if ( name.indexOf( "data-" ) === 0 ) {
								name = camelCase( name.slice( 5 ) );
								dataAttr( elem, name, data[ name ] );
							}
						}
					}
					dataPriv.set( elem, "hasDataAttrs", true );
				}
			}

			return data;
		}

		// Sets multiple values
		if ( typeof key === "object" ) {
			return this.each( function() {
				dataUser.set( this, key );
			} );
		}

		return access( this, function( value ) {
			var data;

			// The calling jQuery object (element matches) is not empty
			// (and therefore has an element appears at this[ 0 ]) and the
			// `value` parameter was not undefined. An empty jQuery object
			// will result in `undefined` for elem = this[ 0 ] which will
			// throw an exception if an attempt to read a data cache is made.
			if ( elem && value === undefined ) {

				// Attempt to get data from the cache
				// The key will always be camelCased in Data
				data = dataUser.get( elem, key );
				if ( data !== undefined ) {
					return data;
				}

				// Attempt to "discover" the data in
				// HTML5 custom data-* attrs
				data = dataAttr( elem, key );
				if ( data !== undefined ) {
					return data;
				}

				// We tried really hard, but the data doesn't exist.
				return;
			}

			// Set the data...
			this.each( function() {

				// We always store the camelCased key
				dataUser.set( this, key, value );
			} );
		}, null, value, arguments.length > 1, null, true );
	},

	removeData: function( key ) {
		return this.each( function() {
			dataUser.remove( this, key );
		} );
	}
} );


jQuery.extend( {
	queue: function( elem, type, data ) {
		var queue;

		if ( elem ) {
			type = ( type || "fx" ) + "queue";
			queue = dataPriv.get( elem, type );

			// Speed up dequeue by getting out quickly if this is just a lookup
			if ( data ) {
				if ( !queue || Array.isArray( data ) ) {
					queue = dataPriv.access( elem, type, jQuery.makeArray( data ) );
				} else {
					queue.push( data );
				}
			}
			return queue || [];
		}
	},

	dequeue: function( elem, type ) {
		type = type || "fx";

		var queue = jQuery.queue( elem, type ),
			startLength = queue.length,
			fn = queue.shift(),
			hooks = jQuery._queueHooks( elem, type ),
			next = function() {
				jQuery.dequeue( elem, type );
			};

		// If the fx queue is dequeued, always remove the progress sentinel
		if ( fn === "inprogress" ) {
			fn = queue.shift();
			startLength--;
		}

		if ( fn ) {

			// Add a progress sentinel to prevent the fx queue from being
			// automatically dequeued
			if ( type === "fx" ) {
				queue.unshift( "inprogress" );
			}

			// Clear up the last queue stop function
			delete hooks.stop;
			fn.call( elem, next, hooks );
		}

		if ( !startLength && hooks ) {
			hooks.empty.fire();
		}
	},

	// Not public - generate a queueHooks object, or return the current one
	_queueHooks: function( elem, type ) {
		var key = type + "queueHooks";
		return dataPriv.get( elem, key ) || dataPriv.access( elem, key, {
			empty: jQuery.Callbacks( "once memory" ).add( function() {
				dataPriv.remove( elem, [ type + "queue", key ] );
			} )
		} );
	}
} );

jQuery.fn.extend( {
	queue: function( type, data ) {
		var setter = 2;

		if ( typeof type !== "string" ) {
			data = type;
			type = "fx";
			setter--;
		}

		if ( arguments.length < setter ) {
			return jQuery.queue( this[ 0 ], type );
		}

		return data === undefined ?
			this :
			this.each( function() {
				var queue = jQuery.queue( this, type, data );

				// Ensure a hooks for this queue
				jQuery._queueHooks( this, type );

				if ( type === "fx" && queue[ 0 ] !== "inprogress" ) {
					jQuery.dequeue( this, type );
				}
			} );
	},
	dequeue: function( type ) {
		return this.each( function() {
			jQuery.dequeue( this, type );
		} );
	},
	clearQueue: function( type ) {
		return this.queue( type || "fx", [] );
	},

	// Get a promise resolved when queues of a certain type
	// are emptied (fx is the type by default)
	promise: function( type, obj ) {
		var tmp,
			count = 1,
			defer = jQuery.Deferred(),
			elements = this,
			i = this.length,
			resolve = function() {
				if ( !( --count ) ) {
					defer.resolveWith( elements, [ elements ] );
				}
			};

		if ( typeof type !== "string" ) {
			obj = type;
			type = undefined;
		}
		type = type || "fx";

		while ( i-- ) {
			tmp = dataPriv.get( elements[ i ], type + "queueHooks" );
			if ( tmp && tmp.empty ) {
				count++;
				tmp.empty.add( resolve );
			}
		}
		resolve();
		return defer.promise( obj );
	}
} );
var pnum = ( /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/ ).source;

var rcssNum = new RegExp( "^(?:([+-])=|)(" + pnum + ")([a-z%]*)$", "i" );


var cssExpand = [ "Top", "Right", "Bottom", "Left" ];

var isHiddenWithinTree = function( elem, el ) {

		// isHiddenWithinTree might be called from jQuery#filter function;
		// in that case, element will be second argument
		elem = el || elem;

		// Inline style trumps all
		return elem.style.display === "none" ||
			elem.style.display === "" &&

			// Otherwise, check computed style
			// Support: Firefox <=43 - 45
			// Disconnected elements can have computed display: none, so first confirm that elem is
			// in the document.
			jQuery.contains( elem.ownerDocument, elem ) &&

			jQuery.css( elem, "display" ) === "none";
	};

var swap = function( elem, options, callback, args ) {
	var ret, name,
		old = {};

	// Remember the old values, and insert the new ones
	for ( name in options ) {
		old[ name ] = elem.style[ name ];
		elem.style[ name ] = options[ name ];
	}

	ret = callback.apply( elem, args || [] );

	// Revert the old values
	for ( name in options ) {
		elem.style[ name ] = old[ name ];
	}

	return ret;
};




function adjustCSS( elem, prop, valueParts, tween ) {
	var adjusted, scale,
		maxIterations = 20,
		currentValue = tween ?
			function() {
				return tween.cur();
			} :
			function() {
				return jQuery.css( elem, prop, "" );
			},
		initial = currentValue(),
		unit = valueParts && valueParts[ 3 ] || ( jQuery.cssNumber[ prop ] ? "" : "px" ),

		// Starting value computation is required for potential unit mismatches
		initialInUnit = ( jQuery.cssNumber[ prop ] || unit !== "px" && +initial ) &&
			rcssNum.exec( jQuery.css( elem, prop ) );

	if ( initialInUnit && initialInUnit[ 3 ] !== unit ) {

		// Support: Firefox <=54
		// Halve the iteration target value to prevent interference from CSS upper bounds (gh-2144)
		initial = initial / 2;

		// Trust units reported by jQuery.css
		unit = unit || initialInUnit[ 3 ];

		// Iteratively approximate from a nonzero starting point
		initialInUnit = +initial || 1;

		while ( maxIterations-- ) {

			// Evaluate and update our best guess (doubling guesses that zero out).
			// Finish if the scale equals or crosses 1 (making the old*new product non-positive).
			jQuery.style( elem, prop, initialInUnit + unit );
			if ( ( 1 - scale ) * ( 1 - ( scale = currentValue() / initial || 0.5 ) ) <= 0 ) {
				maxIterations = 0;
			}
			initialInUnit = initialInUnit / scale;

		}

		initialInUnit = initialInUnit * 2;
		jQuery.style( elem, prop, initialInUnit + unit );

		// Make sure we update the tween properties later on
		valueParts = valueParts || [];
	}

	if ( valueParts ) {
		initialInUnit = +initialInUnit || +initial || 0;

		// Apply relative offset (+=/-=) if specified
		adjusted = valueParts[ 1 ] ?
			initialInUnit + ( valueParts[ 1 ] + 1 ) * valueParts[ 2 ] :
			+valueParts[ 2 ];
		if ( tween ) {
			tween.unit = unit;
			tween.start = initialInUnit;
			tween.end = adjusted;
		}
	}
	return adjusted;
}


var defaultDisplayMap = {};

function getDefaultDisplay( elem ) {
	var temp,
		doc = elem.ownerDocument,
		nodeName = elem.nodeName,
		display = defaultDisplayMap[ nodeName ];

	if ( display ) {
		return display;
	}

	temp = doc.body.appendChild( doc.createElement( nodeName ) );
	display = jQuery.css( temp, "display" );

	temp.parentNode.removeChild( temp );

	if ( display === "none" ) {
		display = "block";
	}
	defaultDisplayMap[ nodeName ] = display;

	return display;
}

function showHide( elements, show ) {
	var display, elem,
		values = [],
		index = 0,
		length = elements.length;

	// Determine new display value for elements that need to change
	for ( ; index < length; index++ ) {
		elem = elements[ index ];
		if ( !elem.style ) {
			continue;
		}

		display = elem.style.display;
		if ( show ) {

			// Since we force visibility upon cascade-hidden elements, an immediate (and slow)
			// check is required in this first loop unless we have a nonempty display value (either
			// inline or about-to-be-restored)
			if ( display === "none" ) {
				values[ index ] = dataPriv.get( elem, "display" ) || null;
				if ( !values[ index ] ) {
					elem.style.display = "";
				}
			}
			if ( elem.style.display === "" && isHiddenWithinTree( elem ) ) {
				values[ index ] = getDefaultDisplay( elem );
			}
		} else {
			if ( display !== "none" ) {
				values[ index ] = "none";

				// Remember what we're overwriting
				dataPriv.set( elem, "display", display );
			}
		}
	}

	// Set the display of the elements in a second loop to avoid constant reflow
	for ( index = 0; index < length; index++ ) {
		if ( values[ index ] != null ) {
			elements[ index ].style.display = values[ index ];
		}
	}

	return elements;
}

jQuery.fn.extend( {
	show: function() {
		return showHide( this, true );
	},
	hide: function() {
		return showHide( this );
	},
	toggle: function( state ) {
		if ( typeof state === "boolean" ) {
			return state ? this.show() : this.hide();
		}

		return this.each( function() {
			if ( isHiddenWithinTree( this ) ) {
				jQuery( this ).show();
			} else {
				jQuery( this ).hide();
			}
		} );
	}
} );
var rcheckableType = ( /^(?:checkbox|radio)$/i );

var rtagName = ( /<([a-z][^\/\0>\x20\t\r\n\f]+)/i );

var rscriptType = ( /^$|^module$|\/(?:java|ecma)script/i );



// We have to close these tags to support XHTML (#13200)
var wrapMap = {

	// Support: IE <=9 only
	option: [ 1, "<select multiple='multiple'>", "</select>" ],

	// XHTML parsers do not magically insert elements in the
	// same way that tag soup parsers do. So we cannot shorten
	// this by omitting <tbody> or other required elements.
	thead: [ 1, "<table>", "</table>" ],
	col: [ 2, "<table><colgroup>", "</colgroup></table>" ],
	tr: [ 2, "<table><tbody>", "</tbody></table>" ],
	td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],

	_default: [ 0, "", "" ]
};

// Support: IE <=9 only
wrapMap.optgroup = wrapMap.option;

wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
wrapMap.th = wrapMap.td;


function getAll( context, tag ) {

	// Support: IE <=9 - 11 only
	// Use typeof to avoid zero-argument method invocation on host objects (#15151)
	var ret;

	if ( typeof context.getElementsByTagName !== "undefined" ) {
		ret = context.getElementsByTagName( tag || "*" );

	} else if ( typeof context.querySelectorAll !== "undefined" ) {
		ret = context.querySelectorAll( tag || "*" );

	} else {
		ret = [];
	}

	if ( tag === undefined || tag && nodeName( context, tag ) ) {
		return jQuery.merge( [ context ], ret );
	}

	return ret;
}


// Mark scripts as having already been evaluated
function setGlobalEval( elems, refElements ) {
	var i = 0,
		l = elems.length;

	for ( ; i < l; i++ ) {
		dataPriv.set(
			elems[ i ],
			"globalEval",
			!refElements || dataPriv.get( refElements[ i ], "globalEval" )
		);
	}
}


var rhtml = /<|&#?\w+;/;

function buildFragment( elems, context, scripts, selection, ignored ) {
	var elem, tmp, tag, wrap, contains, j,
		fragment = context.createDocumentFragment(),
		nodes = [],
		i = 0,
		l = elems.length;

	for ( ; i < l; i++ ) {
		elem = elems[ i ];

		if ( elem || elem === 0 ) {

			// Add nodes directly
			if ( toType( elem ) === "object" ) {

				// Support: Android <=4.0 only, PhantomJS 1 only
				// push.apply(_, arraylike) throws on ancient WebKit
				jQuery.merge( nodes, elem.nodeType ? [ elem ] : elem );

			// Convert non-html into a text node
			} else if ( !rhtml.test( elem ) ) {
				nodes.push( context.createTextNode( elem ) );

			// Convert html into DOM nodes
			} else {
				tmp = tmp || fragment.appendChild( context.createElement( "div" ) );

				// Deserialize a standard representation
				tag = ( rtagName.exec( elem ) || [ "", "" ] )[ 1 ].toLowerCase();
				wrap = wrapMap[ tag ] || wrapMap._default;
				tmp.innerHTML = wrap[ 1 ] + jQuery.htmlPrefilter( elem ) + wrap[ 2 ];

				// Descend through wrappers to the right content
				j = wrap[ 0 ];
				while ( j-- ) {
					tmp = tmp.lastChild;
				}

				// Support: Android <=4.0 only, PhantomJS 1 only
				// push.apply(_, arraylike) throws on ancient WebKit
				jQuery.merge( nodes, tmp.childNodes );

				// Remember the top-level container
				tmp = fragment.firstChild;

				// Ensure the created nodes are orphaned (#12392)
				tmp.textContent = "";
			}
		}
	}

	// Remove wrapper from fragment
	fragment.textContent = "";

	i = 0;
	while ( ( elem = nodes[ i++ ] ) ) {

		// Skip elements already in the context collection (trac-4087)
		if ( selection && jQuery.inArray( elem, selection ) > -1 ) {
			if ( ignored ) {
				ignored.push( elem );
			}
			continue;
		}

		contains = jQuery.contains( elem.ownerDocument, elem );

		// Append to fragment
		tmp = getAll( fragment.appendChild( elem ), "script" );

		// Preserve script evaluation history
		if ( contains ) {
			setGlobalEval( tmp );
		}

		// Capture executables
		if ( scripts ) {
			j = 0;
			while ( ( elem = tmp[ j++ ] ) ) {
				if ( rscriptType.test( elem.type || "" ) ) {
					scripts.push( elem );
				}
			}
		}
	}

	return fragment;
}


( function() {
	var fragment = document.createDocumentFragment(),
		div = fragment.appendChild( document.createElement( "div" ) ),
		input = document.createElement( "input" );

	// Support: Android 4.0 - 4.3 only
	// Check state lost if the name is set (#11217)
	// Support: Windows Web Apps (WWA)
	// `name` and `type` must use .setAttribute for WWA (#14901)
	input.setAttribute( "type", "radio" );
	input.setAttribute( "checked", "checked" );
	input.setAttribute( "name", "t" );

	div.appendChild( input );

	// Support: Android <=4.1 only
	// Older WebKit doesn't clone checked state correctly in fragments
	support.checkClone = div.cloneNode( true ).cloneNode( true ).lastChild.checked;

	// Support: IE <=11 only
	// Make sure textarea (and checkbox) defaultValue is properly cloned
	div.innerHTML = "<textarea>x</textarea>";
	support.noCloneChecked = !!div.cloneNode( true ).lastChild.defaultValue;
} )();
var documentElement = document.documentElement;



var
	rkeyEvent = /^key/,
	rmouseEvent = /^(?:mouse|pointer|contextmenu|drag|drop)|click/,
	rtypenamespace = /^([^.]*)(?:\.(.+)|)/;

function returnTrue() {
	return true;
}

function returnFalse() {
	return false;
}

// Support: IE <=9 only
// See #13393 for more info
function safeActiveElement() {
	try {
		return document.activeElement;
	} catch ( err ) { }
}

function on( elem, types, selector, data, fn, one ) {
	var origFn, type;

	// Types can be a map of types/handlers
	if ( typeof types === "object" ) {

		// ( types-Object, selector, data )
		if ( typeof selector !== "string" ) {

			// ( types-Object, data )
			data = data || selector;
			selector = undefined;
		}
		for ( type in types ) {
			on( elem, type, selector, data, types[ type ], one );
		}
		return elem;
	}

	if ( data == null && fn == null ) {

		// ( types, fn )
		fn = selector;
		data = selector = undefined;
	} else if ( fn == null ) {
		if ( typeof selector === "string" ) {

			// ( types, selector, fn )
			fn = data;
			data = undefined;
		} else {

			// ( types, data, fn )
			fn = data;
			data = selector;
			selector = undefined;
		}
	}
	if ( fn === false ) {
		fn = returnFalse;
	} else if ( !fn ) {
		return elem;
	}

	if ( one === 1 ) {
		origFn = fn;
		fn = function( event ) {

			// Can use an empty set, since event contains the info
			jQuery().off( event );
			return origFn.apply( this, arguments );
		};

		// Use same guid so caller can remove using origFn
		fn.guid = origFn.guid || ( origFn.guid = jQuery.guid++ );
	}
	return elem.each( function() {
		jQuery.event.add( this, types, fn, data, selector );
	} );
}

/*
 * Helper functions for managing events -- not part of the public interface.
 * Props to Dean Edwards' addEvent library for many of the ideas.
 */
jQuery.event = {

	global: {},

	add: function( elem, types, handler, data, selector ) {

		var handleObjIn, eventHandle, tmp,
			events, t, handleObj,
			special, handlers, type, namespaces, origType,
			elemData = dataPriv.get( elem );

		// Don't attach events to noData or text/comment nodes (but allow plain objects)
		if ( !elemData ) {
			return;
		}

		// Caller can pass in an object of custom data in lieu of the handler
		if ( handler.handler ) {
			handleObjIn = handler;
			handler = handleObjIn.handler;
			selector = handleObjIn.selector;
		}

		// Ensure that invalid selectors throw exceptions at attach time
		// Evaluate against documentElement in case elem is a non-element node (e.g., document)
		if ( selector ) {
			jQuery.find.matchesSelector( documentElement, selector );
		}

		// Make sure that the handler has a unique ID, used to find/remove it later
		if ( !handler.guid ) {
			handler.guid = jQuery.guid++;
		}

		// Init the element's event structure and main handler, if this is the first
		if ( !( events = elemData.events ) ) {
			events = elemData.events = {};
		}
		if ( !( eventHandle = elemData.handle ) ) {
			eventHandle = elemData.handle = function( e ) {

				// Discard the second event of a jQuery.event.trigger() and
				// when an event is called after a page has unloaded
				return typeof jQuery !== "undefined" && jQuery.event.triggered !== e.type ?
					jQuery.event.dispatch.apply( elem, arguments ) : undefined;
			};
		}

		// Handle multiple events separated by a space
		types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
		t = types.length;
		while ( t-- ) {
			tmp = rtypenamespace.exec( types[ t ] ) || [];
			type = origType = tmp[ 1 ];
			namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

			// There *must* be a type, no attaching namespace-only handlers
			if ( !type ) {
				continue;
			}

			// If event changes its type, use the special event handlers for the changed type
			special = jQuery.event.special[ type ] || {};

			// If selector defined, determine special event api type, otherwise given type
			type = ( selector ? special.delegateType : special.bindType ) || type;

			// Update special based on newly reset type
			special = jQuery.event.special[ type ] || {};

			// handleObj is passed to all event handlers
			handleObj = jQuery.extend( {
				type: type,
				origType: origType,
				data: data,
				handler: handler,
				guid: handler.guid,
				selector: selector,
				needsContext: selector && jQuery.expr.match.needsContext.test( selector ),
				namespace: namespaces.join( "." )
			}, handleObjIn );

			// Init the event handler queue if we're the first
			if ( !( handlers = events[ type ] ) ) {
				handlers = events[ type ] = [];
				handlers.delegateCount = 0;

				// Only use addEventListener if the special events handler returns false
				if ( !special.setup ||
					special.setup.call( elem, data, namespaces, eventHandle ) === false ) {

					if ( elem.addEventListener ) {
						elem.addEventListener( type, eventHandle );
					}
				}
			}

			if ( special.add ) {
				special.add.call( elem, handleObj );

				if ( !handleObj.handler.guid ) {
					handleObj.handler.guid = handler.guid;
				}
			}

			// Add to the element's handler list, delegates in front
			if ( selector ) {
				handlers.splice( handlers.delegateCount++, 0, handleObj );
			} else {
				handlers.push( handleObj );
			}

			// Keep track of which events have ever been used, for event optimization
			jQuery.event.global[ type ] = true;
		}

	},

	// Detach an event or set of events from an element
	remove: function( elem, types, handler, selector, mappedTypes ) {

		var j, origCount, tmp,
			events, t, handleObj,
			special, handlers, type, namespaces, origType,
			elemData = dataPriv.hasData( elem ) && dataPriv.get( elem );

		if ( !elemData || !( events = elemData.events ) ) {
			return;
		}

		// Once for each type.namespace in types; type may be omitted
		types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
		t = types.length;
		while ( t-- ) {
			tmp = rtypenamespace.exec( types[ t ] ) || [];
			type = origType = tmp[ 1 ];
			namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

			// Unbind all events (on this namespace, if provided) for the element
			if ( !type ) {
				for ( type in events ) {
					jQuery.event.remove( elem, type + types[ t ], handler, selector, true );
				}
				continue;
			}

			special = jQuery.event.special[ type ] || {};
			type = ( selector ? special.delegateType : special.bindType ) || type;
			handlers = events[ type ] || [];
			tmp = tmp[ 2 ] &&
				new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" );

			// Remove matching events
			origCount = j = handlers.length;
			while ( j-- ) {
				handleObj = handlers[ j ];

				if ( ( mappedTypes || origType === handleObj.origType ) &&
					( !handler || handler.guid === handleObj.guid ) &&
					( !tmp || tmp.test( handleObj.namespace ) ) &&
					( !selector || selector === handleObj.selector ||
						selector === "**" && handleObj.selector ) ) {
					handlers.splice( j, 1 );

					if ( handleObj.selector ) {
						handlers.delegateCount--;
					}
					if ( special.remove ) {
						special.remove.call( elem, handleObj );
					}
				}
			}

			// Remove generic event handler if we removed something and no more handlers exist
			// (avoids potential for endless recursion during removal of special event handlers)
			if ( origCount && !handlers.length ) {
				if ( !special.teardown ||
					special.teardown.call( elem, namespaces, elemData.handle ) === false ) {

					jQuery.removeEvent( elem, type, elemData.handle );
				}

				delete events[ type ];
			}
		}

		// Remove data and the expando if it's no longer used
		if ( jQuery.isEmptyObject( events ) ) {
			dataPriv.remove( elem, "handle events" );
		}
	},

	dispatch: function( nativeEvent ) {

		// Make a writable jQuery.Event from the native event object
		var event = jQuery.event.fix( nativeEvent );

		var i, j, ret, matched, handleObj, handlerQueue,
			args = new Array( arguments.length ),
			handlers = ( dataPriv.get( this, "events" ) || {} )[ event.type ] || [],
			special = jQuery.event.special[ event.type ] || {};

		// Use the fix-ed jQuery.Event rather than the (read-only) native event
		args[ 0 ] = event;

		for ( i = 1; i < arguments.length; i++ ) {
			args[ i ] = arguments[ i ];
		}

		event.delegateTarget = this;

		// Call the preDispatch hook for the mapped type, and let it bail if desired
		if ( special.preDispatch && special.preDispatch.call( this, event ) === false ) {
			return;
		}

		// Determine handlers
		handlerQueue = jQuery.event.handlers.call( this, event, handlers );

		// Run delegates first; they may want to stop propagation beneath us
		i = 0;
		while ( ( matched = handlerQueue[ i++ ] ) && !event.isPropagationStopped() ) {
			event.currentTarget = matched.elem;

			j = 0;
			while ( ( handleObj = matched.handlers[ j++ ] ) &&
				!event.isImmediatePropagationStopped() ) {

				// Triggered event must either 1) have no namespace, or 2) have namespace(s)
				// a subset or equal to those in the bound event (both can have no namespace).
				if ( !event.rnamespace || event.rnamespace.test( handleObj.namespace ) ) {

					event.handleObj = handleObj;
					event.data = handleObj.data;

					ret = ( ( jQuery.event.special[ handleObj.origType ] || {} ).handle ||
						handleObj.handler ).apply( matched.elem, args );

					if ( ret !== undefined ) {
						if ( ( event.result = ret ) === false ) {
							event.preventDefault();
							event.stopPropagation();
						}
					}
				}
			}
		}

		// Call the postDispatch hook for the mapped type
		if ( special.postDispatch ) {
			special.postDispatch.call( this, event );
		}

		return event.result;
	},

	handlers: function( event, handlers ) {
		var i, handleObj, sel, matchedHandlers, matchedSelectors,
			handlerQueue = [],
			delegateCount = handlers.delegateCount,
			cur = event.target;

		// Find delegate handlers
		if ( delegateCount &&

			// Support: IE <=9
			// Black-hole SVG <use> instance trees (trac-13180)
			cur.nodeType &&

			// Support: Firefox <=42
			// Suppress spec-violating clicks indicating a non-primary pointer button (trac-3861)
			// https://www.w3.org/TR/DOM-Level-3-Events/#event-type-click
			// Support: IE 11 only
			// ...but not arrow key "clicks" of radio inputs, which can have `button` -1 (gh-2343)
			!( event.type === "click" && event.button >= 1 ) ) {

			for ( ; cur !== this; cur = cur.parentNode || this ) {

				// Don't check non-elements (#13208)
				// Don't process clicks on disabled elements (#6911, #8165, #11382, #11764)
				if ( cur.nodeType === 1 && !( event.type === "click" && cur.disabled === true ) ) {
					matchedHandlers = [];
					matchedSelectors = {};
					for ( i = 0; i < delegateCount; i++ ) {
						handleObj = handlers[ i ];

						// Don't conflict with Object.prototype properties (#13203)
						sel = handleObj.selector + " ";

						if ( matchedSelectors[ sel ] === undefined ) {
							matchedSelectors[ sel ] = handleObj.needsContext ?
								jQuery( sel, this ).index( cur ) > -1 :
								jQuery.find( sel, this, null, [ cur ] ).length;
						}
						if ( matchedSelectors[ sel ] ) {
							matchedHandlers.push( handleObj );
						}
					}
					if ( matchedHandlers.length ) {
						handlerQueue.push( { elem: cur, handlers: matchedHandlers } );
					}
				}
			}
		}

		// Add the remaining (directly-bound) handlers
		cur = this;
		if ( delegateCount < handlers.length ) {
			handlerQueue.push( { elem: cur, handlers: handlers.slice( delegateCount ) } );
		}

		return handlerQueue;
	},

	addProp: function( name, hook ) {
		Object.defineProperty( jQuery.Event.prototype, name, {
			enumerable: true,
			configurable: true,

			get: isFunction( hook ) ?
				function() {
					if ( this.originalEvent ) {
							return hook( this.originalEvent );
					}
				} :
				function() {
					if ( this.originalEvent ) {
							return this.originalEvent[ name ];
					}
				},

			set: function( value ) {
				Object.defineProperty( this, name, {
					enumerable: true,
					configurable: true,
					writable: true,
					value: value
				} );
			}
		} );
	},

	fix: function( originalEvent ) {
		return originalEvent[ jQuery.expando ] ?
			originalEvent :
			new jQuery.Event( originalEvent );
	},

	special: {
		load: {

			// Prevent triggered image.load events from bubbling to window.load
			noBubble: true
		},
		focus: {

			// Fire native event if possible so blur/focus sequence is correct
			trigger: function() {
				if ( this !== safeActiveElement() && this.focus ) {
					this.focus();
					return false;
				}
			},
			delegateType: "focusin"
		},
		blur: {
			trigger: function() {
				if ( this === safeActiveElement() && this.blur ) {
					this.blur();
					return false;
				}
			},
			delegateType: "focusout"
		},
		click: {

			// For checkbox, fire native event so checked state will be right
			trigger: function() {
				if ( this.type === "checkbox" && this.click && nodeName( this, "input" ) ) {
					this.click();
					return false;
				}
			},

			// For cross-browser consistency, don't fire native .click() on links
			_default: function( event ) {
				return nodeName( event.target, "a" );
			}
		},

		beforeunload: {
			postDispatch: function( event ) {

				// Support: Firefox 20+
				// Firefox doesn't alert if the returnValue field is not set.
				if ( event.result !== undefined && event.originalEvent ) {
					event.originalEvent.returnValue = event.result;
				}
			}
		}
	}
};

jQuery.removeEvent = function( elem, type, handle ) {

	// This "if" is needed for plain objects
	if ( elem.removeEventListener ) {
		elem.removeEventListener( type, handle );
	}
};

jQuery.Event = function( src, props ) {

	// Allow instantiation without the 'new' keyword
	if ( !( this instanceof jQuery.Event ) ) {
		return new jQuery.Event( src, props );
	}

	// Event object
	if ( src && src.type ) {
		this.originalEvent = src;
		this.type = src.type;

		// Events bubbling up the document may have been marked as prevented
		// by a handler lower down the tree; reflect the correct value.
		this.isDefaultPrevented = src.defaultPrevented ||
				src.defaultPrevented === undefined &&

				// Support: Android <=2.3 only
				src.returnValue === false ?
			returnTrue :
			returnFalse;

		// Create target properties
		// Support: Safari <=6 - 7 only
		// Target should not be a text node (#504, #13143)
		this.target = ( src.target && src.target.nodeType === 3 ) ?
			src.target.parentNode :
			src.target;

		this.currentTarget = src.currentTarget;
		this.relatedTarget = src.relatedTarget;

	// Event type
	} else {
		this.type = src;
	}

	// Put explicitly provided properties onto the event object
	if ( props ) {
		jQuery.extend( this, props );
	}

	// Create a timestamp if incoming event doesn't have one
	this.timeStamp = src && src.timeStamp || Date.now();

	// Mark it as fixed
	this[ jQuery.expando ] = true;
};

// jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
// https://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
jQuery.Event.prototype = {
	constructor: jQuery.Event,
	isDefaultPrevented: returnFalse,
	isPropagationStopped: returnFalse,
	isImmediatePropagationStopped: returnFalse,
	isSimulated: false,

	preventDefault: function() {
		var e = this.originalEvent;

		this.isDefaultPrevented = returnTrue;

		if ( e && !this.isSimulated ) {
			e.preventDefault();
		}
	},
	stopPropagation: function() {
		var e = this.originalEvent;

		this.isPropagationStopped = returnTrue;

		if ( e && !this.isSimulated ) {
			e.stopPropagation();
		}
	},
	stopImmediatePropagation: function() {
		var e = this.originalEvent;

		this.isImmediatePropagationStopped = returnTrue;

		if ( e && !this.isSimulated ) {
			e.stopImmediatePropagation();
		}

		this.stopPropagation();
	}
};

// Includes all common event props including KeyEvent and MouseEvent specific props
jQuery.each( {
	altKey: true,
	bubbles: true,
	cancelable: true,
	changedTouches: true,
	ctrlKey: true,
	detail: true,
	eventPhase: true,
	metaKey: true,
	pageX: true,
	pageY: true,
	shiftKey: true,
	view: true,
	"char": true,
	charCode: true,
	key: true,
	keyCode: true,
	button: true,
	buttons: true,
	clientX: true,
	clientY: true,
	offsetX: true,
	offsetY: true,
	pointerId: true,
	pointerType: true,
	screenX: true,
	screenY: true,
	targetTouches: true,
	toElement: true,
	touches: true,

	which: function( event ) {
		var button = event.button;

		// Add which for key events
		if ( event.which == null && rkeyEvent.test( event.type ) ) {
			return event.charCode != null ? event.charCode : event.keyCode;
		}

		// Add which for click: 1 === left; 2 === middle; 3 === right
		if ( !event.which && button !== undefined && rmouseEvent.test( event.type ) ) {
			if ( button & 1 ) {
				return 1;
			}

			if ( button & 2 ) {
				return 3;
			}

			if ( button & 4 ) {
				return 2;
			}

			return 0;
		}

		return event.which;
	}
}, jQuery.event.addProp );

// Create mouseenter/leave events using mouseover/out and event-time checks
// so that event delegation works in jQuery.
// Do the same for pointerenter/pointerleave and pointerover/pointerout
//
// Support: Safari 7 only
// Safari sends mouseenter too often; see:
// https://bugs.chromium.org/p/chromium/issues/detail?id=470258
// for the description of the bug (it existed in older Chrome versions as well).
jQuery.each( {
	mouseenter: "mouseover",
	mouseleave: "mouseout",
	pointerenter: "pointerover",
	pointerleave: "pointerout"
}, function( orig, fix ) {
	jQuery.event.special[ orig ] = {
		delegateType: fix,
		bindType: fix,

		handle: function( event ) {
			var ret,
				target = this,
				related = event.relatedTarget,
				handleObj = event.handleObj;

			// For mouseenter/leave call the handler if related is outside the target.
			// NB: No relatedTarget if the mouse left/entered the browser window
			if ( !related || ( related !== target && !jQuery.contains( target, related ) ) ) {
				event.type = handleObj.origType;
				ret = handleObj.handler.apply( this, arguments );
				event.type = fix;
			}
			return ret;
		}
	};
} );

jQuery.fn.extend( {

	on: function( types, selector, data, fn ) {
		return on( this, types, selector, data, fn );
	},
	one: function( types, selector, data, fn ) {
		return on( this, types, selector, data, fn, 1 );
	},
	off: function( types, selector, fn ) {
		var handleObj, type;
		if ( types && types.preventDefault && types.handleObj ) {

			// ( event )  dispatched jQuery.Event
			handleObj = types.handleObj;
			jQuery( types.delegateTarget ).off(
				handleObj.namespace ?
					handleObj.origType + "." + handleObj.namespace :
					handleObj.origType,
				handleObj.selector,
				handleObj.handler
			);
			return this;
		}
		if ( typeof types === "object" ) {

			// ( types-object [, selector] )
			for ( type in types ) {
				this.off( type, selector, types[ type ] );
			}
			return this;
		}
		if ( selector === false || typeof selector === "function" ) {

			// ( types [, fn] )
			fn = selector;
			selector = undefined;
		}
		if ( fn === false ) {
			fn = returnFalse;
		}
		return this.each( function() {
			jQuery.event.remove( this, types, fn, selector );
		} );
	}
} );


var

	/* eslint-disable max-len */

	// See https://github.com/eslint/eslint/issues/3229
	rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([a-z][^\/\0>\x20\t\r\n\f]*)[^>]*)\/>/gi,

	/* eslint-enable */

	// Support: IE <=10 - 11, Edge 12 - 13 only
	// In IE/Edge using regex groups here causes severe slowdowns.
	// See https://connect.microsoft.com/IE/feedback/details/1736512/
	rnoInnerhtml = /<script|<style|<link/i,

	// checked="checked" or checked
	rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,
	rcleanScript = /^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g;

// Prefer a tbody over its parent table for containing new rows
function manipulationTarget( elem, content ) {
	if ( nodeName( elem, "table" ) &&
		nodeName( content.nodeType !== 11 ? content : content.firstChild, "tr" ) ) {

		return jQuery( elem ).children( "tbody" )[ 0 ] || elem;
	}

	return elem;
}

// Replace/restore the type attribute of script elements for safe DOM manipulation
function disableScript( elem ) {
	elem.type = ( elem.getAttribute( "type" ) !== null ) + "/" + elem.type;
	return elem;
}
function restoreScript( elem ) {
	if ( ( elem.type || "" ).slice( 0, 5 ) === "true/" ) {
		elem.type = elem.type.slice( 5 );
	} else {
		elem.removeAttribute( "type" );
	}

	return elem;
}

function cloneCopyEvent( src, dest ) {
	var i, l, type, pdataOld, pdataCur, udataOld, udataCur, events;

	if ( dest.nodeType !== 1 ) {
		return;
	}

	// 1. Copy private data: events, handlers, etc.
	if ( dataPriv.hasData( src ) ) {
		pdataOld = dataPriv.access( src );
		pdataCur = dataPriv.set( dest, pdataOld );
		events = pdataOld.events;

		if ( events ) {
			delete pdataCur.handle;
			pdataCur.events = {};

			for ( type in events ) {
				for ( i = 0, l = events[ type ].length; i < l; i++ ) {
					jQuery.event.add( dest, type, events[ type ][ i ] );
				}
			}
		}
	}

	// 2. Copy user data
	if ( dataUser.hasData( src ) ) {
		udataOld = dataUser.access( src );
		udataCur = jQuery.extend( {}, udataOld );

		dataUser.set( dest, udataCur );
	}
}

// Fix IE bugs, see support tests
function fixInput( src, dest ) {
	var nodeName = dest.nodeName.toLowerCase();

	// Fails to persist the checked state of a cloned checkbox or radio button.
	if ( nodeName === "input" && rcheckableType.test( src.type ) ) {
		dest.checked = src.checked;

	// Fails to return the selected option to the default selected state when cloning options
	} else if ( nodeName === "input" || nodeName === "textarea" ) {
		dest.defaultValue = src.defaultValue;
	}
}

function domManip( collection, args, callback, ignored ) {

	// Flatten any nested arrays
	args = concat.apply( [], args );

	var fragment, first, scripts, hasScripts, node, doc,
		i = 0,
		l = collection.length,
		iNoClone = l - 1,
		value = args[ 0 ],
		valueIsFunction = isFunction( value );

	// We can't cloneNode fragments that contain checked, in WebKit
	if ( valueIsFunction ||
			( l > 1 && typeof value === "string" &&
				!support.checkClone && rchecked.test( value ) ) ) {
		return collection.each( function( index ) {
			var self = collection.eq( index );
			if ( valueIsFunction ) {
				args[ 0 ] = value.call( this, index, self.html() );
			}
			domManip( self, args, callback, ignored );
		} );
	}

	if ( l ) {
		fragment = buildFragment( args, collection[ 0 ].ownerDocument, false, collection, ignored );
		first = fragment.firstChild;

		if ( fragment.childNodes.length === 1 ) {
			fragment = first;
		}

		// Require either new content or an interest in ignored elements to invoke the callback
		if ( first || ignored ) {
			scripts = jQuery.map( getAll( fragment, "script" ), disableScript );
			hasScripts = scripts.length;

			// Use the original fragment for the last item
			// instead of the first because it can end up
			// being emptied incorrectly in certain situations (#8070).
			for ( ; i < l; i++ ) {
				node = fragment;

				if ( i !== iNoClone ) {
					node = jQuery.clone( node, true, true );

					// Keep references to cloned scripts for later restoration
					if ( hasScripts ) {

						// Support: Android <=4.0 only, PhantomJS 1 only
						// push.apply(_, arraylike) throws on ancient WebKit
						jQuery.merge( scripts, getAll( node, "script" ) );
					}
				}

				callback.call( collection[ i ], node, i );
			}

			if ( hasScripts ) {
				doc = scripts[ scripts.length - 1 ].ownerDocument;

				// Reenable scripts
				jQuery.map( scripts, restoreScript );

				// Evaluate executable scripts on first document insertion
				for ( i = 0; i < hasScripts; i++ ) {
					node = scripts[ i ];
					if ( rscriptType.test( node.type || "" ) &&
						!dataPriv.access( node, "globalEval" ) &&
						jQuery.contains( doc, node ) ) {

						if ( node.src && ( node.type || "" ).toLowerCase()  !== "module" ) {

							// Optional AJAX dependency, but won't run scripts if not present
							if ( jQuery._evalUrl ) {
								jQuery._evalUrl( node.src );
							}
						} else {
							DOMEval( node.textContent.replace( rcleanScript, "" ), doc, node );
						}
					}
				}
			}
		}
	}

	return collection;
}

function remove( elem, selector, keepData ) {
	var node,
		nodes = selector ? jQuery.filter( selector, elem ) : elem,
		i = 0;

	for ( ; ( node = nodes[ i ] ) != null; i++ ) {
		if ( !keepData && node.nodeType === 1 ) {
			jQuery.cleanData( getAll( node ) );
		}

		if ( node.parentNode ) {
			if ( keepData && jQuery.contains( node.ownerDocument, node ) ) {
				setGlobalEval( getAll( node, "script" ) );
			}
			node.parentNode.removeChild( node );
		}
	}

	return elem;
}

jQuery.extend( {
	htmlPrefilter: function( html ) {
		return html.replace( rxhtmlTag, "<$1></$2>" );
	},

	clone: function( elem, dataAndEvents, deepDataAndEvents ) {
		var i, l, srcElements, destElements,
			clone = elem.cloneNode( true ),
			inPage = jQuery.contains( elem.ownerDocument, elem );

		// Fix IE cloning issues
		if ( !support.noCloneChecked && ( elem.nodeType === 1 || elem.nodeType === 11 ) &&
				!jQuery.isXMLDoc( elem ) ) {

			// We eschew Sizzle here for performance reasons: https://jsperf.com/getall-vs-sizzle/2
			destElements = getAll( clone );
			srcElements = getAll( elem );

			for ( i = 0, l = srcElements.length; i < l; i++ ) {
				fixInput( srcElements[ i ], destElements[ i ] );
			}
		}

		// Copy the events from the original to the clone
		if ( dataAndEvents ) {
			if ( deepDataAndEvents ) {
				srcElements = srcElements || getAll( elem );
				destElements = destElements || getAll( clone );

				for ( i = 0, l = srcElements.length; i < l; i++ ) {
					cloneCopyEvent( srcElements[ i ], destElements[ i ] );
				}
			} else {
				cloneCopyEvent( elem, clone );
			}
		}

		// Preserve script evaluation history
		destElements = getAll( clone, "script" );
		if ( destElements.length > 0 ) {
			setGlobalEval( destElements, !inPage && getAll( elem, "script" ) );
		}

		// Return the cloned set
		return clone;
	},

	cleanData: function( elems ) {
		var data, elem, type,
			special = jQuery.event.special,
			i = 0;

		for ( ; ( elem = elems[ i ] ) !== undefined; i++ ) {
			if ( acceptData( elem ) ) {
				if ( ( data = elem[ dataPriv.expando ] ) ) {
					if ( data.events ) {
						for ( type in data.events ) {
							if ( special[ type ] ) {
								jQuery.event.remove( elem, type );

							// This is a shortcut to avoid jQuery.event.remove's overhead
							} else {
								jQuery.removeEvent( elem, type, data.handle );
							}
						}
					}

					// Support: Chrome <=35 - 45+
					// Assign undefined instead of using delete, see Data#remove
					elem[ dataPriv.expando ] = undefined;
				}
				if ( elem[ dataUser.expando ] ) {

					// Support: Chrome <=35 - 45+
					// Assign undefined instead of using delete, see Data#remove
					elem[ dataUser.expando ] = undefined;
				}
			}
		}
	}
} );

jQuery.fn.extend( {
	detach: function( selector ) {
		return remove( this, selector, true );
	},

	remove: function( selector ) {
		return remove( this, selector );
	},

	text: function( value ) {
		return access( this, function( value ) {
			return value === undefined ?
				jQuery.text( this ) :
				this.empty().each( function() {
					if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
						this.textContent = value;
					}
				} );
		}, null, value, arguments.length );
	},

	append: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
				var target = manipulationTarget( this, elem );
				target.appendChild( elem );
			}
		} );
	},

	prepend: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
				var target = manipulationTarget( this, elem );
				target.insertBefore( elem, target.firstChild );
			}
		} );
	},

	before: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.parentNode ) {
				this.parentNode.insertBefore( elem, this );
			}
		} );
	},

	after: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.parentNode ) {
				this.parentNode.insertBefore( elem, this.nextSibling );
			}
		} );
	},

	empty: function() {
		var elem,
			i = 0;

		for ( ; ( elem = this[ i ] ) != null; i++ ) {
			if ( elem.nodeType === 1 ) {

				// Prevent memory leaks
				jQuery.cleanData( getAll( elem, false ) );

				// Remove any remaining nodes
				elem.textContent = "";
			}
		}

		return this;
	},

	clone: function( dataAndEvents, deepDataAndEvents ) {
		dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
		deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;

		return this.map( function() {
			return jQuery.clone( this, dataAndEvents, deepDataAndEvents );
		} );
	},

	html: function( value ) {
		return access( this, function( value ) {
			var elem = this[ 0 ] || {},
				i = 0,
				l = this.length;

			if ( value === undefined && elem.nodeType === 1 ) {
				return elem.innerHTML;
			}

			// See if we can take a shortcut and just use innerHTML
			if ( typeof value === "string" && !rnoInnerhtml.test( value ) &&
				!wrapMap[ ( rtagName.exec( value ) || [ "", "" ] )[ 1 ].toLowerCase() ] ) {

				value = jQuery.htmlPrefilter( value );

				try {
					for ( ; i < l; i++ ) {
						elem = this[ i ] || {};

						// Remove element nodes and prevent memory leaks
						if ( elem.nodeType === 1 ) {
							jQuery.cleanData( getAll( elem, false ) );
							elem.innerHTML = value;
						}
					}

					elem = 0;

				// If using innerHTML throws an exception, use the fallback method
				} catch ( e ) {}
			}

			if ( elem ) {
				this.empty().append( value );
			}
		}, null, value, arguments.length );
	},

	replaceWith: function() {
		var ignored = [];

		// Make the changes, replacing each non-ignored context element with the new content
		return domManip( this, arguments, function( elem ) {
			var parent = this.parentNode;

			if ( jQuery.inArray( this, ignored ) < 0 ) {
				jQuery.cleanData( getAll( this ) );
				if ( parent ) {
					parent.replaceChild( elem, this );
				}
			}

		// Force callback invocation
		}, ignored );
	}
} );

jQuery.each( {
	appendTo: "append",
	prependTo: "prepend",
	insertBefore: "before",
	insertAfter: "after",
	replaceAll: "replaceWith"
}, function( name, original ) {
	jQuery.fn[ name ] = function( selector ) {
		var elems,
			ret = [],
			insert = jQuery( selector ),
			last = insert.length - 1,
			i = 0;

		for ( ; i <= last; i++ ) {
			elems = i === last ? this : this.clone( true );
			jQuery( insert[ i ] )[ original ]( elems );

			// Support: Android <=4.0 only, PhantomJS 1 only
			// .get() because push.apply(_, arraylike) throws on ancient WebKit
			push.apply( ret, elems.get() );
		}

		return this.pushStack( ret );
	};
} );
var rnumnonpx = new RegExp( "^(" + pnum + ")(?!px)[a-z%]+$", "i" );

var getStyles = function( elem ) {

		// Support: IE <=11 only, Firefox <=30 (#15098, #14150)
		// IE throws on elements created in popups
		// FF meanwhile throws on frame elements through "defaultView.getComputedStyle"
		var view = elem.ownerDocument.defaultView;

		if ( !view || !view.opener ) {
			view = window;
		}

		return view.getComputedStyle( elem );
	};

var rboxStyle = new RegExp( cssExpand.join( "|" ), "i" );



( function() {

	// Executing both pixelPosition & boxSizingReliable tests require only one layout
	// so they're executed at the same time to save the second computation.
	function computeStyleTests() {

		// This is a singleton, we need to execute it only once
		if ( !div ) {
			return;
		}

		container.style.cssText = "position:absolute;left:-11111px;width:60px;" +
			"margin-top:1px;padding:0;border:0";
		div.style.cssText =
			"position:relative;display:block;box-sizing:border-box;overflow:scroll;" +
			"margin:auto;border:1px;padding:1px;" +
			"width:60%;top:1%";
		documentElement.appendChild( container ).appendChild( div );

		var divStyle = window.getComputedStyle( div );
		pixelPositionVal = divStyle.top !== "1%";

		// Support: Android 4.0 - 4.3 only, Firefox <=3 - 44
		reliableMarginLeftVal = roundPixelMeasures( divStyle.marginLeft ) === 12;

		// Support: Android 4.0 - 4.3 only, Safari <=9.1 - 10.1, iOS <=7.0 - 9.3
		// Some styles come back with percentage values, even though they shouldn't
		div.style.right = "60%";
		pixelBoxStylesVal = roundPixelMeasures( divStyle.right ) === 36;

		// Support: IE 9 - 11 only
		// Detect misreporting of content dimensions for box-sizing:border-box elements
		boxSizingReliableVal = roundPixelMeasures( divStyle.width ) === 36;

		// Support: IE 9 only
		// Detect overflow:scroll screwiness (gh-3699)
		div.style.position = "absolute";
		scrollboxSizeVal = div.offsetWidth === 36 || "absolute";

		documentElement.removeChild( container );

		// Nullify the div so it wouldn't be stored in the memory and
		// it will also be a sign that checks already performed
		div = null;
	}

	function roundPixelMeasures( measure ) {
		return Math.round( parseFloat( measure ) );
	}

	var pixelPositionVal, boxSizingReliableVal, scrollboxSizeVal, pixelBoxStylesVal,
		reliableMarginLeftVal,
		container = document.createElement( "div" ),
		div = document.createElement( "div" );

	// Finish early in limited (non-browser) environments
	if ( !div.style ) {
		return;
	}

	// Support: IE <=9 - 11 only
	// Style of cloned element affects source element cloned (#8908)
	div.style.backgroundClip = "content-box";
	div.cloneNode( true ).style.backgroundClip = "";
	support.clearCloneStyle = div.style.backgroundClip === "content-box";

	jQuery.extend( support, {
		boxSizingReliable: function() {
			computeStyleTests();
			return boxSizingReliableVal;
		},
		pixelBoxStyles: function() {
			computeStyleTests();
			return pixelBoxStylesVal;
		},
		pixelPosition: function() {
			computeStyleTests();
			return pixelPositionVal;
		},
		reliableMarginLeft: function() {
			computeStyleTests();
			return reliableMarginLeftVal;
		},
		scrollboxSize: function() {
			computeStyleTests();
			return scrollboxSizeVal;
		}
	} );
} )();


function curCSS( elem, name, computed ) {
	var width, minWidth, maxWidth, ret,

		// Support: Firefox 51+
		// Retrieving style before computed somehow
		// fixes an issue with getting wrong values
		// on detached elements
		style = elem.style;

	computed = computed || getStyles( elem );

	// getPropertyValue is needed for:
	//   .css('filter') (IE 9 only, #12537)
	//   .css('--customProperty) (#3144)
	if ( computed ) {
		ret = computed.getPropertyValue( name ) || computed[ name ];

		if ( ret === "" && !jQuery.contains( elem.ownerDocument, elem ) ) {
			ret = jQuery.style( elem, name );
		}

		// A tribute to the "awesome hack by Dean Edwards"
		// Android Browser returns percentage for some values,
		// but width seems to be reliably pixels.
		// This is against the CSSOM draft spec:
		// https://drafts.csswg.org/cssom/#resolved-values
		if ( !support.pixelBoxStyles() && rnumnonpx.test( ret ) && rboxStyle.test( name ) ) {

			// Remember the original values
			width = style.width;
			minWidth = style.minWidth;
			maxWidth = style.maxWidth;

			// Put in the new values to get a computed value out
			style.minWidth = style.maxWidth = style.width = ret;
			ret = computed.width;

			// Revert the changed values
			style.width = width;
			style.minWidth = minWidth;
			style.maxWidth = maxWidth;
		}
	}

	return ret !== undefined ?

		// Support: IE <=9 - 11 only
		// IE returns zIndex value as an integer.
		ret + "" :
		ret;
}


function addGetHookIf( conditionFn, hookFn ) {

	// Define the hook, we'll check on the first run if it's really needed.
	return {
		get: function() {
			if ( conditionFn() ) {

				// Hook not needed (or it's not possible to use it due
				// to missing dependency), remove it.
				delete this.get;
				return;
			}

			// Hook needed; redefine it so that the support test is not executed again.
			return ( this.get = hookFn ).apply( this, arguments );
		}
	};
}


var

	// Swappable if display is none or starts with table
	// except "table", "table-cell", or "table-caption"
	// See here for display values: https://developer.mozilla.org/en-US/docs/CSS/display
	rdisplayswap = /^(none|table(?!-c[ea]).+)/,
	rcustomProp = /^--/,
	cssShow = { position: "absolute", visibility: "hidden", display: "block" },
	cssNormalTransform = {
		letterSpacing: "0",
		fontWeight: "400"
	},

	cssPrefixes = [ "Webkit", "Moz", "ms" ],
	emptyStyle = document.createElement( "div" ).style;

// Return a css property mapped to a potentially vendor prefixed property
function vendorPropName( name ) {

	// Shortcut for names that are not vendor prefixed
	if ( name in emptyStyle ) {
		return name;
	}

	// Check for vendor prefixed names
	var capName = name[ 0 ].toUpperCase() + name.slice( 1 ),
		i = cssPrefixes.length;

	while ( i-- ) {
		name = cssPrefixes[ i ] + capName;
		if ( name in emptyStyle ) {
			return name;
		}
	}
}

// Return a property mapped along what jQuery.cssProps suggests or to
// a vendor prefixed property.
function finalPropName( name ) {
	var ret = jQuery.cssProps[ name ];
	if ( !ret ) {
		ret = jQuery.cssProps[ name ] = vendorPropName( name ) || name;
	}
	return ret;
}

function setPositiveNumber( elem, value, subtract ) {

	// Any relative (+/-) values have already been
	// normalized at this point
	var matches = rcssNum.exec( value );
	return matches ?

		// Guard against undefined "subtract", e.g., when used as in cssHooks
		Math.max( 0, matches[ 2 ] - ( subtract || 0 ) ) + ( matches[ 3 ] || "px" ) :
		value;
}

function boxModelAdjustment( elem, dimension, box, isBorderBox, styles, computedVal ) {
	var i = dimension === "width" ? 1 : 0,
		extra = 0,
		delta = 0;

	// Adjustment may not be necessary
	if ( box === ( isBorderBox ? "border" : "content" ) ) {
		return 0;
	}

	for ( ; i < 4; i += 2 ) {

		// Both box models exclude margin
		if ( box === "margin" ) {
			delta += jQuery.css( elem, box + cssExpand[ i ], true, styles );
		}

		// If we get here with a content-box, we're seeking "padding" or "border" or "margin"
		if ( !isBorderBox ) {

			// Add padding
			delta += jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );

			// For "border" or "margin", add border
			if ( box !== "padding" ) {
				delta += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );

			// But still keep track of it otherwise
			} else {
				extra += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
			}

		// If we get here with a border-box (content + padding + border), we're seeking "content" or
		// "padding" or "margin"
		} else {

			// For "content", subtract padding
			if ( box === "content" ) {
				delta -= jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );
			}

			// For "content" or "padding", subtract border
			if ( box !== "margin" ) {
				delta -= jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
			}
		}
	}

	// Account for positive content-box scroll gutter when requested by providing computedVal
	if ( !isBorderBox && computedVal >= 0 ) {

		// offsetWidth/offsetHeight is a rounded sum of content, padding, scroll gutter, and border
		// Assuming integer scroll gutter, subtract the rest and round down
		delta += Math.max( 0, Math.ceil(
			elem[ "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 ) ] -
			computedVal -
			delta -
			extra -
			0.5
		) );
	}

	return delta;
}

function getWidthOrHeight( elem, dimension, extra ) {

	// Start with computed style
	var styles = getStyles( elem ),
		val = curCSS( elem, dimension, styles ),
		isBorderBox = jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
		valueIsBorderBox = isBorderBox;

	// Support: Firefox <=54
	// Return a confounding non-pixel value or feign ignorance, as appropriate.
	if ( rnumnonpx.test( val ) ) {
		if ( !extra ) {
			return val;
		}
		val = "auto";
	}

	// Check for style in case a browser which returns unreliable values
	// for getComputedStyle silently falls back to the reliable elem.style
	valueIsBorderBox = valueIsBorderBox &&
		( support.boxSizingReliable() || val === elem.style[ dimension ] );

	// Fall back to offsetWidth/offsetHeight when value is "auto"
	// This happens for inline elements with no explicit setting (gh-3571)
	// Support: Android <=4.1 - 4.3 only
	// Also use offsetWidth/offsetHeight for misreported inline dimensions (gh-3602)
	if ( val === "auto" ||
		!parseFloat( val ) && jQuery.css( elem, "display", false, styles ) === "inline" ) {

		val = elem[ "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 ) ];

		// offsetWidth/offsetHeight provide border-box values
		valueIsBorderBox = true;
	}

	// Normalize "" and auto
	val = parseFloat( val ) || 0;

	// Adjust for the element's box model
	return ( val +
		boxModelAdjustment(
			elem,
			dimension,
			extra || ( isBorderBox ? "border" : "content" ),
			valueIsBorderBox,
			styles,

			// Provide the current computed size to request scroll gutter calculation (gh-3589)
			val
		)
	) + "px";
}

jQuery.extend( {

	// Add in style property hooks for overriding the default
	// behavior of getting and setting a style property
	cssHooks: {
		opacity: {
			get: function( elem, computed ) {
				if ( computed ) {

					// We should always get a number back from opacity
					var ret = curCSS( elem, "opacity" );
					return ret === "" ? "1" : ret;
				}
			}
		}
	},

	// Don't automatically add "px" to these possibly-unitless properties
	cssNumber: {
		"animationIterationCount": true,
		"columnCount": true,
		"fillOpacity": true,
		"flexGrow": true,
		"flexShrink": true,
		"fontWeight": true,
		"lineHeight": true,
		"opacity": true,
		"order": true,
		"orphans": true,
		"widows": true,
		"zIndex": true,
		"zoom": true
	},

	// Add in properties whose names you wish to fix before
	// setting or getting the value
	cssProps: {},

	// Get and set the style property on a DOM Node
	style: function( elem, name, value, extra ) {

		// Don't set styles on text and comment nodes
		if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style ) {
			return;
		}

		// Make sure that we're working with the right name
		var ret, type, hooks,
			origName = camelCase( name ),
			isCustomProp = rcustomProp.test( name ),
			style = elem.style;

		// Make sure that we're working with the right name. We don't
		// want to query the value if it is a CSS custom property
		// since they are user-defined.
		if ( !isCustomProp ) {
			name = finalPropName( origName );
		}

		// Gets hook for the prefixed version, then unprefixed version
		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

		// Check if we're setting a value
		if ( value !== undefined ) {
			type = typeof value;

			// Convert "+=" or "-=" to relative numbers (#7345)
			if ( type === "string" && ( ret = rcssNum.exec( value ) ) && ret[ 1 ] ) {
				value = adjustCSS( elem, name, ret );

				// Fixes bug #9237
				type = "number";
			}

			// Make sure that null and NaN values aren't set (#7116)
			if ( value == null || value !== value ) {
				return;
			}

			// If a number was passed in, add the unit (except for certain CSS properties)
			if ( type === "number" ) {
				value += ret && ret[ 3 ] || ( jQuery.cssNumber[ origName ] ? "" : "px" );
			}

			// background-* props affect original clone's values
			if ( !support.clearCloneStyle && value === "" && name.indexOf( "background" ) === 0 ) {
				style[ name ] = "inherit";
			}

			// If a hook was provided, use that value, otherwise just set the specified value
			if ( !hooks || !( "set" in hooks ) ||
				( value = hooks.set( elem, value, extra ) ) !== undefined ) {

				if ( isCustomProp ) {
					style.setProperty( name, value );
				} else {
					style[ name ] = value;
				}
			}

		} else {

			// If a hook was provided get the non-computed value from there
			if ( hooks && "get" in hooks &&
				( ret = hooks.get( elem, false, extra ) ) !== undefined ) {

				return ret;
			}

			// Otherwise just get the value from the style object
			return style[ name ];
		}
	},

	css: function( elem, name, extra, styles ) {
		var val, num, hooks,
			origName = camelCase( name ),
			isCustomProp = rcustomProp.test( name );

		// Make sure that we're working with the right name. We don't
		// want to modify the value if it is a CSS custom property
		// since they are user-defined.
		if ( !isCustomProp ) {
			name = finalPropName( origName );
		}

		// Try prefixed name followed by the unprefixed name
		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

		// If a hook was provided get the computed value from there
		if ( hooks && "get" in hooks ) {
			val = hooks.get( elem, true, extra );
		}

		// Otherwise, if a way to get the computed value exists, use that
		if ( val === undefined ) {
			val = curCSS( elem, name, styles );
		}

		// Convert "normal" to computed value
		if ( val === "normal" && name in cssNormalTransform ) {
			val = cssNormalTransform[ name ];
		}

		// Make numeric if forced or a qualifier was provided and val looks numeric
		if ( extra === "" || extra ) {
			num = parseFloat( val );
			return extra === true || isFinite( num ) ? num || 0 : val;
		}

		return val;
	}
} );

jQuery.each( [ "height", "width" ], function( i, dimension ) {
	jQuery.cssHooks[ dimension ] = {
		get: function( elem, computed, extra ) {
			if ( computed ) {

				// Certain elements can have dimension info if we invisibly show them
				// but it must have a current display style that would benefit
				return rdisplayswap.test( jQuery.css( elem, "display" ) ) &&

					// Support: Safari 8+
					// Table columns in Safari have non-zero offsetWidth & zero
					// getBoundingClientRect().width unless display is changed.
					// Support: IE <=11 only
					// Running getBoundingClientRect on a disconnected node
					// in IE throws an error.
					( !elem.getClientRects().length || !elem.getBoundingClientRect().width ) ?
						swap( elem, cssShow, function() {
							return getWidthOrHeight( elem, dimension, extra );
						} ) :
						getWidthOrHeight( elem, dimension, extra );
			}
		},

		set: function( elem, value, extra ) {
			var matches,
				styles = getStyles( elem ),
				isBorderBox = jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
				subtract = extra && boxModelAdjustment(
					elem,
					dimension,
					extra,
					isBorderBox,
					styles
				);

			// Account for unreliable border-box dimensions by comparing offset* to computed and
			// faking a content-box to get border and padding (gh-3699)
			if ( isBorderBox && support.scrollboxSize() === styles.position ) {
				subtract -= Math.ceil(
					elem[ "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 ) ] -
					parseFloat( styles[ dimension ] ) -
					boxModelAdjustment( elem, dimension, "border", false, styles ) -
					0.5
				);
			}

			// Convert to pixels if value adjustment is needed
			if ( subtract && ( matches = rcssNum.exec( value ) ) &&
				( matches[ 3 ] || "px" ) !== "px" ) {

				elem.style[ dimension ] = value;
				value = jQuery.css( elem, dimension );
			}

			return setPositiveNumber( elem, value, subtract );
		}
	};
} );

jQuery.cssHooks.marginLeft = addGetHookIf( support.reliableMarginLeft,
	function( elem, computed ) {
		if ( computed ) {
			return ( parseFloat( curCSS( elem, "marginLeft" ) ) ||
				elem.getBoundingClientRect().left -
					swap( elem, { marginLeft: 0 }, function() {
						return elem.getBoundingClientRect().left;
					} )
				) + "px";
		}
	}
);

// These hooks are used by animate to expand properties
jQuery.each( {
	margin: "",
	padding: "",
	border: "Width"
}, function( prefix, suffix ) {
	jQuery.cssHooks[ prefix + suffix ] = {
		expand: function( value ) {
			var i = 0,
				expanded = {},

				// Assumes a single number if not a string
				parts = typeof value === "string" ? value.split( " " ) : [ value ];

			for ( ; i < 4; i++ ) {
				expanded[ prefix + cssExpand[ i ] + suffix ] =
					parts[ i ] || parts[ i - 2 ] || parts[ 0 ];
			}

			return expanded;
		}
	};

	if ( prefix !== "margin" ) {
		jQuery.cssHooks[ prefix + suffix ].set = setPositiveNumber;
	}
} );

jQuery.fn.extend( {
	css: function( name, value ) {
		return access( this, function( elem, name, value ) {
			var styles, len,
				map = {},
				i = 0;

			if ( Array.isArray( name ) ) {
				styles = getStyles( elem );
				len = name.length;

				for ( ; i < len; i++ ) {
					map[ name[ i ] ] = jQuery.css( elem, name[ i ], false, styles );
				}

				return map;
			}

			return value !== undefined ?
				jQuery.style( elem, name, value ) :
				jQuery.css( elem, name );
		}, name, value, arguments.length > 1 );
	}
} );


function Tween( elem, options, prop, end, easing ) {
	return new Tween.prototype.init( elem, options, prop, end, easing );
}
jQuery.Tween = Tween;

Tween.prototype = {
	constructor: Tween,
	init: function( elem, options, prop, end, easing, unit ) {
		this.elem = elem;
		this.prop = prop;
		this.easing = easing || jQuery.easing._default;
		this.options = options;
		this.start = this.now = this.cur();
		this.end = end;
		this.unit = unit || ( jQuery.cssNumber[ prop ] ? "" : "px" );
	},
	cur: function() {
		var hooks = Tween.propHooks[ this.prop ];

		return hooks && hooks.get ?
			hooks.get( this ) :
			Tween.propHooks._default.get( this );
	},
	run: function( percent ) {
		var eased,
			hooks = Tween.propHooks[ this.prop ];

		if ( this.options.duration ) {
			this.pos = eased = jQuery.easing[ this.easing ](
				percent, this.options.duration * percent, 0, 1, this.options.duration
			);
		} else {
			this.pos = eased = percent;
		}
		this.now = ( this.end - this.start ) * eased + this.start;

		if ( this.options.step ) {
			this.options.step.call( this.elem, this.now, this );
		}

		if ( hooks && hooks.set ) {
			hooks.set( this );
		} else {
			Tween.propHooks._default.set( this );
		}
		return this;
	}
};

Tween.prototype.init.prototype = Tween.prototype;

Tween.propHooks = {
	_default: {
		get: function( tween ) {
			var result;

			// Use a property on the element directly when it is not a DOM element,
			// or when there is no matching style property that exists.
			if ( tween.elem.nodeType !== 1 ||
				tween.elem[ tween.prop ] != null && tween.elem.style[ tween.prop ] == null ) {
				return tween.elem[ tween.prop ];
			}

			// Passing an empty string as a 3rd parameter to .css will automatically
			// attempt a parseFloat and fallback to a string if the parse fails.
			// Simple values such as "10px" are parsed to Float;
			// complex values such as "rotate(1rad)" are returned as-is.
			result = jQuery.css( tween.elem, tween.prop, "" );

			// Empty strings, null, undefined and "auto" are converted to 0.
			return !result || result === "auto" ? 0 : result;
		},
		set: function( tween ) {

			// Use step hook for back compat.
			// Use cssHook if its there.
			// Use .style if available and use plain properties where available.
			if ( jQuery.fx.step[ tween.prop ] ) {
				jQuery.fx.step[ tween.prop ]( tween );
			} else if ( tween.elem.nodeType === 1 &&
				( tween.elem.style[ jQuery.cssProps[ tween.prop ] ] != null ||
					jQuery.cssHooks[ tween.prop ] ) ) {
				jQuery.style( tween.elem, tween.prop, tween.now + tween.unit );
			} else {
				tween.elem[ tween.prop ] = tween.now;
			}
		}
	}
};

// Support: IE <=9 only
// Panic based approach to setting things on disconnected nodes
Tween.propHooks.scrollTop = Tween.propHooks.scrollLeft = {
	set: function( tween ) {
		if ( tween.elem.nodeType && tween.elem.parentNode ) {
			tween.elem[ tween.prop ] = tween.now;
		}
	}
};

jQuery.easing = {
	linear: function( p ) {
		return p;
	},
	swing: function( p ) {
		return 0.5 - Math.cos( p * Math.PI ) / 2;
	},
	_default: "swing"
};

jQuery.fx = Tween.prototype.init;

// Back compat <1.8 extension point
jQuery.fx.step = {};




var
	fxNow, inProgress,
	rfxtypes = /^(?:toggle|show|hide)$/,
	rrun = /queueHooks$/;

function schedule() {
	if ( inProgress ) {
		if ( document.hidden === false && window.requestAnimationFrame ) {
			window.requestAnimationFrame( schedule );
		} else {
			window.setTimeout( schedule, jQuery.fx.interval );
		}

		jQuery.fx.tick();
	}
}

// Animations created synchronously will run synchronously
function createFxNow() {
	window.setTimeout( function() {
		fxNow = undefined;
	} );
	return ( fxNow = Date.now() );
}

// Generate parameters to create a standard animation
function genFx( type, includeWidth ) {
	var which,
		i = 0,
		attrs = { height: type };

	// If we include width, step value is 1 to do all cssExpand values,
	// otherwise step value is 2 to skip over Left and Right
	includeWidth = includeWidth ? 1 : 0;
	for ( ; i < 4; i += 2 - includeWidth ) {
		which = cssExpand[ i ];
		attrs[ "margin" + which ] = attrs[ "padding" + which ] = type;
	}

	if ( includeWidth ) {
		attrs.opacity = attrs.width = type;
	}

	return attrs;
}

function createTween( value, prop, animation ) {
	var tween,
		collection = ( Animation.tweeners[ prop ] || [] ).concat( Animation.tweeners[ "*" ] ),
		index = 0,
		length = collection.length;
	for ( ; index < length; index++ ) {
		if ( ( tween = collection[ index ].call( animation, prop, value ) ) ) {

			// We're done with this property
			return tween;
		}
	}
}

function defaultPrefilter( elem, props, opts ) {
	var prop, value, toggle, hooks, oldfire, propTween, restoreDisplay, display,
		isBox = "width" in props || "height" in props,
		anim = this,
		orig = {},
		style = elem.style,
		hidden = elem.nodeType && isHiddenWithinTree( elem ),
		dataShow = dataPriv.get( elem, "fxshow" );

	// Queue-skipping animations hijack the fx hooks
	if ( !opts.queue ) {
		hooks = jQuery._queueHooks( elem, "fx" );
		if ( hooks.unqueued == null ) {
			hooks.unqueued = 0;
			oldfire = hooks.empty.fire;
			hooks.empty.fire = function() {
				if ( !hooks.unqueued ) {
					oldfire();
				}
			};
		}
		hooks.unqueued++;

		anim.always( function() {

			// Ensure the complete handler is called before this completes
			anim.always( function() {
				hooks.unqueued--;
				if ( !jQuery.queue( elem, "fx" ).length ) {
					hooks.empty.fire();
				}
			} );
		} );
	}

	// Detect show/hide animations
	for ( prop in props ) {
		value = props[ prop ];
		if ( rfxtypes.test( value ) ) {
			delete props[ prop ];
			toggle = toggle || value === "toggle";
			if ( value === ( hidden ? "hide" : "show" ) ) {

				// Pretend to be hidden if this is a "show" and
				// there is still data from a stopped show/hide
				if ( value === "show" && dataShow && dataShow[ prop ] !== undefined ) {
					hidden = true;

				// Ignore all other no-op show/hide data
				} else {
					continue;
				}
			}
			orig[ prop ] = dataShow && dataShow[ prop ] || jQuery.style( elem, prop );
		}
	}

	// Bail out if this is a no-op like .hide().hide()
	propTween = !jQuery.isEmptyObject( props );
	if ( !propTween && jQuery.isEmptyObject( orig ) ) {
		return;
	}

	// Restrict "overflow" and "display" styles during box animations
	if ( isBox && elem.nodeType === 1 ) {

		// Support: IE <=9 - 11, Edge 12 - 15
		// Record all 3 overflow attributes because IE does not infer the shorthand
		// from identically-valued overflowX and overflowY and Edge just mirrors
		// the overflowX value there.
		opts.overflow = [ style.overflow, style.overflowX, style.overflowY ];

		// Identify a display type, preferring old show/hide data over the CSS cascade
		restoreDisplay = dataShow && dataShow.display;
		if ( restoreDisplay == null ) {
			restoreDisplay = dataPriv.get( elem, "display" );
		}
		display = jQuery.css( elem, "display" );
		if ( display === "none" ) {
			if ( restoreDisplay ) {
				display = restoreDisplay;
			} else {

				// Get nonempty value(s) by temporarily forcing visibility
				showHide( [ elem ], true );
				restoreDisplay = elem.style.display || restoreDisplay;
				display = jQuery.css( elem, "display" );
				showHide( [ elem ] );
			}
		}

		// Animate inline elements as inline-block
		if ( display === "inline" || display === "inline-block" && restoreDisplay != null ) {
			if ( jQuery.css( elem, "float" ) === "none" ) {

				// Restore the original display value at the end of pure show/hide animations
				if ( !propTween ) {
					anim.done( function() {
						style.display = restoreDisplay;
					} );
					if ( restoreDisplay == null ) {
						display = style.display;
						restoreDisplay = display === "none" ? "" : display;
					}
				}
				style.display = "inline-block";
			}
		}
	}

	if ( opts.overflow ) {
		style.overflow = "hidden";
		anim.always( function() {
			style.overflow = opts.overflow[ 0 ];
			style.overflowX = opts.overflow[ 1 ];
			style.overflowY = opts.overflow[ 2 ];
		} );
	}

	// Implement show/hide animations
	propTween = false;
	for ( prop in orig ) {

		// General show/hide setup for this element animation
		if ( !propTween ) {
			if ( dataShow ) {
				if ( "hidden" in dataShow ) {
					hidden = dataShow.hidden;
				}
			} else {
				dataShow = dataPriv.access( elem, "fxshow", { display: restoreDisplay } );
			}

			// Store hidden/visible for toggle so `.stop().toggle()` "reverses"
			if ( toggle ) {
				dataShow.hidden = !hidden;
			}

			// Show elements before animating them
			if ( hidden ) {
				showHide( [ elem ], true );
			}

			/* eslint-disable no-loop-func */

			anim.done( function() {

			/* eslint-enable no-loop-func */

				// The final step of a "hide" animation is actually hiding the element
				if ( !hidden ) {
					showHide( [ elem ] );
				}
				dataPriv.remove( elem, "fxshow" );
				for ( prop in orig ) {
					jQuery.style( elem, prop, orig[ prop ] );
				}
			} );
		}

		// Per-property setup
		propTween = createTween( hidden ? dataShow[ prop ] : 0, prop, anim );
		if ( !( prop in dataShow ) ) {
			dataShow[ prop ] = propTween.start;
			if ( hidden ) {
				propTween.end = propTween.start;
				propTween.start = 0;
			}
		}
	}
}

function propFilter( props, specialEasing ) {
	var index, name, easing, value, hooks;

	// camelCase, specialEasing and expand cssHook pass
	for ( index in props ) {
		name = camelCase( index );
		easing = specialEasing[ name ];
		value = props[ index ];
		if ( Array.isArray( value ) ) {
			easing = value[ 1 ];
			value = props[ index ] = value[ 0 ];
		}

		if ( index !== name ) {
			props[ name ] = value;
			delete props[ index ];
		}

		hooks = jQuery.cssHooks[ name ];
		if ( hooks && "expand" in hooks ) {
			value = hooks.expand( value );
			delete props[ name ];

			// Not quite $.extend, this won't overwrite existing keys.
			// Reusing 'index' because we have the correct "name"
			for ( index in value ) {
				if ( !( index in props ) ) {
					props[ index ] = value[ index ];
					specialEasing[ index ] = easing;
				}
			}
		} else {
			specialEasing[ name ] = easing;
		}
	}
}

function Animation( elem, properties, options ) {
	var result,
		stopped,
		index = 0,
		length = Animation.prefilters.length,
		deferred = jQuery.Deferred().always( function() {

			// Don't match elem in the :animated selector
			delete tick.elem;
		} ),
		tick = function() {
			if ( stopped ) {
				return false;
			}
			var currentTime = fxNow || createFxNow(),
				remaining = Math.max( 0, animation.startTime + animation.duration - currentTime ),

				// Support: Android 2.3 only
				// Archaic crash bug won't allow us to use `1 - ( 0.5 || 0 )` (#12497)
				temp = remaining / animation.duration || 0,
				percent = 1 - temp,
				index = 0,
				length = animation.tweens.length;

			for ( ; index < length; index++ ) {
				animation.tweens[ index ].run( percent );
			}

			deferred.notifyWith( elem, [ animation, percent, remaining ] );

			// If there's more to do, yield
			if ( percent < 1 && length ) {
				return remaining;
			}

			// If this was an empty animation, synthesize a final progress notification
			if ( !length ) {
				deferred.notifyWith( elem, [ animation, 1, 0 ] );
			}

			// Resolve the animation and report its conclusion
			deferred.resolveWith( elem, [ animation ] );
			return false;
		},
		animation = deferred.promise( {
			elem: elem,
			props: jQuery.extend( {}, properties ),
			opts: jQuery.extend( true, {
				specialEasing: {},
				easing: jQuery.easing._default
			}, options ),
			originalProperties: properties,
			originalOptions: options,
			startTime: fxNow || createFxNow(),
			duration: options.duration,
			tweens: [],
			createTween: function( prop, end ) {
				var tween = jQuery.Tween( elem, animation.opts, prop, end,
						animation.opts.specialEasing[ prop ] || animation.opts.easing );
				animation.tweens.push( tween );
				return tween;
			},
			stop: function( gotoEnd ) {
				var index = 0,

					// If we are going to the end, we want to run all the tweens
					// otherwise we skip this part
					length = gotoEnd ? animation.tweens.length : 0;
				if ( stopped ) {
					return this;
				}
				stopped = true;
				for ( ; index < length; index++ ) {
					animation.tweens[ index ].run( 1 );
				}

				// Resolve when we played the last frame; otherwise, reject
				if ( gotoEnd ) {
					deferred.notifyWith( elem, [ animation, 1, 0 ] );
					deferred.resolveWith( elem, [ animation, gotoEnd ] );
				} else {
					deferred.rejectWith( elem, [ animation, gotoEnd ] );
				}
				return this;
			}
		} ),
		props = animation.props;

	propFilter( props, animation.opts.specialEasing );

	for ( ; index < length; index++ ) {
		result = Animation.prefilters[ index ].call( animation, elem, props, animation.opts );
		if ( result ) {
			if ( isFunction( result.stop ) ) {
				jQuery._queueHooks( animation.elem, animation.opts.queue ).stop =
					result.stop.bind( result );
			}
			return result;
		}
	}

	jQuery.map( props, createTween, animation );

	if ( isFunction( animation.opts.start ) ) {
		animation.opts.start.call( elem, animation );
	}

	// Attach callbacks from options
	animation
		.progress( animation.opts.progress )
		.done( animation.opts.done, animation.opts.complete )
		.fail( animation.opts.fail )
		.always( animation.opts.always );

	jQuery.fx.timer(
		jQuery.extend( tick, {
			elem: elem,
			anim: animation,
			queue: animation.opts.queue
		} )
	);

	return animation;
}

jQuery.Animation = jQuery.extend( Animation, {

	tweeners: {
		"*": [ function( prop, value ) {
			var tween = this.createTween( prop, value );
			adjustCSS( tween.elem, prop, rcssNum.exec( value ), tween );
			return tween;
		} ]
	},

	tweener: function( props, callback ) {
		if ( isFunction( props ) ) {
			callback = props;
			props = [ "*" ];
		} else {
			props = props.match( rnothtmlwhite );
		}

		var prop,
			index = 0,
			length = props.length;

		for ( ; index < length; index++ ) {
			prop = props[ index ];
			Animation.tweeners[ prop ] = Animation.tweeners[ prop ] || [];
			Animation.tweeners[ prop ].unshift( callback );
		}
	},

	prefilters: [ defaultPrefilter ],

	prefilter: function( callback, prepend ) {
		if ( prepend ) {
			Animation.prefilters.unshift( callback );
		} else {
			Animation.prefilters.push( callback );
		}
	}
} );

jQuery.speed = function( speed, easing, fn ) {
	var opt = speed && typeof speed === "object" ? jQuery.extend( {}, speed ) : {
		complete: fn || !fn && easing ||
			isFunction( speed ) && speed,
		duration: speed,
		easing: fn && easing || easing && !isFunction( easing ) && easing
	};

	// Go to the end state if fx are off
	if ( jQuery.fx.off ) {
		opt.duration = 0;

	} else {
		if ( typeof opt.duration !== "number" ) {
			if ( opt.duration in jQuery.fx.speeds ) {
				opt.duration = jQuery.fx.speeds[ opt.duration ];

			} else {
				opt.duration = jQuery.fx.speeds._default;
			}
		}
	}

	// Normalize opt.queue - true/undefined/null -> "fx"
	if ( opt.queue == null || opt.queue === true ) {
		opt.queue = "fx";
	}

	// Queueing
	opt.old = opt.complete;

	opt.complete = function() {
		if ( isFunction( opt.old ) ) {
			opt.old.call( this );
		}

		if ( opt.queue ) {
			jQuery.dequeue( this, opt.queue );
		}
	};

	return opt;
};

jQuery.fn.extend( {
	fadeTo: function( speed, to, easing, callback ) {

		// Show any hidden elements after setting opacity to 0
		return this.filter( isHiddenWithinTree ).css( "opacity", 0 ).show()

			// Animate to the value specified
			.end().animate( { opacity: to }, speed, easing, callback );
	},
	animate: function( prop, speed, easing, callback ) {
		var empty = jQuery.isEmptyObject( prop ),
			optall = jQuery.speed( speed, easing, callback ),
			doAnimation = function() {

				// Operate on a copy of prop so per-property easing won't be lost
				var anim = Animation( this, jQuery.extend( {}, prop ), optall );

				// Empty animations, or finishing resolves immediately
				if ( empty || dataPriv.get( this, "finish" ) ) {
					anim.stop( true );
				}
			};
			doAnimation.finish = doAnimation;

		return empty || optall.queue === false ?
			this.each( doAnimation ) :
			this.queue( optall.queue, doAnimation );
	},
	stop: function( type, clearQueue, gotoEnd ) {
		var stopQueue = function( hooks ) {
			var stop = hooks.stop;
			delete hooks.stop;
			stop( gotoEnd );
		};

		if ( typeof type !== "string" ) {
			gotoEnd = clearQueue;
			clearQueue = type;
			type = undefined;
		}
		if ( clearQueue && type !== false ) {
			this.queue( type || "fx", [] );
		}

		return this.each( function() {
			var dequeue = true,
				index = type != null && type + "queueHooks",
				timers = jQuery.timers,
				data = dataPriv.get( this );

			if ( index ) {
				if ( data[ index ] && data[ index ].stop ) {
					stopQueue( data[ index ] );
				}
			} else {
				for ( index in data ) {
					if ( data[ index ] && data[ index ].stop && rrun.test( index ) ) {
						stopQueue( data[ index ] );
					}
				}
			}

			for ( index = timers.length; index--; ) {
				if ( timers[ index ].elem === this &&
					( type == null || timers[ index ].queue === type ) ) {

					timers[ index ].anim.stop( gotoEnd );
					dequeue = false;
					timers.splice( index, 1 );
				}
			}

			// Start the next in the queue if the last step wasn't forced.
			// Timers currently will call their complete callbacks, which
			// will dequeue but only if they were gotoEnd.
			if ( dequeue || !gotoEnd ) {
				jQuery.dequeue( this, type );
			}
		} );
	},
	finish: function( type ) {
		if ( type !== false ) {
			type = type || "fx";
		}
		return this.each( function() {
			var index,
				data = dataPriv.get( this ),
				queue = data[ type + "queue" ],
				hooks = data[ type + "queueHooks" ],
				timers = jQuery.timers,
				length = queue ? queue.length : 0;

			// Enable finishing flag on private data
			data.finish = true;

			// Empty the queue first
			jQuery.queue( this, type, [] );

			if ( hooks && hooks.stop ) {
				hooks.stop.call( this, true );
			}

			// Look for any active animations, and finish them
			for ( index = timers.length; index--; ) {
				if ( timers[ index ].elem === this && timers[ index ].queue === type ) {
					timers[ index ].anim.stop( true );
					timers.splice( index, 1 );
				}
			}

			// Look for any animations in the old queue and finish them
			for ( index = 0; index < length; index++ ) {
				if ( queue[ index ] && queue[ index ].finish ) {
					queue[ index ].finish.call( this );
				}
			}

			// Turn off finishing flag
			delete data.finish;
		} );
	}
} );

jQuery.each( [ "toggle", "show", "hide" ], function( i, name ) {
	var cssFn = jQuery.fn[ name ];
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return speed == null || typeof speed === "boolean" ?
			cssFn.apply( this, arguments ) :
			this.animate( genFx( name, true ), speed, easing, callback );
	};
} );

// Generate shortcuts for custom animations
jQuery.each( {
	slideDown: genFx( "show" ),
	slideUp: genFx( "hide" ),
	slideToggle: genFx( "toggle" ),
	fadeIn: { opacity: "show" },
	fadeOut: { opacity: "hide" },
	fadeToggle: { opacity: "toggle" }
}, function( name, props ) {
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return this.animate( props, speed, easing, callback );
	};
} );

jQuery.timers = [];
jQuery.fx.tick = function() {
	var timer,
		i = 0,
		timers = jQuery.timers;

	fxNow = Date.now();

	for ( ; i < timers.length; i++ ) {
		timer = timers[ i ];

		// Run the timer and safely remove it when done (allowing for external removal)
		if ( !timer() && timers[ i ] === timer ) {
			timers.splice( i--, 1 );
		}
	}

	if ( !timers.length ) {
		jQuery.fx.stop();
	}
	fxNow = undefined;
};

jQuery.fx.timer = function( timer ) {
	jQuery.timers.push( timer );
	jQuery.fx.start();
};

jQuery.fx.interval = 13;
jQuery.fx.start = function() {
	if ( inProgress ) {
		return;
	}

	inProgress = true;
	schedule();
};

jQuery.fx.stop = function() {
	inProgress = null;
};

jQuery.fx.speeds = {
	slow: 600,
	fast: 200,

	// Default speed
	_default: 400
};


// Based off of the plugin by Clint Helfers, with permission.
// https://web.archive.org/web/20100324014747/http://blindsignals.com/index.php/2009/07/jquery-delay/
jQuery.fn.delay = function( time, type ) {
	time = jQuery.fx ? jQuery.fx.speeds[ time ] || time : time;
	type = type || "fx";

	return this.queue( type, function( next, hooks ) {
		var timeout = window.setTimeout( next, time );
		hooks.stop = function() {
			window.clearTimeout( timeout );
		};
	} );
};


( function() {
	var input = document.createElement( "input" ),
		select = document.createElement( "select" ),
		opt = select.appendChild( document.createElement( "option" ) );

	input.type = "checkbox";

	// Support: Android <=4.3 only
	// Default value for a checkbox should be "on"
	support.checkOn = input.value !== "";

	// Support: IE <=11 only
	// Must access selectedIndex to make default options select
	support.optSelected = opt.selected;

	// Support: IE <=11 only
	// An input loses its value after becoming a radio
	input = document.createElement( "input" );
	input.value = "t";
	input.type = "radio";
	support.radioValue = input.value === "t";
} )();


var boolHook,
	attrHandle = jQuery.expr.attrHandle;

jQuery.fn.extend( {
	attr: function( name, value ) {
		return access( this, jQuery.attr, name, value, arguments.length > 1 );
	},

	removeAttr: function( name ) {
		return this.each( function() {
			jQuery.removeAttr( this, name );
		} );
	}
} );

jQuery.extend( {
	attr: function( elem, name, value ) {
		var ret, hooks,
			nType = elem.nodeType;

		// Don't get/set attributes on text, comment and attribute nodes
		if ( nType === 3 || nType === 8 || nType === 2 ) {
			return;
		}

		// Fallback to prop when attributes are not supported
		if ( typeof elem.getAttribute === "undefined" ) {
			return jQuery.prop( elem, name, value );
		}

		// Attribute hooks are determined by the lowercase version
		// Grab necessary hook if one is defined
		if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {
			hooks = jQuery.attrHooks[ name.toLowerCase() ] ||
				( jQuery.expr.match.bool.test( name ) ? boolHook : undefined );
		}

		if ( value !== undefined ) {
			if ( value === null ) {
				jQuery.removeAttr( elem, name );
				return;
			}

			if ( hooks && "set" in hooks &&
				( ret = hooks.set( elem, value, name ) ) !== undefined ) {
				return ret;
			}

			elem.setAttribute( name, value + "" );
			return value;
		}

		if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
			return ret;
		}

		ret = jQuery.find.attr( elem, name );

		// Non-existent attributes return null, we normalize to undefined
		return ret == null ? undefined : ret;
	},

	attrHooks: {
		type: {
			set: function( elem, value ) {
				if ( !support.radioValue && value === "radio" &&
					nodeName( elem, "input" ) ) {
					var val = elem.value;
					elem.setAttribute( "type", value );
					if ( val ) {
						elem.value = val;
					}
					return value;
				}
			}
		}
	},

	removeAttr: function( elem, value ) {
		var name,
			i = 0,

			// Attribute names can contain non-HTML whitespace characters
			// https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
			attrNames = value && value.match( rnothtmlwhite );

		if ( attrNames && elem.nodeType === 1 ) {
			while ( ( name = attrNames[ i++ ] ) ) {
				elem.removeAttribute( name );
			}
		}
	}
} );

// Hooks for boolean attributes
boolHook = {
	set: function( elem, value, name ) {
		if ( value === false ) {

			// Remove boolean attributes when set to false
			jQuery.removeAttr( elem, name );
		} else {
			elem.setAttribute( name, name );
		}
		return name;
	}
};

jQuery.each( jQuery.expr.match.bool.source.match( /\w+/g ), function( i, name ) {
	var getter = attrHandle[ name ] || jQuery.find.attr;

	attrHandle[ name ] = function( elem, name, isXML ) {
		var ret, handle,
			lowercaseName = name.toLowerCase();

		if ( !isXML ) {

			// Avoid an infinite loop by temporarily removing this function from the getter
			handle = attrHandle[ lowercaseName ];
			attrHandle[ lowercaseName ] = ret;
			ret = getter( elem, name, isXML ) != null ?
				lowercaseName :
				null;
			attrHandle[ lowercaseName ] = handle;
		}
		return ret;
	};
} );




var rfocusable = /^(?:input|select|textarea|button)$/i,
	rclickable = /^(?:a|area)$/i;

jQuery.fn.extend( {
	prop: function( name, value ) {
		return access( this, jQuery.prop, name, value, arguments.length > 1 );
	},

	removeProp: function( name ) {
		return this.each( function() {
			delete this[ jQuery.propFix[ name ] || name ];
		} );
	}
} );

jQuery.extend( {
	prop: function( elem, name, value ) {
		var ret, hooks,
			nType = elem.nodeType;

		// Don't get/set properties on text, comment and attribute nodes
		if ( nType === 3 || nType === 8 || nType === 2 ) {
			return;
		}

		if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {

			// Fix name and attach hooks
			name = jQuery.propFix[ name ] || name;
			hooks = jQuery.propHooks[ name ];
		}

		if ( value !== undefined ) {
			if ( hooks && "set" in hooks &&
				( ret = hooks.set( elem, value, name ) ) !== undefined ) {
				return ret;
			}

			return ( elem[ name ] = value );
		}

		if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
			return ret;
		}

		return elem[ name ];
	},

	propHooks: {
		tabIndex: {
			get: function( elem ) {

				// Support: IE <=9 - 11 only
				// elem.tabIndex doesn't always return the
				// correct value when it hasn't been explicitly set
				// https://web.archive.org/web/20141116233347/http://fluidproject.org/blog/2008/01/09/getting-setting-and-removing-tabindex-values-with-javascript/
				// Use proper attribute retrieval(#12072)
				var tabindex = jQuery.find.attr( elem, "tabindex" );

				if ( tabindex ) {
					return parseInt( tabindex, 10 );
				}

				if (
					rfocusable.test( elem.nodeName ) ||
					rclickable.test( elem.nodeName ) &&
					elem.href
				) {
					return 0;
				}

				return -1;
			}
		}
	},

	propFix: {
		"for": "htmlFor",
		"class": "className"
	}
} );

// Support: IE <=11 only
// Accessing the selectedIndex property
// forces the browser to respect setting selected
// on the option
// The getter ensures a default option is selected
// when in an optgroup
// eslint rule "no-unused-expressions" is disabled for this code
// since it considers such accessions noop
if ( !support.optSelected ) {
	jQuery.propHooks.selected = {
		get: function( elem ) {

			/* eslint no-unused-expressions: "off" */

			var parent = elem.parentNode;
			if ( parent && parent.parentNode ) {
				parent.parentNode.selectedIndex;
			}
			return null;
		},
		set: function( elem ) {

			/* eslint no-unused-expressions: "off" */

			var parent = elem.parentNode;
			if ( parent ) {
				parent.selectedIndex;

				if ( parent.parentNode ) {
					parent.parentNode.selectedIndex;
				}
			}
		}
	};
}

jQuery.each( [
	"tabIndex",
	"readOnly",
	"maxLength",
	"cellSpacing",
	"cellPadding",
	"rowSpan",
	"colSpan",
	"useMap",
	"frameBorder",
	"contentEditable"
], function() {
	jQuery.propFix[ this.toLowerCase() ] = this;
} );




	// Strip and collapse whitespace according to HTML spec
	// https://infra.spec.whatwg.org/#strip-and-collapse-ascii-whitespace
	function stripAndCollapse( value ) {
		var tokens = value.match( rnothtmlwhite ) || [];
		return tokens.join( " " );
	}


function getClass( elem ) {
	return elem.getAttribute && elem.getAttribute( "class" ) || "";
}

function classesToArray( value ) {
	if ( Array.isArray( value ) ) {
		return value;
	}
	if ( typeof value === "string" ) {
		return value.match( rnothtmlwhite ) || [];
	}
	return [];
}

jQuery.fn.extend( {
	addClass: function( value ) {
		var classes, elem, cur, curValue, clazz, j, finalValue,
			i = 0;

		if ( isFunction( value ) ) {
			return this.each( function( j ) {
				jQuery( this ).addClass( value.call( this, j, getClass( this ) ) );
			} );
		}

		classes = classesToArray( value );

		if ( classes.length ) {
			while ( ( elem = this[ i++ ] ) ) {
				curValue = getClass( elem );
				cur = elem.nodeType === 1 && ( " " + stripAndCollapse( curValue ) + " " );

				if ( cur ) {
					j = 0;
					while ( ( clazz = classes[ j++ ] ) ) {
						if ( cur.indexOf( " " + clazz + " " ) < 0 ) {
							cur += clazz + " ";
						}
					}

					// Only assign if different to avoid unneeded rendering.
					finalValue = stripAndCollapse( cur );
					if ( curValue !== finalValue ) {
						elem.setAttribute( "class", finalValue );
					}
				}
			}
		}

		return this;
	},

	removeClass: function( value ) {
		var classes, elem, cur, curValue, clazz, j, finalValue,
			i = 0;

		if ( isFunction( value ) ) {
			return this.each( function( j ) {
				jQuery( this ).removeClass( value.call( this, j, getClass( this ) ) );
			} );
		}

		if ( !arguments.length ) {
			return this.attr( "class", "" );
		}

		classes = classesToArray( value );

		if ( classes.length ) {
			while ( ( elem = this[ i++ ] ) ) {
				curValue = getClass( elem );

				// This expression is here for better compressibility (see addClass)
				cur = elem.nodeType === 1 && ( " " + stripAndCollapse( curValue ) + " " );

				if ( cur ) {
					j = 0;
					while ( ( clazz = classes[ j++ ] ) ) {

						// Remove *all* instances
						while ( cur.indexOf( " " + clazz + " " ) > -1 ) {
							cur = cur.replace( " " + clazz + " ", " " );
						}
					}

					// Only assign if different to avoid unneeded rendering.
					finalValue = stripAndCollapse( cur );
					if ( curValue !== finalValue ) {
						elem.setAttribute( "class", finalValue );
					}
				}
			}
		}

		return this;
	},

	toggleClass: function( value, stateVal ) {
		var type = typeof value,
			isValidValue = type === "string" || Array.isArray( value );

		if ( typeof stateVal === "boolean" && isValidValue ) {
			return stateVal ? this.addClass( value ) : this.removeClass( value );
		}

		if ( isFunction( value ) ) {
			return this.each( function( i ) {
				jQuery( this ).toggleClass(
					value.call( this, i, getClass( this ), stateVal ),
					stateVal
				);
			} );
		}

		return this.each( function() {
			var className, i, self, classNames;

			if ( isValidValue ) {

				// Toggle individual class names
				i = 0;
				self = jQuery( this );
				classNames = classesToArray( value );

				while ( ( className = classNames[ i++ ] ) ) {

					// Check each className given, space separated list
					if ( self.hasClass( className ) ) {
						self.removeClass( className );
					} else {
						self.addClass( className );
					}
				}

			// Toggle whole class name
			} else if ( value === undefined || type === "boolean" ) {
				className = getClass( this );
				if ( className ) {

					// Store className if set
					dataPriv.set( this, "__className__", className );
				}

				// If the element has a class name or if we're passed `false`,
				// then remove the whole classname (if there was one, the above saved it).
				// Otherwise bring back whatever was previously saved (if anything),
				// falling back to the empty string if nothing was stored.
				if ( this.setAttribute ) {
					this.setAttribute( "class",
						className || value === false ?
						"" :
						dataPriv.get( this, "__className__" ) || ""
					);
				}
			}
		} );
	},

	hasClass: function( selector ) {
		var className, elem,
			i = 0;

		className = " " + selector + " ";
		while ( ( elem = this[ i++ ] ) ) {
			if ( elem.nodeType === 1 &&
				( " " + stripAndCollapse( getClass( elem ) ) + " " ).indexOf( className ) > -1 ) {
					return true;
			}
		}

		return false;
	}
} );




var rreturn = /\r/g;

jQuery.fn.extend( {
	val: function( value ) {
		var hooks, ret, valueIsFunction,
			elem = this[ 0 ];

		if ( !arguments.length ) {
			if ( elem ) {
				hooks = jQuery.valHooks[ elem.type ] ||
					jQuery.valHooks[ elem.nodeName.toLowerCase() ];

				if ( hooks &&
					"get" in hooks &&
					( ret = hooks.get( elem, "value" ) ) !== undefined
				) {
					return ret;
				}

				ret = elem.value;

				// Handle most common string cases
				if ( typeof ret === "string" ) {
					return ret.replace( rreturn, "" );
				}

				// Handle cases where value is null/undef or number
				return ret == null ? "" : ret;
			}

			return;
		}

		valueIsFunction = isFunction( value );

		return this.each( function( i ) {
			var val;

			if ( this.nodeType !== 1 ) {
				return;
			}

			if ( valueIsFunction ) {
				val = value.call( this, i, jQuery( this ).val() );
			} else {
				val = value;
			}

			// Treat null/undefined as ""; convert numbers to string
			if ( val == null ) {
				val = "";

			} else if ( typeof val === "number" ) {
				val += "";

			} else if ( Array.isArray( val ) ) {
				val = jQuery.map( val, function( value ) {
					return value == null ? "" : value + "";
				} );
			}

			hooks = jQuery.valHooks[ this.type ] || jQuery.valHooks[ this.nodeName.toLowerCase() ];

			// If set returns undefined, fall back to normal setting
			if ( !hooks || !( "set" in hooks ) || hooks.set( this, val, "value" ) === undefined ) {
				this.value = val;
			}
		} );
	}
} );

jQuery.extend( {
	valHooks: {
		option: {
			get: function( elem ) {

				var val = jQuery.find.attr( elem, "value" );
				return val != null ?
					val :

					// Support: IE <=10 - 11 only
					// option.text throws exceptions (#14686, #14858)
					// Strip and collapse whitespace
					// https://html.spec.whatwg.org/#strip-and-collapse-whitespace
					stripAndCollapse( jQuery.text( elem ) );
			}
		},
		select: {
			get: function( elem ) {
				var value, option, i,
					options = elem.options,
					index = elem.selectedIndex,
					one = elem.type === "select-one",
					values = one ? null : [],
					max = one ? index + 1 : options.length;

				if ( index < 0 ) {
					i = max;

				} else {
					i = one ? index : 0;
				}

				// Loop through all the selected options
				for ( ; i < max; i++ ) {
					option = options[ i ];

					// Support: IE <=9 only
					// IE8-9 doesn't update selected after form reset (#2551)
					if ( ( option.selected || i === index ) &&

							// Don't return options that are disabled or in a disabled optgroup
							!option.disabled &&
							( !option.parentNode.disabled ||
								!nodeName( option.parentNode, "optgroup" ) ) ) {

						// Get the specific value for the option
						value = jQuery( option ).val();

						// We don't need an array for one selects
						if ( one ) {
							return value;
						}

						// Multi-Selects return an array
						values.push( value );
					}
				}

				return values;
			},

			set: function( elem, value ) {
				var optionSet, option,
					options = elem.options,
					values = jQuery.makeArray( value ),
					i = options.length;

				while ( i-- ) {
					option = options[ i ];

					/* eslint-disable no-cond-assign */

					if ( option.selected =
						jQuery.inArray( jQuery.valHooks.option.get( option ), values ) > -1
					) {
						optionSet = true;
					}

					/* eslint-enable no-cond-assign */
				}

				// Force browsers to behave consistently when non-matching value is set
				if ( !optionSet ) {
					elem.selectedIndex = -1;
				}
				return values;
			}
		}
	}
} );

// Radios and checkboxes getter/setter
jQuery.each( [ "radio", "checkbox" ], function() {
	jQuery.valHooks[ this ] = {
		set: function( elem, value ) {
			if ( Array.isArray( value ) ) {
				return ( elem.checked = jQuery.inArray( jQuery( elem ).val(), value ) > -1 );
			}
		}
	};
	if ( !support.checkOn ) {
		jQuery.valHooks[ this ].get = function( elem ) {
			return elem.getAttribute( "value" ) === null ? "on" : elem.value;
		};
	}
} );




// Return jQuery for attributes-only inclusion


support.focusin = "onfocusin" in window;


var rfocusMorph = /^(?:focusinfocus|focusoutblur)$/,
	stopPropagationCallback = function( e ) {
		e.stopPropagation();
	};

jQuery.extend( jQuery.event, {

	trigger: function( event, data, elem, onlyHandlers ) {

		var i, cur, tmp, bubbleType, ontype, handle, special, lastElement,
			eventPath = [ elem || document ],
			type = hasOwn.call( event, "type" ) ? event.type : event,
			namespaces = hasOwn.call( event, "namespace" ) ? event.namespace.split( "." ) : [];

		cur = lastElement = tmp = elem = elem || document;

		// Don't do events on text and comment nodes
		if ( elem.nodeType === 3 || elem.nodeType === 8 ) {
			return;
		}

		// focus/blur morphs to focusin/out; ensure we're not firing them right now
		if ( rfocusMorph.test( type + jQuery.event.triggered ) ) {
			return;
		}

		if ( type.indexOf( "." ) > -1 ) {

			// Namespaced trigger; create a regexp to match event type in handle()
			namespaces = type.split( "." );
			type = namespaces.shift();
			namespaces.sort();
		}
		ontype = type.indexOf( ":" ) < 0 && "on" + type;

		// Caller can pass in a jQuery.Event object, Object, or just an event type string
		event = event[ jQuery.expando ] ?
			event :
			new jQuery.Event( type, typeof event === "object" && event );

		// Trigger bitmask: & 1 for native handlers; & 2 for jQuery (always true)
		event.isTrigger = onlyHandlers ? 2 : 3;
		event.namespace = namespaces.join( "." );
		event.rnamespace = event.namespace ?
			new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" ) :
			null;

		// Clean up the event in case it is being reused
		event.result = undefined;
		if ( !event.target ) {
			event.target = elem;
		}

		// Clone any incoming data and prepend the event, creating the handler arg list
		data = data == null ?
			[ event ] :
			jQuery.makeArray( data, [ event ] );

		// Allow special events to draw outside the lines
		special = jQuery.event.special[ type ] || {};
		if ( !onlyHandlers && special.trigger && special.trigger.apply( elem, data ) === false ) {
			return;
		}

		// Determine event propagation path in advance, per W3C events spec (#9951)
		// Bubble up to document, then to window; watch for a global ownerDocument var (#9724)
		if ( !onlyHandlers && !special.noBubble && !isWindow( elem ) ) {

			bubbleType = special.delegateType || type;
			if ( !rfocusMorph.test( bubbleType + type ) ) {
				cur = cur.parentNode;
			}
			for ( ; cur; cur = cur.parentNode ) {
				eventPath.push( cur );
				tmp = cur;
			}

			// Only add window if we got to document (e.g., not plain obj or detached DOM)
			if ( tmp === ( elem.ownerDocument || document ) ) {
				eventPath.push( tmp.defaultView || tmp.parentWindow || window );
			}
		}

		// Fire handlers on the event path
		i = 0;
		while ( ( cur = eventPath[ i++ ] ) && !event.isPropagationStopped() ) {
			lastElement = cur;
			event.type = i > 1 ?
				bubbleType :
				special.bindType || type;

			// jQuery handler
			handle = ( dataPriv.get( cur, "events" ) || {} )[ event.type ] &&
				dataPriv.get( cur, "handle" );
			if ( handle ) {
				handle.apply( cur, data );
			}

			// Native handler
			handle = ontype && cur[ ontype ];
			if ( handle && handle.apply && acceptData( cur ) ) {
				event.result = handle.apply( cur, data );
				if ( event.result === false ) {
					event.preventDefault();
				}
			}
		}
		event.type = type;

		// If nobody prevented the default action, do it now
		if ( !onlyHandlers && !event.isDefaultPrevented() ) {

			if ( ( !special._default ||
				special._default.apply( eventPath.pop(), data ) === false ) &&
				acceptData( elem ) ) {

				// Call a native DOM method on the target with the same name as the event.
				// Don't do default actions on window, that's where global variables be (#6170)
				if ( ontype && isFunction( elem[ type ] ) && !isWindow( elem ) ) {

					// Don't re-trigger an onFOO event when we call its FOO() method
					tmp = elem[ ontype ];

					if ( tmp ) {
						elem[ ontype ] = null;
					}

					// Prevent re-triggering of the same event, since we already bubbled it above
					jQuery.event.triggered = type;

					if ( event.isPropagationStopped() ) {
						lastElement.addEventListener( type, stopPropagationCallback );
					}

					elem[ type ]();

					if ( event.isPropagationStopped() ) {
						lastElement.removeEventListener( type, stopPropagationCallback );
					}

					jQuery.event.triggered = undefined;

					if ( tmp ) {
						elem[ ontype ] = tmp;
					}
				}
			}
		}

		return event.result;
	},

	// Piggyback on a donor event to simulate a different one
	// Used only for `focus(in | out)` events
	simulate: function( type, elem, event ) {
		var e = jQuery.extend(
			new jQuery.Event(),
			event,
			{
				type: type,
				isSimulated: true
			}
		);

		jQuery.event.trigger( e, null, elem );
	}

} );

jQuery.fn.extend( {

	trigger: function( type, data ) {
		return this.each( function() {
			jQuery.event.trigger( type, data, this );
		} );
	},
	triggerHandler: function( type, data ) {
		var elem = this[ 0 ];
		if ( elem ) {
			return jQuery.event.trigger( type, data, elem, true );
		}
	}
} );


// Support: Firefox <=44
// Firefox doesn't have focus(in | out) events
// Related ticket - https://bugzilla.mozilla.org/show_bug.cgi?id=687787
//
// Support: Chrome <=48 - 49, Safari <=9.0 - 9.1
// focus(in | out) events fire after focus & blur events,
// which is spec violation - http://www.w3.org/TR/DOM-Level-3-Events/#events-focusevent-event-order
// Related ticket - https://bugs.chromium.org/p/chromium/issues/detail?id=449857
if ( !support.focusin ) {
	jQuery.each( { focus: "focusin", blur: "focusout" }, function( orig, fix ) {

		// Attach a single capturing handler on the document while someone wants focusin/focusout
		var handler = function( event ) {
			jQuery.event.simulate( fix, event.target, jQuery.event.fix( event ) );
		};

		jQuery.event.special[ fix ] = {
			setup: function() {
				var doc = this.ownerDocument || this,
					attaches = dataPriv.access( doc, fix );

				if ( !attaches ) {
					doc.addEventListener( orig, handler, true );
				}
				dataPriv.access( doc, fix, ( attaches || 0 ) + 1 );
			},
			teardown: function() {
				var doc = this.ownerDocument || this,
					attaches = dataPriv.access( doc, fix ) - 1;

				if ( !attaches ) {
					doc.removeEventListener( orig, handler, true );
					dataPriv.remove( doc, fix );

				} else {
					dataPriv.access( doc, fix, attaches );
				}
			}
		};
	} );
}
var location = window.location;

var nonce = Date.now();

var rquery = ( /\?/ );



// Cross-browser xml parsing
jQuery.parseXML = function( data ) {
	var xml;
	if ( !data || typeof data !== "string" ) {
		return null;
	}

	// Support: IE 9 - 11 only
	// IE throws on parseFromString with invalid input.
	try {
		xml = ( new window.DOMParser() ).parseFromString( data, "text/xml" );
	} catch ( e ) {
		xml = undefined;
	}

	if ( !xml || xml.getElementsByTagName( "parsererror" ).length ) {
		jQuery.error( "Invalid XML: " + data );
	}
	return xml;
};


var
	rbracket = /\[\]$/,
	rCRLF = /\r?\n/g,
	rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
	rsubmittable = /^(?:input|select|textarea|keygen)/i;

function buildParams( prefix, obj, traditional, add ) {
	var name;

	if ( Array.isArray( obj ) ) {

		// Serialize array item.
		jQuery.each( obj, function( i, v ) {
			if ( traditional || rbracket.test( prefix ) ) {

				// Treat each array item as a scalar.
				add( prefix, v );

			} else {

				// Item is non-scalar (array or object), encode its numeric index.
				buildParams(
					prefix + "[" + ( typeof v === "object" && v != null ? i : "" ) + "]",
					v,
					traditional,
					add
				);
			}
		} );

	} else if ( !traditional && toType( obj ) === "object" ) {

		// Serialize object item.
		for ( name in obj ) {
			buildParams( prefix + "[" + name + "]", obj[ name ], traditional, add );
		}

	} else {

		// Serialize scalar item.
		add( prefix, obj );
	}
}

// Serialize an array of form elements or a set of
// key/values into a query string
jQuery.param = function( a, traditional ) {
	var prefix,
		s = [],
		add = function( key, valueOrFunction ) {

			// If value is a function, invoke it and use its return value
			var value = isFunction( valueOrFunction ) ?
				valueOrFunction() :
				valueOrFunction;

			s[ s.length ] = encodeURIComponent( key ) + "=" +
				encodeURIComponent( value == null ? "" : value );
		};

	// If an array was passed in, assume that it is an array of form elements.
	if ( Array.isArray( a ) || ( a.jquery && !jQuery.isPlainObject( a ) ) ) {

		// Serialize the form elements
		jQuery.each( a, function() {
			add( this.name, this.value );
		} );

	} else {

		// If traditional, encode the "old" way (the way 1.3.2 or older
		// did it), otherwise encode params recursively.
		for ( prefix in a ) {
			buildParams( prefix, a[ prefix ], traditional, add );
		}
	}

	// Return the resulting serialization
	return s.join( "&" );
};

jQuery.fn.extend( {
	serialize: function() {
		return jQuery.param( this.serializeArray() );
	},
	serializeArray: function() {
		return this.map( function() {

			// Can add propHook for "elements" to filter or add form elements
			var elements = jQuery.prop( this, "elements" );
			return elements ? jQuery.makeArray( elements ) : this;
		} )
		.filter( function() {
			var type = this.type;

			// Use .is( ":disabled" ) so that fieldset[disabled] works
			return this.name && !jQuery( this ).is( ":disabled" ) &&
				rsubmittable.test( this.nodeName ) && !rsubmitterTypes.test( type ) &&
				( this.checked || !rcheckableType.test( type ) );
		} )
		.map( function( i, elem ) {
			var val = jQuery( this ).val();

			if ( val == null ) {
				return null;
			}

			if ( Array.isArray( val ) ) {
				return jQuery.map( val, function( val ) {
					return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
				} );
			}

			return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
		} ).get();
	}
} );


var
	r20 = /%20/g,
	rhash = /#.*$/,
	rantiCache = /([?&])_=[^&]*/,
	rheaders = /^(.*?):[ \t]*([^\r\n]*)$/mg,

	// #7653, #8125, #8152: local protocol detection
	rlocalProtocol = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
	rnoContent = /^(?:GET|HEAD)$/,
	rprotocol = /^\/\//,

	/* Prefilters
	 * 1) They are useful to introduce custom dataTypes (see ajax/jsonp.js for an example)
	 * 2) These are called:
	 *    - BEFORE asking for a transport
	 *    - AFTER param serialization (s.data is a string if s.processData is true)
	 * 3) key is the dataType
	 * 4) the catchall symbol "*" can be used
	 * 5) execution will start with transport dataType and THEN continue down to "*" if needed
	 */
	prefilters = {},

	/* Transports bindings
	 * 1) key is the dataType
	 * 2) the catchall symbol "*" can be used
	 * 3) selection will start with transport dataType and THEN go to "*" if needed
	 */
	transports = {},

	// Avoid comment-prolog char sequence (#10098); must appease lint and evade compression
	allTypes = "*/".concat( "*" ),

	// Anchor tag for parsing the document origin
	originAnchor = document.createElement( "a" );
	originAnchor.href = location.href;

// Base "constructor" for jQuery.ajaxPrefilter and jQuery.ajaxTransport
function addToPrefiltersOrTransports( structure ) {

	// dataTypeExpression is optional and defaults to "*"
	return function( dataTypeExpression, func ) {

		if ( typeof dataTypeExpression !== "string" ) {
			func = dataTypeExpression;
			dataTypeExpression = "*";
		}

		var dataType,
			i = 0,
			dataTypes = dataTypeExpression.toLowerCase().match( rnothtmlwhite ) || [];

		if ( isFunction( func ) ) {

			// For each dataType in the dataTypeExpression
			while ( ( dataType = dataTypes[ i++ ] ) ) {

				// Prepend if requested
				if ( dataType[ 0 ] === "+" ) {
					dataType = dataType.slice( 1 ) || "*";
					( structure[ dataType ] = structure[ dataType ] || [] ).unshift( func );

				// Otherwise append
				} else {
					( structure[ dataType ] = structure[ dataType ] || [] ).push( func );
				}
			}
		}
	};
}

// Base inspection function for prefilters and transports
function inspectPrefiltersOrTransports( structure, options, originalOptions, jqXHR ) {

	var inspected = {},
		seekingTransport = ( structure === transports );

	function inspect( dataType ) {
		var selected;
		inspected[ dataType ] = true;
		jQuery.each( structure[ dataType ] || [], function( _, prefilterOrFactory ) {
			var dataTypeOrTransport = prefilterOrFactory( options, originalOptions, jqXHR );
			if ( typeof dataTypeOrTransport === "string" &&
				!seekingTransport && !inspected[ dataTypeOrTransport ] ) {

				options.dataTypes.unshift( dataTypeOrTransport );
				inspect( dataTypeOrTransport );
				return false;
			} else if ( seekingTransport ) {
				return !( selected = dataTypeOrTransport );
			}
		} );
		return selected;
	}

	return inspect( options.dataTypes[ 0 ] ) || !inspected[ "*" ] && inspect( "*" );
}

// A special extend for ajax options
// that takes "flat" options (not to be deep extended)
// Fixes #9887
function ajaxExtend( target, src ) {
	var key, deep,
		flatOptions = jQuery.ajaxSettings.flatOptions || {};

	for ( key in src ) {
		if ( src[ key ] !== undefined ) {
			( flatOptions[ key ] ? target : ( deep || ( deep = {} ) ) )[ key ] = src[ key ];
		}
	}
	if ( deep ) {
		jQuery.extend( true, target, deep );
	}

	return target;
}

/* Handles responses to an ajax request:
 * - finds the right dataType (mediates between content-type and expected dataType)
 * - returns the corresponding response
 */
function ajaxHandleResponses( s, jqXHR, responses ) {

	var ct, type, finalDataType, firstDataType,
		contents = s.contents,
		dataTypes = s.dataTypes;

	// Remove auto dataType and get content-type in the process
	while ( dataTypes[ 0 ] === "*" ) {
		dataTypes.shift();
		if ( ct === undefined ) {
			ct = s.mimeType || jqXHR.getResponseHeader( "Content-Type" );
		}
	}

	// Check if we're dealing with a known content-type
	if ( ct ) {
		for ( type in contents ) {
			if ( contents[ type ] && contents[ type ].test( ct ) ) {
				dataTypes.unshift( type );
				break;
			}
		}
	}

	// Check to see if we have a response for the expected dataType
	if ( dataTypes[ 0 ] in responses ) {
		finalDataType = dataTypes[ 0 ];
	} else {

		// Try convertible dataTypes
		for ( type in responses ) {
			if ( !dataTypes[ 0 ] || s.converters[ type + " " + dataTypes[ 0 ] ] ) {
				finalDataType = type;
				break;
			}
			if ( !firstDataType ) {
				firstDataType = type;
			}
		}

		// Or just use first one
		finalDataType = finalDataType || firstDataType;
	}

	// If we found a dataType
	// We add the dataType to the list if needed
	// and return the corresponding response
	if ( finalDataType ) {
		if ( finalDataType !== dataTypes[ 0 ] ) {
			dataTypes.unshift( finalDataType );
		}
		return responses[ finalDataType ];
	}
}

/* Chain conversions given the request and the original response
 * Also sets the responseXXX fields on the jqXHR instance
 */
function ajaxConvert( s, response, jqXHR, isSuccess ) {
	var conv2, current, conv, tmp, prev,
		converters = {},

		// Work with a copy of dataTypes in case we need to modify it for conversion
		dataTypes = s.dataTypes.slice();

	// Create converters map with lowercased keys
	if ( dataTypes[ 1 ] ) {
		for ( conv in s.converters ) {
			converters[ conv.toLowerCase() ] = s.converters[ conv ];
		}
	}

	current = dataTypes.shift();

	// Convert to each sequential dataType
	while ( current ) {

		if ( s.responseFields[ current ] ) {
			jqXHR[ s.responseFields[ current ] ] = response;
		}

		// Apply the dataFilter if provided
		if ( !prev && isSuccess && s.dataFilter ) {
			response = s.dataFilter( response, s.dataType );
		}

		prev = current;
		current = dataTypes.shift();

		if ( current ) {

			// There's only work to do if current dataType is non-auto
			if ( current === "*" ) {

				current = prev;

			// Convert response if prev dataType is non-auto and differs from current
			} else if ( prev !== "*" && prev !== current ) {

				// Seek a direct converter
				conv = converters[ prev + " " + current ] || converters[ "* " + current ];

				// If none found, seek a pair
				if ( !conv ) {
					for ( conv2 in converters ) {

						// If conv2 outputs current
						tmp = conv2.split( " " );
						if ( tmp[ 1 ] === current ) {

							// If prev can be converted to accepted input
							conv = converters[ prev + " " + tmp[ 0 ] ] ||
								converters[ "* " + tmp[ 0 ] ];
							if ( conv ) {

								// Condense equivalence converters
								if ( conv === true ) {
									conv = converters[ conv2 ];

								// Otherwise, insert the intermediate dataType
								} else if ( converters[ conv2 ] !== true ) {
									current = tmp[ 0 ];
									dataTypes.unshift( tmp[ 1 ] );
								}
								break;
							}
						}
					}
				}

				// Apply converter (if not an equivalence)
				if ( conv !== true ) {

					// Unless errors are allowed to bubble, catch and return them
					if ( conv && s.throws ) {
						response = conv( response );
					} else {
						try {
							response = conv( response );
						} catch ( e ) {
							return {
								state: "parsererror",
								error: conv ? e : "No conversion from " + prev + " to " + current
							};
						}
					}
				}
			}
		}
	}

	return { state: "success", data: response };
}

jQuery.extend( {

	// Counter for holding the number of active queries
	active: 0,

	// Last-Modified header cache for next request
	lastModified: {},
	etag: {},

	ajaxSettings: {
		url: location.href,
		type: "GET",
		isLocal: rlocalProtocol.test( location.protocol ),
		global: true,
		processData: true,
		async: true,
		contentType: "application/x-www-form-urlencoded; charset=UTF-8",

		/*
		timeout: 0,
		data: null,
		dataType: null,
		username: null,
		password: null,
		cache: null,
		throws: false,
		traditional: false,
		headers: {},
		*/

		accepts: {
			"*": allTypes,
			text: "text/plain",
			html: "text/html",
			xml: "application/xml, text/xml",
			json: "application/json, text/javascript"
		},

		contents: {
			xml: /\bxml\b/,
			html: /\bhtml/,
			json: /\bjson\b/
		},

		responseFields: {
			xml: "responseXML",
			text: "responseText",
			json: "responseJSON"
		},

		// Data converters
		// Keys separate source (or catchall "*") and destination types with a single space
		converters: {

			// Convert anything to text
			"* text": String,

			// Text to html (true = no transformation)
			"text html": true,

			// Evaluate text as a json expression
			"text json": JSON.parse,

			// Parse text as xml
			"text xml": jQuery.parseXML
		},

		// For options that shouldn't be deep extended:
		// you can add your own custom options here if
		// and when you create one that shouldn't be
		// deep extended (see ajaxExtend)
		flatOptions: {
			url: true,
			context: true
		}
	},

	// Creates a full fledged settings object into target
	// with both ajaxSettings and settings fields.
	// If target is omitted, writes into ajaxSettings.
	ajaxSetup: function( target, settings ) {
		return settings ?

			// Building a settings object
			ajaxExtend( ajaxExtend( target, jQuery.ajaxSettings ), settings ) :

			// Extending ajaxSettings
			ajaxExtend( jQuery.ajaxSettings, target );
	},

	ajaxPrefilter: addToPrefiltersOrTransports( prefilters ),
	ajaxTransport: addToPrefiltersOrTransports( transports ),

	// Main method
	ajax: function( url, options ) {

		// If url is an object, simulate pre-1.5 signature
		if ( typeof url === "object" ) {
			options = url;
			url = undefined;
		}

		// Force options to be an object
		options = options || {};

		var transport,

			// URL without anti-cache param
			cacheURL,

			// Response headers
			responseHeadersString,
			responseHeaders,

			// timeout handle
			timeoutTimer,

			// Url cleanup var
			urlAnchor,

			// Request state (becomes false upon send and true upon completion)
			completed,

			// To know if global events are to be dispatched
			fireGlobals,

			// Loop variable
			i,

			// uncached part of the url
			uncached,

			// Create the final options object
			s = jQuery.ajaxSetup( {}, options ),

			// Callbacks context
			callbackContext = s.context || s,

			// Context for global events is callbackContext if it is a DOM node or jQuery collection
			globalEventContext = s.context &&
				( callbackContext.nodeType || callbackContext.jquery ) ?
					jQuery( callbackContext ) :
					jQuery.event,

			// Deferreds
			deferred = jQuery.Deferred(),
			completeDeferred = jQuery.Callbacks( "once memory" ),

			// Status-dependent callbacks
			statusCode = s.statusCode || {},

			// Headers (they are sent all at once)
			requestHeaders = {},
			requestHeadersNames = {},

			// Default abort message
			strAbort = "canceled",

			// Fake xhr
			jqXHR = {
				readyState: 0,

				// Builds headers hashtable if needed
				getResponseHeader: function( key ) {
					var match;
					if ( completed ) {
						if ( !responseHeaders ) {
							responseHeaders = {};
							while ( ( match = rheaders.exec( responseHeadersString ) ) ) {
								responseHeaders[ match[ 1 ].toLowerCase() ] = match[ 2 ];
							}
						}
						match = responseHeaders[ key.toLowerCase() ];
					}
					return match == null ? null : match;
				},

				// Raw string
				getAllResponseHeaders: function() {
					return completed ? responseHeadersString : null;
				},

				// Caches the header
				setRequestHeader: function( name, value ) {
					if ( completed == null ) {
						name = requestHeadersNames[ name.toLowerCase() ] =
							requestHeadersNames[ name.toLowerCase() ] || name;
						requestHeaders[ name ] = value;
					}
					return this;
				},

				// Overrides response content-type header
				overrideMimeType: function( type ) {
					if ( completed == null ) {
						s.mimeType = type;
					}
					return this;
				},

				// Status-dependent callbacks
				statusCode: function( map ) {
					var code;
					if ( map ) {
						if ( completed ) {

							// Execute the appropriate callbacks
							jqXHR.always( map[ jqXHR.status ] );
						} else {

							// Lazy-add the new callbacks in a way that preserves old ones
							for ( code in map ) {
								statusCode[ code ] = [ statusCode[ code ], map[ code ] ];
							}
						}
					}
					return this;
				},

				// Cancel the request
				abort: function( statusText ) {
					var finalText = statusText || strAbort;
					if ( transport ) {
						transport.abort( finalText );
					}
					done( 0, finalText );
					return this;
				}
			};

		// Attach deferreds
		deferred.promise( jqXHR );

		// Add protocol if not provided (prefilters might expect it)
		// Handle falsy url in the settings object (#10093: consistency with old signature)
		// We also use the url parameter if available
		s.url = ( ( url || s.url || location.href ) + "" )
			.replace( rprotocol, location.protocol + "//" );

		// Alias method option to type as per ticket #12004
		s.type = options.method || options.type || s.method || s.type;

		// Extract dataTypes list
		s.dataTypes = ( s.dataType || "*" ).toLowerCase().match( rnothtmlwhite ) || [ "" ];

		// A cross-domain request is in order when the origin doesn't match the current origin.
		if ( s.crossDomain == null ) {
			urlAnchor = document.createElement( "a" );

			// Support: IE <=8 - 11, Edge 12 - 15
			// IE throws exception on accessing the href property if url is malformed,
			// e.g. http://example.com:80x/
			try {
				urlAnchor.href = s.url;

				// Support: IE <=8 - 11 only
				// Anchor's host property isn't correctly set when s.url is relative
				urlAnchor.href = urlAnchor.href;
				s.crossDomain = originAnchor.protocol + "//" + originAnchor.host !==
					urlAnchor.protocol + "//" + urlAnchor.host;
			} catch ( e ) {

				// If there is an error parsing the URL, assume it is crossDomain,
				// it can be rejected by the transport if it is invalid
				s.crossDomain = true;
			}
		}

		// Convert data if not already a string
		if ( s.data && s.processData && typeof s.data !== "string" ) {
			s.data = jQuery.param( s.data, s.traditional );
		}

		// Apply prefilters
		inspectPrefiltersOrTransports( prefilters, s, options, jqXHR );

		// If request was aborted inside a prefilter, stop there
		if ( completed ) {
			return jqXHR;
		}

		// We can fire global events as of now if asked to
		// Don't fire events if jQuery.event is undefined in an AMD-usage scenario (#15118)
		fireGlobals = jQuery.event && s.global;

		// Watch for a new set of requests
		if ( fireGlobals && jQuery.active++ === 0 ) {
			jQuery.event.trigger( "ajaxStart" );
		}

		// Uppercase the type
		s.type = s.type.toUpperCase();

		// Determine if request has content
		s.hasContent = !rnoContent.test( s.type );

		// Save the URL in case we're toying with the If-Modified-Since
		// and/or If-None-Match header later on
		// Remove hash to simplify url manipulation
		cacheURL = s.url.replace( rhash, "" );

		// More options handling for requests with no content
		if ( !s.hasContent ) {

			// Remember the hash so we can put it back
			uncached = s.url.slice( cacheURL.length );

			// If data is available and should be processed, append data to url
			if ( s.data && ( s.processData || typeof s.data === "string" ) ) {
				cacheURL += ( rquery.test( cacheURL ) ? "&" : "?" ) + s.data;

				// #9682: remove data so that it's not used in an eventual retry
				delete s.data;
			}

			// Add or update anti-cache param if needed
			if ( s.cache === false ) {
				cacheURL = cacheURL.replace( rantiCache, "$1" );
				uncached = ( rquery.test( cacheURL ) ? "&" : "?" ) + "_=" + ( nonce++ ) + uncached;
			}

			// Put hash and anti-cache on the URL that will be requested (gh-1732)
			s.url = cacheURL + uncached;

		// Change '%20' to '+' if this is encoded form body content (gh-2658)
		} else if ( s.data && s.processData &&
			( s.contentType || "" ).indexOf( "application/x-www-form-urlencoded" ) === 0 ) {
			s.data = s.data.replace( r20, "+" );
		}

		// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
		if ( s.ifModified ) {
			if ( jQuery.lastModified[ cacheURL ] ) {
				jqXHR.setRequestHeader( "If-Modified-Since", jQuery.lastModified[ cacheURL ] );
			}
			if ( jQuery.etag[ cacheURL ] ) {
				jqXHR.setRequestHeader( "If-None-Match", jQuery.etag[ cacheURL ] );
			}
		}

		// Set the correct header, if data is being sent
		if ( s.data && s.hasContent && s.contentType !== false || options.contentType ) {
			jqXHR.setRequestHeader( "Content-Type", s.contentType );
		}

		// Set the Accepts header for the server, depending on the dataType
		jqXHR.setRequestHeader(
			"Accept",
			s.dataTypes[ 0 ] && s.accepts[ s.dataTypes[ 0 ] ] ?
				s.accepts[ s.dataTypes[ 0 ] ] +
					( s.dataTypes[ 0 ] !== "*" ? ", " + allTypes + "; q=0.01" : "" ) :
				s.accepts[ "*" ]
		);

		// Check for headers option
		for ( i in s.headers ) {
			jqXHR.setRequestHeader( i, s.headers[ i ] );
		}

		// Allow custom headers/mimetypes and early abort
		if ( s.beforeSend &&
			( s.beforeSend.call( callbackContext, jqXHR, s ) === false || completed ) ) {

			// Abort if not done already and return
			return jqXHR.abort();
		}

		// Aborting is no longer a cancellation
		strAbort = "abort";

		// Install callbacks on deferreds
		completeDeferred.add( s.complete );
		jqXHR.done( s.success );
		jqXHR.fail( s.error );

		// Get transport
		transport = inspectPrefiltersOrTransports( transports, s, options, jqXHR );

		// If no transport, we auto-abort
		if ( !transport ) {
			done( -1, "No Transport" );
		} else {
			jqXHR.readyState = 1;

			// Send global event
			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxSend", [ jqXHR, s ] );
			}

			// If request was aborted inside ajaxSend, stop there
			if ( completed ) {
				return jqXHR;
			}

			// Timeout
			if ( s.async && s.timeout > 0 ) {
				timeoutTimer = window.setTimeout( function() {
					jqXHR.abort( "timeout" );
				}, s.timeout );
			}

			try {
				completed = false;
				transport.send( requestHeaders, done );
			} catch ( e ) {

				// Rethrow post-completion exceptions
				if ( completed ) {
					throw e;
				}

				// Propagate others as results
				done( -1, e );
			}
		}

		// Callback for when everything is done
		function done( status, nativeStatusText, responses, headers ) {
			var isSuccess, success, error, response, modified,
				statusText = nativeStatusText;

			// Ignore repeat invocations
			if ( completed ) {
				return;
			}

			completed = true;

			// Clear timeout if it exists
			if ( timeoutTimer ) {
				window.clearTimeout( timeoutTimer );
			}

			// Dereference transport for early garbage collection
			// (no matter how long the jqXHR object will be used)
			transport = undefined;

			// Cache response headers
			responseHeadersString = headers || "";

			// Set readyState
			jqXHR.readyState = status > 0 ? 4 : 0;

			// Determine if successful
			isSuccess = status >= 200 && status < 300 || status === 304;

			// Get response data
			if ( responses ) {
				response = ajaxHandleResponses( s, jqXHR, responses );
			}

			// Convert no matter what (that way responseXXX fields are always set)
			response = ajaxConvert( s, response, jqXHR, isSuccess );

			// If successful, handle type chaining
			if ( isSuccess ) {

				// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
				if ( s.ifModified ) {
					modified = jqXHR.getResponseHeader( "Last-Modified" );
					if ( modified ) {
						jQuery.lastModified[ cacheURL ] = modified;
					}
					modified = jqXHR.getResponseHeader( "etag" );
					if ( modified ) {
						jQuery.etag[ cacheURL ] = modified;
					}
				}

				// if no content
				if ( status === 204 || s.type === "HEAD" ) {
					statusText = "nocontent";

				// if not modified
				} else if ( status === 304 ) {
					statusText = "notmodified";

				// If we have data, let's convert it
				} else {
					statusText = response.state;
					success = response.data;
					error = response.error;
					isSuccess = !error;
				}
			} else {

				// Extract error from statusText and normalize for non-aborts
				error = statusText;
				if ( status || !statusText ) {
					statusText = "error";
					if ( status < 0 ) {
						status = 0;
					}
				}
			}

			// Set data for the fake xhr object
			jqXHR.status = status;
			jqXHR.statusText = ( nativeStatusText || statusText ) + "";

			// Success/Error
			if ( isSuccess ) {
				deferred.resolveWith( callbackContext, [ success, statusText, jqXHR ] );
			} else {
				deferred.rejectWith( callbackContext, [ jqXHR, statusText, error ] );
			}

			// Status-dependent callbacks
			jqXHR.statusCode( statusCode );
			statusCode = undefined;

			if ( fireGlobals ) {
				globalEventContext.trigger( isSuccess ? "ajaxSuccess" : "ajaxError",
					[ jqXHR, s, isSuccess ? success : error ] );
			}

			// Complete
			completeDeferred.fireWith( callbackContext, [ jqXHR, statusText ] );

			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxComplete", [ jqXHR, s ] );

				// Handle the global AJAX counter
				if ( !( --jQuery.active ) ) {
					jQuery.event.trigger( "ajaxStop" );
				}
			}
		}

		return jqXHR;
	},

	getJSON: function( url, data, callback ) {
		return jQuery.get( url, data, callback, "json" );
	},

	getScript: function( url, callback ) {
		return jQuery.get( url, undefined, callback, "script" );
	}
} );

jQuery.each( [ "get", "post" ], function( i, method ) {
	jQuery[ method ] = function( url, data, callback, type ) {

		// Shift arguments if data argument was omitted
		if ( isFunction( data ) ) {
			type = type || callback;
			callback = data;
			data = undefined;
		}

		// The url can be an options object (which then must have .url)
		return jQuery.ajax( jQuery.extend( {
			url: url,
			type: method,
			dataType: type,
			data: data,
			success: callback
		}, jQuery.isPlainObject( url ) && url ) );
	};
} );


jQuery._evalUrl = function( url ) {
	return jQuery.ajax( {
		url: url,

		// Make this explicit, since user can override this through ajaxSetup (#11264)
		type: "GET",
		dataType: "script",
		cache: true,
		async: false,
		global: false,
		"throws": true
	} );
};


jQuery.fn.extend( {
	wrapAll: function( html ) {
		var wrap;

		if ( this[ 0 ] ) {
			if ( isFunction( html ) ) {
				html = html.call( this[ 0 ] );
			}

			// The elements to wrap the target around
			wrap = jQuery( html, this[ 0 ].ownerDocument ).eq( 0 ).clone( true );

			if ( this[ 0 ].parentNode ) {
				wrap.insertBefore( this[ 0 ] );
			}

			wrap.map( function() {
				var elem = this;

				while ( elem.firstElementChild ) {
					elem = elem.firstElementChild;
				}

				return elem;
			} ).append( this );
		}

		return this;
	},

	wrapInner: function( html ) {
		if ( isFunction( html ) ) {
			return this.each( function( i ) {
				jQuery( this ).wrapInner( html.call( this, i ) );
			} );
		}

		return this.each( function() {
			var self = jQuery( this ),
				contents = self.contents();

			if ( contents.length ) {
				contents.wrapAll( html );

			} else {
				self.append( html );
			}
		} );
	},

	wrap: function( html ) {
		var htmlIsFunction = isFunction( html );

		return this.each( function( i ) {
			jQuery( this ).wrapAll( htmlIsFunction ? html.call( this, i ) : html );
		} );
	},

	unwrap: function( selector ) {
		this.parent( selector ).not( "body" ).each( function() {
			jQuery( this ).replaceWith( this.childNodes );
		} );
		return this;
	}
} );


jQuery.expr.pseudos.hidden = function( elem ) {
	return !jQuery.expr.pseudos.visible( elem );
};
jQuery.expr.pseudos.visible = function( elem ) {
	return !!( elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length );
};




jQuery.ajaxSettings.xhr = function() {
	try {
		return new window.XMLHttpRequest();
	} catch ( e ) {}
};

var xhrSuccessStatus = {

		// File protocol always yields status code 0, assume 200
		0: 200,

		// Support: IE <=9 only
		// #1450: sometimes IE returns 1223 when it should be 204
		1223: 204
	},
	xhrSupported = jQuery.ajaxSettings.xhr();

support.cors = !!xhrSupported && ( "withCredentials" in xhrSupported );
support.ajax = xhrSupported = !!xhrSupported;

jQuery.ajaxTransport( function( options ) {
	var callback, errorCallback;

	// Cross domain only allowed if supported through XMLHttpRequest
	if ( support.cors || xhrSupported && !options.crossDomain ) {
		return {
			send: function( headers, complete ) {
				var i,
					xhr = options.xhr();

				xhr.open(
					options.type,
					options.url,
					options.async,
					options.username,
					options.password
				);

				// Apply custom fields if provided
				if ( options.xhrFields ) {
					for ( i in options.xhrFields ) {
						xhr[ i ] = options.xhrFields[ i ];
					}
				}

				// Override mime type if needed
				if ( options.mimeType && xhr.overrideMimeType ) {
					xhr.overrideMimeType( options.mimeType );
				}

				// X-Requested-With header
				// For cross-domain requests, seeing as conditions for a preflight are
				// akin to a jigsaw puzzle, we simply never set it to be sure.
				// (it can always be set on a per-request basis or even using ajaxSetup)
				// For same-domain requests, won't change header if already provided.
				if ( !options.crossDomain && !headers[ "X-Requested-With" ] ) {
					headers[ "X-Requested-With" ] = "XMLHttpRequest";
				}

				// Set headers
				for ( i in headers ) {
					xhr.setRequestHeader( i, headers[ i ] );
				}

				// Callback
				callback = function( type ) {
					return function() {
						if ( callback ) {
							callback = errorCallback = xhr.onload =
								xhr.onerror = xhr.onabort = xhr.ontimeout =
									xhr.onreadystatechange = null;

							if ( type === "abort" ) {
								xhr.abort();
							} else if ( type === "error" ) {

								// Support: IE <=9 only
								// On a manual native abort, IE9 throws
								// errors on any property access that is not readyState
								if ( typeof xhr.status !== "number" ) {
									complete( 0, "error" );
								} else {
									complete(

										// File: protocol always yields status 0; see #8605, #14207
										xhr.status,
										xhr.statusText
									);
								}
							} else {
								complete(
									xhrSuccessStatus[ xhr.status ] || xhr.status,
									xhr.statusText,

									// Support: IE <=9 only
									// IE9 has no XHR2 but throws on binary (trac-11426)
									// For XHR2 non-text, let the caller handle it (gh-2498)
									( xhr.responseType || "text" ) !== "text"  ||
									typeof xhr.responseText !== "string" ?
										{ binary: xhr.response } :
										{ text: xhr.responseText },
									xhr.getAllResponseHeaders()
								);
							}
						}
					};
				};

				// Listen to events
				xhr.onload = callback();
				errorCallback = xhr.onerror = xhr.ontimeout = callback( "error" );

				// Support: IE 9 only
				// Use onreadystatechange to replace onabort
				// to handle uncaught aborts
				if ( xhr.onabort !== undefined ) {
					xhr.onabort = errorCallback;
				} else {
					xhr.onreadystatechange = function() {

						// Check readyState before timeout as it changes
						if ( xhr.readyState === 4 ) {

							// Allow onerror to be called first,
							// but that will not handle a native abort
							// Also, save errorCallback to a variable
							// as xhr.onerror cannot be accessed
							window.setTimeout( function() {
								if ( callback ) {
									errorCallback();
								}
							} );
						}
					};
				}

				// Create the abort callback
				callback = callback( "abort" );

				try {

					// Do send the request (this may raise an exception)
					xhr.send( options.hasContent && options.data || null );
				} catch ( e ) {

					// #14683: Only rethrow if this hasn't been notified as an error yet
					if ( callback ) {
						throw e;
					}
				}
			},

			abort: function() {
				if ( callback ) {
					callback();
				}
			}
		};
	}
} );




// Prevent auto-execution of scripts when no explicit dataType was provided (See gh-2432)
jQuery.ajaxPrefilter( function( s ) {
	if ( s.crossDomain ) {
		s.contents.script = false;
	}
} );

// Install script dataType
jQuery.ajaxSetup( {
	accepts: {
		script: "text/javascript, application/javascript, " +
			"application/ecmascript, application/x-ecmascript"
	},
	contents: {
		script: /\b(?:java|ecma)script\b/
	},
	converters: {
		"text script": function( text ) {
			jQuery.globalEval( text );
			return text;
		}
	}
} );

// Handle cache's special case and crossDomain
jQuery.ajaxPrefilter( "script", function( s ) {
	if ( s.cache === undefined ) {
		s.cache = false;
	}
	if ( s.crossDomain ) {
		s.type = "GET";
	}
} );

// Bind script tag hack transport
jQuery.ajaxTransport( "script", function( s ) {

	// This transport only deals with cross domain requests
	if ( s.crossDomain ) {
		var script, callback;
		return {
			send: function( _, complete ) {
				script = jQuery( "<script>" ).prop( {
					charset: s.scriptCharset,
					src: s.url
				} ).on(
					"load error",
					callback = function( evt ) {
						script.remove();
						callback = null;
						if ( evt ) {
							complete( evt.type === "error" ? 404 : 200, evt.type );
						}
					}
				);

				// Use native DOM manipulation to avoid our domManip AJAX trickery
				document.head.appendChild( script[ 0 ] );
			},
			abort: function() {
				if ( callback ) {
					callback();
				}
			}
		};
	}
} );




var oldCallbacks = [],
	rjsonp = /(=)\?(?=&|$)|\?\?/;

// Default jsonp settings
jQuery.ajaxSetup( {
	jsonp: "callback",
	jsonpCallback: function() {
		var callback = oldCallbacks.pop() || ( jQuery.expando + "_" + ( nonce++ ) );
		this[ callback ] = true;
		return callback;
	}
} );

// Detect, normalize options and install callbacks for jsonp requests
jQuery.ajaxPrefilter( "json jsonp", function( s, originalSettings, jqXHR ) {

	var callbackName, overwritten, responseContainer,
		jsonProp = s.jsonp !== false && ( rjsonp.test( s.url ) ?
			"url" :
			typeof s.data === "string" &&
				( s.contentType || "" )
					.indexOf( "application/x-www-form-urlencoded" ) === 0 &&
				rjsonp.test( s.data ) && "data"
		);

	// Handle iff the expected data type is "jsonp" or we have a parameter to set
	if ( jsonProp || s.dataTypes[ 0 ] === "jsonp" ) {

		// Get callback name, remembering preexisting value associated with it
		callbackName = s.jsonpCallback = isFunction( s.jsonpCallback ) ?
			s.jsonpCallback() :
			s.jsonpCallback;

		// Insert callback into url or form data
		if ( jsonProp ) {
			s[ jsonProp ] = s[ jsonProp ].replace( rjsonp, "$1" + callbackName );
		} else if ( s.jsonp !== false ) {
			s.url += ( rquery.test( s.url ) ? "&" : "?" ) + s.jsonp + "=" + callbackName;
		}

		// Use data converter to retrieve json after script execution
		s.converters[ "script json" ] = function() {
			if ( !responseContainer ) {
				jQuery.error( callbackName + " was not called" );
			}
			return responseContainer[ 0 ];
		};

		// Force json dataType
		s.dataTypes[ 0 ] = "json";

		// Install callback
		overwritten = window[ callbackName ];
		window[ callbackName ] = function() {
			responseContainer = arguments;
		};

		// Clean-up function (fires after converters)
		jqXHR.always( function() {

			// If previous value didn't exist - remove it
			if ( overwritten === undefined ) {
				jQuery( window ).removeProp( callbackName );

			// Otherwise restore preexisting value
			} else {
				window[ callbackName ] = overwritten;
			}

			// Save back as free
			if ( s[ callbackName ] ) {

				// Make sure that re-using the options doesn't screw things around
				s.jsonpCallback = originalSettings.jsonpCallback;

				// Save the callback name for future use
				oldCallbacks.push( callbackName );
			}

			// Call if it was a function and we have a response
			if ( responseContainer && isFunction( overwritten ) ) {
				overwritten( responseContainer[ 0 ] );
			}

			responseContainer = overwritten = undefined;
		} );

		// Delegate to script
		return "script";
	}
} );




// Support: Safari 8 only
// In Safari 8 documents created via document.implementation.createHTMLDocument
// collapse sibling forms: the second one becomes a child of the first one.
// Because of that, this security measure has to be disabled in Safari 8.
// https://bugs.webkit.org/show_bug.cgi?id=137337
support.createHTMLDocument = ( function() {
	var body = document.implementation.createHTMLDocument( "" ).body;
	body.innerHTML = "<form></form><form></form>";
	return body.childNodes.length === 2;
} )();


// Argument "data" should be string of html
// context (optional): If specified, the fragment will be created in this context,
// defaults to document
// keepScripts (optional): If true, will include scripts passed in the html string
jQuery.parseHTML = function( data, context, keepScripts ) {
	if ( typeof data !== "string" ) {
		return [];
	}
	if ( typeof context === "boolean" ) {
		keepScripts = context;
		context = false;
	}

	var base, parsed, scripts;

	if ( !context ) {

		// Stop scripts or inline event handlers from being executed immediately
		// by using document.implementation
		if ( support.createHTMLDocument ) {
			context = document.implementation.createHTMLDocument( "" );

			// Set the base href for the created document
			// so any parsed elements with URLs
			// are based on the document's URL (gh-2965)
			base = context.createElement( "base" );
			base.href = document.location.href;
			context.head.appendChild( base );
		} else {
			context = document;
		}
	}

	parsed = rsingleTag.exec( data );
	scripts = !keepScripts && [];

	// Single tag
	if ( parsed ) {
		return [ context.createElement( parsed[ 1 ] ) ];
	}

	parsed = buildFragment( [ data ], context, scripts );

	if ( scripts && scripts.length ) {
		jQuery( scripts ).remove();
	}

	return jQuery.merge( [], parsed.childNodes );
};


/**
 * Load a url into a page
 */
jQuery.fn.load = function( url, params, callback ) {
	var selector, type, response,
		self = this,
		off = url.indexOf( " " );

	if ( off > -1 ) {
		selector = stripAndCollapse( url.slice( off ) );
		url = url.slice( 0, off );
	}

	// If it's a function
	if ( isFunction( params ) ) {

		// We assume that it's the callback
		callback = params;
		params = undefined;

	// Otherwise, build a param string
	} else if ( params && typeof params === "object" ) {
		type = "POST";
	}

	// If we have elements to modify, make the request
	if ( self.length > 0 ) {
		jQuery.ajax( {
			url: url,

			// If "type" variable is undefined, then "GET" method will be used.
			// Make value of this field explicit since
			// user can override it through ajaxSetup method
			type: type || "GET",
			dataType: "html",
			data: params
		} ).done( function( responseText ) {

			// Save response for use in complete callback
			response = arguments;

			self.html( selector ?

				// If a selector was specified, locate the right elements in a dummy div
				// Exclude scripts to avoid IE 'Permission Denied' errors
				jQuery( "<div>" ).append( jQuery.parseHTML( responseText ) ).find( selector ) :

				// Otherwise use the full result
				responseText );

		// If the request succeeds, this function gets "data", "status", "jqXHR"
		// but they are ignored because response was set above.
		// If it fails, this function gets "jqXHR", "status", "error"
		} ).always( callback && function( jqXHR, status ) {
			self.each( function() {
				callback.apply( this, response || [ jqXHR.responseText, status, jqXHR ] );
			} );
		} );
	}

	return this;
};




// Attach a bunch of functions for handling common AJAX events
jQuery.each( [
	"ajaxStart",
	"ajaxStop",
	"ajaxComplete",
	"ajaxError",
	"ajaxSuccess",
	"ajaxSend"
], function( i, type ) {
	jQuery.fn[ type ] = function( fn ) {
		return this.on( type, fn );
	};
} );




jQuery.expr.pseudos.animated = function( elem ) {
	return jQuery.grep( jQuery.timers, function( fn ) {
		return elem === fn.elem;
	} ).length;
};




jQuery.offset = {
	setOffset: function( elem, options, i ) {
		var curPosition, curLeft, curCSSTop, curTop, curOffset, curCSSLeft, calculatePosition,
			position = jQuery.css( elem, "position" ),
			curElem = jQuery( elem ),
			props = {};

		// Set position first, in-case top/left are set even on static elem
		if ( position === "static" ) {
			elem.style.position = "relative";
		}

		curOffset = curElem.offset();
		curCSSTop = jQuery.css( elem, "top" );
		curCSSLeft = jQuery.css( elem, "left" );
		calculatePosition = ( position === "absolute" || position === "fixed" ) &&
			( curCSSTop + curCSSLeft ).indexOf( "auto" ) > -1;

		// Need to be able to calculate position if either
		// top or left is auto and position is either absolute or fixed
		if ( calculatePosition ) {
			curPosition = curElem.position();
			curTop = curPosition.top;
			curLeft = curPosition.left;

		} else {
			curTop = parseFloat( curCSSTop ) || 0;
			curLeft = parseFloat( curCSSLeft ) || 0;
		}

		if ( isFunction( options ) ) {

			// Use jQuery.extend here to allow modification of coordinates argument (gh-1848)
			options = options.call( elem, i, jQuery.extend( {}, curOffset ) );
		}

		if ( options.top != null ) {
			props.top = ( options.top - curOffset.top ) + curTop;
		}
		if ( options.left != null ) {
			props.left = ( options.left - curOffset.left ) + curLeft;
		}

		if ( "using" in options ) {
			options.using.call( elem, props );

		} else {
			curElem.css( props );
		}
	}
};

jQuery.fn.extend( {

	// offset() relates an element's border box to the document origin
	offset: function( options ) {

		// Preserve chaining for setter
		if ( arguments.length ) {
			return options === undefined ?
				this :
				this.each( function( i ) {
					jQuery.offset.setOffset( this, options, i );
				} );
		}

		var rect, win,
			elem = this[ 0 ];

		if ( !elem ) {
			return;
		}

		// Return zeros for disconnected and hidden (display: none) elements (gh-2310)
		// Support: IE <=11 only
		// Running getBoundingClientRect on a
		// disconnected node in IE throws an error
		if ( !elem.getClientRects().length ) {
			return { top: 0, left: 0 };
		}

		// Get document-relative position by adding viewport scroll to viewport-relative gBCR
		rect = elem.getBoundingClientRect();
		win = elem.ownerDocument.defaultView;
		return {
			top: rect.top + win.pageYOffset,
			left: rect.left + win.pageXOffset
		};
	},

	// position() relates an element's margin box to its offset parent's padding box
	// This corresponds to the behavior of CSS absolute positioning
	position: function() {
		if ( !this[ 0 ] ) {
			return;
		}

		var offsetParent, offset, doc,
			elem = this[ 0 ],
			parentOffset = { top: 0, left: 0 };

		// position:fixed elements are offset from the viewport, which itself always has zero offset
		if ( jQuery.css( elem, "position" ) === "fixed" ) {

			// Assume position:fixed implies availability of getBoundingClientRect
			offset = elem.getBoundingClientRect();

		} else {
			offset = this.offset();

			// Account for the *real* offset parent, which can be the document or its root element
			// when a statically positioned element is identified
			doc = elem.ownerDocument;
			offsetParent = elem.offsetParent || doc.documentElement;
			while ( offsetParent &&
				( offsetParent === doc.body || offsetParent === doc.documentElement ) &&
				jQuery.css( offsetParent, "position" ) === "static" ) {

				offsetParent = offsetParent.parentNode;
			}
			if ( offsetParent && offsetParent !== elem && offsetParent.nodeType === 1 ) {

				// Incorporate borders into its offset, since they are outside its content origin
				parentOffset = jQuery( offsetParent ).offset();
				parentOffset.top += jQuery.css( offsetParent, "borderTopWidth", true );
				parentOffset.left += jQuery.css( offsetParent, "borderLeftWidth", true );
			}
		}

		// Subtract parent offsets and element margins
		return {
			top: offset.top - parentOffset.top - jQuery.css( elem, "marginTop", true ),
			left: offset.left - parentOffset.left - jQuery.css( elem, "marginLeft", true )
		};
	},

	// This method will return documentElement in the following cases:
	// 1) For the element inside the iframe without offsetParent, this method will return
	//    documentElement of the parent window
	// 2) For the hidden or detached element
	// 3) For body or html element, i.e. in case of the html node - it will return itself
	//
	// but those exceptions were never presented as a real life use-cases
	// and might be considered as more preferable results.
	//
	// This logic, however, is not guaranteed and can change at any point in the future
	offsetParent: function() {
		return this.map( function() {
			var offsetParent = this.offsetParent;

			while ( offsetParent && jQuery.css( offsetParent, "position" ) === "static" ) {
				offsetParent = offsetParent.offsetParent;
			}

			return offsetParent || documentElement;
		} );
	}
} );

// Create scrollLeft and scrollTop methods
jQuery.each( { scrollLeft: "pageXOffset", scrollTop: "pageYOffset" }, function( method, prop ) {
	var top = "pageYOffset" === prop;

	jQuery.fn[ method ] = function( val ) {
		return access( this, function( elem, method, val ) {

			// Coalesce documents and windows
			var win;
			if ( isWindow( elem ) ) {
				win = elem;
			} else if ( elem.nodeType === 9 ) {
				win = elem.defaultView;
			}

			if ( val === undefined ) {
				return win ? win[ prop ] : elem[ method ];
			}

			if ( win ) {
				win.scrollTo(
					!top ? val : win.pageXOffset,
					top ? val : win.pageYOffset
				);

			} else {
				elem[ method ] = val;
			}
		}, method, val, arguments.length );
	};
} );

// Support: Safari <=7 - 9.1, Chrome <=37 - 49
// Add the top/left cssHooks using jQuery.fn.position
// Webkit bug: https://bugs.webkit.org/show_bug.cgi?id=29084
// Blink bug: https://bugs.chromium.org/p/chromium/issues/detail?id=589347
// getComputedStyle returns percent when specified for top/left/bottom/right;
// rather than make the css module depend on the offset module, just check for it here
jQuery.each( [ "top", "left" ], function( i, prop ) {
	jQuery.cssHooks[ prop ] = addGetHookIf( support.pixelPosition,
		function( elem, computed ) {
			if ( computed ) {
				computed = curCSS( elem, prop );

				// If curCSS returns percentage, fallback to offset
				return rnumnonpx.test( computed ) ?
					jQuery( elem ).position()[ prop ] + "px" :
					computed;
			}
		}
	);
} );


// Create innerHeight, innerWidth, height, width, outerHeight and outerWidth methods
jQuery.each( { Height: "height", Width: "width" }, function( name, type ) {
	jQuery.each( { padding: "inner" + name, content: type, "": "outer" + name },
		function( defaultExtra, funcName ) {

		// Margin is only for outerHeight, outerWidth
		jQuery.fn[ funcName ] = function( margin, value ) {
			var chainable = arguments.length && ( defaultExtra || typeof margin !== "boolean" ),
				extra = defaultExtra || ( margin === true || value === true ? "margin" : "border" );

			return access( this, function( elem, type, value ) {
				var doc;

				if ( isWindow( elem ) ) {

					// $( window ).outerWidth/Height return w/h including scrollbars (gh-1729)
					return funcName.indexOf( "outer" ) === 0 ?
						elem[ "inner" + name ] :
						elem.document.documentElement[ "client" + name ];
				}

				// Get document width or height
				if ( elem.nodeType === 9 ) {
					doc = elem.documentElement;

					// Either scroll[Width/Height] or offset[Width/Height] or client[Width/Height],
					// whichever is greatest
					return Math.max(
						elem.body[ "scroll" + name ], doc[ "scroll" + name ],
						elem.body[ "offset" + name ], doc[ "offset" + name ],
						doc[ "client" + name ]
					);
				}

				return value === undefined ?

					// Get width or height on the element, requesting but not forcing parseFloat
					jQuery.css( elem, type, extra ) :

					// Set width or height on the element
					jQuery.style( elem, type, value, extra );
			}, type, chainable ? margin : undefined, chainable );
		};
	} );
} );


jQuery.each( ( "blur focus focusin focusout resize scroll click dblclick " +
	"mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
	"change select submit keydown keypress keyup contextmenu" ).split( " " ),
	function( i, name ) {

	// Handle event binding
	jQuery.fn[ name ] = function( data, fn ) {
		return arguments.length > 0 ?
			this.on( name, null, data, fn ) :
			this.trigger( name );
	};
} );

jQuery.fn.extend( {
	hover: function( fnOver, fnOut ) {
		return this.mouseenter( fnOver ).mouseleave( fnOut || fnOver );
	}
} );




jQuery.fn.extend( {

	bind: function( types, data, fn ) {
		return this.on( types, null, data, fn );
	},
	unbind: function( types, fn ) {
		return this.off( types, null, fn );
	},

	delegate: function( selector, types, data, fn ) {
		return this.on( types, selector, data, fn );
	},
	undelegate: function( selector, types, fn ) {

		// ( namespace ) or ( selector, types [, fn] )
		return arguments.length === 1 ?
			this.off( selector, "**" ) :
			this.off( types, selector || "**", fn );
	}
} );

// Bind a function to a context, optionally partially applying any
// arguments.
// jQuery.proxy is deprecated to promote standards (specifically Function#bind)
// However, it is not slated for removal any time soon
jQuery.proxy = function( fn, context ) {
	var tmp, args, proxy;

	if ( typeof context === "string" ) {
		tmp = fn[ context ];
		context = fn;
		fn = tmp;
	}

	// Quick check to determine if target is callable, in the spec
	// this throws a TypeError, but we will just return undefined.
	if ( !isFunction( fn ) ) {
		return undefined;
	}

	// Simulated bind
	args = slice.call( arguments, 2 );
	proxy = function() {
		return fn.apply( context || this, args.concat( slice.call( arguments ) ) );
	};

	// Set the guid of unique handler to the same of original handler, so it can be removed
	proxy.guid = fn.guid = fn.guid || jQuery.guid++;

	return proxy;
};

jQuery.holdReady = function( hold ) {
	if ( hold ) {
		jQuery.readyWait++;
	} else {
		jQuery.ready( true );
	}
};
jQuery.isArray = Array.isArray;
jQuery.parseJSON = JSON.parse;
jQuery.nodeName = nodeName;
jQuery.isFunction = isFunction;
jQuery.isWindow = isWindow;
jQuery.camelCase = camelCase;
jQuery.type = toType;

jQuery.now = Date.now;

jQuery.isNumeric = function( obj ) {

	// As of jQuery 3.0, isNumeric is limited to
	// strings and numbers (primitives or objects)
	// that can be coerced to finite numbers (gh-2662)
	var type = jQuery.type( obj );
	return ( type === "number" || type === "string" ) &&

		// parseFloat NaNs numeric-cast false positives ("")
		// ...but misinterprets leading-number strings, particularly hex literals ("0x...")
		// subtraction forces infinities to NaN
		!isNaN( obj - parseFloat( obj ) );
};




var

	// Map over jQuery in case of overwrite
	_jQuery = window.jQuery,

	// Map over the $ in case of overwrite
	_$ = window.$;

jQuery.noConflict = function( deep ) {
	if ( window.$ === jQuery ) {
		window.$ = _$;
	}

	if ( deep && window.jQuery === jQuery ) {
		window.jQuery = _jQuery;
	}

	return jQuery;
};

// Expose jQuery and $ identifiers, even in AMD
// (#7102#comment:10, https://github.com/jquery/jquery/pull/557)
// and CommonJS for browser emulators (#13566)
if ( !noGlobal ) {
	window.jQuery = window.$ = jQuery;
}




return jQuery;
} );
});

ohif_core.OHIF.string = {}; // Search for some string inside any object or array

ohif_core.OHIF.string.search = (object, query, property = null, result = []) => {
  // Create the search pattern
  const pattern = new RegExp(jquery.trim(query), 'i');

  underscore.each(object, item => {
    // Stop here if item is empty
    if (!item) {
      return;
    } // Get the value to be compared


    const value = underscore.isString(property) ? item[property] : item; // Check if the value match the pattern

    if (underscore.isString(value) && pattern.test(value)) {
      // Add the current item to the result
      result.push(item);
    }

    if (underscore.isObject(item)) {
      // Search recursively the item if the current item is an object
      ohif_core.OHIF.string.search(item, query, property, result);
    }
  }); // Return the found items


  return result;
}; // Encode any string into a safe format for HTML id attribute


ohif_core.OHIF.string.encodeId = input => {
  const string = input && input.toString ? input.toString() : input; // Return an underscore if the given string is empty or if it's not a string

  if (string === '' || typeof string !== 'string') {
    return '_';
  } // Create a converter to replace non accepted chars


  const converter = match => '_' + match[0].charCodeAt(0).toString(16) + '_'; // Encode the given string and return it


  return string.replace(/[^a-zA-Z0-9-]/g, converter);
};

const ui = meteor.Meteor.settings && meteor.Meteor.settings.public && meteor.Meteor.settings.public.ui;
ohif_core.OHIF.uiSettings = ui || {};
/**
 * Get the offset for the given element
 *
 * @param {Object} element DOM element which will have the offser calculated
 * @returns {Object} Object containing the top and left offset
 */

ohif_core.OHIF.ui.getOffset = element => {
  let top = 0;
  let left = 0;

  if (element.offsetParent) {
    do {
      left += element.offsetLeft;
      top += element.offsetTop;
    } while (element = element.offsetParent);
  }

  return {
    left,
    top
  };
};
/**
 * Get the vertical and horizontal scrollbar sizes
 * Got from https://stackoverflow.com/questions/986937/how-can-i-get-the-browsers-scrollbar-sizes
 *
 * @returns {Array} Array containing the scrollbar horizontal and vertical sizes
 */


ohif_core.OHIF.ui.getScrollbarSize = () => {
  const inner = document.createElement('p');
  inner.style.width = '100%';
  inner.style.height = '100%';
  const outer = document.createElement('div');
  outer.style.position = 'absolute';
  outer.style.top = '0px';
  outer.style.left = '0px';
  outer.style.visibility = 'hidden';
  outer.style.width = '100px';
  outer.style.height = '100px';
  outer.style.overflow = 'hidden';
  outer.appendChild(inner);
  document.body.appendChild(outer);
  const w1 = inner.offsetWidth;
  const h1 = inner.offsetHeight;
  outer.style.overflow = 'scroll';
  let w2 = inner.offsetWidth;
  let h2 = inner.offsetHeight;

  if (w1 === w2) {
    w2 = outer.clientWidth;
  }

  if (h1 === h2) {
    h2 = outer.clientHeight;
  }

  document.body.removeChild(outer);
  return [w1 - w2, h1 - h2];
};
/**
 * Check if the pressed key combination will result in a character input
 * Got from https://stackoverflow.com/questions/4179708/how-to-detect-if-the-pressed-key-will-produce-a-character-inside-an-input-text
 *
 * @returns {Boolean} Wheter the pressed key combination will input a character or not
 */


ohif_core.OHIF.ui.isCharacterKeyPress = event => {
  if (typeof event.which === 'undefined') {
    // This is IE, which only fires keypress events for printable keys
    return true;
  } else if (typeof event.which === 'number' && event.which > 0) {
    // In other browsers except old versions of WebKit, event.which is
    // only greater than zero if the keypress is a printable key.
    // We need to filter out backspace and ctrl/alt/meta key combinations
    return !event.ctrlKey && !event.metaKey && !event.altKey && event.which !== 8;
  }

  return false;
};

ohif_core.OHIF.utils.sortBy = function () {
  var fields = [].slice.call(arguments),
      n_fields = fields.length;
  return function (A, B) {
    var a, b, field, key, reverse, result, i;

    for (i = 0; i < n_fields; i++) {
      result = 0;
      field = fields[i];
      key = typeof field === 'string' ? field : field.name;
      a = A[key];
      b = B[key];

      if (typeof field.primer !== 'undefined') {
        a = field.primer(a);
        b = field.primer(b);
      }

      reverse = field.reverse ? -1 : 1;

      if (a < b) {
        result = reverse * -1;
      }

      if (a > b) {
        result = reverse * 1;
      }

      if (result !== 0) {
        break;
      }
    }

    return result;
  };
};

ohif_core.OHIF.viewer = {};

ohif_core.OHIF.user = ohif_core.OHIF.user || {}; // These should be overridden by the implementation

ohif_core.OHIF.user.schema = null;

ohif_core.OHIF.user.userLoggedIn = () => false;

ohif_core.OHIF.user.getUserId = () => null;

ohif_core.OHIF.user.getName = () => null;

ohif_core.OHIF.user.getAccessToken = () => null;

ohif_core.OHIF.user.login = () => new Promise((resolve, reject) => reject());

ohif_core.OHIF.user.logout = () => new Promise((resolve, reject) => reject());

ohif_core.OHIF.user.getData = key => null;

ohif_core.OHIF.user.setData = (key, value) => null;

ohif_core.OHIF.user.validate = () => null;

ohif_core.OHIF.object = {}; // Transforms a shallow object with keys separated by "." into a nested object

ohif_core.OHIF.object.getNestedObject = shallowObject => {
  const nestedObject = {};

  for (let key in shallowObject) {
    if (!shallowObject.hasOwnProperty(key)) continue;
    const value = shallowObject[key];
    const propertyArray = key.split('.');
    let currentObject = nestedObject;

    while (propertyArray.length) {
      const currentProperty = propertyArray.shift();

      if (!propertyArray.length) {
        currentObject[currentProperty] = value;
      } else {
        if (!currentObject[currentProperty]) {
          currentObject[currentProperty] = {};
        }

        currentObject = currentObject[currentProperty];
      }
    }
  }

  return nestedObject;
}; // Transforms a nested object into a shallowObject merging its keys with "." character


ohif_core.OHIF.object.getShallowObject = nestedObject => {
  const shallowObject = {};

  const putValues = (baseKey, nestedObject, resultObject) => {
    for (let key in nestedObject) {
      if (!nestedObject.hasOwnProperty(key)) continue;
      let currentKey = baseKey ? `${baseKey}.${key}` : key;
      const currentValue = nestedObject[key];

      if (typeof currentValue === 'object') {
        if (currentValue instanceof Array) {
          currentKey += '[]';
        }

        putValues(currentKey, currentValue, resultObject);
      } else {
        resultObject[currentKey] = currentValue;
      }
    }
  };

  putValues('', nestedObject, shallowObject);
  return shallowObject;
};

/**
 * Returns the specified element as a dicom attribute group/element.
 *
 * @param element - The group/element of the element (e.g. '00280009')
 * @param [defaultValue] - The value to return if the element is not present
 * @returns {*}
 */
function getAttribute(element, defaultValue) {
  if (!element) {
    return defaultValue;
  } // Value is not present if the attribute has a zero length value


  if (!element.Value) {
    return defaultValue;
  } // Sanity check to make sure we have at least one entry in the array.


  if (!element.Value.length) {
    return defaultValue;
  }

  return convertToInt(element.Value);
}

function convertToInt(input) {
  function padFour(input) {
    var l = input.length;
    if (l == 0) return '0000';
    if (l == 1) return '000' + input;
    if (l == 2) return '00' + input;
    if (l == 3) return '0' + input;
    return input;
  }

  var output = '';

  for (var i = 0; i < input.length; i++) {
    for (var j = 0; j < input[i].length; j++) {
      output += padFour(input[i].charCodeAt(j).toString(16));
    }
  }

  return parseInt(output, 16);
}

var btoa = function btoa(val) {
  return new Buffer(val).toString('base64');
};

/**
 * Returns the Authorization header as part of an Object.
 *
 * @returns {Object}
 */

function getAuthorizationHeader() {
  const headers = {}; // Check for OHIF.user since this can also be run on the server

  const accessToken = ohif_core.OHIF.user && ohif_core.OHIF.user.getAccessToken && ohif_core.OHIF.user.getAccessToken();
  const server = ohif_core.OHIF.servers.getCurrentServer();

  if (server && server.requestOptions && server.requestOptions.auth) {
    // HTTP Basic Auth (user:password)
    headers.Authorization = `Basic ${btoa(server.requestOptions.auth)}`;
  } else if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

function getModalities(modality, modalitiesInStudy) {
  var modalities = {};

  if (modality) {
    modalities = modality;
  }

  if (modalitiesInStudy) {
    // Find vr in modalities
    if (modalities.vr && modalities.vr === modalitiesInStudy.vr) {
      for (var i = 0; i < modalitiesInStudy.Value.length; i++) {
        var value = modalitiesInStudy.Value[i];

        if (modalities.Value.indexOf(value) === -1) {
          modalities.Value.push(value);
        }
      }
    } else {
      modalities = modalitiesInStudy;
    }
  }

  return modalities;
}

/**
 * Returns the Alphabetic version of a PN
 *
 * @param element - The group/element of the element (e.g. '00200013')
 * @param [defaultValue] - The default value to return if the element is not found
 * @returns {*}
 */
function getName(element, defaultValue) {
  if (!element) {
    return defaultValue;
  } // Value is not present if the attribute has a zero length value


  if (!element.Value) {
    return defaultValue;
  } // Sanity check to make sure we have at least one entry in the array.


  if (!element.Value.length) {
    return defaultValue;
  } // Return the Alphabetic component group


  if (element.Value[0].Alphabetic) {
    return element.Value[0].Alphabetic;
  } // Orthanc does not return PN properly so this is a temporary workaround


  return element.Value[0];
}

/**
 * Returns the first string value as a Javascript Number
 * @param element - The group/element of the element (e.g. '00200013')
 * @param [defaultValue] - The default value to return if the element does not exist
 * @returns {*}
 */
function getNumber(element, defaultValue) {
  if (!element) {
    return defaultValue;
  } // Value is not present if the attribute has a zero length value


  if (!element.Value) {
    return defaultValue;
  } // Sanity check to make sure we have at least one entry in the array.


  if (!element.Value.length) {
    return defaultValue;
  }

  return parseFloat(element.Value[0]);
}

/**
 * Returns the specified element as a string.  Multi-valued elements will be separated by a backslash
 *
 * @param element - The group/element of the element (e.g. '00200013')
 * @param [defaultValue] - The value to return if the element is not present
 * @returns {*}
 */
function getString(element, defaultValue) {
  if (!element) {
    return defaultValue;
  } // Value is not present if the attribute has a zero length value


  if (!element.Value) {
    return defaultValue;
  } // Sanity check to make sure we have at least one entry in the array.


  if (!element.Value.length) {
    return defaultValue;
  } // Join the array together separated by backslash
  // NOTE: Orthanc does not correctly split values into an array so the join is a no-op


  return element.Value.join('\\');
}

const DICOMWeb$2 = {
  getAttribute,
  getAuthorizationHeader,
  getModalities,
  getName,
  getNumber,
  getString
};
ohif_core.OHIF.DICOMWeb = DICOMWeb$2;

/**
 * Retrieves the current server configuration used to retrieve studies
 */

ohif_core.OHIF.servers.getCurrentServer = () => {
  return window.store.state.servers.find(server => server.active === true);
};

// TODO: Deprecate since we have the same thing in dcmjs?
const NUMBER = 'number';
const STRING = 'string';
const REGEX_TAG = /^x[0-9a-fx]{8}$/;
const DICOMTagDescriptions = Object.create(Object.prototype, {
  _descriptions: {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.create(null)
  },
  tagNumberToString: {
    configurable: false,
    enumerable: true,
    writable: false,
    value: function tagNumberToString(tag) {
      let string; // by default, undefined is returned...

      if (this.isValidTagNumber(tag)) {
        // if it's a number, build its hexadecimal representation...
        string = 'x' + ('00000000' + tag.toString(16)).substr(-8);
      }

      return string;
    }
  },
  isValidTagNumber: {
    configurable: false,
    enumerable: true,
    writable: false,
    value: function isValidTagNumber(tag) {
      return typeof tag === NUMBER && tag >= 0 && tag <= 0xFFFFFFFF;
    }
  },
  isValidTag: {
    configurable: false,
    enumerable: true,
    writable: false,
    value: function isValidTag(tag) {
      return typeof tag === STRING ? REGEX_TAG.test(tag) : this.isValidTagNumber(tag);
    }
  },
  find: {
    configurable: false,
    enumerable: true,
    writable: false,
    value: function find(name) {
      let description; // by default, undefined is returned...

      if (typeof name !== STRING) {
        // if it's a number, a tag string will be returned...
        name = this.tagNumberToString(name);
      }

      if (typeof name === STRING) {
        description = this._descriptions[name];
      }

      return description;
    }
  },
  init: {
    configurable: false,
    enumerable: true,
    writable: false,
    value: function init(descriptionMap) {
      const _hasOwn = Object.prototype.hasOwnProperty;
      const _descriptions = this._descriptions;

      for (let tag in descriptionMap) {
        if (_hasOwn.call(descriptionMap, tag)) {
          if (!this.isValidTag(tag)) {
            // Skip in case tag is not valid...
            console.info(`DICOMTagDescriptions: Invalid tag "${tag}"...`);
            continue;
          }

          if (tag in _descriptions) {
            // Skip in case the tag is duplicated...
            console.info(`DICOMTagDescriptions: Duplicated tag "${tag}"...`);
            continue;
          } // Save keyword...


          const keyword = descriptionMap[tag]; // Create a description entry and freeze it...

          const entry = Object.create(null);
          entry.tag = tag;
          entry.keyword = keyword;
          Object.freeze(entry); // Add tag references to entry...

          _descriptions[tag] = entry; // Add keyword references to entry (if not present already)...

          if (keyword in _descriptions) {
            const currentEntry = _descriptions[keyword];
            console.info(`DICOMTagDescriptions: Using <${currentEntry.tag},${currentEntry.keyword}> instead of <${entry.tag},${entry.keyword}> for keyword "${keyword}"...`);
          } else {
            _descriptions[keyword] = entry;
          }
        }
      } // Freeze internal description map...


      Object.freeze(_descriptions); // Freeze itself...

      Object.freeze(this);
    }
  }
});
/**
 * Map with DICOM Tag Descriptions
 */

let initialTagDescriptionMap = {
  x00020000: 'FileMetaInfoGroupLength',
  x00020001: 'FileMetaInfoVersion',
  x00020002: 'MediaStorageSOPClassUID',
  x00020003: 'MediaStorageSOPInstanceUID',
  x00020010: 'TransferSyntaxUID',
  x00020012: 'ImplementationClassUID',
  x00020013: 'ImplementationVersionName',
  x00020016: 'SourceApplicationEntityTitle',
  x00020100: 'PrivateInformationCreatorUID',
  x00020102: 'PrivateInformation',
  x00041130: 'FileSetID',
  x00041141: 'FileSetDescriptorFileID',
  x00041142: 'SpecificCharacterSetOfFile',
  x00041200: 'FirstDirectoryRecordOffset',
  x00041202: 'LastDirectoryRecordOffset',
  x00041212: 'FileSetConsistencyFlag',
  x00041220: 'DirectoryRecordSequence',
  x00041400: 'OffsetOfNextDirectoryRecord',
  x00041410: 'RecordInUseFlag',
  x00041420: 'LowerLevelDirectoryEntityOffset',
  x00041430: 'DirectoryRecordType',
  x00041432: 'PrivateRecordUID',
  x00041500: 'ReferencedFileID',
  x00041504: 'MRDRDirectoryRecordOffset',
  x00041510: 'ReferencedSOPClassUIDInFile',
  x00041511: 'ReferencedSOPInstanceUIDInFile',
  x00041512: 'ReferencedTransferSyntaxUIDInFile',
  x0004151a: 'ReferencedRelatedSOPClassUIDInFile',
  x00041600: 'NumberOfReferences',
  x00080000: 'IdentifyingGroupLength',
  x00080001: 'LengthToEnd',
  x00080005: 'SpecificCharacterSet',
  x00080006: 'LanguageCodeSequence',
  x00080008: 'ImageType',
  x00080010: 'RecognitionCode',
  x00080012: 'InstanceCreationDate',
  x00080013: 'InstanceCreationTime',
  x00080014: 'InstanceCreatorUID',
  x00080016: 'SOPClassUID',
  x00080018: 'SOPInstanceUID',
  x0008001a: 'RelatedGeneralSOPClassUID',
  x0008001b: 'OriginalSpecializedSOPClassUID',
  x00080020: 'StudyDate',
  x00080021: 'SeriesDate',
  x00080022: 'AcquisitionDate',
  x00080023: 'ContentDate',
  x00080024: 'OverlayDate',
  x00080025: 'CurveDate',
  x0008002a: 'AcquisitionDateTime',
  x00080030: 'StudyTime',
  x00080031: 'SeriesTime',
  x00080032: 'AcquisitionTime',
  x00080033: 'ContentTime',
  x00080034: 'OverlayTime',
  x00080035: 'CurveTime',
  x00080040: 'DataSetType',
  x00080041: 'DataSetSubtype',
  x00080042: 'NuclearMedicineSeriesType',
  x00080050: 'AccessionNumber',
  x00080052: 'QueryRetrieveLevel',
  x00080054: 'RetrieveAETitle',
  x00080056: 'InstanceAvailability',
  x00080058: 'FailedSOPInstanceUIDList',
  x00080060: 'Modality',
  x00080061: 'ModalitiesInStudy',
  x00080062: 'SOPClassesInStudy',
  x00080064: 'ConversionType',
  x00080068: 'PresentationIntentType',
  x00080070: 'Manufacturer',
  x00080080: 'InstitutionName',
  x00080081: 'InstitutionAddress',
  x00080082: 'InstitutionCodeSequence',
  x00080090: 'ReferringPhysicianName',
  x00080092: 'ReferringPhysicianAddress',
  x00080094: 'ReferringPhysicianTelephoneNumber',
  x00080096: 'ReferringPhysicianIDSequence',
  x00080100: 'CodeValue',
  x00080102: 'CodingSchemeDesignator',
  x00080103: 'CodingSchemeVersion',
  x00080104: 'CodeMeaning',
  x00080105: 'MappingResource',
  x00080106: 'ContextGroupVersion',
  x00080107: 'ContextGroupLocalVersion',
  x0008010b: 'ContextGroupExtensionFlag',
  x0008010c: 'CodingSchemeUID',
  x0008010d: 'ContextGroupExtensionCreatorUID',
  x0008010f: 'ContextIdentifier',
  x00080110: 'CodingSchemeIDSequence',
  x00080112: 'CodingSchemeRegistry',
  x00080114: 'CodingSchemeExternalID',
  x00080115: 'CodingSchemeName',
  x00080116: 'CodingSchemeResponsibleOrganization',
  x00080117: 'ContextUID',
  x00080201: 'TimezoneOffsetFromUTC',
  x00081000: 'NetworkID',
  x00081010: 'StationName',
  x00081030: 'StudyDescription',
  x00081032: 'ProcedureCodeSequence',
  x0008103e: 'SeriesDescription',
  x00081040: 'InstitutionalDepartmentName',
  x00081048: 'PhysiciansOfRecord',
  x00081049: 'PhysiciansOfRecordIDSequence',
  x00081050: 'PerformingPhysicianName',
  x00081052: 'PerformingPhysicianIDSequence',
  x00081060: 'NameOfPhysicianReadingStudy',
  x00081062: 'PhysicianReadingStudyIDSequence',
  x00081070: 'OperatorsName',
  x00081072: 'OperatorIDSequence',
  x00081080: 'AdmittingDiagnosesDescription',
  x00081084: 'AdmittingDiagnosesCodeSequence',
  x00081090: 'ManufacturersModelName',
  x00081100: 'ReferencedResultsSequence',
  x00081110: 'ReferencedStudySequence',
  x00081111: 'ReferencedPerformedProcedureStepSequence',
  x00081115: 'ReferencedSeriesSequence',
  x00081120: 'ReferencedPatientSequence',
  x00081125: 'ReferencedVisitSequence',
  x00081130: 'ReferencedOverlaySequence',
  x0008113a: 'ReferencedWaveformSequence',
  x00081140: 'ReferencedImageSequence',
  x00081145: 'ReferencedCurveSequence',
  x0008114a: 'ReferencedInstanceSequence',
  x00081150: 'ReferencedSOPClassUID',
  x00081155: 'ReferencedSOPInstanceUID',
  x0008115a: 'SOPClassesSupported',
  x00081160: 'ReferencedFrameNumber',
  x00081161: 'SimpleFrameList',
  x00081162: 'CalculatedFrameList',
  x00081163: 'TimeRange',
  x00081164: 'FrameExtractionSequence',
  x00081195: 'TransactionUID',
  x00081197: 'FailureReason',
  x00081198: 'FailedSOPSequence',
  x00081199: 'ReferencedSOPSequence',
  x00081200: 'OtherReferencedStudiesSequence',
  x00081250: 'RelatedSeriesSequence',
  x00082110: 'LossyImageCompressionRetired',
  x00082111: 'DerivationDescription',
  x00082112: 'SourceImageSequence',
  x00082120: 'StageName',
  x00082122: 'StageNumber',
  x00082124: 'NumberOfStages',
  x00082127: 'ViewName',
  x00082128: 'ViewNumber',
  x00082129: 'NumberOfEventTimers',
  x0008212a: 'NumberOfViewsInStage',
  x00082130: 'EventElapsedTimes',
  x00082132: 'EventTimerNames',
  x00082133: 'EventTimerSequence',
  x00082134: 'EventTimeOffset',
  x00082135: 'EventCodeSequence',
  x00082142: 'StartTrim',
  x00082143: 'StopTrim',
  x00082144: 'RecommendedDisplayFrameRate',
  x00082200: 'TransducerPosition',
  x00082204: 'TransducerOrientation',
  x00082208: 'AnatomicStructure',
  x00082218: 'AnatomicRegionSequence',
  x00082220: 'AnatomicRegionModifierSequence',
  x00082228: 'PrimaryAnatomicStructureSequence',
  x00082229: 'AnatomicStructureOrRegionSequence',
  x00082230: 'AnatomicStructureModifierSequence',
  x00082240: 'TransducerPositionSequence',
  x00082242: 'TransducerPositionModifierSequence',
  x00082244: 'TransducerOrientationSequence',
  x00082246: 'TransducerOrientationModifierSeq',
  x00082253: 'AnatomicEntrancePortalCodeSeqTrial',
  x00082255: 'AnatomicApproachDirCodeSeqTrial',
  x00082256: 'AnatomicPerspectiveDescrTrial',
  x00082257: 'AnatomicPerspectiveCodeSeqTrial',
  x00083001: 'AlternateRepresentationSequence',
  x00083010: 'IrradiationEventUID',
  x00084000: 'IdentifyingComments',
  x00089007: 'FrameType',
  x00089092: 'ReferencedImageEvidenceSequence',
  x00089121: 'ReferencedRawDataSequence',
  x00089123: 'CreatorVersionUID',
  x00089124: 'DerivationImageSequence',
  x00089154: 'SourceImageEvidenceSequence',
  x00089205: 'PixelPresentation',
  x00089206: 'VolumetricProperties',
  x00089207: 'VolumeBasedCalculationTechnique',
  x00089208: 'ComplexImageComponent',
  x00089209: 'AcquisitionContrast',
  x00089215: 'DerivationCodeSequence',
  x00089237: 'GrayscalePresentationStateSequence',
  x00089410: 'ReferencedOtherPlaneSequence',
  x00089458: 'FrameDisplaySequence',
  x00089459: 'RecommendedDisplayFrameRateInFloat',
  x00089460: 'SkipFrameRangeFlag',
  // x00091001: 'FullFidelity',
  // x00091002: 'SuiteID',
  // x00091004: 'ProductID',
  // x00091027: 'ImageActualDate',
  // x00091030: 'ServiceID',
  // x00091031: 'MobileLocationNumber',
  // x000910e3: 'EquipmentUID',
  // x000910e6: 'GenesisVersionNow',
  // x000910e7: 'ExamRecordChecksum',
  // x000910e9: 'ActualSeriesDataTimeStamp',
  x00100000: 'PatientGroupLength',
  x00100010: 'PatientName',
  x00100020: 'PatientID',
  x00100021: 'IssuerOfPatientID',
  x00100022: 'TypeOfPatientID',
  x00100030: 'PatientBirthDate',
  x00100032: 'PatientBirthTime',
  x00100040: 'PatientSex',
  x00100050: 'PatientInsurancePlanCodeSequence',
  x00100101: 'PatientPrimaryLanguageCodeSeq',
  x00100102: 'PatientPrimaryLanguageCodeModSeq',
  x00101000: 'OtherPatientIDs',
  x00101001: 'OtherPatientNames',
  x00101002: 'OtherPatientIDsSequence',
  x00101005: 'PatientBirthName',
  x00101010: 'PatientAge',
  x00101020: 'PatientSize',
  x00101030: 'PatientWeight',
  x00101040: 'PatientAddress',
  x00101050: 'InsurancePlanIdentification',
  x00101060: 'PatientMotherBirthName',
  x00101080: 'MilitaryRank',
  x00101081: 'BranchOfService',
  x00101090: 'MedicalRecordLocator',
  x00102000: 'MedicalAlerts',
  x00102110: 'Allergies',
  x00102150: 'CountryOfResidence',
  x00102152: 'RegionOfResidence',
  x00102154: 'PatientTelephoneNumbers',
  x00102160: 'EthnicGroup',
  x00102180: 'Occupation',
  x001021a0: 'SmokingStatus',
  x001021b0: 'AdditionalPatientHistory',
  x001021c0: 'PregnancyStatus',
  x001021d0: 'LastMenstrualDate',
  x001021f0: 'PatientReligiousPreference',
  x00102201: 'PatientSpeciesDescription',
  x00102202: 'PatientSpeciesCodeSequence',
  x00102203: 'PatientSexNeutered',
  x00102210: 'AnatomicalOrientationType',
  x00102292: 'PatientBreedDescription',
  x00102293: 'PatientBreedCodeSequence',
  x00102294: 'BreedRegistrationSequence',
  x00102295: 'BreedRegistrationNumber',
  x00102296: 'BreedRegistryCodeSequence',
  x00102297: 'ResponsiblePerson',
  x00102298: 'ResponsiblePersonRole',
  x00102299: 'ResponsibleOrganization',
  x00104000: 'PatientComments',
  x00109431: 'ExaminedBodyThickness',
  x00111010: 'PatientStatus',
  x00120010: 'ClinicalTrialSponsorName',
  x00120020: 'ClinicalTrialProtocolID',
  x00120021: 'ClinicalTrialProtocolName',
  x00120030: 'ClinicalTrialSiteID',
  x00120031: 'ClinicalTrialSiteName',
  x00120040: 'ClinicalTrialSubjectID',
  x00120042: 'ClinicalTrialSubjectReadingID',
  x00120050: 'ClinicalTrialTimePointID',
  x00120051: 'ClinicalTrialTimePointDescription',
  x00120060: 'ClinicalTrialCoordinatingCenter',
  x00120062: 'PatientIdentityRemoved',
  x00120063: 'DeidentificationMethod',
  x00120064: 'DeidentificationMethodCodeSequence',
  x00120071: 'ClinicalTrialSeriesID',
  x00120072: 'ClinicalTrialSeriesDescription',
  x00120084: 'DistributionType',
  x00120085: 'ConsentForDistributionFlag',
  x00180000: 'AcquisitionGroupLength',
  x00180010: 'ContrastBolusAgent',
  x00180012: 'ContrastBolusAgentSequence',
  x00180014: 'ContrastBolusAdministrationRoute',
  x00180015: 'BodyPartExamined',
  x00180020: 'ScanningSequence',
  x00180021: 'SequenceVariant',
  x00180022: 'ScanOptions',
  x00180023: 'MRAcquisitionType',
  x00180024: 'SequenceName',
  x00180025: 'AngioFlag',
  x00180026: 'InterventionDrugInformationSeq',
  x00180027: 'InterventionDrugStopTime',
  x00180028: 'InterventionDrugDose',
  x00180029: 'InterventionDrugSequence',
  x0018002a: 'AdditionalDrugSequence',
  x00180030: 'Radionuclide',
  x00180031: 'Radiopharmaceutical',
  x00180032: 'EnergyWindowCenterline',
  x00180033: 'EnergyWindowTotalWidth',
  x00180034: 'InterventionDrugName',
  x00180035: 'InterventionDrugStartTime',
  x00180036: 'InterventionSequence',
  x00180037: 'TherapyType',
  x00180038: 'InterventionStatus',
  x00180039: 'TherapyDescription',
  x0018003a: 'InterventionDescription',
  x00180040: 'CineRate',
  x00180042: 'InitialCineRunState',
  x00180050: 'SliceThickness',
  x00180060: 'KVP',
  x00180070: 'CountsAccumulated',
  x00180071: 'AcquisitionTerminationCondition',
  x00180072: 'EffectiveDuration',
  x00180073: 'AcquisitionStartCondition',
  x00180074: 'AcquisitionStartConditionData',
  x00180075: 'AcquisitionEndConditionData',
  x00180080: 'RepetitionTime',
  x00180081: 'EchoTime',
  x00180082: 'InversionTime',
  x00180083: 'NumberOfAverages',
  x00180084: 'ImagingFrequency',
  x00180085: 'ImagedNucleus',
  x00180086: 'EchoNumber',
  x00180087: 'MagneticFieldStrength',
  x00180088: 'SpacingBetweenSlices',
  x00180089: 'NumberOfPhaseEncodingSteps',
  x00180090: 'DataCollectionDiameter',
  x00180091: 'EchoTrainLength',
  x00180093: 'PercentSampling',
  x00180094: 'PercentPhaseFieldOfView',
  x00180095: 'PixelBandwidth',
  x00181000: 'DeviceSerialNumber',
  x00181002: 'DeviceUID',
  x00181003: 'DeviceID',
  x00181004: 'PlateID',
  x00181005: 'GeneratorID',
  x00181006: 'GridID',
  x00181007: 'CassetteID',
  x00181008: 'GantryID',
  x00181010: 'SecondaryCaptureDeviceID',
  x00181011: 'HardcopyCreationDeviceID',
  x00181012: 'DateOfSecondaryCapture',
  x00181014: 'TimeOfSecondaryCapture',
  x00181016: 'SecondaryCaptureDeviceManufacturer',
  x00181017: 'HardcopyDeviceManufacturer',
  x00181018: 'SecondaryCaptureDeviceModelName',
  x00181019: 'SecondaryCaptureDeviceSoftwareVers',
  x0018101a: 'HardcopyDeviceSoftwareVersion',
  x0018101b: 'HardcopyDeviceModelName',
  x00181020: 'SoftwareVersion',
  x00181022: 'VideoImageFormatAcquired',
  x00181023: 'DigitalImageFormatAcquired',
  x00181030: 'ProtocolName',
  x00181040: 'ContrastBolusRoute',
  x00181041: 'ContrastBolusVolume',
  x00181042: 'ContrastBolusStartTime',
  x00181043: 'ContrastBolusStopTime',
  x00181044: 'ContrastBolusTotalDose',
  x00181045: 'SyringeCounts',
  x00181046: 'ContrastFlowRate',
  x00181047: 'ContrastFlowDuration',
  x00181048: 'ContrastBolusIngredient',
  x00181049: 'ContrastBolusConcentration',
  x00181050: 'SpatialResolution',
  x00181060: 'TriggerTime',
  x00181061: 'TriggerSourceOrType',
  x00181062: 'NominalInterval',
  x00181063: 'FrameTime',
  x00181064: 'CardiacFramingType',
  x00181065: 'FrameTimeVector',
  x00181066: 'FrameDelay',
  x00181067: 'ImageTriggerDelay',
  x00181068: 'MultiplexGroupTimeOffset',
  x00181069: 'TriggerTimeOffset',
  x0018106a: 'SynchronizationTrigger',
  x0018106c: 'SynchronizationChannel',
  x0018106e: 'TriggerSamplePosition',
  x00181070: 'RadiopharmaceuticalRoute',
  x00181071: 'RadiopharmaceuticalVolume',
  x00181072: 'RadiopharmaceuticalStartTime',
  x00181073: 'RadiopharmaceuticalStopTime',
  x00181074: 'RadionuclideTotalDose',
  x00181075: 'RadionuclideHalfLife',
  x00181076: 'RadionuclidePositronFraction',
  x00181077: 'RadiopharmaceuticalSpecActivity',
  x00181078: 'RadiopharmaceuticalStartDateTime',
  x00181079: 'RadiopharmaceuticalStopDateTime',
  x00181080: 'BeatRejectionFlag',
  x00181081: 'LowRRValue',
  x00181082: 'HighRRValue',
  x00181083: 'IntervalsAcquired',
  x00181084: 'IntervalsRejected',
  x00181085: 'PVCRejection',
  x00181086: 'SkipBeats',
  x00181088: 'HeartRate',
  x00181090: 'CardiacNumberOfImages',
  x00181094: 'TriggerWindow',
  x00181100: 'ReconstructionDiameter',
  x00181110: 'DistanceSourceToDetector',
  x00181111: 'DistanceSourceToPatient',
  x00181114: 'EstimatedRadiographicMagnification',
  x00181120: 'GantryDetectorTilt',
  x00181121: 'GantryDetectorSlew',
  x00181130: 'TableHeight',
  x00181131: 'TableTraverse',
  x00181134: 'TableMotion',
  x00181135: 'TableVerticalIncrement',
  x00181136: 'TableLateralIncrement',
  x00181137: 'TableLongitudinalIncrement',
  x00181138: 'TableAngle',
  x0018113a: 'TableType',
  x00181140: 'RotationDirection',
  x00181141: 'AngularPosition',
  x00181142: 'RadialPosition',
  x00181143: 'ScanArc',
  x00181144: 'AngularStep',
  x00181145: 'CenterOfRotationOffset',
  x00181146: 'RotationOffset',
  x00181147: 'FieldOfViewShape',
  x00181149: 'FieldOfViewDimensions',
  x00181150: 'ExposureTime',
  x00181151: 'XRayTubeCurrent',
  x00181152: 'Exposure',
  x00181153: 'ExposureInMicroAmpSec',
  x00181154: 'AveragePulseWidth',
  x00181155: 'RadiationSetting',
  x00181156: 'RectificationType',
  x0018115a: 'RadiationMode',
  x0018115e: 'ImageAreaDoseProduct',
  x00181160: 'FilterType',
  x00181161: 'TypeOfFilters',
  x00181162: 'IntensifierSize',
  x00181164: 'ImagerPixelSpacing',
  x00181166: 'Grid',
  x00181170: 'GeneratorPower',
  x00181180: 'CollimatorGridName',
  x00181181: 'CollimatorType',
  x00181182: 'FocalDistance',
  x00181183: 'XFocusCenter',
  x00181184: 'YFocusCenter',
  x00181190: 'FocalSpots',
  x00181191: 'AnodeTargetMaterial',
  x001811a0: 'BodyPartThickness',
  x001811a2: 'CompressionForce',
  x00181200: 'DateOfLastCalibration',
  x00181201: 'TimeOfLastCalibration',
  x00181210: 'ConvolutionKernel',
  x00181240: 'UpperLowerPixelValues',
  x00181242: 'ActualFrameDuration',
  x00181243: 'CountRate',
  x00181244: 'PreferredPlaybackSequencing',
  x00181250: 'ReceiveCoilName',
  x00181251: 'TransmitCoilName',
  x00181260: 'PlateType',
  x00181261: 'PhosphorType',
  x00181300: 'ScanVelocity',
  x00181301: 'WholeBodyTechnique',
  x00181302: 'ScanLength',
  x00181310: 'AcquisitionMatrix',
  x00181312: 'InPlanePhaseEncodingDirection',
  x00181314: 'FlipAngle',
  x00181315: 'VariableFlipAngleFlag',
  x00181316: 'SAR',
  x00181318: 'DB-Dt',
  x00181400: 'AcquisitionDeviceProcessingDescr',
  x00181401: 'AcquisitionDeviceProcessingCode',
  x00181402: 'CassetteOrientation',
  x00181403: 'CassetteSize',
  x00181404: 'ExposuresOnPlate',
  x00181405: 'RelativeXRayExposure',
  x00181450: 'ColumnAngulation',
  x00181460: 'TomoLayerHeight',
  x00181470: 'TomoAngle',
  x00181480: 'TomoTime',
  x00181490: 'TomoType',
  x00181491: 'TomoClass',
  x00181495: 'NumberOfTomosynthesisSourceImages',
  x00181500: 'PositionerMotion',
  x00181508: 'PositionerType',
  x00181510: 'PositionerPrimaryAngle',
  x00181511: 'PositionerSecondaryAngle',
  x00181520: 'PositionerPrimaryAngleIncrement',
  x00181521: 'PositionerSecondaryAngleIncrement',
  x00181530: 'DetectorPrimaryAngle',
  x00181531: 'DetectorSecondaryAngle',
  x00181600: 'ShutterShape',
  x00181602: 'ShutterLeftVerticalEdge',
  x00181604: 'ShutterRightVerticalEdge',
  x00181606: 'ShutterUpperHorizontalEdge',
  x00181608: 'ShutterLowerHorizontalEdge',
  x00181610: 'CenterOfCircularShutter',
  x00181612: 'RadiusOfCircularShutter',
  x00181620: 'VerticesOfPolygonalShutter',
  x00181622: 'ShutterPresentationValue',
  x00181623: 'ShutterOverlayGroup',
  x00181624: 'ShutterPresentationColorCIELabVal',
  x00181700: 'CollimatorShape',
  x00181702: 'CollimatorLeftVerticalEdge',
  x00181704: 'CollimatorRightVerticalEdge',
  x00181706: 'CollimatorUpperHorizontalEdge',
  x00181708: 'CollimatorLowerHorizontalEdge',
  x00181710: 'CenterOfCircularCollimator',
  x00181712: 'RadiusOfCircularCollimator',
  x00181720: 'VerticesOfPolygonalCollimator',
  x00181800: 'AcquisitionTimeSynchronized',
  x00181801: 'TimeSource',
  x00181802: 'TimeDistributionProtocol',
  x00181803: 'NTPSourceAddress',
  x00182001: 'PageNumberVector',
  x00182002: 'FrameLabelVector',
  x00182003: 'FramePrimaryAngleVector',
  x00182004: 'FrameSecondaryAngleVector',
  x00182005: 'SliceLocationVector',
  x00182006: 'DisplayWindowLabelVector',
  x00182010: 'NominalScannedPixelSpacing',
  x00182020: 'DigitizingDeviceTransportDirection',
  x00182030: 'RotationOfScannedFilm',
  x00183100: 'IVUSAcquisition',
  x00183101: 'IVUSPullbackRate',
  x00183102: 'IVUSGatedRate',
  x00183103: 'IVUSPullbackStartFrameNumber',
  x00183104: 'IVUSPullbackStopFrameNumber',
  x00183105: 'LesionNumber',
  x00184000: 'AcquisitionComments',
  x00185000: 'OutputPower',
  x00185010: 'TransducerData',
  x00185012: 'FocusDepth',
  x00185020: 'ProcessingFunction',
  x00185021: 'PostprocessingFunction',
  x00185022: 'MechanicalIndex',
  x00185024: 'BoneThermalIndex',
  x00185026: 'CranialThermalIndex',
  x00185027: 'SoftTissueThermalIndex',
  x00185028: 'SoftTissueFocusThermalIndex',
  x00185029: 'SoftTissueSurfaceThermalIndex',
  x00185030: 'DynamicRange',
  x00185040: 'TotalGain',
  x00185050: 'DepthOfScanField',
  x00185100: 'PatientPosition',
  x00185101: 'ViewPosition',
  x00185104: 'ProjectionEponymousNameCodeSeq',
  x00185210: 'ImageTransformationMatrix',
  x00185212: 'ImageTranslationVector',
  x00186000: 'Sensitivity',
  x00186011: 'SequenceOfUltrasoundRegions',
  x00186012: 'RegionSpatialFormat',
  x00186014: 'RegionDataType',
  x00186016: 'RegionFlags',
  x00186018: 'RegionLocationMinX0',
  x0018601a: 'RegionLocationMinY0',
  x0018601c: 'RegionLocationMaxX1',
  x0018601e: 'RegionLocationMaxY1',
  x00186020: 'ReferencePixelX0',
  x00186022: 'ReferencePixelY0',
  x00186024: 'PhysicalUnitsXDirection',
  x00186026: 'PhysicalUnitsYDirection',
  x00186028: 'ReferencePixelPhysicalValueX',
  x0018602a: 'ReferencePixelPhysicalValueY',
  x0018602c: 'PhysicalDeltaX',
  x0018602e: 'PhysicalDeltaY',
  x00186030: 'TransducerFrequency',
  x00186031: 'TransducerType',
  x00186032: 'PulseRepetitionFrequency',
  x00186034: 'DopplerCorrectionAngle',
  x00186036: 'SteeringAngle',
  x00186038: 'DopplerSampleVolumeXPosRetired',
  x00186039: 'DopplerSampleVolumeXPosition',
  x0018603a: 'DopplerSampleVolumeYPosRetired',
  x0018603b: 'DopplerSampleVolumeYPosition',
  x0018603c: 'TMLinePositionX0Retired',
  x0018603d: 'TMLinePositionX0',
  x0018603e: 'TMLinePositionY0Retired',
  x0018603f: 'TMLinePositionY0',
  x00186040: 'TMLinePositionX1Retired',
  x00186041: 'TMLinePositionX1',
  x00186042: 'TMLinePositionY1Retired',
  x00186043: 'TMLinePositionY1',
  x00186044: 'PixelComponentOrganization',
  x00186046: 'PixelComponentMask',
  x00186048: 'PixelComponentRangeStart',
  x0018604a: 'PixelComponentRangeStop',
  x0018604c: 'PixelComponentPhysicalUnits',
  x0018604e: 'PixelComponentDataType',
  x00186050: 'NumberOfTableBreakPoints',
  x00186052: 'TableOfXBreakPoints',
  x00186054: 'TableOfYBreakPoints',
  x00186056: 'NumberOfTableEntries',
  x00186058: 'TableOfPixelValues',
  x0018605a: 'TableOfParameterValues',
  x00186060: 'RWaveTimeVector',
  x00187000: 'DetectorConditionsNominalFlag',
  x00187001: 'DetectorTemperature',
  x00187004: 'DetectorType',
  x00187005: 'DetectorConfiguration',
  x00187006: 'DetectorDescription',
  x00187008: 'DetectorMode',
  x0018700a: 'DetectorID',
  x0018700c: 'DateOfLastDetectorCalibration',
  x0018700e: 'TimeOfLastDetectorCalibration',
  x00187010: 'DetectorExposuresSinceCalibration',
  x00187011: 'DetectorExposuresSinceManufactured',
  x00187012: 'DetectorTimeSinceLastExposure',
  x00187014: 'DetectorActiveTime',
  x00187016: 'DetectorActiveOffsetFromExposure',
  x0018701a: 'DetectorBinning',
  x00187020: 'DetectorElementPhysicalSize',
  x00187022: 'DetectorElementSpacing',
  x00187024: 'DetectorActiveShape',
  x00187026: 'DetectorActiveDimensions',
  x00187028: 'DetectorActiveOrigin',
  x0018702a: 'DetectorManufacturerName',
  x0018702b: 'DetectorManufacturersModelName',
  x00187030: 'FieldOfViewOrigin',
  x00187032: 'FieldOfViewRotation',
  x00187034: 'FieldOfViewHorizontalFlip',
  x00187040: 'GridAbsorbingMaterial',
  x00187041: 'GridSpacingMaterial',
  x00187042: 'GridThickness',
  x00187044: 'GridPitch',
  x00187046: 'GridAspectRatio',
  x00187048: 'GridPeriod',
  x0018704c: 'GridFocalDistance',
  x00187050: 'FilterMaterial',
  x00187052: 'FilterThicknessMinimum',
  x00187054: 'FilterThicknessMaximum',
  x00187060: 'ExposureControlMode',
  x00187062: 'ExposureControlModeDescription',
  x00187064: 'ExposureStatus',
  x00187065: 'PhototimerSetting',
  x00188150: 'ExposureTimeInMicroSec',
  x00188151: 'XRayTubeCurrentInMicroAmps',
  x00189004: 'ContentQualification',
  x00189005: 'PulseSequenceName',
  x00189006: 'MRImagingModifierSequence',
  x00189008: 'EchoPulseSequence',
  x00189009: 'InversionRecovery',
  x00189010: 'FlowCompensation',
  x00189011: 'MultipleSpinEcho',
  x00189012: 'MultiPlanarExcitation',
  x00189014: 'PhaseContrast',
  x00189015: 'TimeOfFlightContrast',
  x00189016: 'Spoiling',
  x00189017: 'SteadyStatePulseSequence',
  x00189018: 'EchoPlanarPulseSequence',
  x00189019: 'TagAngleFirstAxis',
  x00189020: 'MagnetizationTransfer',
  x00189021: 'T2Preparation',
  x00189022: 'BloodSignalNulling',
  x00189024: 'SaturationRecovery',
  x00189025: 'SpectrallySelectedSuppression',
  x00189026: 'SpectrallySelectedExcitation',
  x00189027: 'SpatialPresaturation',
  x00189028: 'Tagging',
  x00189029: 'OversamplingPhase',
  x00189030: 'TagSpacingFirstDimension',
  x00189032: 'GeometryOfKSpaceTraversal',
  x00189033: 'SegmentedKSpaceTraversal',
  x00189034: 'RectilinearPhaseEncodeReordering',
  x00189035: 'TagThickness',
  x00189036: 'PartialFourierDirection',
  x00189037: 'CardiacSynchronizationTechnique',
  x00189041: 'ReceiveCoilManufacturerName',
  x00189042: 'MRReceiveCoilSequence',
  x00189043: 'ReceiveCoilType',
  x00189044: 'QuadratureReceiveCoil',
  x00189045: 'MultiCoilDefinitionSequence',
  x00189046: 'MultiCoilConfiguration',
  x00189047: 'MultiCoilElementName',
  x00189048: 'MultiCoilElementUsed',
  x00189049: 'MRTransmitCoilSequence',
  x00189050: 'TransmitCoilManufacturerName',
  x00189051: 'TransmitCoilType',
  x00189052: 'SpectralWidth',
  x00189053: 'ChemicalShiftReference',
  x00189054: 'VolumeLocalizationTechnique',
  x00189058: 'MRAcquisitionFrequencyEncodeSteps',
  x00189059: 'Decoupling',
  x00189060: 'DecoupledNucleus',
  x00189061: 'DecouplingFrequency',
  x00189062: 'DecouplingMethod',
  x00189063: 'DecouplingChemicalShiftReference',
  x00189064: 'KSpaceFiltering',
  x00189065: 'TimeDomainFiltering',
  x00189066: 'NumberOfZeroFills',
  x00189067: 'BaselineCorrection',
  x00189069: 'ParallelReductionFactorInPlane',
  x00189070: 'CardiacRRIntervalSpecified',
  x00189073: 'AcquisitionDuration',
  x00189074: 'FrameAcquisitionDateTime',
  x00189075: 'DiffusionDirectionality',
  x00189076: 'DiffusionGradientDirectionSequence',
  x00189077: 'ParallelAcquisition',
  x00189078: 'ParallelAcquisitionTechnique',
  x00189079: 'InversionTimes',
  x00189080: 'MetaboliteMapDescription',
  x00189081: 'PartialFourier',
  x00189082: 'EffectiveEchoTime',
  x00189083: 'MetaboliteMapCodeSequence',
  x00189084: 'ChemicalShiftSequence',
  x00189085: 'CardiacSignalSource',
  x00189087: 'DiffusionBValue',
  x00189089: 'DiffusionGradientOrientation',
  x00189090: 'VelocityEncodingDirection',
  x00189091: 'VelocityEncodingMinimumValue',
  x00189093: 'NumberOfKSpaceTrajectories',
  x00189094: 'CoverageOfKSpace',
  x00189095: 'SpectroscopyAcquisitionPhaseRows',
  x00189096: 'ParallelReductFactorInPlaneRetired',
  x00189098: 'TransmitterFrequency',
  x00189100: 'ResonantNucleus',
  x00189101: 'FrequencyCorrection',
  x00189103: 'MRSpectroscopyFOV-GeometrySequence',
  x00189104: 'SlabThickness',
  x00189105: 'SlabOrientation',
  x00189106: 'MidSlabPosition',
  x00189107: 'MRSpatialSaturationSequence',
  x00189112: 'MRTimingAndRelatedParametersSeq',
  x00189114: 'MREchoSequence',
  x00189115: 'MRModifierSequence',
  x00189117: 'MRDiffusionSequence',
  x00189118: 'CardiacTriggerSequence',
  x00189119: 'MRAveragesSequence',
  x00189125: 'MRFOV-GeometrySequence',
  x00189126: 'VolumeLocalizationSequence',
  x00189127: 'SpectroscopyAcquisitionDataColumns',
  x00189147: 'DiffusionAnisotropyType',
  x00189151: 'FrameReferenceDateTime',
  x00189152: 'MRMetaboliteMapSequence',
  x00189155: 'ParallelReductionFactorOutOfPlane',
  x00189159: 'SpectroscopyOutOfPlanePhaseSteps',
  x00189166: 'BulkMotionStatus',
  x00189168: 'ParallelReductionFactSecondInPlane',
  x00189169: 'CardiacBeatRejectionTechnique',
  x00189170: 'RespiratoryMotionCompTechnique',
  x00189171: 'RespiratorySignalSource',
  x00189172: 'BulkMotionCompensationTechnique',
  x00189173: 'BulkMotionSignalSource',
  x00189174: 'ApplicableSafetyStandardAgency',
  x00189175: 'ApplicableSafetyStandardDescr',
  x00189176: 'OperatingModeSequence',
  x00189177: 'OperatingModeType',
  x00189178: 'OperatingMode',
  x00189179: 'SpecificAbsorptionRateDefinition',
  x00189180: 'GradientOutputType',
  x00189181: 'SpecificAbsorptionRateValue',
  x00189182: 'GradientOutput',
  x00189183: 'FlowCompensationDirection',
  x00189184: 'TaggingDelay',
  x00189185: 'RespiratoryMotionCompTechDescr',
  x00189186: 'RespiratorySignalSourceID',
  x00189195: 'ChemicalShiftsMinIntegrateLimitHz',
  x00189196: 'ChemicalShiftsMaxIntegrateLimitHz',
  x00189197: 'MRVelocityEncodingSequence',
  x00189198: 'FirstOrderPhaseCorrection',
  x00189199: 'WaterReferencedPhaseCorrection',
  x00189200: 'MRSpectroscopyAcquisitionType',
  x00189214: 'RespiratoryCyclePosition',
  x00189217: 'VelocityEncodingMaximumValue',
  x00189218: 'TagSpacingSecondDimension',
  x00189219: 'TagAngleSecondAxis',
  x00189220: 'FrameAcquisitionDuration',
  x00189226: 'MRImageFrameTypeSequence',
  x00189227: 'MRSpectroscopyFrameTypeSequence',
  x00189231: 'MRAcqPhaseEncodingStepsInPlane',
  x00189232: 'MRAcqPhaseEncodingStepsOutOfPlane',
  x00189234: 'SpectroscopyAcqPhaseColumns',
  x00189236: 'CardiacCyclePosition',
  x00189239: 'SpecificAbsorptionRateSequence',
  x00189240: 'RFEchoTrainLength',
  x00189241: 'GradientEchoTrainLength',
  x00189295: 'ChemicalShiftsMinIntegrateLimitPPM',
  x00189296: 'ChemicalShiftsMaxIntegrateLimitPPM',
  x00189301: 'CTAcquisitionTypeSequence',
  x00189302: 'AcquisitionType',
  x00189303: 'TubeAngle',
  x00189304: 'CTAcquisitionDetailsSequence',
  x00189305: 'RevolutionTime',
  x00189306: 'SingleCollimationWidth',
  x00189307: 'TotalCollimationWidth',
  x00189308: 'CTTableDynamicsSequence',
  x00189309: 'TableSpeed',
  x00189310: 'TableFeedPerRotation',
  x00189311: 'SpiralPitchFactor',
  x00189312: 'CTGeometrySequence',
  x00189313: 'DataCollectionCenterPatient',
  x00189314: 'CTReconstructionSequence',
  x00189315: 'ReconstructionAlgorithm',
  x00189316: 'ConvolutionKernelGroup',
  x00189317: 'ReconstructionFieldOfView',
  x00189318: 'ReconstructionTargetCenterPatient',
  x00189319: 'ReconstructionAngle',
  x00189320: 'ImageFilter',
  x00189321: 'CTExposureSequence',
  x00189322: 'ReconstructionPixelSpacing',
  x00189323: 'ExposureModulationType',
  x00189324: 'EstimatedDoseSaving',
  x00189325: 'CTXRayDetailsSequence',
  x00189326: 'CTPositionSequence',
  x00189327: 'TablePosition',
  x00189328: 'ExposureTimeInMilliSec',
  x00189329: 'CTImageFrameTypeSequence',
  x00189330: 'XRayTubeCurrentInMilliAmps',
  x00189332: 'ExposureInMilliAmpSec',
  x00189333: 'ConstantVolumeFlag',
  x00189334: 'FluoroscopyFlag',
  x00189335: 'SourceToDataCollectionCenterDist',
  x00189337: 'ContrastBolusAgentNumber',
  x00189338: 'ContrastBolusIngredientCodeSeq',
  x00189340: 'ContrastAdministrationProfileSeq',
  x00189341: 'ContrastBolusUsageSequence',
  x00189342: 'ContrastBolusAgentAdministered',
  x00189343: 'ContrastBolusAgentDetected',
  x00189344: 'ContrastBolusAgentPhase',
  x00189345: 'CTDIvol',
  x00189346: 'CTDIPhantomTypeCodeSequence',
  x00189351: 'CalciumScoringMassFactorPatient',
  x00189352: 'CalciumScoringMassFactorDevice',
  x00189353: 'EnergyWeightingFactor',
  x00189360: 'CTAdditionalXRaySourceSequence',
  x00189401: 'ProjectionPixelCalibrationSequence',
  x00189402: 'DistanceSourceToIsocenter',
  x00189403: 'DistanceObjectToTableTop',
  x00189404: 'ObjectPixelSpacingInCenterOfBeam',
  x00189405: 'PositionerPositionSequence',
  x00189406: 'TablePositionSequence',
  x00189407: 'CollimatorShapeSequence',
  x00189412: 'XA-XRFFrameCharacteristicsSequence',
  x00189417: 'FrameAcquisitionSequence',
  x00189420: 'XRayReceptorType',
  x00189423: 'AcquisitionProtocolName',
  x00189424: 'AcquisitionProtocolDescription',
  x00189425: 'ContrastBolusIngredientOpaque',
  x00189426: 'DistanceReceptorPlaneToDetHousing',
  x00189427: 'IntensifierActiveShape',
  x00189428: 'IntensifierActiveDimensions',
  x00189429: 'PhysicalDetectorSize',
  x00189430: 'PositionOfIsocenterProjection',
  x00189432: 'FieldOfViewSequence',
  x00189433: 'FieldOfViewDescription',
  x00189434: 'ExposureControlSensingRegionsSeq',
  x00189435: 'ExposureControlSensingRegionShape',
  x00189436: 'ExposureControlSensRegionLeftEdge',
  x00189437: 'ExposureControlSensRegionRightEdge',
  x00189440: 'CenterOfCircExposControlSensRegion',
  x00189441: 'RadiusOfCircExposControlSensRegion',
  x00189447: 'ColumnAngulationPatient',
  x00189449: 'BeamAngle',
  x00189451: 'FrameDetectorParametersSequence',
  x00189452: 'CalculatedAnatomyThickness',
  x00189455: 'CalibrationSequence',
  x00189456: 'ObjectThicknessSequence',
  x00189457: 'PlaneIdentification',
  x00189461: 'FieldOfViewDimensionsInFloat',
  x00189462: 'IsocenterReferenceSystemSequence',
  x00189463: 'PositionerIsocenterPrimaryAngle',
  x00189464: 'PositionerIsocenterSecondaryAngle',
  x00189465: 'PositionerIsocenterDetRotAngle',
  x00189466: 'TableXPositionToIsocenter',
  x00189467: 'TableYPositionToIsocenter',
  x00189468: 'TableZPositionToIsocenter',
  x00189469: 'TableHorizontalRotationAngle',
  x00189470: 'TableHeadTiltAngle',
  x00189471: 'TableCradleTiltAngle',
  x00189472: 'FrameDisplayShutterSequence',
  x00189473: 'AcquiredImageAreaDoseProduct',
  x00189474: 'CArmPositionerTabletopRelationship',
  x00189476: 'XRayGeometrySequence',
  x00189477: 'IrradiationEventIDSequence',
  x00189504: 'XRay3DFrameTypeSequence',
  x00189506: 'ContributingSourcesSequence',
  x00189507: 'XRay3DAcquisitionSequence',
  x00189508: 'PrimaryPositionerScanArc',
  x00189509: 'SecondaryPositionerScanArc',
  x00189510: 'PrimaryPositionerScanStartAngle',
  x00189511: 'SecondaryPositionerScanStartAngle',
  x00189514: 'PrimaryPositionerIncrement',
  x00189515: 'SecondaryPositionerIncrement',
  x00189516: 'StartAcquisitionDateTime',
  x00189517: 'EndAcquisitionDateTime',
  x00189524: 'ApplicationName',
  x00189525: 'ApplicationVersion',
  x00189526: 'ApplicationManufacturer',
  x00189527: 'AlgorithmType',
  x00189528: 'AlgorithmDescription',
  x00189530: 'XRay3DReconstructionSequence',
  x00189531: 'ReconstructionDescription',
  x00189538: 'PerProjectionAcquisitionSequence',
  x00189601: 'DiffusionBMatrixSequence',
  x00189602: 'DiffusionBValueXX',
  x00189603: 'DiffusionBValueXY',
  x00189604: 'DiffusionBValueXZ',
  x00189605: 'DiffusionBValueYY',
  x00189606: 'DiffusionBValueYZ',
  x00189607: 'DiffusionBValueZZ',
  x00189701: 'DecayCorrectionDateTime',
  x00189715: 'StartDensityThreshold',
  x00189722: 'TerminationTimeThreshold',
  x00189725: 'DetectorGeometry',
  x00189727: 'AxialDetectorDimension',
  x00189735: 'PETPositionSequence',
  x00189739: 'NumberOfIterations',
  x00189740: 'NumberOfSubsets',
  x00189751: 'PETFrameTypeSequence',
  x00189756: 'ReconstructionType',
  x00189758: 'DecayCorrected',
  x00189759: 'AttenuationCorrected',
  x00189760: 'ScatterCorrected',
  x00189761: 'DeadTimeCorrected',
  x00189762: 'GantryMotionCorrected',
  x00189763: 'PatientMotionCorrected',
  x00189765: 'RandomsCorrected',
  x00189767: 'SensitivityCalibrated',
  x00189801: 'DepthsOfFocus',
  x00189804: 'ExclusionStartDatetime',
  x00189805: 'ExclusionDuration',
  x00189807: 'ImageDataTypeSequence',
  x00189808: 'DataType',
  x0018980b: 'AliasedDataType',
  x0018a001: 'ContributingEquipmentSequence',
  x0018a002: 'ContributionDateTime',
  x0018a003: 'ContributionDescription',
  // x00191002: 'NumberOfCellsIInDetector',
  // x00191003: 'CellNumberAtTheta',
  // x00191004: 'CellSpacing',
  // x0019100f: 'HorizFrameOfRef',
  // x00191011: 'SeriesContrast',
  // x00191012: 'LastPseq',
  // x00191013: 'StartNumberForBaseline',
  // x00191014: 'EndNumberForBaseline',
  // x00191015: 'StartNumberForEnhancedScans',
  // x00191016: 'EndNumberForEnhancedScans',
  // x00191017: 'SeriesPlane',
  // x00191018: 'FirstScanRas',
  // x00191019: 'FirstScanLocation',
  // x0019101a: 'LastScanRas',
  // x0019101b: 'LastScanLoc',
  // x0019101e: 'DisplayFieldOfView',
  // x00191023: 'TableSpeed',
  // x00191024: 'MidScanTime',
  // x00191025: 'MidScanFlag',
  // x00191026: 'DegreesOfAzimuth',
  // x00191027: 'GantryPeriod',
  // x0019102a: 'XRayOnPosition',
  // x0019102b: 'XRayOffPosition',
  // x0019102c: 'NumberOfTriggers',
  // x0019102e: 'AngleOfFirstView',
  // x0019102f: 'TriggerFrequency',
  // x00191039: 'ScanFOVType',
  // x00191040: 'StatReconFlag',
  // x00191041: 'ComputeType',
  // x00191042: 'SegmentNumber',
  // x00191043: 'TotalSegmentsRequested',
  // x00191044: 'InterscanDelay',
  // x00191047: 'ViewCompressionFactor',
  // x0019104a: 'TotalNoOfRefChannels',
  // x0019104b: 'DataSizeForScanData',
  // x00191052: 'ReconPostProcflag',
  // x00191057: 'CTWaterNumber',
  // x00191058: 'CTBoneNumber',
  // x0019105a: 'AcquisitionDuration',
  // x0019105e: 'NumberOfChannels',
  // x0019105f: 'IncrementBetweenChannels',
  // x00191060: 'StartingView',
  // x00191061: 'NumberOfViews',
  // x00191062: 'IncrementBetweenViews',
  // x0019106a: 'DependantOnNoViewsProcessed',
  // x0019106b: 'FieldOfViewInDetectorCells',
  // x00191070: 'ValueOfBackProjectionButton',
  // x00191071: 'SetIfFatqEstimatesWereUsed',
  // x00191072: 'ZChanAvgOverViews',
  // x00191073: 'AvgOfLeftRefChansOverViews',
  // x00191074: 'MaxLeftChanOverViews',
  // x00191075: 'AvgOfRightRefChansOverViews',
  // x00191076: 'MaxRightChanOverViews',
  // x0019107d: 'SecondEcho',
  // x0019107e: 'NumberOfEchoes',
  // x0019107f: 'TableDelta',
  // x00191081: 'Contiguous',
  // x00191084: 'PeakSAR',
  // x00191085: 'MonitorSAR',
  // x00191087: 'CardiacRepetitionTime',
  // x00191088: 'ImagesPerCardiacCycle',
  // x0019108a: 'ActualReceiveGainAnalog',
  // x0019108b: 'ActualReceiveGainDigital',
  // x0019108d: 'DelayAfterTrigger',
  // x0019108f: 'Swappf',
  // x00191090: 'PauseInterval',
  // x00191091: 'PulseTime',
  // x00191092: 'SliceOffsetOnFreqAxis',
  // x00191093: 'CenterFrequency',
  // x00191094: 'TransmitGain',
  // x00191095: 'AnalogReceiverGain',
  // x00191096: 'DigitalReceiverGain',
  // x00191097: 'BitmapDefiningCVs',
  // x00191098: 'CenterFreqMethod',
  // x0019109b: 'PulseSeqMode',
  // x0019109c: 'PulseSeqName',
  // x0019109d: 'PulseSeqDate',
  // x0019109e: 'InternalPulseSeqName',
  // x0019109f: 'TransmittingCoil',
  // x001910a0: 'SurfaceCoilType',
  // x001910a1: 'ExtremityCoilFlag',
  // x001910a2: 'RawDataRunNumber',
  // x001910a3: 'CalibratedFieldStrength',
  // x001910a4: 'SATFatWaterBone',
  // x001910a5: 'ReceiveBandwidth',
  // x001910a7: 'UserData01',
  // x001910a8: 'UserData02',
  // x001910a9: 'UserData03',
  // x001910aa: 'UserData04',
  // x001910ab: 'UserData05',
  // x001910ac: 'UserData06',
  // x001910ad: 'UserData07',
  // x001910ae: 'UserData08',
  // x001910af: 'UserData09',
  // x001910b0: 'UserData10',
  // x001910b1: 'UserData11',
  // x001910b2: 'UserData12',
  // x001910b3: 'UserData13',
  // x001910b4: 'UserData14',
  // x001910b5: 'UserData15',
  // x001910b6: 'UserData16',
  // x001910b7: 'UserData17',
  // x001910b8: 'UserData18',
  // x001910b9: 'UserData19',
  // x001910ba: 'UserData20',
  // x001910bb: 'UserData21',
  // x001910bc: 'UserData22',
  // x001910bd: 'UserData23',
  // x001910be: 'ProjectionAngle',
  // x001910c0: 'SaturationPlanes',
  // x001910c1: 'SurfaceCoilIntensity',
  // x001910c2: 'SATLocationR',
  // x001910c3: 'SATLocationL',
  // x001910c4: 'SATLocationA',
  // x001910c5: 'SATLocationP',
  // x001910c6: 'SATLocationH',
  // x001910c7: 'SATLocationF',
  // x001910c8: 'SATThicknessR-L',
  // x001910c9: 'SATThicknessA-P',
  // x001910ca: 'SATThicknessH-F',
  // x001910cb: 'PrescribedFlowAxis',
  // x001910cc: 'VelocityEncoding',
  // x001910cd: 'ThicknessDisclaimer',
  // x001910ce: 'PrescanType',
  // x001910cf: 'PrescanStatus',
  // x001910d0: 'RawDataType',
  // x001910d2: 'ProjectionAlgorithm',
  // x001910d3: 'ProjectionAlgorithm',
  // x001910d5: 'FractionalEcho',
  // x001910d6: 'PrepPulse',
  // x001910d7: 'CardiacPhases',
  // x001910d8: 'VariableEchoflag',
  // x001910d9: 'ConcatenatedSAT',
  // x001910da: 'ReferenceChannelUsed',
  // x001910db: 'BackProjectorCoefficient',
  // x001910dc: 'PrimarySpeedCorrectionUsed',
  // x001910dd: 'OverrangeCorrectionUsed',
  // x001910de: 'DynamicZAlphaValue',
  // x001910df: 'UserData',
  // x001910e0: 'UserData',
  // x001910e2: 'VelocityEncodeScale',
  // x001910f2: 'FastPhases',
  // x001910f9: 'TransmissionGain',
  x00200000: 'RelationshipGroupLength',
  x0020000d: 'StudyInstanceUID',
  x0020000e: 'SeriesInstanceUID',
  x00200010: 'StudyID',
  x00200011: 'SeriesNumber',
  x00200012: 'AcquisitionNumber',
  x00200013: 'InstanceNumber',
  x00200014: 'IsotopeNumber',
  x00200015: 'PhaseNumber',
  x00200016: 'IntervalNumber',
  x00200017: 'TimeSlotNumber',
  x00200018: 'AngleNumber',
  x00200019: 'ItemNumber',
  x00200020: 'PatientOrientation',
  x00200022: 'OverlayNumber',
  x00200024: 'CurveNumber',
  x00200026: 'LookupTableNumber',
  x00200030: 'ImagePosition',
  x00200032: 'ImagePositionPatient',
  x00200035: 'ImageOrientation',
  x00200037: 'ImageOrientationPatient',
  x00200050: 'Location',
  x00200052: 'FrameOfReferenceUID',
  x00200060: 'Laterality',
  x00200062: 'ImageLaterality',
  x00200070: 'ImageGeometryType',
  x00200080: 'MaskingImage',
  x00200100: 'TemporalPositionIdentifier',
  x00200105: 'NumberOfTemporalPositions',
  x00200110: 'TemporalResolution',
  x00200200: 'SynchronizationFrameOfReferenceUID',
  x00201000: 'SeriesInStudy',
  x00201001: 'AcquisitionsInSeries',
  x00201002: 'ImagesInAcquisition',
  x00201003: 'ImagesInSeries',
  x00201004: 'AcquisitionsInStudy',
  x00201005: 'ImagesInStudy',
  x00201020: 'Reference',
  x00201040: 'PositionReferenceIndicator',
  x00201041: 'SliceLocation',
  x00201070: 'OtherStudyNumbers',
  x00201200: 'NumberOfPatientRelatedStudies',
  x00201202: 'NumberOfPatientRelatedSeries',
  x00201204: 'NumberOfPatientRelatedInstances',
  x00201206: 'NumberOfStudyRelatedSeries',
  x00201208: 'NumberOfStudyRelatedInstances',
  x00201209: 'NumberOfSeriesRelatedInstances',
  x002031xx: 'SourceImageIDs',
  x00203401: 'ModifyingDeviceID',
  x00203402: 'ModifiedImageID',
  x00203403: 'ModifiedImageDate',
  x00203404: 'ModifyingDeviceManufacturer',
  x00203405: 'ModifiedImageTime',
  x00203406: 'ModifiedImageDescription',
  x00204000: 'ImageComments',
  x00205000: 'OriginalImageIdentification',
  x00205002: 'OriginalImageIdentNomenclature',
  x00209056: 'StackID',
  x00209057: 'InStackPositionNumber',
  x00209071: 'FrameAnatomySequence',
  x00209072: 'FrameLaterality',
  x00209111: 'FrameContentSequence',
  x00209113: 'PlanePositionSequence',
  x00209116: 'PlaneOrientationSequence',
  x00209128: 'TemporalPositionIndex',
  x00209153: 'TriggerDelayTime',
  x00209156: 'FrameAcquisitionNumber',
  x00209157: 'DimensionIndexValues',
  x00209158: 'FrameComments',
  x00209161: 'ConcatenationUID',
  x00209162: 'InConcatenationNumber',
  x00209163: 'InConcatenationTotalNumber',
  x00209164: 'DimensionOrganizationUID',
  x00209165: 'DimensionIndexPointer',
  x00209167: 'FunctionalGroupPointer',
  x00209213: 'DimensionIndexPrivateCreator',
  x00209221: 'DimensionOrganizationSequence',
  x00209222: 'DimensionIndexSequence',
  x00209228: 'ConcatenationFrameOffsetNumber',
  x00209238: 'FunctionalGroupPrivateCreator',
  x00209241: 'NominalPercentageOfCardiacPhase',
  x00209245: 'NominalPercentOfRespiratoryPhase',
  x00209246: 'StartingRespiratoryAmplitude',
  x00209247: 'StartingRespiratoryPhase',
  x00209248: 'EndingRespiratoryAmplitude',
  x00209249: 'EndingRespiratoryPhase',
  x00209250: 'RespiratoryTriggerType',
  x00209251: 'RRIntervalTimeNominal',
  x00209252: 'ActualCardiacTriggerDelayTime',
  x00209253: 'RespiratorySynchronizationSequence',
  x00209254: 'RespiratoryIntervalTime',
  x00209255: 'NominalRespiratoryTriggerDelayTime',
  x00209256: 'RespiratoryTriggerDelayThreshold',
  x00209257: 'ActualRespiratoryTriggerDelayTime',
  x00209301: 'ImagePositionVolume',
  x00209302: 'ImageOrientationVolume',
  x00209308: 'ApexPosition',
  x00209421: 'DimensionDescriptionLabel',
  x00209450: 'PatientOrientationInFrameSequence',
  x00209453: 'FrameLabel',
  x00209518: 'AcquisitionIndex',
  x00209529: 'ContributingSOPInstancesRefSeq',
  x00209536: 'ReconstructionIndex',
  // x00211003: 'SeriesFromWhichPrescribed',
  // x00211005: 'GenesisVersionNow',
  // x00211007: 'SeriesRecordChecksum',
  // x00211018: 'GenesisVersionNow',
  // x00211019: 'AcqreconRecordChecksum',
  // x00211020: 'TableStartLocation',
  // x00211035: 'SeriesFromWhichPrescribed',
  // x00211036: 'ImageFromWhichPrescribed',
  // x00211037: 'ScreenFormat',
  // x0021104a: 'AnatomicalReferenceForScout',
  // x0021104f: 'LocationsInAcquisition',
  // x00211050: 'GraphicallyPrescribed',
  // x00211051: 'RotationFromSourceXRot',
  // x00211052: 'RotationFromSourceYRot',
  // x00211053: 'RotationFromSourceZRot',
  // x00211054: 'ImagePosition',
  // x00211055: 'ImageOrientation',
  // x00211056: 'IntegerSlop',
  // x00211057: 'IntegerSlop',
  // x00211058: 'IntegerSlop',
  // x00211059: 'IntegerSlop',
  // x0021105a: 'IntegerSlop',
  // x0021105b: 'FloatSlop',
  // x0021105c: 'FloatSlop',
  // x0021105d: 'FloatSlop',
  // x0021105e: 'FloatSlop',
  // x0021105f: 'FloatSlop',
  // x00211081: 'AutoWindowLevelAlpha',
  // x00211082: 'AutoWindowLevelBeta',
  // x00211083: 'AutoWindowLevelWindow',
  // x00211084: 'ToWindowLevelLevel',
  // x00211090: 'TubeFocalSpotPosition',
  // x00211091: 'BiopsyPosition',
  // x00211092: 'BiopsyTLocation',
  // x00211093: 'BiopsyRefLocation',
  x00220001: 'LightPathFilterPassThroughWavelen',
  x00220002: 'LightPathFilterPassBand',
  x00220003: 'ImagePathFilterPassThroughWavelen',
  x00220004: 'ImagePathFilterPassBand',
  x00220005: 'PatientEyeMovementCommanded',
  x00220006: 'PatientEyeMovementCommandCodeSeq',
  x00220007: 'SphericalLensPower',
  x00220008: 'CylinderLensPower',
  x00220009: 'CylinderAxis',
  x0022000a: 'EmmetropicMagnification',
  x0022000b: 'IntraOcularPressure',
  x0022000c: 'HorizontalFieldOfView',
  x0022000d: 'PupilDilated',
  x0022000e: 'DegreeOfDilation',
  x00220010: 'StereoBaselineAngle',
  x00220011: 'StereoBaselineDisplacement',
  x00220012: 'StereoHorizontalPixelOffset',
  x00220013: 'StereoVerticalPixelOffset',
  x00220014: 'StereoRotation',
  x00220015: 'AcquisitionDeviceTypeCodeSequence',
  x00220016: 'IlluminationTypeCodeSequence',
  x00220017: 'LightPathFilterTypeStackCodeSeq',
  x00220018: 'ImagePathFilterTypeStackCodeSeq',
  x00220019: 'LensesCodeSequence',
  x0022001a: 'ChannelDescriptionCodeSequence',
  x0022001b: 'RefractiveStateSequence',
  x0022001c: 'MydriaticAgentCodeSequence',
  x0022001d: 'RelativeImagePositionCodeSequence',
  x00220020: 'StereoPairsSequence',
  x00220021: 'LeftImageSequence',
  x00220022: 'RightImageSequence',
  x00220030: 'AxialLengthOfTheEye',
  x00220031: 'OphthalmicFrameLocationSequence',
  x00220032: 'ReferenceCoordinates',
  x00220035: 'DepthSpatialResolution',
  x00220036: 'MaximumDepthDistortion',
  x00220037: 'AlongScanSpatialResolution',
  x00220038: 'MaximumAlongScanDistortion',
  x00220039: 'OphthalmicImageOrientation',
  x00220041: 'DepthOfTransverseImage',
  x00220042: 'MydriaticAgentConcUnitsSeq',
  x00220048: 'AcrossScanSpatialResolution',
  x00220049: 'MaximumAcrossScanDistortion',
  x0022004e: 'MydriaticAgentConcentration',
  x00220055: 'IlluminationWaveLength',
  x00220056: 'IlluminationPower',
  x00220057: 'IlluminationBandwidth',
  x00220058: 'MydriaticAgentSequence',
  // x00231001: 'NumberOfSeriesInStudy',
  // x00231002: 'NumberOfUnarchivedSeries',
  // x00231010: 'ReferenceImageField',
  // x00231050: 'SummaryImage',
  // x00231070: 'StartTimeSecsInFirstAxial',
  // x00231074: 'NoofUpdatesToHeader',
  // x0023107d: 'IndicatesIfTheStudyHasCompleteInfo',
  // x00251006: 'LastPulseSequenceUsed',
  // x00251007: 'ImagesInSeries',
  // x00251010: 'LandmarkCounter',
  // x00251011: 'NumberOfAcquisitions',
  // x00251014: 'IndicatesNoofUpdatesToHeader',
  // x00251017: 'SeriesCompleteFlag',
  // x00251018: 'NumberOfImagesArchived',
  // x00251019: 'LastImageNumberUsed',
  // x0025101a: 'PrimaryReceiverSuiteAndHost',
  // x00271006: 'ImageArchiveFlag',
  // x00271010: 'ScoutType',
  // x0027101c: 'VmaMamp',
  // x0027101d: 'VmaPhase',
  // x0027101e: 'VmaMod',
  // x0027101f: 'VmaClip',
  // x00271020: 'SmartScanOnOffFlag',
  // x00271030: 'ForeignImageRevision',
  // x00271031: 'ImagingMode',
  // x00271032: 'PulseSequence',
  // x00271033: 'ImagingOptions',
  // x00271035: 'PlaneType',
  // x00271036: 'ObliquePlane',
  // x00271040: 'RASLetterOfImageLocation',
  // x00271041: 'ImageLocation',
  // x00271042: 'CenterRCoordOfPlaneImage',
  // x00271043: 'CenterACoordOfPlaneImage',
  // x00271044: 'CenterSCoordOfPlaneImage',
  // x00271045: 'NormalRCoord',
  // x00271046: 'NormalACoord',
  // x00271047: 'NormalSCoord',
  // x00271048: 'RCoordOfTopRightCorner',
  // x00271049: 'ACoordOfTopRightCorner',
  // x0027104a: 'SCoordOfTopRightCorner',
  // x0027104b: 'RCoordOfBottomRightCorner',
  // x0027104c: 'ACoordOfBottomRightCorner',
  // x0027104d: 'SCoordOfBottomRightCorner',
  // x00271050: 'TableStartLocation',
  // x00271051: 'TableEndLocation',
  // x00271052: 'RASLetterForSideOfImage',
  // x00271053: 'RASLetterForAnteriorPosterior',
  // x00271054: 'RASLetterForScoutStartLoc',
  // x00271055: 'RASLetterForScoutEndLoc',
  // x00271060: 'ImageDimensionX',
  // x00271061: 'ImageDimensionY',
  // x00271062: 'NumberOfExcitations',
  x00280000: 'ImagePresentationGroupLength',
  x00280002: 'SamplesPerPixel',
  x00280003: 'SamplesPerPixelUsed',
  x00280004: 'PhotometricInterpretation',
  x00280005: 'ImageDimensions',
  x00280006: 'PlanarConfiguration',
  x00280008: 'NumberOfFrames',
  x00280009: 'FrameIncrementPointer',
  x0028000a: 'FrameDimensionPointer',
  x00280010: 'Rows',
  x00280011: 'Columns',
  x00280012: 'Planes',
  x00280014: 'UltrasoundColorDataPresent',
  x00280030: 'PixelSpacing',
  x00280031: 'ZoomFactor',
  x00280032: 'ZoomCenter',
  x00280034: 'PixelAspectRatio',
  x00280040: 'ImageFormat',
  x00280050: 'ManipulatedImage',
  x00280051: 'CorrectedImage',
  x0028005f: 'CompressionRecognitionCode',
  x00280060: 'CompressionCode',
  x00280061: 'CompressionOriginator',
  x00280062: 'CompressionLabel',
  x00280063: 'CompressionDescription',
  x00280065: 'CompressionSequence',
  x00280066: 'CompressionStepPointers',
  x00280068: 'RepeatInterval',
  x00280069: 'BitsGrouped',
  x00280070: 'PerimeterTable',
  x00280071: 'PerimeterValue',
  x00280080: 'PredictorRows',
  x00280081: 'PredictorColumns',
  x00280082: 'PredictorConstants',
  x00280090: 'BlockedPixels',
  x00280091: 'BlockRows',
  x00280092: 'BlockColumns',
  x00280093: 'RowOverlap',
  x00280094: 'ColumnOverlap',
  x00280100: 'BitsAllocated',
  x00280101: 'BitsStored',
  x00280102: 'HighBit',
  x00280103: 'PixelRepresentation',
  x00280104: 'SmallestValidPixelValue',
  x00280105: 'LargestValidPixelValue',
  x00280106: 'SmallestImagePixelValue',
  x00280107: 'LargestImagePixelValue',
  x00280108: 'SmallestPixelValueInSeries',
  x00280109: 'LargestPixelValueInSeries',
  x00280110: 'SmallestImagePixelValueInPlane',
  x00280111: 'LargestImagePixelValueInPlane',
  x00280120: 'PixelPaddingValue',
  x00280121: 'PixelPaddingRangeLimit',
  x00280200: 'ImageLocation',
  x00280300: 'QualityControlImage',
  x00280301: 'BurnedInAnnotation',
  x00280400: 'TransformLabel',
  x00280401: 'TransformVersionNumber',
  x00280402: 'NumberOfTransformSteps',
  x00280403: 'SequenceOfCompressedData',
  x00280404: 'DetailsOfCoefficients',
  x002804x2: 'CoefficientCoding',
  x002804x3: 'CoefficientCodingPointers',
  x00280700: 'DCTLabel',
  x00280701: 'DataBlockDescription',
  x00280702: 'DataBlock',
  x00280710: 'NormalizationFactorFormat',
  x00280720: 'ZonalMapNumberFormat',
  x00280721: 'ZonalMapLocation',
  x00280722: 'ZonalMapFormat',
  x00280730: 'AdaptiveMapFormat',
  x00280740: 'CodeNumberFormat',
  x002808x0: 'CodeLabel',
  x002808x2: 'NumberOfTables',
  x002808x3: 'CodeTableLocation',
  x002808x4: 'BitsForCodeWord',
  x002808x8: 'ImageDataLocation',
  x00280a02: 'PixelSpacingCalibrationType',
  x00280a04: 'PixelSpacingCalibrationDescription',
  x00281040: 'PixelIntensityRelationship',
  x00281041: 'PixelIntensityRelationshipSign',
  x00281050: 'WindowCenter',
  x00281051: 'WindowWidth',
  x00281052: 'RescaleIntercept',
  x00281053: 'RescaleSlope',
  x00281054: 'RescaleType',
  x00281055: 'WindowCenterAndWidthExplanation',
  x00281056: 'VOI_LUTFunction',
  x00281080: 'GrayScale',
  x00281090: 'RecommendedViewingMode',
  x00281100: 'GrayLookupTableDescriptor',
  x00281101: 'RedPaletteColorTableDescriptor',
  x00281102: 'GreenPaletteColorTableDescriptor',
  x00281103: 'BluePaletteColorTableDescriptor',
  x00281111: 'LargeRedPaletteColorTableDescr',
  x00281112: 'LargeGreenPaletteColorTableDescr',
  x00281113: 'LargeBluePaletteColorTableDescr',
  x00281199: 'PaletteColorTableUID',
  x00281200: 'GrayLookupTableData',
  x00281201: 'RedPaletteColorTableData',
  x00281202: 'GreenPaletteColorTableData',
  x00281203: 'BluePaletteColorTableData',
  x00281211: 'LargeRedPaletteColorTableData',
  x00281212: 'LargeGreenPaletteColorTableData',
  x00281213: 'LargeBluePaletteColorTableData',
  x00281214: 'LargePaletteColorLookupTableUID',
  x00281221: 'SegmentedRedColorTableData',
  x00281222: 'SegmentedGreenColorTableData',
  x00281223: 'SegmentedBlueColorTableData',
  x00281300: 'BreastImplantPresent',
  x00281350: 'PartialView',
  x00281351: 'PartialViewDescription',
  x00281352: 'PartialViewCodeSequence',
  x0028135a: 'SpatialLocationsPreserved',
  x00281402: 'DataPathAssignment',
  x00281404: 'BlendingLUT1Sequence',
  x00281406: 'BlendingWeightConstant',
  x00281408: 'BlendingLookupTableData',
  x0028140c: 'BlendingLUT2Sequence',
  x0028140e: 'DataPathID',
  x0028140f: 'RGBLUTTransferFunction',
  x00281410: 'AlphaLUTTransferFunction',
  x00282000: 'ICCProfile',
  x00282110: 'LossyImageCompression',
  x00282112: 'LossyImageCompressionRatio',
  x00282114: 'LossyImageCompressionMethod',
  x00283000: 'ModalityLUTSequence',
  x00283002: 'LUTDescriptor',
  x00283003: 'LUTExplanation',
  x00283004: 'ModalityLUTType',
  x00283006: 'LUTData',
  x00283010: 'VOILUTSequence',
  x00283110: 'SoftcopyVOILUTSequence',
  x00284000: 'ImagePresentationComments',
  x00285000: 'BiPlaneAcquisitionSequence',
  x00286010: 'RepresentativeFrameNumber',
  x00286020: 'FrameNumbersOfInterest',
  x00286022: 'FrameOfInterestDescription',
  x00286023: 'FrameOfInterestType',
  x00286030: 'MaskPointers',
  x00286040: 'RWavePointer',
  x00286100: 'MaskSubtractionSequence',
  x00286101: 'MaskOperation',
  x00286102: 'ApplicableFrameRange',
  x00286110: 'MaskFrameNumbers',
  x00286112: 'ContrastFrameAveraging',
  x00286114: 'MaskSubPixelShift',
  x00286120: 'TIDOffset',
  x00286190: 'MaskOperationExplanation',
  x00287fe0: 'PixelDataProviderURL',
  x00289001: 'DataPointRows',
  x00289002: 'DataPointColumns',
  x00289003: 'SignalDomainColumns',
  x00289099: 'LargestMonochromePixelValue',
  x00289108: 'DataRepresentation',
  x00289110: 'PixelMeasuresSequence',
  x00289132: 'FrameVOILUTSequence',
  x00289145: 'PixelValueTransformationSequence',
  x00289235: 'SignalDomainRows',
  x00289411: 'DisplayFilterPercentage',
  x00289415: 'FramePixelShiftSequence',
  x00289416: 'SubtractionItemID',
  x00289422: 'PixelIntensityRelationshipLUTSeq',
  x00289443: 'FramePixelDataPropertiesSequence',
  x00289444: 'GeometricalProperties',
  x00289445: 'GeometricMaximumDistortion',
  x00289446: 'ImageProcessingApplied',
  x00289454: 'MaskSelectionMode',
  x00289474: 'LUTFunction',
  x00289478: 'MaskVisibilityPercentage',
  x00289501: 'PixelShiftSequence',
  x00289502: 'RegionPixelShiftSequence',
  x00289503: 'VerticesOfTheRegion',
  x00289506: 'PixelShiftFrameRange',
  x00289507: 'LUTFrameRange',
  x00289520: 'ImageToEquipmentMappingMatrix',
  x00289537: 'EquipmentCoordinateSystemID',
  // x00291004: 'LowerRangeOfPixels1a',
  // x00291005: 'LowerRangeOfPixels1b',
  // x00291006: 'LowerRangeOfPixels1c',
  // x00291007: 'LowerRangeOfPixels1d',
  // x00291008: 'LowerRangeOfPixels1e',
  // x00291009: 'LowerRangeOfPixels1f',
  // x0029100a: 'LowerRangeOfPixels1g',
  // x00291015: 'LowerRangeOfPixels1h',
  // x00291016: 'LowerRangeOfPixels1i',
  // x00291017: 'LowerRangeOfPixels2',
  // x00291018: 'UpperRangeOfPixels2',
  // x0029101a: 'LenOfTotHdrInBytes',
  // x00291026: 'VersionOfTheHdrStruct',
  // x00291034: 'AdvantageCompOverflow',
  // x00291035: 'AdvantageCompUnderflow',
  x00320000: 'StudyGroupLength',
  x0032000a: 'StudyStatusID',
  x0032000c: 'StudyPriorityID',
  x00320012: 'StudyIDIssuer',
  x00320032: 'StudyVerifiedDate',
  x00320033: 'StudyVerifiedTime',
  x00320034: 'StudyReadDate',
  x00320035: 'StudyReadTime',
  x00321000: 'ScheduledStudyStartDate',
  x00321001: 'ScheduledStudyStartTime',
  x00321010: 'ScheduledStudyStopDate',
  x00321011: 'ScheduledStudyStopTime',
  x00321020: 'ScheduledStudyLocation',
  x00321021: 'ScheduledStudyLocationAETitle',
  x00321030: 'ReasonForStudy',
  x00321031: 'RequestingPhysicianIDSequence',
  x00321032: 'RequestingPhysician',
  x00321033: 'RequestingService',
  x00321040: 'StudyArrivalDate',
  x00321041: 'StudyArrivalTime',
  x00321050: 'StudyCompletionDate',
  x00321051: 'StudyCompletionTime',
  x00321055: 'StudyComponentStatusID',
  x00321060: 'RequestedProcedureDescription',
  x00321064: 'RequestedProcedureCodeSequence',
  x00321070: 'RequestedContrastAgent',
  x00324000: 'StudyComments',
  x00380004: 'ReferencedPatientAliasSequence',
  x00380008: 'VisitStatusID',
  x00380010: 'AdmissionID',
  x00380011: 'IssuerOfAdmissionID',
  x00380016: 'RouteOfAdmissions',
  x0038001a: 'ScheduledAdmissionDate',
  x0038001b: 'ScheduledAdmissionTime',
  x0038001c: 'ScheduledDischargeDate',
  x0038001d: 'ScheduledDischargeTime',
  x0038001e: 'ScheduledPatientInstitResidence',
  x00380020: 'AdmittingDate',
  x00380021: 'AdmittingTime',
  x00380030: 'DischargeDate',
  x00380032: 'DischargeTime',
  x00380040: 'DischargeDiagnosisDescription',
  x00380044: 'DischargeDiagnosisCodeSequence',
  x00380050: 'SpecialNeeds',
  x00380060: 'ServiceEpisodeID',
  x00380061: 'IssuerOfServiceEpisodeID',
  x00380062: 'ServiceEpisodeDescription',
  x00380100: 'PertinentDocumentsSequence',
  x00380300: 'CurrentPatientLocation',
  x00380400: 'PatientInstitutionResidence',
  x00380500: 'PatientState',
  x00380502: 'PatientClinicalTrialParticipSeq',
  x00384000: 'VisitComments',
  x003a0004: 'WaveformOriginality',
  x003a0005: 'NumberOfWaveformChannels',
  x003a0010: 'NumberOfWaveformSamples',
  x003a001a: 'SamplingFrequency',
  x003a0020: 'MultiplexGroupLabel',
  x003a0200: 'ChannelDefinitionSequence',
  x003a0202: 'WaveformChannelNumber',
  x003a0203: 'ChannelLabel',
  x003a0205: 'ChannelStatus',
  x003a0208: 'ChannelSourceSequence',
  x003a0209: 'ChannelSourceModifiersSequence',
  x003a020a: 'SourceWaveformSequence',
  x003a020c: 'ChannelDerivationDescription',
  x003a0210: 'ChannelSensitivity',
  x003a0211: 'ChannelSensitivityUnitsSequence',
  x003a0212: 'ChannelSensitivityCorrectionFactor',
  x003a0213: 'ChannelBaseline',
  x003a0214: 'ChannelTimeSkew',
  x003a0215: 'ChannelSampleSkew',
  x003a0218: 'ChannelOffset',
  x003a021a: 'WaveformBitsStored',
  x003a0220: 'FilterLowFrequency',
  x003a0221: 'FilterHighFrequency',
  x003a0222: 'NotchFilterFrequency',
  x003a0223: 'NotchFilterBandwidth',
  x003a0230: 'WaveformDataDisplayScale',
  x003a0231: 'WaveformDisplayBkgCIELabValue',
  x003a0240: 'WaveformPresentationGroupSequence',
  x003a0241: 'PresentationGroupNumber',
  x003a0242: 'ChannelDisplaySequence',
  x003a0244: 'ChannelRecommendDisplayCIELabValue',
  x003a0245: 'ChannelPosition',
  x003a0246: 'DisplayShadingFlag',
  x003a0247: 'FractionalChannelDisplayScale',
  x003a0248: 'AbsoluteChannelDisplayScale',
  x003a0300: 'MultiplexAudioChannelsDescrCodeSeq',
  x003a0301: 'ChannelIdentificationCode',
  x003a0302: 'ChannelMode',
  x00400001: 'ScheduledStationAETitle',
  x00400002: 'ScheduledProcedureStepStartDate',
  x00400003: 'ScheduledProcedureStepStartTime',
  x00400004: 'ScheduledProcedureStepEndDate',
  x00400005: 'ScheduledProcedureStepEndTime',
  x00400006: 'ScheduledPerformingPhysiciansName',
  x00400007: 'ScheduledProcedureStepDescription',
  x00400008: 'ScheduledProtocolCodeSequence',
  x00400009: 'ScheduledProcedureStepID',
  x0040000a: 'StageCodeSequence',
  x0040000b: 'ScheduledPerformingPhysicianIDSeq',
  x00400010: 'ScheduledStationName',
  x00400011: 'ScheduledProcedureStepLocation',
  x00400012: 'PreMedication',
  x00400020: 'ScheduledProcedureStepStatus',
  x00400031: 'LocalNamespaceEntityID',
  x00400032: 'UniversalEntityID',
  x00400033: 'UniversalEntityIDType',
  x00400035: 'IdentifierTypeCode',
  x00400036: 'AssigningFacilitySequence',
  x00400100: 'ScheduledProcedureStepSequence',
  x00400220: 'ReferencedNonImageCompositeSOPSeq',
  x00400241: 'PerformedStationAETitle',
  x00400242: 'PerformedStationName',
  x00400243: 'PerformedLocation',
  x00400244: 'PerformedProcedureStepStartDate',
  x00400245: 'PerformedProcedureStepStartTime',
  x00400250: 'PerformedProcedureStepEndDate',
  x00400251: 'PerformedProcedureStepEndTime',
  x00400252: 'PerformedProcedureStepStatus',
  x00400253: 'PerformedProcedureStepID',
  x00400254: 'PerformedProcedureStepDescription',
  x00400255: 'PerformedProcedureTypeDescription',
  x00400260: 'PerformedProtocolCodeSequence',
  x00400261: 'PerformedProtocolType',
  x00400270: 'ScheduledStepAttributesSequence',
  x00400275: 'RequestAttributesSequence',
  x00400280: 'CommentsOnPerformedProcedureStep',
  x00400281: 'ProcStepDiscontinueReasonCodeSeq',
  x00400293: 'QuantitySequence',
  x00400294: 'Quantity',
  x00400295: 'MeasuringUnitsSequence',
  x00400296: 'BillingItemSequence',
  x00400300: 'TotalTimeOfFluoroscopy',
  x00400301: 'TotalNumberOfExposures',
  x00400302: 'EntranceDose',
  x00400303: 'ExposedArea',
  x00400306: 'DistanceSourceToEntrance',
  x00400307: 'DistanceSourceToSupport',
  x0040030e: 'ExposureDoseSequence',
  x00400310: 'CommentsOnRadiationDose',
  x00400312: 'XRayOutput',
  x00400314: 'HalfValueLayer',
  x00400316: 'OrganDose',
  x00400318: 'OrganExposed',
  x00400320: 'BillingProcedureStepSequence',
  x00400321: 'FilmConsumptionSequence',
  x00400324: 'BillingSuppliesAndDevicesSequence',
  x00400330: 'ReferencedProcedureStepSequence',
  x00400340: 'PerformedSeriesSequence',
  x00400400: 'CommentsOnScheduledProcedureStep',
  x00400440: 'ProtocolContextSequence',
  x00400441: 'ContentItemModifierSequence',
  x0040050a: 'SpecimenAccessionNumber',
  x00400512: 'ContainerIdentifier',
  x0040051a: 'ContainerDescription',
  x00400550: 'SpecimenSequence',
  x00400551: 'SpecimenIdentifier',
  x00400552: 'SpecimenDescriptionSequenceTrial',
  x00400553: 'SpecimenDescriptionTrial',
  x00400554: 'SpecimenUID',
  x00400555: 'AcquisitionContextSequence',
  x00400556: 'AcquisitionContextDescription',
  x0040059a: 'SpecimenTypeCodeSequence',
  x00400600: 'SpecimenShortDescription',
  x004006fa: 'SlideIdentifier',
  x0040071a: 'ImageCenterPointCoordinatesSeq',
  x0040072a: 'XOffsetInSlideCoordinateSystem',
  x0040073a: 'YOffsetInSlideCoordinateSystem',
  x0040074a: 'ZOffsetInSlideCoordinateSystem',
  x004008d8: 'PixelSpacingSequence',
  x004008da: 'CoordinateSystemAxisCodeSequence',
  x004008ea: 'MeasurementUnitsCodeSequence',
  x004009f8: 'VitalStainCodeSequenceTrial',
  x00401001: 'RequestedProcedureID',
  x00401002: 'ReasonForRequestedProcedure',
  x00401003: 'RequestedProcedurePriority',
  x00401004: 'PatientTransportArrangements',
  x00401005: 'RequestedProcedureLocation',
  x00401006: 'PlacerOrderNumber-Procedure',
  x00401007: 'FillerOrderNumber-Procedure',
  x00401008: 'ConfidentialityCode',
  x00401009: 'ReportingPriority',
  x0040100a: 'ReasonForRequestedProcedureCodeSeq',
  x00401010: 'NamesOfIntendedRecipientsOfResults',
  x00401011: 'IntendedRecipientsOfResultsIDSeq',
  x00401101: 'PersonIdentificationCodeSequence',
  x00401102: 'PersonAddress',
  x00401103: 'PersonTelephoneNumbers',
  x00401400: 'RequestedProcedureComments',
  x00402001: 'ReasonForImagingServiceRequest',
  x00402004: 'IssueDateOfImagingServiceRequest',
  x00402005: 'IssueTimeOfImagingServiceRequest',
  x00402006: 'PlacerOrderNumberImagingServiceRequestRetired',
  x00402007: 'FillerOrderNumberImagingServiceRequestRetired',
  x00402008: 'OrderEnteredBy',
  x00402009: 'OrderEntererLocation',
  x00402010: 'OrderCallbackPhoneNumber',
  x00402016: 'PlacerOrderNum-ImagingServiceReq',
  x00402017: 'FillerOrderNum-ImagingServiceReq',
  x00402400: 'ImagingServiceRequestComments',
  x00403001: 'ConfidentialityOnPatientDataDescr',
  x00404001: 'GenPurposeScheduledProcStepStatus',
  x00404002: 'GenPurposePerformedProcStepStatus',
  x00404003: 'GenPurposeSchedProcStepPriority',
  x00404004: 'SchedProcessingApplicationsCodeSeq',
  x00404005: 'SchedProcedureStepStartDateAndTime',
  x00404006: 'MultipleCopiesFlag',
  x00404007: 'PerformedProcessingAppsCodeSeq',
  x00404009: 'HumanPerformerCodeSequence',
  x00404010: 'SchedProcStepModificationDateTime',
  x00404011: 'ExpectedCompletionDateAndTime',
  x00404015: 'ResultingGenPurposePerfProcStepSeq',
  x00404016: 'RefGenPurposeSchedProcStepSeq',
  x00404018: 'ScheduledWorkitemCodeSequence',
  x00404019: 'PerformedWorkitemCodeSequence',
  x00404020: 'InputAvailabilityFlag',
  x00404021: 'InputInformationSequence',
  x00404022: 'RelevantInformationSequence',
  x00404023: 'RefGenPurSchedProcStepTransUID',
  x00404025: 'ScheduledStationNameCodeSequence',
  x00404026: 'ScheduledStationClassCodeSequence',
  x00404027: 'SchedStationGeographicLocCodeSeq',
  x00404028: 'PerformedStationNameCodeSequence',
  x00404029: 'PerformedStationClassCodeSequence',
  x00404030: 'PerformedStationGeogLocCodeSeq',
  x00404031: 'RequestedSubsequentWorkItemCodeSeq',
  x00404032: 'NonDICOMOutputCodeSequence',
  x00404033: 'OutputInformationSequence',
  x00404034: 'ScheduledHumanPerformersSequence',
  x00404035: 'ActualHumanPerformersSequence',
  x00404036: 'HumanPerformersOrganization',
  x00404037: 'HumanPerformerName',
  x00404040: 'RawDataHandling',
  x00408302: 'EntranceDoseInMilliGy',
  x00409094: 'RefImageRealWorldValueMappingSeq',
  x00409096: 'RealWorldValueMappingSequence',
  x00409098: 'PixelValueMappingCodeSequence',
  x00409210: 'LUTLabel',
  x00409211: 'RealWorldValueLastValueMapped',
  x00409212: 'RealWorldValueLUTData',
  x00409216: 'RealWorldValueFirstValueMapped',
  x00409224: 'RealWorldValueIntercept',
  x00409225: 'RealWorldValueSlope',
  x0040a010: 'RelationshipType',
  x0040a027: 'VerifyingOrganization',
  x0040a030: 'VerificationDateTime',
  x0040a032: 'ObservationDateTime',
  x0040a040: 'ValueType',
  x0040a043: 'ConceptNameCodeSequence',
  x0040a050: 'ContinuityOfContent',
  x0040a073: 'VerifyingObserverSequence',
  x0040a075: 'VerifyingObserverName',
  x0040a078: 'AuthorObserverSequence',
  x0040a07a: 'ParticipantSequence',
  x0040a07c: 'CustodialOrganizationSequence',
  x0040a080: 'ParticipationType',
  x0040a082: 'ParticipationDateTime',
  x0040a084: 'ObserverType',
  x0040a088: 'VerifyingObserverIdentCodeSequence',
  x0040a090: 'EquivalentCDADocumentSequence',
  x0040a0b0: 'ReferencedWaveformChannels',
  x0040a120: 'DateTime',
  x0040a121: 'Date',
  x0040a122: 'Time',
  x0040a123: 'PersonName',
  x0040a124: 'UID',
  x0040a130: 'TemporalRangeType',
  x0040a132: 'ReferencedSamplePositions',
  x0040a136: 'ReferencedFrameNumbers',
  x0040a138: 'ReferencedTimeOffsets',
  x0040a13a: 'ReferencedDateTime',
  x0040a160: 'TextValue',
  x0040a168: 'ConceptCodeSequence',
  x0040a170: 'PurposeOfReferenceCodeSequence',
  x0040a180: 'AnnotationGroupNumber',
  x0040a195: 'ModifierCodeSequence',
  x0040a300: 'MeasuredValueSequence',
  x0040a301: 'NumericValueQualifierCodeSequence',
  x0040a30a: 'NumericValue',
  x0040a353: 'AddressTrial',
  x0040a354: 'TelephoneNumberTrial',
  x0040a360: 'PredecessorDocumentsSequence',
  x0040a370: 'ReferencedRequestSequence',
  x0040a372: 'PerformedProcedureCodeSequence',
  x0040a375: 'CurrentRequestedProcEvidenceSeq',
  x0040a385: 'PertinentOtherEvidenceSequence',
  x0040a390: 'HL7StructuredDocumentRefSeq',
  x0040a491: 'CompletionFlag',
  x0040a492: 'CompletionFlagDescription',
  x0040a493: 'VerificationFlag',
  x0040a494: 'ArchiveRequested',
  x0040a496: 'PreliminaryFlag',
  x0040a504: 'ContentTemplateSequence',
  x0040a525: 'IdenticalDocumentsSequence',
  x0040a730: 'ContentSequence',
  x0040b020: 'AnnotationSequence',
  x0040db00: 'TemplateIdentifier',
  x0040db06: 'TemplateVersion',
  x0040db07: 'TemplateLocalVersion',
  x0040db0b: 'TemplateExtensionFlag',
  x0040db0c: 'TemplateExtensionOrganizationUID',
  x0040db0d: 'TemplateExtensionCreatorUID',
  x0040db73: 'ReferencedContentItemIdentifier',
  x0040e001: 'HL7InstanceIdentifier',
  x0040e004: 'HL7DocumentEffectiveTime',
  x0040e006: 'HL7DocumentTypeCodeSequence',
  x0040e010: 'RetrieveURI',
  x0040e011: 'RetrieveLocationUID',
  x00420010: 'DocumentTitle',
  x00420011: 'EncapsulatedDocument',
  x00420012: 'MIMETypeOfEncapsulatedDocument',
  x00420013: 'SourceInstanceSequence',
  x00420014: 'ListOfMIMETypes',
  // x00431001: 'BitmapOfPrescanOptions',
  // x00431002: 'GradientOffsetInX',
  // x00431003: 'GradientOffsetInY',
  // x00431004: 'GradientOffsetInZ',
  // x00431005: 'ImgIsOriginalOrUnoriginal',
  // x00431006: 'NumberOfEPIShots',
  // x00431007: 'ViewsPerSegment',
  // x00431008: 'RespiratoryRateBpm',
  // x00431009: 'RespiratoryTriggerPoint',
  // x0043100a: 'TypeOfReceiverUsed',
  // x0043100b: 'PeakRateOfChangeOfGradientField',
  // x0043100c: 'LimitsInUnitsOfPercent',
  // x0043100d: 'PSDEstimatedLimit',
  // x0043100e: 'PSDEstimatedLimitInTeslaPerSecond',
  // x0043100f: 'Saravghead',
  // x00431010: 'WindowValue',
  // x00431011: 'TotalInputViews',
  // x00431012: 'X-RayChain',
  // x00431013: 'DeconKernelParameters',
  // x00431014: 'CalibrationParameters',
  // x00431015: 'TotalOutputViews',
  // x00431016: 'NumberOfOverranges',
  // x00431017: 'IBHImageScaleFactors',
  // x00431018: 'BBHCoefficients',
  // x00431019: 'NumberOfBBHChainsToBlend',
  // x0043101a: 'StartingChannelNumber',
  // x0043101b: 'PpscanParameters',
  // x0043101c: 'GEImageIntegrity',
  // x0043101d: 'LevelValue',
  // x0043101e: 'DeltaStartTime',
  // x0043101f: 'MaxOverrangesInAView',
  // x00431020: 'AvgOverrangesAllViews',
  // x00431021: 'CorrectedAfterGlowTerms',
  // x00431025: 'ReferenceChannels',
  // x00431026: 'NoViewsRefChansBlocked',
  // x00431027: 'ScanPitchRatio',
  // x00431028: 'UniqueImageIden',
  // x00431029: 'HistogramTables',
  // x0043102a: 'UserDefinedData',
  // x0043102b: 'PrivateScanOptions',
  // x0043102c: 'EffectiveEchoSpacing',
  // x0043102d: 'StringSlopField1',
  // x0043102e: 'StringSlopField2',
  // x0043102f: 'RawDataType',
  // x00431030: 'RawDataType',
  // x00431031: 'RACordOfTargetReconCenter',
  // x00431032: 'RawDataType',
  // x00431033: 'NegScanspacing',
  // x00431034: 'OffsetFrequency',
  // x00431035: 'UserUsageTag',
  // x00431036: 'UserFillMapMSW',
  // x00431037: 'UserFillMapLSW',
  // x00431038: 'User25-48',
  // x00431039: 'SlopInt6-9',
  // x00431040: 'TriggerOnPosition',
  // x00431041: 'DegreeOfRotation',
  // x00431042: 'DASTriggerSource',
  // x00431043: 'DASFpaGain',
  // x00431044: 'DASOutputSource',
  // x00431045: 'DASAdInput',
  // x00431046: 'DASCalMode',
  // x00431047: 'DASCalFrequency',
  // x00431048: 'DASRegXm',
  // x00431049: 'DASAutoZero',
  // x0043104a: 'StartingChannelOfView',
  // x0043104b: 'DASXmPattern',
  // x0043104c: 'TGGCTriggerMode',
  // x0043104d: 'StartScanToXrayOnDelay',
  // x0043104e: 'DurationOfXrayOn',
  // x00431060: 'SlopInt10-17',
  // x00431061: 'ScannerStudyEntityUID',
  // x00431062: 'ScannerStudyID',
  // x0043106f: 'ScannerTableEntry',
  x00440001: 'ProductPackageIdentifier',
  x00440002: 'SubstanceAdministrationApproval',
  x00440003: 'ApprovalStatusFurtherDescription',
  x00440004: 'ApprovalStatusDateTime',
  x00440007: 'ProductTypeCodeSequence',
  x00440008: 'ProductName',
  x00440009: 'ProductDescription',
  x0044000a: 'ProductLotIdentifier',
  x0044000b: 'ProductExpirationDateTime',
  x00440010: 'SubstanceAdministrationDateTime',
  x00440011: 'SubstanceAdministrationNotes',
  x00440012: 'SubstanceAdministrationDeviceID',
  x00440013: 'ProductParameterSequence',
  x00440019: 'SubstanceAdminParameterSeq',
  // x00451001: 'NumberOfMacroRowsInDetector',
  // x00451002: 'MacroWidthAtISOCenter',
  // x00451003: 'DASType',
  // x00451004: 'DASGain',
  // x00451005: 'DASTemperature',
  // x00451006: 'TableDirectionInOrOut',
  // x00451007: 'ZSmoothingFactor',
  // x00451008: 'ViewWeightingMode',
  // x00451009: 'SigmaRowNumberWhichRowsWereUsed',
  // x0045100a: 'MinimumDasValueFoundInTheScanData',
  // x0045100b: 'MaximumOffsetShiftValueUsed',
  // x0045100c: 'NumberOfViewsShifted',
  // x0045100d: 'ZTrackingFlag',
  // x0045100e: 'MeanZError',
  // x0045100f: 'ZTrackingMaximumError',
  // x00451010: 'StartingViewForRow2a',
  // x00451011: 'NumberOfViewsInRow2a',
  // x00451012: 'StartingViewForRow1a',
  // x00451013: 'SigmaMode',
  // x00451014: 'NumberOfViewsInRow1a',
  // x00451015: 'StartingViewForRow2b',
  // x00451016: 'NumberOfViewsInRow2b',
  // x00451017: 'StartingViewForRow1b',
  // x00451018: 'NumberOfViewsInRow1b',
  // x00451019: 'AirFilterCalibrationDate',
  // x0045101a: 'AirFilterCalibrationTime',
  // x0045101b: 'PhantomCalibrationDate',
  // x0045101c: 'PhantomCalibrationTime',
  // x0045101d: 'ZSlopeCalibrationDate',
  // x0045101e: 'ZSlopeCalibrationTime',
  // x0045101f: 'CrosstalkCalibrationDate',
  // x00451020: 'CrosstalkCalibrationTime',
  // x00451021: 'IterboneOptionFlag',
  // x00451022: 'PeristalticFlagOption',
  x00460012: 'LensDescription',
  x00460014: 'RightLensSequence',
  x00460015: 'LeftLensSequence',
  x00460018: 'CylinderSequence',
  x00460028: 'PrismSequence',
  x00460030: 'HorizontalPrismPower',
  x00460032: 'HorizontalPrismBase',
  x00460034: 'VerticalPrismPower',
  x00460036: 'VerticalPrismBase',
  x00460038: 'LensSegmentType',
  x00460040: 'OpticalTransmittance',
  x00460042: 'ChannelWidth',
  x00460044: 'PupilSize',
  x00460046: 'CornealSize',
  x00460060: 'DistancePupillaryDistance',
  x00460062: 'NearPupillaryDistance',
  x00460064: 'OtherPupillaryDistance',
  x00460075: 'RadiusOfCurvature',
  x00460076: 'KeratometricPower',
  x00460077: 'KeratometricAxis',
  x00460092: 'BackgroundColor',
  x00460094: 'Optotype',
  x00460095: 'OptotypePresentation',
  x00460100: 'AddNearSequence',
  x00460101: 'AddIntermediateSequence',
  x00460102: 'AddOtherSequence',
  x00460104: 'AddPower',
  x00460106: 'ViewingDistance',
  x00460125: 'ViewingDistanceType',
  x00460135: 'VisualAcuityModifiers',
  x00460137: 'DecimalVisualAcuity',
  x00460139: 'OptotypeDetailedDefinition',
  x00460146: 'SpherePower',
  x00460147: 'CylinderPower',
  x00500004: 'CalibrationImage',
  x00500010: 'DeviceSequence',
  x00500014: 'DeviceLength',
  x00500015: 'ContainerComponentWidth',
  x00500016: 'DeviceDiameter',
  x00500017: 'DeviceDiameterUnits',
  x00500018: 'DeviceVolume',
  x00500019: 'InterMarkerDistance',
  x0050001b: 'ContainerComponentID',
  x00500020: 'DeviceDescription',
  x00540010: 'EnergyWindowVector',
  x00540011: 'NumberOfEnergyWindows',
  x00540012: 'EnergyWindowInformationSequence',
  x00540013: 'EnergyWindowRangeSequence',
  x00540014: 'EnergyWindowLowerLimit',
  x00540015: 'EnergyWindowUpperLimit',
  x00540016: 'RadiopharmaceuticalInformationSeq',
  x00540017: 'ResidualSyringeCounts',
  x00540018: 'EnergyWindowName',
  x00540020: 'DetectorVector',
  x00540021: 'NumberOfDetectors',
  x00540022: 'DetectorInformationSequence',
  x00540030: 'PhaseVector',
  x00540031: 'NumberOfPhases',
  x00540032: 'PhaseInformationSequence',
  x00540033: 'NumberOfFramesInPhase',
  x00540036: 'PhaseDelay',
  x00540038: 'PauseBetweenFrames',
  x00540039: 'PhaseDescription',
  x00540050: 'RotationVector',
  x00540051: 'NumberOfRotations',
  x00540052: 'RotationInformationSequence',
  x00540053: 'NumberOfFramesInRotation',
  x00540060: 'RRIntervalVector',
  x00540061: 'NumberOfRRIntervals',
  x00540062: 'GatedInformationSequence',
  x00540063: 'DataInformationSequence',
  x00540070: 'TimeSlotVector',
  x00540071: 'NumberOfTimeSlots',
  x00540072: 'TimeSlotInformationSequence',
  x00540073: 'TimeSlotTime',
  x00540080: 'SliceVector',
  x00540081: 'NumberOfSlices',
  x00540090: 'AngularViewVector',
  x00540100: 'TimeSliceVector',
  x00540101: 'NumberOfTimeSlices',
  x00540200: 'StartAngle',
  x00540202: 'TypeOfDetectorMotion',
  x00540210: 'TriggerVector',
  x00540211: 'NumberOfTriggersInPhase',
  x00540220: 'ViewCodeSequence',
  x00540222: 'ViewModifierCodeSequence',
  x00540300: 'RadionuclideCodeSequence',
  x00540302: 'AdministrationRouteCodeSequence',
  x00540304: 'RadiopharmaceuticalCodeSequence',
  x00540306: 'CalibrationDataSequence',
  x00540308: 'EnergyWindowNumber',
  x00540400: 'ImageID',
  x00540410: 'PatientOrientationCodeSequence',
  x00540412: 'PatientOrientationModifierCodeSeq',
  x00540414: 'PatientGantryRelationshipCodeSeq',
  x00540500: 'SliceProgressionDirection',
  x00541000: 'SeriesType',
  x00541001: 'Units',
  x00541002: 'CountsSource',
  x00541004: 'ReprojectionMethod',
  x00541100: 'RandomsCorrectionMethod',
  x00541101: 'AttenuationCorrectionMethod',
  x00541102: 'DecayCorrection',
  x00541103: 'ReconstructionMethod',
  x00541104: 'DetectorLinesOfResponseUsed',
  x00541105: 'ScatterCorrectionMethod',
  x00541200: 'AxialAcceptance',
  x00541201: 'AxialMash',
  x00541202: 'TransverseMash',
  x00541203: 'DetectorElementSize',
  x00541210: 'CoincidenceWindowWidth',
  x00541220: 'SecondaryCountsType',
  x00541300: 'FrameReferenceTime',
  x00541310: 'PrimaryCountsAccumulated',
  x00541311: 'SecondaryCountsAccumulated',
  x00541320: 'SliceSensitivityFactor',
  x00541321: 'DecayFactor',
  x00541322: 'DoseCalibrationFactor',
  x00541323: 'ScatterFractionFactor',
  x00541324: 'DeadTimeFactor',
  x00541330: 'ImageIndex',
  x00541400: 'CountsIncluded',
  x00541401: 'DeadTimeCorrectionFlag',
  x00603000: 'HistogramSequence',
  x00603002: 'HistogramNumberOfBins',
  x00603004: 'HistogramFirstBinValue',
  x00603006: 'HistogramLastBinValue',
  x00603008: 'HistogramBinWidth',
  x00603010: 'HistogramExplanation',
  x00603020: 'HistogramData',
  x00620001: 'SegmentationType',
  x00620002: 'SegmentSequence',
  x00620003: 'SegmentedPropertyCategoryCodeSeq',
  x00620004: 'SegmentNumber',
  x00620005: 'SegmentLabel',
  x00620006: 'SegmentDescription',
  x00620008: 'SegmentAlgorithmType',
  x00620009: 'SegmentAlgorithmName',
  x0062000a: 'SegmentIdentificationSequence',
  x0062000b: 'ReferencedSegmentNumber',
  x0062000c: 'RecommendedDisplayGrayscaleValue',
  x0062000d: 'RecommendedDisplayCIELabValue',
  x0062000e: 'MaximumFractionalValue',
  x0062000f: 'SegmentedPropertyTypeCodeSequence',
  x00620010: 'SegmentationFractionalType',
  x00640002: 'DeformableRegistrationSequence',
  x00640003: 'SourceFrameOfReferenceUID',
  x00640005: 'DeformableRegistrationGridSequence',
  x00640007: 'GridDimensions',
  x00640008: 'GridResolution',
  x00640009: 'VectorGridData',
  x0064000f: 'PreDeformationMatrixRegistSeq',
  x00640010: 'PostDeformationMatrixRegistSeq',
  x00660001: 'NumberOfSurfaces',
  x00660002: 'SurfaceSequence',
  x00660003: 'SurfaceNumber',
  x00660004: 'SurfaceComments',
  x00660009: 'SurfaceProcessing',
  x0066000a: 'SurfaceProcessingRatio',
  x0066000e: 'FiniteVolume',
  x00660010: 'Manifold',
  x00660011: 'SurfacePointsSequence',
  x00660015: 'NumberOfSurfacePoints',
  x00660016: 'PointCoordinatesData',
  x00660017: 'PointPositionAccuracy',
  x00660018: 'MeanPointDistance',
  x00660019: 'MaximumPointDistance',
  x0066001b: 'AxisOfRotation',
  x0066001c: 'CenterOfRotation',
  x0066001e: 'NumberOfVectors',
  x0066001f: 'VectorDimensionality',
  x00660020: 'VectorAccuracy',
  x00660021: 'VectorCoordinateData',
  x00660023: 'TrianglePointIndexList',
  x00660024: 'EdgePointIndexList',
  x00660025: 'VertexPointIndexList',
  x00660026: 'TriangleStripSequence',
  x00660027: 'TriangleFanSequence',
  x00660028: 'LineSequence',
  x00660029: 'PrimitivePointIndexList',
  x0066002a: 'SurfaceCount',
  x0066002f: 'AlgorithmFamilyCodeSequ',
  x00660031: 'AlgorithmVersion',
  x00660032: 'AlgorithmParameters',
  x00660034: 'FacetSequence',
  x00660036: 'AlgorithmName',
  x00700001: 'GraphicAnnotationSequence',
  x00700002: 'GraphicLayer',
  x00700003: 'BoundingBoxAnnotationUnits',
  x00700004: 'AnchorPointAnnotationUnits',
  x00700005: 'GraphicAnnotationUnits',
  x00700006: 'UnformattedTextValue',
  x00700008: 'TextObjectSequence',
  x00700009: 'GraphicObjectSequence',
  x00700010: 'BoundingBoxTopLeftHandCorner',
  x00700011: 'BoundingBoxBottomRightHandCorner',
  x00700012: 'BoundingBoxTextHorizJustification',
  x00700014: 'AnchorPoint',
  x00700015: 'AnchorPointVisibility',
  x00700020: 'GraphicDimensions',
  x00700021: 'NumberOfGraphicPoints',
  x00700022: 'GraphicData',
  x00700023: 'GraphicType',
  x00700024: 'GraphicFilled',
  x00700040: 'ImageRotationRetired',
  x00700041: 'ImageHorizontalFlip',
  x00700042: 'ImageRotation',
  x00700050: 'DisplayedAreaTopLeftTrial',
  x00700051: 'DisplayedAreaBottomRightTrial',
  x00700052: 'DisplayedAreaTopLeft',
  x00700053: 'DisplayedAreaBottomRight',
  x0070005a: 'DisplayedAreaSelectionSequence',
  x00700060: 'GraphicLayerSequence',
  x00700062: 'GraphicLayerOrder',
  x00700066: 'GraphicLayerRecDisplayGraysclValue',
  x00700067: 'GraphicLayerRecDisplayRGBValue',
  x00700068: 'GraphicLayerDescription',
  x00700080: 'ContentLabel',
  x00700081: 'ContentDescription',
  x00700082: 'PresentationCreationDate',
  x00700083: 'PresentationCreationTime',
  x00700084: 'ContentCreatorName',
  x00700086: 'ContentCreatorIDCodeSequence',
  x00700100: 'PresentationSizeMode',
  x00700101: 'PresentationPixelSpacing',
  x00700102: 'PresentationPixelAspectRatio',
  x00700103: 'PresentationPixelMagRatio',
  x00700306: 'ShapeType',
  x00700308: 'RegistrationSequence',
  x00700309: 'MatrixRegistrationSequence',
  x0070030a: 'MatrixSequence',
  x0070030c: 'FrameOfRefTransformationMatrixType',
  x0070030d: 'RegistrationTypeCodeSequence',
  x0070030f: 'FiducialDescription',
  x00700310: 'FiducialIdentifier',
  x00700311: 'FiducialIdentifierCodeSequence',
  x00700312: 'ContourUncertaintyRadius',
  x00700314: 'UsedFiducialsSequence',
  x00700318: 'GraphicCoordinatesDataSequence',
  x0070031a: 'FiducialUID',
  x0070031c: 'FiducialSetSequence',
  x0070031e: 'FiducialSequence',
  x00700401: 'GraphicLayerRecomDisplayCIELabVal',
  x00700402: 'BlendingSequence',
  x00700403: 'RelativeOpacity',
  x00700404: 'ReferencedSpatialRegistrationSeq',
  x00700405: 'BlendingPosition',
  x00720002: 'HangingProtocolName',
  x00720004: 'HangingProtocolDescription',
  x00720006: 'HangingProtocolLevel',
  x00720008: 'HangingProtocolCreator',
  x0072000a: 'HangingProtocolCreationDateTime',
  x0072000c: 'HangingProtocolDefinitionSequence',
  x0072000e: 'HangingProtocolUserIDCodeSequence',
  x00720010: 'HangingProtocolUserGroupName',
  x00720012: 'SourceHangingProtocolSequence',
  x00720014: 'NumberOfPriorsReferenced',
  x00720020: 'ImageSetsSequence',
  x00720022: 'ImageSetSelectorSequence',
  x00720024: 'ImageSetSelectorUsageFlag',
  x00720026: 'SelectorAttribute',
  x00720028: 'SelectorValueNumber',
  x00720030: 'TimeBasedImageSetsSequence',
  x00720032: 'ImageSetNumber',
  x00720034: 'ImageSetSelectorCategory',
  x00720038: 'RelativeTime',
  x0072003a: 'RelativeTimeUnits',
  x0072003c: 'AbstractPriorValue',
  x0072003e: 'AbstractPriorCodeSequence',
  x00720040: 'ImageSetLabel',
  x00720050: 'SelectorAttributeVR',
  x00720052: 'SelectorSequencePointer',
  x00720054: 'SelectorSeqPointerPrivateCreator',
  x00720056: 'SelectorAttributePrivateCreator',
  x00720060: 'SelectorATValue',
  x00720062: 'SelectorCSValue',
  x00720064: 'SelectorISValue',
  x00720066: 'SelectorLOValue',
  x00720068: 'SelectorLTValue',
  x0072006a: 'SelectorPNValue',
  x0072006c: 'SelectorSHValue',
  x0072006e: 'SelectorSTValue',
  x00720070: 'SelectorUTValue',
  x00720072: 'SelectorDSValue',
  x00720074: 'SelectorFDValue',
  x00720076: 'SelectorFLValue',
  x00720078: 'SelectorULValue',
  x0072007a: 'SelectorUSValue',
  x0072007c: 'SelectorSLValue',
  x0072007e: 'SelectorSSValue',
  x00720080: 'SelectorCodeSequenceValue',
  x00720100: 'NumberOfScreens',
  x00720102: 'NominalScreenDefinitionSequence',
  x00720104: 'NumberOfVerticalPixels',
  x00720106: 'NumberOfHorizontalPixels',
  x00720108: 'DisplayEnvironmentSpatialPosition',
  x0072010a: 'ScreenMinimumGrayscaleBitDepth',
  x0072010c: 'ScreenMinimumColorBitDepth',
  x0072010e: 'ApplicationMaximumRepaintTime',
  x00720200: 'DisplaySetsSequence',
  x00720202: 'DisplaySetNumber',
  x00720203: 'DisplaySetLabel',
  x00720204: 'DisplaySetPresentationGroup',
  x00720206: 'DisplaySetPresentationGroupDescr',
  x00720208: 'PartialDataDisplayHandling',
  x00720210: 'SynchronizedScrollingSequence',
  x00720212: 'DisplaySetScrollingGroup',
  x00720214: 'NavigationIndicatorSequence',
  x00720216: 'NavigationDisplaySet',
  x00720218: 'ReferenceDisplaySets',
  x00720300: 'ImageBoxesSequence',
  x00720302: 'ImageBoxNumber',
  x00720304: 'ImageBoxLayoutType',
  x00720306: 'ImageBoxTileHorizontalDimension',
  x00720308: 'ImageBoxTileVerticalDimension',
  x00720310: 'ImageBoxScrollDirection',
  x00720312: 'ImageBoxSmallScrollType',
  x00720314: 'ImageBoxSmallScrollAmount',
  x00720316: 'ImageBoxLargeScrollType',
  x00720318: 'ImageBoxLargeScrollAmount',
  x00720320: 'ImageBoxOverlapPriority',
  x00720330: 'CineRelativeToRealTime',
  x00720400: 'FilterOperationsSequence',
  x00720402: 'FilterByCategory',
  x00720404: 'FilterByAttributePresence',
  x00720406: 'FilterByOperator',
  x00720432: 'SynchronizedImageBoxList',
  x00720434: 'TypeOfSynchronization',
  x00720500: 'BlendingOperationType',
  x00720510: 'ReformattingOperationType',
  x00720512: 'ReformattingThickness',
  x00720514: 'ReformattingInterval',
  x00720516: 'ReformattingOpInitialViewDir',
  x00720520: 'RenderingType3D',
  x00720600: 'SortingOperationsSequence',
  x00720602: 'SortByCategory',
  x00720604: 'SortingDirection',
  x00720700: 'DisplaySetPatientOrientation',
  x00720702: 'VOIType',
  x00720704: 'PseudoColorType',
  x00720706: 'ShowGrayscaleInverted',
  x00720710: 'ShowImageTrueSizeFlag',
  x00720712: 'ShowGraphicAnnotationFlag',
  x00720714: 'ShowPatientDemographicsFlag',
  x00720716: 'ShowAcquisitionTechniquesFlag',
  x00720717: 'DisplaySetHorizontalJustification',
  x00720718: 'DisplaySetVerticalJustification',
  x00741000: 'UnifiedProcedureStepState',
  x00741002: 'UPSProgressInformationSequence',
  x00741004: 'UnifiedProcedureStepProgress',
  x00741006: 'UnifiedProcedureStepProgressDescr',
  x00741008: 'UnifiedProcedureStepComURISeq',
  x0074100a: 'ContactURI',
  x0074100c: 'ContactDisplayName',
  x00741020: 'BeamTaskSequence',
  x00741022: 'BeamTaskType',
  x00741024: 'BeamOrderIndex',
  x00741030: 'DeliveryVerificationImageSequence',
  x00741032: 'VerificationImageTiming',
  x00741034: 'DoubleExposureFlag',
  x00741036: 'DoubleExposureOrdering',
  x00741038: 'DoubleExposureMeterset',
  x0074103a: 'DoubleExposureFieldDelta',
  x00741040: 'RelatedReferenceRTImageSequence',
  x00741042: 'GeneralMachineVerificationSequence',
  x00741044: 'ConventionalMachineVerificationSeq',
  x00741046: 'IonMachineVerificationSequence',
  x00741048: 'FailedAttributesSequence',
  x0074104a: 'OverriddenAttributesSequence',
  x0074104c: 'ConventionalControlPointVerifySeq',
  x0074104e: 'IonControlPointVerificationSeq',
  x00741050: 'AttributeOccurrenceSequence',
  x00741052: 'AttributeOccurrencePointer',
  x00741054: 'AttributeItemSelector',
  x00741056: 'AttributeOccurrencePrivateCreator',
  x00741200: 'ScheduledProcedureStepPriority',
  x00741202: 'StudyListLabel',
  x00741204: 'ProcedureStepLabel',
  x00741210: 'ScheduledProcessingParametersSeq',
  x00741212: 'PerformedProcessingParametersSeq',
  x00741216: 'UPSPerformedProcedureSequence',
  x00741220: 'RelatedProcedureStepSequence',
  x00741222: 'ProcedureStepRelationshipType',
  x00741230: 'DeletionLock',
  x00741234: 'ReceivingAE',
  x00741236: 'RequestingAE',
  x00741238: 'ReasonForCancellation',
  x00741242: 'SCPStatus',
  x00741244: 'SubscriptionListStatus',
  x00741246: 'UPSListStatus',
  x00880130: 'StorageMediaFileSetID',
  x00880140: 'StorageMediaFileSetUID',
  x00880200: 'IconImageSequence',
  x00880904: 'TopicTitle',
  x00880906: 'TopicSubject',
  x00880910: 'TopicAuthor',
  x00880912: 'TopicKeywords',
  x01000410: 'SOPInstanceStatus',
  x01000420: 'SOPAuthorizationDateAndTime',
  x01000424: 'SOPAuthorizationComment',
  x01000426: 'AuthorizationEquipmentCertNumber',
  x04000005: 'MACIDNumber',
  x04000010: 'MACCalculationTransferSyntaxUID',
  x04000015: 'MACAlgorithm',
  x04000020: 'DataElementsSigned',
  x04000100: 'DigitalSignatureUID',
  x04000105: 'DigitalSignatureDateTime',
  x04000110: 'CertificateType',
  x04000115: 'CertificateOfSigner',
  x04000120: 'Signature',
  x04000305: 'CertifiedTimestampType',
  x04000310: 'CertifiedTimestamp',
  x04000401: 'DigitalSignaturePurposeCodeSeq',
  x04000402: 'ReferencedDigitalSignatureSeq',
  x04000403: 'ReferencedSOPInstanceMACSeq',
  x04000404: 'MAC',
  x04000500: 'EncryptedAttributesSequence',
  x04000510: 'EncryptedContentTransferSyntaxUID',
  x04000520: 'EncryptedContent',
  x04000550: 'ModifiedAttributesSequence',
  x04000561: 'OriginalAttributesSequence',
  x04000562: 'AttributeModificationDateTime',
  x04000563: 'ModifyingSystem',
  x04000564: 'SourceOfPreviousValues',
  x04000565: 'ReasonForTheAttributeModification',
  x1000xxx0: 'EscapeTriplet',
  x1000xxx1: 'RunLengthTriplet',
  x1000xxx2: 'HuffmanTableSize',
  x1000xxx3: 'HuffmanTableTriplet',
  x1000xxx4: 'ShiftTableSize',
  x1000xxx5: 'ShiftTableTriplet',
  x1010xxxx: 'ZonalMap',
  x20000010: 'NumberOfCopies',
  x2000001e: 'PrinterConfigurationSequence',
  x20000020: 'PrintPriority',
  x20000030: 'MediumType',
  x20000040: 'FilmDestination',
  x20000050: 'FilmSessionLabel',
  x20000060: 'MemoryAllocation',
  x20000061: 'MaximumMemoryAllocation',
  x20000062: 'ColorImagePrintingFlag',
  x20000063: 'CollationFlag',
  x20000065: 'AnnotationFlag',
  x20000067: 'ImageOverlayFlag',
  x20000069: 'PresentationLUTFlag',
  x2000006a: 'ImageBoxPresentationLUTFlag',
  x200000a0: 'MemoryBitDepth',
  x200000a1: 'PrintingBitDepth',
  x200000a2: 'MediaInstalledSequence',
  x200000a4: 'OtherMediaAvailableSequence',
  x200000a8: 'SupportedImageDisplayFormatSeq',
  x20000500: 'ReferencedFilmBoxSequence',
  x20000510: 'ReferencedStoredPrintSequence',
  x20100010: 'ImageDisplayFormat',
  x20100030: 'AnnotationDisplayFormatID',
  x20100040: 'FilmOrientation',
  x20100050: 'FilmSizeID',
  x20100052: 'PrinterResolutionID',
  x20100054: 'DefaultPrinterResolutionID',
  x20100060: 'MagnificationType',
  x20100080: 'SmoothingType',
  x201000a6: 'DefaultMagnificationType',
  x201000a7: 'OtherMagnificationTypesAvailable',
  x201000a8: 'DefaultSmoothingType',
  x201000a9: 'OtherSmoothingTypesAvailable',
  x20100100: 'BorderDensity',
  x20100110: 'EmptyImageDensity',
  x20100120: 'MinDensity',
  x20100130: 'MaxDensity',
  x20100140: 'Trim',
  x20100150: 'ConfigurationInformation',
  x20100152: 'ConfigurationInformationDescr',
  x20100154: 'MaximumCollatedFilms',
  x2010015e: 'Illumination',
  x20100160: 'ReflectedAmbientLight',
  x20100376: 'PrinterPixelSpacing',
  x20100500: 'ReferencedFilmSessionSequence',
  x20100510: 'ReferencedImageBoxSequence',
  x20100520: 'ReferencedBasicAnnotationBoxSeq',
  x20200010: 'ImageBoxPosition',
  x20200020: 'Polarity',
  x20200030: 'RequestedImageSize',
  x20200040: 'RequestedDecimate-CropBehavior',
  x20200050: 'RequestedResolutionID',
  x202000a0: 'RequestedImageSizeFlag',
  x202000a2: 'DecimateCropResult',
  x20200110: 'BasicGrayscaleImageSequence',
  x20200111: 'BasicColorImageSequence',
  x20200130: 'ReferencedImageOverlayBoxSequence',
  x20200140: 'ReferencedVOILUTBoxSequence',
  x20300010: 'AnnotationPosition',
  x20300020: 'TextString',
  x20400010: 'ReferencedOverlayPlaneSequence',
  x20400011: 'ReferencedOverlayPlaneGroups',
  x20400020: 'OverlayPixelDataSequence',
  x20400060: 'OverlayMagnificationType',
  x20400070: 'OverlaySmoothingType',
  x20400072: 'OverlayOrImageMagnification',
  x20400074: 'MagnifyToNumberOfColumns',
  x20400080: 'OverlayForegroundDensity',
  x20400082: 'OverlayBackgroundDensity',
  x20400090: 'OverlayMode',
  x20400100: 'ThresholdDensity',
  x20400500: 'ReferencedImageBoxSequenceRetired',
  x20500010: 'PresentationLUTSequence',
  x20500020: 'PresentationLUTShape',
  x20500500: 'ReferencedPresentationLUTSequence',
  x21000010: 'PrintJobID',
  x21000020: 'ExecutionStatus',
  x21000030: 'ExecutionStatusInfo',
  x21000040: 'CreationDate',
  x21000050: 'CreationTime',
  x21000070: 'Originator',
  x21000140: 'DestinationAE',
  x21000160: 'OwnerID',
  x21000170: 'NumberOfFilms',
  x21000500: 'ReferencedPrintJobSequencePullStoredPrint',
  x21100010: 'PrinterStatus',
  x21100020: 'PrinterStatusInfo',
  x21100030: 'PrinterName',
  x21100099: 'PrintQueueID',
  x21200010: 'QueueStatus',
  x21200050: 'PrintJobDescriptionSequence',
  x21200070: 'ReferencedPrintJobSequence',
  x21300010: 'PrintManagementCapabilitiesSeq',
  x21300015: 'PrinterCharacteristicsSequence',
  x21300030: 'FilmBoxContentSequence',
  x21300040: 'ImageBoxContentSequence',
  x21300050: 'AnnotationContentSequence',
  x21300060: 'ImageOverlayBoxContentSequence',
  x21300080: 'PresentationLUTContentSequence',
  x213000a0: 'ProposedStudySequence',
  x213000c0: 'OriginalImageSequence',
  x22000001: 'LabelFromInfoExtractedFromInstance',
  x22000002: 'LabelText',
  x22000003: 'LabelStyleSelection',
  x22000004: 'MediaDisposition',
  x22000005: 'BarcodeValue',
  x22000006: 'BarcodeSymbology',
  x22000007: 'AllowMediaSplitting',
  x22000008: 'IncludeNonDICOMObjects',
  x22000009: 'IncludeDisplayApplication',
  x2200000a: 'SaveCompInstancesAfterMediaCreate',
  x2200000b: 'TotalNumberMediaPiecesCreated',
  x2200000c: 'RequestedMediaApplicationProfile',
  x2200000d: 'ReferencedStorageMediaSequence',
  x2200000e: 'FailureAttributes',
  x2200000f: 'AllowLossyCompression',
  x22000020: 'RequestPriority',
  x30020002: 'RTImageLabel',
  x30020003: 'RTImageName',
  x30020004: 'RTImageDescription',
  x3002000a: 'ReportedValuesOrigin',
  x3002000c: 'RTImagePlane',
  x3002000d: 'XRayImageReceptorTranslation',
  x3002000e: 'XRayImageReceptorAngle',
  x30020010: 'RTImageOrientation',
  x30020011: 'ImagePlanePixelSpacing',
  x30020012: 'RTImagePosition',
  x30020020: 'RadiationMachineName',
  x30020022: 'RadiationMachineSAD',
  x30020024: 'RadiationMachineSSD',
  x30020026: 'RTImageSID',
  x30020028: 'SourceToReferenceObjectDistance',
  x30020029: 'FractionNumber',
  x30020030: 'ExposureSequence',
  x30020032: 'MetersetExposure',
  x30020034: 'DiaphragmPosition',
  x30020040: 'FluenceMapSequence',
  x30020041: 'FluenceDataSource',
  x30020042: 'FluenceDataScale',
  x30020051: 'FluenceMode',
  x30020052: 'FluenceModeID',
  x30040001: 'DVHType',
  x30040002: 'DoseUnits',
  x30040004: 'DoseType',
  x30040006: 'DoseComment',
  x30040008: 'NormalizationPoint',
  x3004000a: 'DoseSummationType',
  x3004000c: 'GridFrameOffsetVector',
  x3004000e: 'DoseGridScaling',
  x30040010: 'RTDoseROISequence',
  x30040012: 'DoseValue',
  x30040014: 'TissueHeterogeneityCorrection',
  x30040040: 'DVHNormalizationPoint',
  x30040042: 'DVHNormalizationDoseValue',
  x30040050: 'DVHSequence',
  x30040052: 'DVHDoseScaling',
  x30040054: 'DVHVolumeUnits',
  x30040056: 'DVHNumberOfBins',
  x30040058: 'DVHData',
  x30040060: 'DVHReferencedROISequence',
  x30040062: 'DVHROIContributionType',
  x30040070: 'DVHMinimumDose',
  x30040072: 'DVHMaximumDose',
  x30040074: 'DVHMeanDose',
  x30060002: 'StructureSetLabel',
  x30060004: 'StructureSetName',
  x30060006: 'StructureSetDescription',
  x30060008: 'StructureSetDate',
  x30060009: 'StructureSetTime',
  x30060010: 'ReferencedFrameOfReferenceSequence',
  x30060012: 'RTReferencedStudySequence',
  x30060014: 'RTReferencedSeriesSequence',
  x30060016: 'ContourImageSequence',
  x30060020: 'StructureSetROISequence',
  x30060022: 'ROINumber',
  x30060024: 'ReferencedFrameOfReferenceUID',
  x30060026: 'ROIName',
  x30060028: 'ROIDescription',
  x3006002a: 'ROIDisplayColor',
  x3006002c: 'ROIVolume',
  x30060030: 'RTRelatedROISequence',
  x30060033: 'RTROIRelationship',
  x30060036: 'ROIGenerationAlgorithm',
  x30060038: 'ROIGenerationDescription',
  x30060039: 'ROIContourSequence',
  x30060040: 'ContourSequence',
  x30060042: 'ContourGeometricType',
  x30060044: 'ContourSlabThickness',
  x30060045: 'ContourOffsetVector',
  x30060046: 'NumberOfContourPoints',
  x30060048: 'ContourNumber',
  x30060049: 'AttachedContours',
  x30060050: 'ContourData',
  x30060080: 'RTROIObservationsSequence',
  x30060082: 'ObservationNumber',
  x30060084: 'ReferencedROINumber',
  x30060085: 'ROIObservationLabel',
  x30060086: 'RTROIIdentificationCodeSequence',
  x30060088: 'ROIObservationDescription',
  x300600a0: 'RelatedRTROIObservationsSequence',
  x300600a4: 'RTROIInterpretedType',
  x300600a6: 'ROIInterpreter',
  x300600b0: 'ROIPhysicalPropertiesSequence',
  x300600b2: 'ROIPhysicalProperty',
  x300600b4: 'ROIPhysicalPropertyValue',
  x300600b6: 'ROIElementalCompositionSequence',
  x300600b7: 'ROIElementalCompAtomicNumber',
  x300600b8: 'ROIElementalCompAtomicMassFraction',
  x300600c0: 'FrameOfReferenceRelationshipSeq',
  x300600c2: 'RelatedFrameOfReferenceUID',
  x300600c4: 'FrameOfReferenceTransformType',
  x300600c6: 'FrameOfReferenceTransformMatrix',
  x300600c8: 'FrameOfReferenceTransformComment',
  x30080010: 'MeasuredDoseReferenceSequence',
  x30080012: 'MeasuredDoseDescription',
  x30080014: 'MeasuredDoseType',
  x30080016: 'MeasuredDoseValue',
  x30080020: 'TreatmentSessionBeamSequence',
  x30080021: 'TreatmentSessionIonBeamSequence',
  x30080022: 'CurrentFractionNumber',
  x30080024: 'TreatmentControlPointDate',
  x30080025: 'TreatmentControlPointTime',
  x3008002a: 'TreatmentTerminationStatus',
  x3008002b: 'TreatmentTerminationCode',
  x3008002c: 'TreatmentVerificationStatus',
  x30080030: 'ReferencedTreatmentRecordSequence',
  x30080032: 'SpecifiedPrimaryMeterset',
  x30080033: 'SpecifiedSecondaryMeterset',
  x30080036: 'DeliveredPrimaryMeterset',
  x30080037: 'DeliveredSecondaryMeterset',
  x3008003a: 'SpecifiedTreatmentTime',
  x3008003b: 'DeliveredTreatmentTime',
  x30080040: 'ControlPointDeliverySequence',
  x30080041: 'IonControlPointDeliverySequence',
  x30080042: 'SpecifiedMeterset',
  x30080044: 'DeliveredMeterset',
  x30080045: 'MetersetRateSet',
  x30080046: 'MetersetRateDelivered',
  x30080047: 'ScanSpotMetersetsDelivered',
  x30080048: 'DoseRateDelivered',
  x30080050: 'TreatmentSummaryCalcDoseRefSeq',
  x30080052: 'CumulativeDoseToDoseReference',
  x30080054: 'FirstTreatmentDate',
  x30080056: 'MostRecentTreatmentDate',
  x3008005a: 'NumberOfFractionsDelivered',
  x30080060: 'OverrideSequence',
  x30080061: 'ParameterSequencePointer',
  x30080062: 'OverrideParameterPointer',
  x30080063: 'ParameterItemIndex',
  x30080064: 'MeasuredDoseReferenceNumber',
  x30080065: 'ParameterPointer',
  x30080066: 'OverrideReason',
  x30080068: 'CorrectedParameterSequence',
  x3008006a: 'CorrectionValue',
  x30080070: 'CalculatedDoseReferenceSequence',
  x30080072: 'CalculatedDoseReferenceNumber',
  x30080074: 'CalculatedDoseReferenceDescription',
  x30080076: 'CalculatedDoseReferenceDoseValue',
  x30080078: 'StartMeterset',
  x3008007a: 'EndMeterset',
  x30080080: 'ReferencedMeasuredDoseReferenceSeq',
  x30080082: 'ReferencedMeasuredDoseReferenceNum',
  x30080090: 'ReferencedCalculatedDoseRefSeq',
  x30080092: 'ReferencedCalculatedDoseRefNumber',
  x300800a0: 'BeamLimitingDeviceLeafPairsSeq',
  x300800b0: 'RecordedWedgeSequence',
  x300800c0: 'RecordedCompensatorSequence',
  x300800d0: 'RecordedBlockSequence',
  x300800e0: 'TreatmentSummaryMeasuredDoseRefSeq',
  x300800f0: 'RecordedSnoutSequence',
  x300800f2: 'RecordedRangeShifterSequence',
  x300800f4: 'RecordedLateralSpreadingDeviceSeq',
  x300800f6: 'RecordedRangeModulatorSequence',
  x30080100: 'RecordedSourceSequence',
  x30080105: 'SourceSerialNumber',
  x30080110: 'TreatmentSessionAppSetupSeq',
  x30080116: 'ApplicationSetupCheck',
  x30080120: 'RecordedBrachyAccessoryDeviceSeq',
  x30080122: 'ReferencedBrachyAccessoryDeviceNum',
  x30080130: 'RecordedChannelSequence',
  x30080132: 'SpecifiedChannelTotalTime',
  x30080134: 'DeliveredChannelTotalTime',
  x30080136: 'SpecifiedNumberOfPulses',
  x30080138: 'DeliveredNumberOfPulses',
  x3008013a: 'SpecifiedPulseRepetitionInterval',
  x3008013c: 'DeliveredPulseRepetitionInterval',
  x30080140: 'RecordedSourceApplicatorSequence',
  x30080142: 'ReferencedSourceApplicatorNumber',
  x30080150: 'RecordedChannelShieldSequence',
  x30080152: 'ReferencedChannelShieldNumber',
  x30080160: 'BrachyControlPointDeliveredSeq',
  x30080162: 'SafePositionExitDate',
  x30080164: 'SafePositionExitTime',
  x30080166: 'SafePositionReturnDate',
  x30080168: 'SafePositionReturnTime',
  x30080200: 'CurrentTreatmentStatus',
  x30080202: 'TreatmentStatusComment',
  x30080220: 'FractionGroupSummarySequence',
  x30080223: 'ReferencedFractionNumber',
  x30080224: 'FractionGroupType',
  x30080230: 'BeamStopperPosition',
  x30080240: 'FractionStatusSummarySequence',
  x30080250: 'TreatmentDate',
  x30080251: 'TreatmentTime',
  x300a0002: 'RTPlanLabel',
  x300a0003: 'RTPlanName',
  x300a0004: 'RTPlanDescription',
  x300a0006: 'RTPlanDate',
  x300a0007: 'RTPlanTime',
  x300a0009: 'TreatmentProtocols',
  x300a000a: 'PlanIntent',
  x300a000b: 'TreatmentSites',
  x300a000c: 'RTPlanGeometry',
  x300a000e: 'PrescriptionDescription',
  x300a0010: 'DoseReferenceSequence',
  x300a0012: 'DoseReferenceNumber',
  x300a0013: 'DoseReferenceUID',
  x300a0014: 'DoseReferenceStructureType',
  x300a0015: 'NominalBeamEnergyUnit',
  x300a0016: 'DoseReferenceDescription',
  x300a0018: 'DoseReferencePointCoordinates',
  x300a001a: 'NominalPriorDose',
  x300a0020: 'DoseReferenceType',
  x300a0021: 'ConstraintWeight',
  x300a0022: 'DeliveryWarningDose',
  x300a0023: 'DeliveryMaximumDose',
  x300a0025: 'TargetMinimumDose',
  x300a0026: 'TargetPrescriptionDose',
  x300a0027: 'TargetMaximumDose',
  x300a0028: 'TargetUnderdoseVolumeFraction',
  x300a002a: 'OrganAtRiskFullVolumeDose',
  x300a002b: 'OrganAtRiskLimitDose',
  x300a002c: 'OrganAtRiskMaximumDose',
  x300a002d: 'OrganAtRiskOverdoseVolumeFraction',
  x300a0040: 'ToleranceTableSequence',
  x300a0042: 'ToleranceTableNumber',
  x300a0043: 'ToleranceTableLabel',
  x300a0044: 'GantryAngleTolerance',
  x300a0046: 'BeamLimitingDeviceAngleTolerance',
  x300a0048: 'BeamLimitingDeviceToleranceSeq',
  x300a004a: 'BeamLimitingDevicePositionTol',
  x300a004b: 'SnoutPositionTolerance',
  x300a004c: 'PatientSupportAngleTolerance',
  x300a004e: 'TableTopEccentricAngleTolerance',
  x300a004f: 'TableTopPitchAngleTolerance',
  x300a0050: 'TableTopRollAngleTolerance',
  x300a0051: 'TableTopVerticalPositionTolerance',
  x300a0052: 'TableTopLongitudinalPositionTol',
  x300a0053: 'TableTopLateralPositionTolerance',
  x300a0055: 'RTPlanRelationship',
  x300a0070: 'FractionGroupSequence',
  x300a0071: 'FractionGroupNumber',
  x300a0072: 'FractionGroupDescription',
  x300a0078: 'NumberOfFractionsPlanned',
  x300a0079: 'NumberFractionPatternDigitsPerDay',
  x300a007a: 'RepeatFractionCycleLength',
  x300a007b: 'FractionPattern',
  x300a0080: 'NumberOfBeams',
  x300a0082: 'BeamDoseSpecificationPoint',
  x300a0084: 'BeamDose',
  x300a0086: 'BeamMeterset',
  x300a0088: 'BeamDosePointDepth',
  x300a0089: 'BeamDosePointEquivalentDepth',
  x300a008a: 'BeamDosePointSSD',
  x300a00a0: 'NumberOfBrachyApplicationSetups',
  x300a00a2: 'BrachyAppSetupDoseSpecPoint',
  x300a00a4: 'BrachyApplicationSetupDose',
  x300a00b0: 'BeamSequence',
  x300a00b2: 'TreatmentMachineName',
  x300a00b3: 'PrimaryDosimeterUnit',
  x300a00b4: 'SourceAxisDistance',
  x300a00b6: 'BeamLimitingDeviceSequence',
  x300a00b8: 'RTBeamLimitingDeviceType',
  x300a00ba: 'SourceToBeamLimitingDeviceDistance',
  x300a00bb: 'IsocenterToBeamLimitingDeviceDist',
  x300a00bc: 'NumberOfLeafJawPairs',
  x300a00be: 'LeafPositionBoundaries',
  x300a00c0: 'BeamNumber',
  x300a00c2: 'BeamName',
  x300a00c3: 'BeamDescription',
  x300a00c4: 'BeamType',
  x300a00c6: 'RadiationType',
  x300a00c7: 'HighDoseTechniqueType',
  x300a00c8: 'ReferenceImageNumber',
  x300a00ca: 'PlannedVerificationImageSequence',
  x300a00cc: 'ImagingDeviceSpecificAcqParams',
  x300a00ce: 'TreatmentDeliveryType',
  x300a00d0: 'NumberOfWedges',
  x300a00d1: 'WedgeSequence',
  x300a00d2: 'WedgeNumber',
  x300a00d3: 'WedgeType',
  x300a00d4: 'WedgeID',
  x300a00d5: 'WedgeAngle',
  x300a00d6: 'WedgeFactor',
  x300a00d7: 'TotalWedgeTrayWaterEquivThickness',
  x300a00d8: 'WedgeOrientation',
  x300a00d9: 'IsocenterToWedgeTrayDistance',
  x300a00da: 'SourceToWedgeTrayDistance',
  x300a00db: 'WedgeThinEdgePosition',
  x300a00dc: 'BolusID',
  x300a00dd: 'BolusDescription',
  x300a00e0: 'NumberOfCompensators',
  x300a00e1: 'MaterialID',
  x300a00e2: 'TotalCompensatorTrayFactor',
  x300a00e3: 'CompensatorSequence',
  x300a00e4: 'CompensatorNumber',
  x300a00e5: 'CompensatorID',
  x300a00e6: 'SourceToCompensatorTrayDistance',
  x300a00e7: 'CompensatorRows',
  x300a00e8: 'CompensatorColumns',
  x300a00e9: 'CompensatorPixelSpacing',
  x300a00ea: 'CompensatorPosition',
  x300a00eb: 'CompensatorTransmissionData',
  x300a00ec: 'CompensatorThicknessData',
  x300a00ed: 'NumberOfBoli',
  x300a00ee: 'CompensatorType',
  x300a00f0: 'NumberOfBlocks',
  x300a00f2: 'TotalBlockTrayFactor',
  x300a00f3: 'TotalBlockTrayWaterEquivThickness',
  x300a00f4: 'BlockSequence',
  x300a00f5: 'BlockTrayID',
  x300a00f6: 'SourceToBlockTrayDistance',
  x300a00f7: 'IsocenterToBlockTrayDistance',
  x300a00f8: 'BlockType',
  x300a00f9: 'AccessoryCode',
  x300a00fa: 'BlockDivergence',
  x300a00fb: 'BlockMountingPosition',
  x300a00fc: 'BlockNumber',
  x300a00fe: 'BlockName',
  x300a0100: 'BlockThickness',
  x300a0102: 'BlockTransmission',
  x300a0104: 'BlockNumberOfPoints',
  x300a0106: 'BlockData',
  x300a0107: 'ApplicatorSequence',
  x300a0108: 'ApplicatorID',
  x300a0109: 'ApplicatorType',
  x300a010a: 'ApplicatorDescription',
  x300a010c: 'CumulativeDoseReferenceCoefficient',
  x300a010e: 'FinalCumulativeMetersetWeight',
  x300a0110: 'NumberOfControlPoints',
  x300a0111: 'ControlPointSequence',
  x300a0112: 'ControlPointIndex',
  x300a0114: 'NominalBeamEnergy',
  x300a0115: 'DoseRateSet',
  x300a0116: 'WedgePositionSequence',
  x300a0118: 'WedgePosition',
  x300a011a: 'BeamLimitingDevicePositionSequence',
  x300a011c: 'LeafJawPositions',
  x300a011e: 'GantryAngle',
  x300a011f: 'GantryRotationDirection',
  x300a0120: 'BeamLimitingDeviceAngle',
  x300a0121: 'BeamLimitingDeviceRotateDirection',
  x300a0122: 'PatientSupportAngle',
  x300a0123: 'PatientSupportRotationDirection',
  x300a0124: 'TableTopEccentricAxisDistance',
  x300a0125: 'TableTopEccentricAngle',
  x300a0126: 'TableTopEccentricRotateDirection',
  x300a0128: 'TableTopVerticalPosition',
  x300a0129: 'TableTopLongitudinalPosition',
  x300a012a: 'TableTopLateralPosition',
  x300a012c: 'IsocenterPosition',
  x300a012e: 'SurfaceEntryPoint',
  x300a0130: 'SourceToSurfaceDistance',
  x300a0134: 'CumulativeMetersetWeight',
  x300a0140: 'TableTopPitchAngle',
  x300a0142: 'TableTopPitchRotationDirection',
  x300a0144: 'TableTopRollAngle',
  x300a0146: 'TableTopRollRotationDirection',
  x300a0148: 'HeadFixationAngle',
  x300a014a: 'GantryPitchAngle',
  x300a014c: 'GantryPitchRotationDirection',
  x300a014e: 'GantryPitchAngleTolerance',
  x300a0180: 'PatientSetupSequence',
  x300a0182: 'PatientSetupNumber',
  x300a0183: 'PatientSetupLabel',
  x300a0184: 'PatientAdditionalPosition',
  x300a0190: 'FixationDeviceSequence',
  x300a0192: 'FixationDeviceType',
  x300a0194: 'FixationDeviceLabel',
  x300a0196: 'FixationDeviceDescription',
  x300a0198: 'FixationDevicePosition',
  x300a0199: 'FixationDevicePitchAngle',
  x300a019a: 'FixationDeviceRollAngle',
  x300a01a0: 'ShieldingDeviceSequence',
  x300a01a2: 'ShieldingDeviceType',
  x300a01a4: 'ShieldingDeviceLabel',
  x300a01a6: 'ShieldingDeviceDescription',
  x300a01a8: 'ShieldingDevicePosition',
  x300a01b0: 'SetupTechnique',
  x300a01b2: 'SetupTechniqueDescription',
  x300a01b4: 'SetupDeviceSequence',
  x300a01b6: 'SetupDeviceType',
  x300a01b8: 'SetupDeviceLabel',
  x300a01ba: 'SetupDeviceDescription',
  x300a01bc: 'SetupDeviceParameter',
  x300a01d0: 'SetupReferenceDescription',
  x300a01d2: 'TableTopVerticalSetupDisplacement',
  x300a01d4: 'TableTopLongitudinalSetupDisplace',
  x300a01d6: 'TableTopLateralSetupDisplacement',
  x300a0200: 'BrachyTreatmentTechnique',
  x300a0202: 'BrachyTreatmentType',
  x300a0206: 'TreatmentMachineSequence',
  x300a0210: 'SourceSequence',
  x300a0212: 'SourceNumber',
  x300a0214: 'SourceType',
  x300a0216: 'SourceManufacturer',
  x300a0218: 'ActiveSourceDiameter',
  x300a021a: 'ActiveSourceLength',
  x300a0222: 'SourceEncapsulationNomThickness',
  x300a0224: 'SourceEncapsulationNomTransmission',
  x300a0226: 'SourceIsotopeName',
  x300a0228: 'SourceIsotopeHalfLife',
  x300a0229: 'SourceStrengthUnits',
  x300a022a: 'ReferenceAirKermaRate',
  x300a022b: 'SourceStrength',
  x300a022c: 'SourceStrengthReferenceDate',
  x300a022e: 'SourceStrengthReferenceTime',
  x300a0230: 'ApplicationSetupSequence',
  x300a0232: 'ApplicationSetupType',
  x300a0234: 'ApplicationSetupNumber',
  x300a0236: 'ApplicationSetupName',
  x300a0238: 'ApplicationSetupManufacturer',
  x300a0240: 'TemplateNumber',
  x300a0242: 'TemplateType',
  x300a0244: 'TemplateName',
  x300a0250: 'TotalReferenceAirKerma',
  x300a0260: 'BrachyAccessoryDeviceSequence',
  x300a0262: 'BrachyAccessoryDeviceNumber',
  x300a0263: 'BrachyAccessoryDeviceID',
  x300a0264: 'BrachyAccessoryDeviceType',
  x300a0266: 'BrachyAccessoryDeviceName',
  x300a026a: 'BrachyAccessoryDeviceNomThickness',
  x300a026c: 'BrachyAccessoryDevNomTransmission',
  x300a0280: 'ChannelSequence',
  x300a0282: 'ChannelNumber',
  x300a0284: 'ChannelLength',
  x300a0286: 'ChannelTotalTime',
  x300a0288: 'SourceMovementType',
  x300a028a: 'NumberOfPulses',
  x300a028c: 'PulseRepetitionInterval',
  x300a0290: 'SourceApplicatorNumber',
  x300a0291: 'SourceApplicatorID',
  x300a0292: 'SourceApplicatorType',
  x300a0294: 'SourceApplicatorName',
  x300a0296: 'SourceApplicatorLength',
  x300a0298: 'SourceApplicatorManufacturer',
  x300a029c: 'SourceApplicatorWallNomThickness',
  x300a029e: 'SourceApplicatorWallNomTrans',
  x300a02a0: 'SourceApplicatorStepSize',
  x300a02a2: 'TransferTubeNumber',
  x300a02a4: 'TransferTubeLength',
  x300a02b0: 'ChannelShieldSequence',
  x300a02b2: 'ChannelShieldNumber',
  x300a02b3: 'ChannelShieldID',
  x300a02b4: 'ChannelShieldName',
  x300a02b8: 'ChannelShieldNominalThickness',
  x300a02ba: 'ChannelShieldNominalTransmission',
  x300a02c8: 'FinalCumulativeTimeWeight',
  x300a02d0: 'BrachyControlPointSequence',
  x300a02d2: 'ControlPointRelativePosition',
  x300a02d4: 'ControlPoint3DPosition',
  x300a02d6: 'CumulativeTimeWeight',
  x300a02e0: 'CompensatorDivergence',
  x300a02e1: 'CompensatorMountingPosition',
  x300a02e2: 'SourceToCompensatorDistance',
  x300a02e3: 'TotalCompTrayWaterEquivThickness',
  x300a02e4: 'IsocenterToCompensatorTrayDistance',
  x300a02e5: 'CompensatorColumnOffset',
  x300a02e6: 'IsocenterToCompensatorDistances',
  x300a02e7: 'CompensatorRelStoppingPowerRatio',
  x300a02e8: 'CompensatorMillingToolDiameter',
  x300a02ea: 'IonRangeCompensatorSequence',
  x300a02eb: 'CompensatorDescription',
  x300a0302: 'RadiationMassNumber',
  x300a0304: 'RadiationAtomicNumber',
  x300a0306: 'RadiationChargeState',
  x300a0308: 'ScanMode',
  x300a030a: 'VirtualSourceAxisDistances',
  x300a030c: 'SnoutSequence',
  x300a030d: 'SnoutPosition',
  x300a030f: 'SnoutID',
  x300a0312: 'NumberOfRangeShifters',
  x300a0314: 'RangeShifterSequence',
  x300a0316: 'RangeShifterNumber',
  x300a0318: 'RangeShifterID',
  x300a0320: 'RangeShifterType',
  x300a0322: 'RangeShifterDescription',
  x300a0330: 'NumberOfLateralSpreadingDevices',
  x300a0332: 'LateralSpreadingDeviceSequence',
  x300a0334: 'LateralSpreadingDeviceNumber',
  x300a0336: 'LateralSpreadingDeviceID',
  x300a0338: 'LateralSpreadingDeviceType',
  x300a033a: 'LateralSpreadingDeviceDescription',
  x300a033c: 'LateralSpreadingDevWaterEquivThick',
  x300a0340: 'NumberOfRangeModulators',
  x300a0342: 'RangeModulatorSequence',
  x300a0344: 'RangeModulatorNumber',
  x300a0346: 'RangeModulatorID',
  x300a0348: 'RangeModulatorType',
  x300a034a: 'RangeModulatorDescription',
  x300a034c: 'BeamCurrentModulationID',
  x300a0350: 'PatientSupportType',
  x300a0352: 'PatientSupportID',
  x300a0354: 'PatientSupportAccessoryCode',
  x300a0356: 'FixationLightAzimuthalAngle',
  x300a0358: 'FixationLightPolarAngle',
  x300a035a: 'MetersetRate',
  x300a0360: 'RangeShifterSettingsSequence',
  x300a0362: 'RangeShifterSetting',
  x300a0364: 'IsocenterToRangeShifterDistance',
  x300a0366: 'RangeShifterWaterEquivThickness',
  x300a0370: 'LateralSpreadingDeviceSettingsSeq',
  x300a0372: 'LateralSpreadingDeviceSetting',
  x300a0374: 'IsocenterToLateralSpreadingDevDist',
  x300a0380: 'RangeModulatorSettingsSequence',
  x300a0382: 'RangeModulatorGatingStartValue',
  x300a0384: 'RangeModulatorGatingStopValue',
  x300a038a: 'IsocenterToRangeModulatorDistance',
  x300a0390: 'ScanSpotTuneID',
  x300a0392: 'NumberOfScanSpotPositions',
  x300a0394: 'ScanSpotPositionMap',
  x300a0396: 'ScanSpotMetersetWeights',
  x300a0398: 'ScanningSpotSize',
  x300a039a: 'NumberOfPaintings',
  x300a03a0: 'IonToleranceTableSequence',
  x300a03a2: 'IonBeamSequence',
  x300a03a4: 'IonBeamLimitingDeviceSequence',
  x300a03a6: 'IonBlockSequence',
  x300a03a8: 'IonControlPointSequence',
  x300a03aa: 'IonWedgeSequence',
  x300a03ac: 'IonWedgePositionSequence',
  x300a0401: 'ReferencedSetupImageSequence',
  x300a0402: 'SetupImageComment',
  x300a0410: 'MotionSynchronizationSequence',
  x300a0412: 'ControlPointOrientation',
  x300a0420: 'GeneralAccessorySequence',
  x300a0421: 'GeneralAccessoryID',
  x300a0422: 'GeneralAccessoryDescription',
  x300a0423: 'GeneralAccessoryType',
  x300a0424: 'GeneralAccessoryNumber',
  x300c0002: 'ReferencedRTPlanSequence',
  x300c0004: 'ReferencedBeamSequence',
  x300c0006: 'ReferencedBeamNumber',
  x300c0007: 'ReferencedReferenceImageNumber',
  x300c0008: 'StartCumulativeMetersetWeight',
  x300c0009: 'EndCumulativeMetersetWeight',
  x300c000a: 'ReferencedBrachyAppSetupSeq',
  x300c000c: 'ReferencedBrachyAppSetupNumber',
  x300c000e: 'ReferencedSourceNumber',
  x300c0020: 'ReferencedFractionGroupSequence',
  x300c0022: 'ReferencedFractionGroupNumber',
  x300c0040: 'ReferencedVerificationImageSeq',
  x300c0042: 'ReferencedReferenceImageSequence',
  x300c0050: 'ReferencedDoseReferenceSequence',
  x300c0051: 'ReferencedDoseReferenceNumber',
  x300c0055: 'BrachyReferencedDoseReferenceSeq',
  x300c0060: 'ReferencedStructureSetSequence',
  x300c006a: 'ReferencedPatientSetupNumber',
  x300c0080: 'ReferencedDoseSequence',
  x300c00a0: 'ReferencedToleranceTableNumber',
  x300c00b0: 'ReferencedBolusSequence',
  x300c00c0: 'ReferencedWedgeNumber',
  x300c00d0: 'ReferencedCompensatorNumber',
  x300c00e0: 'ReferencedBlockNumber',
  x300c00f0: 'ReferencedControlPointIndex',
  x300c00f2: 'ReferencedControlPointSequence',
  x300c00f4: 'ReferencedStartControlPointIndex',
  x300c00f6: 'ReferencedStopControlPointIndex',
  x300c0100: 'ReferencedRangeShifterNumber',
  x300c0102: 'ReferencedLateralSpreadingDevNum',
  x300c0104: 'ReferencedRangeModulatorNumber',
  x300e0002: 'ApprovalStatus',
  x300e0004: 'ReviewDate',
  x300e0005: 'ReviewTime',
  x300e0008: 'ReviewerName',
  x40000000: 'TextGroupLength',
  x40000010: 'Arbitrary',
  x40004000: 'TextComments',
  x40080040: 'ResultsID',
  x40080042: 'ResultsIDIssuer',
  x40080050: 'ReferencedInterpretationSequence',
  x40080100: 'InterpretationRecordedDate',
  x40080101: 'InterpretationRecordedTime',
  x40080102: 'InterpretationRecorder',
  x40080103: 'ReferenceToRecordedSound',
  x40080108: 'InterpretationTranscriptionDate',
  x40080109: 'InterpretationTranscriptionTime',
  x4008010a: 'InterpretationTranscriber',
  x4008010b: 'InterpretationText',
  x4008010c: 'InterpretationAuthor',
  x40080111: 'InterpretationApproverSequence',
  x40080112: 'InterpretationApprovalDate',
  x40080113: 'InterpretationApprovalTime',
  x40080114: 'PhysicianApprovingInterpretation',
  x40080115: 'InterpretationDiagnosisDescription',
  x40080117: 'InterpretationDiagnosisCodeSeq',
  x40080118: 'ResultsDistributionListSequence',
  x40080119: 'DistributionName',
  x4008011a: 'DistributionAddress',
  x40080200: 'InterpretationID',
  x40080202: 'InterpretationIDIssuer',
  x40080210: 'InterpretationTypeID',
  x40080212: 'InterpretationStatusID',
  x40080300: 'Impressions',
  x40084000: 'ResultsComments',
  x4ffe0001: 'MACParametersSequence',
  x50xx0005: 'CurveDimensions',
  x50xx0010: 'NumberOfPoints',
  x50xx0020: 'TypeOfData',
  x50xx0022: 'CurveDescription',
  x50xx0030: 'AxisUnits',
  x50xx0040: 'AxisLabels',
  x50xx0103: 'DataValueRepresentation',
  x50xx0104: 'MinimumCoordinateValue',
  x50xx0105: 'MaximumCoordinateValue',
  x50xx0106: 'CurveRange',
  x50xx0110: 'CurveDataDescriptor',
  x50xx0112: 'CoordinateStartValue',
  x50xx0114: 'CoordinateStepValue',
  x50xx1001: 'CurveActivationLayer',
  x50xx2000: 'AudioType',
  x50xx2002: 'AudioSampleFormat',
  x50xx2004: 'NumberOfChannels',
  x50xx2006: 'NumberOfSamples',
  x50xx2008: 'SampleRate',
  x50xx200a: 'TotalTime',
  x50xx200c: 'AudioSampleData',
  x50xx200e: 'AudioComments',
  x50xx2500: 'CurveLabel',
  x50xx2600: 'CurveReferencedOverlaySequence',
  x50xx2610: 'ReferencedOverlayGroup',
  x50xx3000: 'CurveData',
  x52009229: 'SharedFunctionalGroupsSequence',
  x52009230: 'PerFrameFunctionalGroupsSequence',
  x54000100: 'WaveformSequence',
  x54000110: 'ChannelMinimumValue',
  x54000112: 'ChannelMaximumValue',
  x54001004: 'WaveformBitsAllocated',
  x54001006: 'WaveformSampleInterpretation',
  x5400100a: 'WaveformPaddingValue',
  x54001010: 'WaveformData',
  x56000010: 'FirstOrderPhaseCorrectionAngle',
  x56000020: 'SpectroscopyData',
  x60000000: 'OverlayGroupLength',
  x60xx0010: 'OverlayRows',
  x60xx0011: 'OverlayColumns',
  x60xx0012: 'OverlayPlanes',
  x60xx0015: 'NumberOfFramesInOverlay',
  x60xx0022: 'OverlayDescription',
  x60xx0040: 'OverlayType',
  x60xx0045: 'OverlaySubtype',
  x60xx0050: 'OverlayOrigin',
  x60xx0051: 'ImageFrameOrigin',
  x60xx0052: 'OverlayPlaneOrigin',
  x60xx0060: 'OverlayCompressionCode',
  x60xx0061: 'OverlayCompressionOriginator',
  x60xx0062: 'OverlayCompressionLabel',
  x60xx0063: 'OverlayCompressionDescription',
  x60xx0066: 'OverlayCompressionStepPointers',
  x60xx0068: 'OverlayRepeatInterval',
  x60xx0069: 'OverlayBitsGrouped',
  x60xx0100: 'OverlayBitsAllocated',
  x60xx0102: 'OverlayBitPosition',
  x60xx0110: 'OverlayFormat',
  x60xx0200: 'OverlayLocation',
  x60xx0800: 'OverlayCodeLabel',
  x60xx0802: 'OverlayNumberOfTables',
  x60xx0803: 'OverlayCodeTableLocation',
  x60xx0804: 'OverlayBitsForCodeWord',
  x60xx1001: 'OverlayActivationLayer',
  x60xx1100: 'OverlayDescriptorGray',
  x60xx1101: 'OverlayDescriptorRed',
  x60xx1102: 'OverlayDescriptorGreen',
  x60xx1103: 'OverlayDescriptorBlue',
  x60xx1200: 'OverlaysGray',
  x60xx1201: 'OverlaysRed',
  x60xx1202: 'OverlaysGreen',
  x60xx1203: 'OverlaysBlue',
  x60xx1301: 'ROIArea',
  x60xx1302: 'ROIMean',
  x60xx1303: 'ROIStandardDeviation',
  x60xx1500: 'OverlayLabel',
  x60xx3000: 'OverlayData',
  x60xx4000: 'OverlayComments',
  x7fxx0000: 'PixelDataGroupLength',
  x7fxx0010: 'PixelData',
  x7fxx0011: 'VariableNextDataGroup',
  x7fxx0020: 'VariableCoefficientsSDVN',
  x7fxx0030: 'VariableCoefficientsSDHN',
  x7fxx0040: 'VariableCoefficientsSDDN',
  xfffafffa: 'DigitalSignaturesSequence',
  xfffcfffc: 'DataSetTrailingPadding',
  xfffee000: 'StartOfItem',
  xfffee00d: 'EndOfItems',
  xfffee0dd: 'EndOfSequence'
};
DICOMTagDescriptions.init(initialTagDescriptionMap); // Discard original map...

initialTagDescriptionMap = null;

/**
 * Overridable namespace to allow getting study boxes data externally.
 *
 * The function must handle the first parameter as a studyInformation object containing at least the
 * studyInstanceUid attribute.
 *
 * Shall return a promise that will be resolved with an object containing those attributes:
 * - studyInstanceUid {String}: copy of studyInformation.studyInstanceUid
 * - modalities {String}: 2 uppercase letters for each modality split by any non-alphabetical char(s)
 * - studyDate {String}: date formatted as YYYYMMDD
 * - studyDescription {String}: study description string
 */

ohif_core.OHIF.studies.getStudyBoxData = false;

ohif_core.OHIF.studies.loadingDict = new reactiveDict.ReactiveDict();
/**
 * Load the study metadata and store its information locally
 *
 * @param {String} studyInstanceUid The UID of the Study to be loaded
 * @returns {Promise} that will be resolved with the study metadata or rejected with an error
 */

ohif_core.OHIF.studies.loadStudy = studyInstanceUid => new Promise((resolve, reject) => {
  // Disable reactivity to get the current loading state
  let currentLoadingState;
  tracker.Tracker.nonreactive(() => {
    currentLoadingState = ohif_core.OHIF.studies.loadingDict.get(studyInstanceUid) || '';
  }); // Set the loading state as the study is not yet loaded

  if (currentLoadingState !== 'loading') {
    ohif_core.OHIF.studies.loadingDict.set(studyInstanceUid, 'loading');
  }

  const studyLoaded = ohif_core.OHIF.viewer.Studies.findBy({
    studyInstanceUid: studyInstanceUid
  });

  if (studyLoaded) {
    ohif_core.OHIF.studies.loadingDict.set(studyInstanceUid, 'loaded');
    resolve(studyLoaded);
    return;
  }

  return ohif_core.OHIF.studies.retrieveStudyMetadata(studyInstanceUid).then(study => {
    if (window.HipaaLogger && ohif_core.OHIF.user && ohif_core.OHIF.user.userLoggedIn && ohif_core.OHIF.user.userLoggedIn()) {
      window.HipaaLogger.logEvent({
        eventType: 'viewed',
        userId: ohif_core.OHIF.user.getUserId(),
        userName: ohif_core.OHIF.user.getName(),
        collectionName: 'Study',
        recordId: studyInstanceUid,
        patientId: study.patientId,
        patientName: study.patientName
      });
    } // Once the data was retrieved, the series are sorted by series and instance number


    ohif_core.OHIF.viewerbase.sortStudy(study); // Updates WADO-RS metaDataManager

    ohif_core.OHIF.viewerbase.updateMetaDataManager(study); // Transform the study in a StudyMetadata object

    const studyMetadata = new ohif_core.OHIF.metadata.StudyMetadata(study); // Add the display sets to the study

    study.displaySets = ohif_core.OHIF.viewerbase.sortingManager.getDisplaySets(studyMetadata);
    study.displaySets.forEach(displaySet => {
      ohif_core.OHIF.viewerbase.stackManager.makeAndAddStack(study, displaySet);
      studyMetadata.addDisplaySet(displaySet);
    }); // Persist study data into OHIF.viewer

    ohif_core.OHIF.viewer.Studies.insert(study);
    ohif_core.OHIF.viewer.StudyMetadataList.insert(study); // Add the study to the loading listener to allow loading progress handling

    const studyLoadingListener = ohif_core.OHIF.viewerbase.StudyLoadingListener.getInstance();
    studyLoadingListener.addStudy(study); // Add the studyInstanceUid to the loaded state dictionary

    ohif_core.OHIF.studies.loadingDict.set(studyInstanceUid, 'loaded');
    resolve(study);
  }).catch((...args) => {
    ohif_core.OHIF.studies.loadingDict.set(studyInstanceUid, 'failed');
    reject(args);
  });
});

/**
 * Retrieves metaData for multiple studies at once.
 *
 * This function calls retrieveStudyMetadata several times, asynchronously,
 * and waits for all of the results to be returned.
 *
 * @param studyInstanceUids The UIDs of the Studies to be retrieved
 * @return Promise
 */

ohif_core.OHIF.studies.retrieveStudiesMetadata = (studyInstanceUids, seriesInstanceUids) => {
  // Create an empty array to store the Promises for each metaData retrieval call
  const promises = []; // Loop through the array of studyInstanceUids

  studyInstanceUids.forEach(function (studyInstanceUid) {
    // Send the call and resolve or reject the related promise based on its outcome
    const promise = ohif_core.OHIF.studies.retrieveStudyMetadata(studyInstanceUid, seriesInstanceUids); // Add the current promise to the array of promises

    promises.push(promise);
  }); // When all of the promises are complete, this callback runs

  const promise = Promise.all(promises); // Warn the error on console if some retrieval failed

  promise.catch(error => ohif_core.OHIF.log.warn(error));
  return promise;
};

// promises and prevent unnecessary subsequent calls to the server

const StudyMetaDataPromises = new Map();
/**
 * Delete the cached study metadata retrieval promise to ensure that the browser will
 * re-retrieve the study metadata when it is next requested
 *
 * @param {String} studyInstanceUid The UID of the Study to be removed from cache
 *
 */

ohif_core.OHIF.studies.deleteStudyMetadataPromise = studyInstanceUid => {
  if (StudyMetaDataPromises.has(studyInstanceUid)) {
    StudyMetaDataPromises.delete(studyInstanceUid);
  }
};
/**
 * Retrieves study metadata using a server call
 *
 * @param {String} studyInstanceUid The UID of the Study to be retrieved
 * @returns {Promise} that will be resolved with the metadata or rejected with the error
 */


ohif_core.OHIF.studies.retrieveStudyMetadata = (studyInstanceUid, seriesInstanceUids) => {
  // @TODO: Whenever a study metadata request has failed, its related promise will be rejected once and for all
  // and further requests for that metadata will always fail. On failure, we probably need to remove the
  // corresponding promise from the "StudyMetaDataPromises" map...
  // If the StudyMetaDataPromises cache already has a pending or resolved promise related to the
  // given studyInstanceUid, then that promise is returned
  if (StudyMetaDataPromises.has(studyInstanceUid)) {
    return StudyMetaDataPromises.get(studyInstanceUid);
  }

  const seriesKeys = Array.isArray(seriesInstanceUids) ? '|' + seriesInstanceUids.join('|') : '';
  const timingKey = `retrieveStudyMetadata[${studyInstanceUid}${seriesKeys}]`;
  ohif_core.OHIF.log.time(timingKey); // Create a promise to handle the data retrieval

  const promise = new Promise((resolve, reject) => {
    const server = ohif_core.OHIF.servers.getCurrentServer(); // If no study metadata is in the cache variable, we need to retrieve it from
    // the server with a call.

    if (server.type === 'dicomWeb' && server.requestOptions.requestFromBrowser === true) {
      ohif_core.OHIF.studies.services.WADO.RetrieveMetadata(server, studyInstanceUid).then(function (data) {
        resolve(data);
      }, reject);
    }
  }); // Store the promise in cache

  StudyMetaDataPromises.set(studyInstanceUid, promise);
  return promise;
};

const studySearchPromises = new Map();
/**
 * Search for studies information by the given filter
 *
 * @param {Object} filter Filter that will be used on search
 * @returns {Promise} resolved with an array of studies information or rejected with an error
 */

ohif_core.OHIF.studies.searchStudies = filter => {
  const promiseKey = JSON.stringify(filter);

  if (studySearchPromises.has(promiseKey)) {
    return studySearchPromises.get(promiseKey);
  } else {
    const promise = new Promise((resolve, reject) => {
      const server = ohif_core.OHIF.servers.getCurrentServer();

      if (server.type === 'dicomWeb' && server.requestOptions.requestFromBrowser === true) {
        ohif_core.OHIF.studies.services.QIDO.Studies(server, filter).then(resolve, reject);
      }
    });
    studySearchPromises.set(promiseKey, promise);
    return promise;
  }
};

class HotkeysContext {
  constructor(name, definitions, enabled) {
    this.name = name;
    this.definitions = Object.assign({}, definitions);
    this.enabled = enabled;
  }

  extend(definitions = {}) {
    if (typeof definitions !== 'object') return;
    this.definitions = Object.assign({}, definitions);
    Object.keys(definitions).forEach(command => {
      const hotkey = definitions[command];
      this.unregister(command);

      if (hotkey) {
        this.register(command, hotkey);
      }

      this.definitions[command] = hotkey;
    });
  }

  register(command, hotkey) {
    if (!hotkey) {
      return;
    }

    if (!command) {
      return ohif_core.OHIF.log.warn(`No command was defined for hotkey "${hotkey}"`);
    }

    const bindingKey = `keydown.hotkey.${this.name}.${command}`;

    const bind = hotkey => $(document).bind(bindingKey, hotkey, event => {
      if (!this.enabled.get()) return;
      ohif_core.OHIF.commands.run(command);
      event.preventDefault();
    });

    if (hotkey instanceof Array) {
      hotkey.forEach(hotkey => bind(hotkey));
    } else {
      bind(hotkey);
    }
  }

  unregister(command) {
    const bindingKey = `keydown.hotkey.${this.name}.${command}`;

    if (this.definitions[command]) {
      $(document).unbind(bindingKey);
      delete this.definitions[command];
    }
  }

  initialize() {
    Object.keys(this.definitions).forEach(command => {
      const hotkey = this.definitions[command];
      this.register(command, hotkey);
    });
  }

  destroy() {
    $(document).unbind(`keydown.hotkey.${this.name}`);
  }

}

class HotkeysManager {
  constructor() {
    this.contexts = {};
    this.defaults = {};
    this.currentContextName = null;
    this.enabled = true;
    this.retrieveFunction = null;
    this.storeFunction = null;
  }

  setRetrieveFunction(retrieveFunction) {
    this.retrieveFunction = retrieveFunction;
  }

  setStoreFunction(storeFunction) {
    this.storeFunction = storeFunction;
  }

  store(contextName, definitions) {
    const storageKey = `hotkeysDefinitions.${contextName}`;
    return new Promise((resolve, reject) => {
      if (this.storeFunction) {
        this.storeFunction.call(this, storageKey, definitions).then(resolve).catch(reject); //} else if (OHIF.user.userLoggedIn()) {
        //    OHIF.user.setData(storageKey, definitions).then(resolve).catch(reject);
      } else {
        const definitionsJSON = JSON.stringify(definitions);
        localStorage.setItem(storageKey, definitionsJSON);
        resolve();
      }
    });
  }

  retrieve(contextName) {
    const storageKey = `hotkeysDefinitions.${contextName}`;
    return new Promise((resolve, reject) => {
      if (this.retrieveFunction) {
        this.retrieveFunction(contextName).then(resolve).catch(reject);
      } else if (ohif_core.OHIF.user.userLoggedIn()) {
        try {
          resolve(ohif_core.OHIF.user.getData(storageKey));
        } catch (error) {
          reject(error);
        }
      } else {
        const definitionsJSON = localStorage.getItem(storageKey) || '';
        const definitions = JSON.parse(definitionsJSON) || undefined;
        resolve(definitions);
      }
    });
  }

  disable() {
    this.enabled.set(false);
  }

  enable() {
    this.enabled.set(true);
  }

  getContext(contextName) {
    return this.contexts[contextName];
  }

  getCurrentContext() {
    return this.getContext(this.currentContextName);
  }

  load(contextName) {
    return new Promise((resolve, reject) => {
      const context = this.getContext(contextName);
      if (!context) return reject();
      this.retrieve(contextName).then(defs => {
        const definitions = defs || this.defaults[contextName];

        if (!definitions) {
          this.changeObserver.changed();
          return reject();
        }

        context.destroy();
        context.definitions = definitions;
        context.initialize();
        this.changeObserver.changed();
        resolve(definitions);
      }).catch(reject);
    });
  }

  set(contextName, contextDefinitions, isDefaultDefinitions = false) {
    const enabled = this.enabled;
    const context = new HotkeysContext(contextName, contextDefinitions, enabled);
    const currentContext = this.getCurrentContext();

    if (currentContext && currentContext.name === contextName) {
      currentContext.destroy();
      context.initialize();
    }

    this.contexts[contextName] = context;

    if (isDefaultDefinitions) {
      this.defaults[contextName] = contextDefinitions;
    }
  }

  register(contextName, command, hotkey) {
    if (!command || !hotkey) return;
    const context = this.getContext(contextName);

    if (!context) {
      this.set(contextName, {});
    }

    context.register(command, hotkey);
  }

  unsetContext(contextName) {
    if (contextName === this.currentContextName) {
      this.getCurrentContext().destroy();
    }

    delete this.contexts[contextName];
    delete this.defaults[contextName];
  }

  resetDefaults(contextName) {
    const context = this.getContext(contextName);
    const definitions = this.defaults[contextName];
    if (!context || !definitions) return;
    context.extend(definitions);
    return this.store(contextName, definitions);
  }

  switchToContext(contextName) {
    const currentContext = this.getCurrentContext();

    if (currentContext) {
      currentContext.destroy();
    }

    const newContext = this.contexts[contextName];
    if (!newContext) return;
    this.currentContextName = contextName;
    newContext.initialize();
    this.load(contextName).catch(() => {});
  }

}

/*jslint browser: true*/
/*jslint jquery: true*/

/*
 * jQuery Hotkeys Plugin
 * Copyright 2010, John Resig
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Based upon the plugin by Tzury Bar Yochay:
 * https://github.com/tzuryby/jquery.hotkeys
 *
 * Original idea by:
 * Binny V A, http://www.openjs.com/scripts/events/keyboard_shortcuts/
 */

/*
 * One small change is: now keys are passed by object { keys: '...' }
 * Might be useful, when you want to pass some other data to your handler
 */

(function(jQuery) {

  jQuery.hotkeys = {
    version: "0.2.0",

    specialKeys: {
      8: "backspace",
      9: "tab",
      10: "return",
      13: "return",
      16: "shift",
      17: "ctrl",
      18: "alt",
      19: "pause",
      20: "capslock",
      27: "esc",
      32: "space",
      33: "pageup",
      34: "pagedown",
      35: "end",
      36: "home",
      37: "left",
      38: "up",
      39: "right",
      40: "down",
      45: "insert",
      46: "del",
      59: ";",
      61: "=",
      96: "0",
      97: "1",
      98: "2",
      99: "3",
      100: "4",
      101: "5",
      102: "6",
      103: "7",
      104: "8",
      105: "9",
      106: "*",
      107: "+",
      109: "-",
      110: ".",
      111: "/",
      112: "f1",
      113: "f2",
      114: "f3",
      115: "f4",
      116: "f5",
      117: "f6",
      118: "f7",
      119: "f8",
      120: "f9",
      121: "f10",
      122: "f11",
      123: "f12",
      144: "numlock",
      145: "scroll",
      173: "-",
      186: ";",
      187: "=",
      188: ",",
      189: "-",
      190: ".",
      191: "/",
      192: "`",
      219: "[",
      220: "\\",
      221: "]",
      222: "'"
    },

    shiftNums: {
      "`": "~",
      "1": "!",
      "2": "@",
      "3": "#",
      "4": "$",
      "5": "%",
      "6": "^",
      "7": "&",
      "8": "*",
      "9": "(",
      "0": ")",
      "-": "_",
      "=": "+",
      ";": ": ",
      "'": "\"",
      ",": "<",
      ".": ">",
      "/": "?",
      "\\": "|"
    },

    // excludes: button, checkbox, file, hidden, image, password, radio, reset, search, submit, url
    textAcceptingInputTypes: [
      "text", "password", "number", "email", "url", "range", "date", "month", "week", "time", "datetime",
      "datetime-local", "search", "color", "tel"],

    // default input types not to bind to unless bound directly
    textInputTypes: /textarea|input|select/i,

    options: {
      filterInputAcceptingElements: true,
      filterTextInputs: true,
      filterContentEditable: true
    }
  };

  function keyHandler(handleObj) {
    if (typeof handleObj.data === "string") {
      handleObj.data = {
        keys: handleObj.data
      };
    }

    // Only care when a possible input has been specified
    if (!handleObj.data || !handleObj.data.keys || typeof handleObj.data.keys !== "string") {
      return;
    }

    var origHandler = handleObj.handler,
      keys = handleObj.data.keys.toLowerCase().split(" ");

    handleObj.handler = function(event) {
      //      Don't fire in text-accepting inputs that we didn't directly bind to
      if (this !== event.target &&
        (jQuery.hotkeys.options.filterInputAcceptingElements &&
          jQuery.hotkeys.textInputTypes.test(event.target.nodeName) ||
          (jQuery.hotkeys.options.filterContentEditable && jQuery(event.target).attr('contenteditable')) ||
          (jQuery.hotkeys.options.filterTextInputs &&
            jQuery.inArray(event.target.type, jQuery.hotkeys.textAcceptingInputTypes) > -1))) {
        return;
      }

      var special = event.type !== "keypress" && jQuery.hotkeys.specialKeys[event.which],
        character = String.fromCharCode(event.which).toLowerCase(),
        modif = "",
        possible = {};

      jQuery.each(["alt", "ctrl", "shift"], function(index, specialKey) {

        if (event[specialKey + 'Key'] && special !== specialKey) {
          modif += specialKey + '+';
        }
      });

      // metaKey is triggered off ctrlKey erronously
      if (event.metaKey && !event.ctrlKey && special !== "meta") {
        modif += "meta+";
      }

      if (event.metaKey && special !== "meta" && modif.indexOf("alt+ctrl+shift+") > -1) {
        modif = modif.replace("alt+ctrl+shift+", "hyper+");
      }

      if (special) {
        possible[modif + special] = true;
      }
      else {
        possible[modif + character] = true;
        possible[modif + jQuery.hotkeys.shiftNums[character]] = true;

        // "$" can be triggered as "Shift+4" or "Shift+$" or just "$"
        if (modif === "shift+") {
          possible[jQuery.hotkeys.shiftNums[character]] = true;
        }
      }

      for (var i = 0, l = keys.length; i < l; i++) {
        if (possible[keys[i]]) {
          return origHandler.apply(this, arguments);
        }
      }
    };
  }

  jQuery.each(["keydown", "keyup", "keypress"], function() {
    jQuery.event.special[this] = {
      add: keyHandler
    };
  });

})(jQuery || undefined.jQuery || window.jQuery);

const hotkeys = new HotkeysManager(); // Export relevant objects

jquery.fn.bounded = function (options) {
  underscore.each(this, element => {
    const boundedInstance = jquery(element).data('boundedInstance');

    if (options === 'destroy' && boundedInstance) {
      jquery(element).removeData('boundedInstance');
      boundedInstance.destroy();
    } else {
      if (boundedInstance) {
        boundedInstance.options(options);
      } else {
        jquery(element).data('boundedInstance', new Bounded(element, options));
      }
    }
  });

  return this;
};
/**
 * This class makes an element bounded to other element's borders.
 */


class Bounded {
  // Initialize the instance with the given element and options
  constructor(element, options = {}) {
    this.element = element;
    this.$element = jquery(element);
    this.options(options);
    this.setBoundedFlag(false); // Force to hardware acceleration to move element if browser supports translate property

    this.useTransform = ohif_core.OHIF.ui.styleProperty.check('transform', 'translate(1px, 1px)');
  } // Set or change the instance options


  options(options = {}) {
    // Process the given options and store it in the instance
    const {
      boundingElement,
      positionElement,
      dimensionElement,
      allowResizing
    } = options;
    this.positionElement = positionElement || this.element;
    this.$positionElement = jquery(this.positionElement);
    this.dimensionElement = dimensionElement || this.element;
    this.$dimensionElement = jquery(this.dimensionElement);
    this.boundingElement = boundingElement;
    this.$boundingElement = jquery(this.boundingElement);
    this.allowResizing = allowResizing; // Check for fixed positioning

    if (this.$positionElement.css('position') === 'fixed') {
      this.boundingElement = window;
    } // Destroy and initialize again the instance


    this.destroy();
    this.init();
  } // Initialize the bounding behaviour


  init() {
    // Create the event handlers
    this.defineEventHandlers(); // Attach the created event handlers to the component

    this.attachEventHandlers(); // Add the bounded class to the element

    this.$element.addClass('bounded'); // Handle the positioning on window resize

    const $window = jquery(window);

    const windowResizeHandler = () => {
      // Check if the element is still in DOM and remove the handler if it is not
      if (!this.$element.closest(document.documentElement).length) {
        $window.off('resize', windowResizeHandler);
      }

      this.$element.trigger('spatialChanged');
    };

    $window.on('resize', windowResizeHandler); // Trigger the bounding check for the first timepoint

    setTimeout(() => this.$element.trigger('spatialChanged'));
  } // Destroy this instance, returning the element to its previous state


  destroy() {
    // Detach the event handlers
    this.detachEventHandlers(); // Remove the bounded class from the element

    this.$element.removeClass('bounded');
  }

  static spatialInfo(positionElement, dimensionElement) {
    // Create the result object
    const result = {}; // Check if the element is the window

    if (!dimensionElement || dimensionElement === window) {
      const $window = jquery(window);
      const width = $window.outerWidth();
      const height = $window.outerHeight();
      return {
        width,
        height,
        x0: 0,
        y0: 0,
        x1: width,
        y1: height
      };
    } // Get the jQuery object for the elements


    const $dimensionElement = jquery(dimensionElement);
    const $positionElement = jquery(positionElement); // Get the integer numbers for element's width

    result.width = $dimensionElement.outerWidth(); // Get the integer numbers for element's height

    result.height = $dimensionElement.outerHeight(); // Get the position property based on the element position CSS attribute

    const elementPosition = $positionElement.css('position');
    const positionProperty = elementPosition === 'fixed' ? 'position' : 'offset'; // Get the element's start position

    const position = $positionElement[positionProperty]();
    result.x0 = position.left;
    result.y0 = position.top; // Get the element's end position

    result.x1 = result.x0 + result.width;
    result.y1 = result.y0 + result.height; // Return the result object

    return result;
  } // Define the event handlers for this class


  defineEventHandlers() {
    this.cssPositionHandler = (elementInfo, boundingInfo) => {
      // Fix element's x positioning and width
      if (this.allowResizing && elementInfo.width > boundingInfo.width) {
        this.$dimensionElement.width(boundingInfo.width);
        this.$positionElement.css('left', boundingInfo.x0);
        this.setBoundedFlag(true);
      } else if (elementInfo.x0 < boundingInfo.x0) {
        this.$positionElement.css('left', boundingInfo.x0);
        this.setBoundedFlag(true);
      } else if (elementInfo.x1 > boundingInfo.x1) {
        this.$positionElement.css('left', boundingInfo.x1 - elementInfo.width);
        this.setBoundedFlag(true);
      } // Fix element's y positioning and height


      if (this.allowResizing && elementInfo.height > boundingInfo.height) {
        this.$dimensionElement.height(boundingInfo.height);
        this.$positionElement.css('top', boundingInfo.y0);
        this.setBoundedFlag(true);
      } else if (elementInfo.y0 < boundingInfo.y0) {
        this.$positionElement.css('top', boundingInfo.y0);
        this.setBoundedFlag(true);
      } else if (elementInfo.y1 > boundingInfo.y1) {
        this.$positionElement.css('top', boundingInfo.y1 - elementInfo.height);
        this.setBoundedFlag(true);
      }
    };

    this.getCSSTranslate = () => {
      const matrixToArray = str => str.match(/(-?[0-9\.]+)/g);

      const transformMatrix = matrixToArray(this.$positionElement.css('transform')) || [];
      return {
        x: parseFloat(transformMatrix[4]) || 0,
        y: parseFloat(transformMatrix[5]) || 0
      };
    };

    this.cssTransformHandler = (elementInfo, boundingInfo, translate) => {
      if (elementInfo.x1 > boundingInfo.x1) {
        translate.x -= elementInfo.x1 - boundingInfo.x1;
      }

      if (elementInfo.y1 > boundingInfo.y1) {
        translate.y -= elementInfo.y1 - boundingInfo.y1;
      }

      if (elementInfo.x0 < boundingInfo.x0) {
        translate.x += boundingInfo.x0 - elementInfo.x0;
      }

      if (elementInfo.y0 < boundingInfo.y0) {
        translate.y += boundingInfo.y0 - elementInfo.y0;
      }

      const translation = `translate(${translate.x}px, ${translate.y}px)`;
      ohif_core.OHIF.ui.styleProperty.set(this.positionElement, 'transform', translation);
    };

    this.spatialChangedHandler = event => {
      // Get the spatial information for element and its bounding element
      const {
        positionElement,
        dimensionElement,
        boundingElement,
        useTransform
      } = this;
      const elementInfo = Bounded.spatialInfo(positionElement, dimensionElement);
      const boundingInfo = Bounded.spatialInfo(boundingElement, boundingElement); // Check if CSS positioning or transform will be used

      const translate = this.getCSSTranslate();

      if (useTransform && (translate.x || translate.y)) {
        this.cssTransformHandler(elementInfo, boundingInfo, translate);
      } else {
        this.cssPositionHandler(elementInfo, boundingInfo);
      }
    };
  } // Attach the event handlers to the element in order to bound it


  attachEventHandlers() {
    this.$element.on('spatialChanged', this.spatialChangedHandler);
    this.$boundingElement.on('resize', this.spatialChangedHandler);
  } // Detach the event handlers from the element


  detachEventHandlers() {
    this.$element.off('spatialChanged', this.spatialChangedHandler);
    this.$boundingElement.off('resize', this.spatialChangedHandler);
  } // This is a means to let outside world know that the element in question has been moved


  setBoundedFlag(value) {
    this.$element.data('wasBounded', value);
  }

}

ohif_core.OHIF.ui.Bounded = Bounded;

jquery.fn.tempShow = function (callback) {
  const elementsToHide = [];
  let current = this; // Temporarily show all parent invisible elements until body

  while (this.is(':hidden')) {
    const $element = jquery(current);

    if (!$element.length || $element.is(':visible')) {
      break;
    }

    $element.addClass('visible');
    elementsToHide.push(current);
    current = $element[0].parentElement;
  }

  if (typeof callback === 'function') {
    callback(this);
  }

  jquery(elementsToHide).removeClass('visible');
  return this;
}; // Adjust the max width/height to enable CSS3 transitions


jquery.fn.adjustMax = function (dimension, modifierFn) {
  const $element = jquery(this); // Temporarily make the element visible to allow getting its dimensions

  $element.tempShow(() => {
    const maxProperty = `max-${dimension}`; // Remove the current max restriction

    $element.each((i, e) => e.style.setProperty(maxProperty, 'none', 'important')); // Get the dimension function to obtain the outer dimension

    const dimensionFn = 'outer' + dimension.charAt(0).toUpperCase() + dimension.slice(1);
    const value = $element[dimensionFn](); // Remove the property (needed for IE)

    $element.each((i, e) => e.style.removeProperty(maxProperty)); // Set the new max restriction

    $element.css(maxProperty, value);
  });
};

let zIndexBackdrop = 1060;
let zIndexModal = 1061;

ohif_core.OHIF.ui.showDialog = (templateName, dialogData = {}) => {
  // Check if the given template exists
  const template = templating.Template[templateName];

  if (!template) {
    throw {
      name: 'TEMPLATE_NOT_FOUND',
      message: `Template ${templateName} not found.`
    };
  }

  let promise;
  let templateData;

  if (dialogData && dialogData.promise instanceof Promise) {
    // Use the given promise to control the modal
    promise = dialogData.promise;
    templateData = dialogData;
  } else {
    // Create a new promise to control the modal and store its resolve and reject callbacks
    let promiseResolve;
    let promiseReject;
    promise = new Promise((resolve, reject) => {
      promiseResolve = resolve;
      promiseReject = reject;
    }); // Render the dialog with the given template passing the promise object and callbacks

    templateData = underscore.extend({}, dialogData, {
      promise,
      promiseResolve,
      promiseReject
    });
  }

  const view = blaze.Blaze.renderWithData(template, templateData, document.body);
  const node = view.firstNode();
  const $node = node && jquery(node);
  let $modal;

  if ($node && $node.hasClass('modal')) {
    $modal = $node;
  } else if ($node && $node.has('.modal')) {
    $modal = $node.find('.modal:first');
  }

  $modal.one('show.bs.modal', function () {
    setTimeout(() => {
      const $modal = jquery(this);
      const modal = $modal.data('bs.modal');
      if (!modal) return;
      const {
        $backdrop
      } = modal;
      if (!$backdrop) return;
      $backdrop.css('z-index', zIndexBackdrop);
      $modal.css('z-index', zIndexModal);
      zIndexBackdrop += 2;
      zIndexModal += 2;
    });
  }); // Destroy the created dialog view when the promise is either resolved or rejected

  const dismissModal = (hideFirst = false) => {
    if (hideFirst || dialogData && dialogData.promise && $modal) {
      $modal.one('hidden.bs.modal', () => blaze.Blaze.remove(view)).modal('hide');
    } else {
      blaze.Blaze.remove(view);
    }
  }; // Create a handler to dismiss the modal on navigation


  const $body = jquery(document.body);

  const navigationHandler = () => {
    dismissModal(true);
    $body.off('ohif.navigated', navigationHandler);
  };

  promise.then(() => dismissModal(false)).catch(() => dismissModal(false)); // Dismiss the modal if navigation occurs and it should not be kept opened

  if (!dialogData.keepOpenOnNavigation) {
    $body.on('ohif.navigated', navigationHandler);
  } // Return the promise to allow callbacks stacking from outside


  return promise;
};

ohif_core.OHIF.ui.repositionDialog = ($modal, x, y) => {
  const $dialog = $modal.find('.modal-dialog'); // Remove the margins and set its position as fixed

  $dialog.css({
    margin: 0,
    position: 'fixed'
  }).bounded(); // Temporarily show the modal

  const isVisible = $modal.is(':visible');
  $modal.show(); // Calculate the center position on screen

  const height = $dialog.outerHeight();
  const width = $dialog.outerWidth();
  const left = parseInt(x - width / 2);
  const top = parseInt(y - height / 2); // Reposition the modal and readjust it to the window boundaries if needed

  $dialog.css({
    left,
    top
  }).trigger('spatialChanged').one('transitionend', () => $dialog.trigger('spatialChanged')); // Switch the modal to its previous visibility state

  $modal.toggle(isVisible);
};

ohif_core.OHIF.ui.unsavedChangesDialog = function (callback, options) {
  // Render the dialog with the given template passing the promise object and callbacks
  const templateData = underscore.extend({}, options, {
    callback: callback
  });

  blaze.Blaze.renderWithData(templating.Template.unsavedChangesDialog, templateData, document.body);
};

$.fn.draggable = function (options) {
  makeDraggable(this, options);
  return this;
};
/**
 * This function makes an element movable around the page.
 * It supports mouse and touch input and allows whichever element
 * is specified to be moved to any arbitrary position.
 *
 * @param element
 */


function makeDraggable(element, options = {}) {
  const $element = element;
  const $document = $(document);
  const $body = $(document.body); // Force to hardware acceleration to move element if browser supports translate property

  const {
    styleProperty
  } = ohif_core.OHIF.ui;
  const useTransform = styleProperty.check('transform', 'translate(1px, 1px)');
  const $container = $(options.container || window);
  let diffX;
  let diffY;
  let wasNotDragged = true;
  let dragging = false;
  let lastCursor, lastOffset;
  let lastTranslateX = 0;
  let lastTranslateY = 0;
  let initialCursor; // initialize dragged flag

  $element.data('wasDragged', false);

  function matrixToArray(str) {
    return str.match(/(-?[0-9\.]+)/g);
  }

  function getCursorCoords(e) {
    const cursor = {
      x: e.clientX,
      y: e.clientY
    }; // Handle touchMove cases

    if (cursor.x === undefined) {
      cursor.x = e.originalEvent.touches[0].pageX;
    }

    if (cursor.y === undefined) {
      cursor.y = e.originalEvent.touches[0].pageY;
    }

    return cursor;
  }

  function reposition(elementLeft, elementTop) {
    if (useTransform) {
      const translation = `translate(${elementLeft}px, ${elementTop}px)`;
      styleProperty.set($element[0], 'transform', translation);
    } else {
      $element.css({
        left: elementLeft + 'px',
        top: elementTop + 'px',
        bottom: 'auto',
        // Setting these to empty doesn't seem to work in Firefox or Safari
        right: 'auto'
      });
    }
  }

  function startMoving(e) {
    // Prevent dragging dialog by clicking on slider
    // (could be extended for buttons, not sure it's necessary
    if (e.target.type && e.target.type === 'range') {
      return;
    } // Stop the dragging if it's not the primary button


    if (e.button !== 0) return; // Stop the dragging if the element is being resized

    if ($element.hasClass('resizing')) {
      return;
    }

    let elementLeft = parseFloat($element.offset().left);
    let elementTop = parseFloat($element.offset().top);
    const cursor = getCursorCoords(e);

    if (useTransform) {
      lastCursor = cursor;
      lastOffset = $element.offset();
      const transformMatrix = matrixToArray($element.css('transform')) || [];
      lastTranslateX = parseFloat(transformMatrix[4]) || 0;
      lastTranslateY = parseFloat(transformMatrix[5]) || 0;
      elementLeft = lastTranslateX;
      elementTop = lastTranslateY;
    } else {
      diffX = cursor.x - elementLeft;
      diffY = cursor.y - elementTop;
    }

    reposition(elementLeft, elementTop);
    $document.on('mousemove', moveHandler);
    $document.on('mouseup', stopMoving);
    $document.on('touchmove', moveHandler);
    $document.on('touchend', stopMoving);
  }

  function stopMoving() {
    $body.css('cursor', '');
    $container.css('cursor', '');
    $element.css('cursor', '');

    if (dragging) {
      setTimeout(() => $element.removeClass('dragging'));
      dragging = false;
    }

    $document.off('mousemove', moveHandler);
    $document.off('touchmove', moveHandler);
  }

  function moveHandler(e) {
    if (!dragging) {
      $body.css('cursor', 'move');
      $container.css('cursor', 'move');
      $element.css('cursor', 'move');
      $element.addClass('dragging');
      dragging = true;
    } // let outside world know that the element in question has been dragged


    if (wasNotDragged) {
      $element.data('wasDragged', true);
      wasNotDragged = false;
    } // Prevent dialog box dragging whole page in iOS


    e.preventDefault();
    const elementWidth = parseFloat($element.outerWidth());
    const elementHeight = parseFloat($element.outerHeight());
    const containerWidth = parseFloat($container.width());
    const containerHeight = parseFloat($container.height());
    const cursor = getCursorCoords(e);
    let elementLeft, elementTop;

    if (useTransform) {
      elementLeft = lastTranslateX - (lastCursor.x - cursor.x);
      elementTop = lastTranslateY - (lastCursor.y - cursor.y);
      const limitX = containerWidth - elementWidth;
      const limitY = containerHeight - elementHeight;
      const sumX = lastOffset.left + (elementLeft - lastTranslateX);
      const sumY = lastOffset.top + (elementTop - lastTranslateY);

      if (sumX > limitX) {
        elementLeft -= sumX - limitX;
      }

      if (sumY > limitY) {
        elementTop -= sumY - limitY;
      }

      if (sumX < 0) {
        elementLeft += 0 - sumX;
      }

      if (sumY < 0) {
        elementTop += 0 - sumY;
      }
    } else {
      elementLeft = cursor.x - diffX;
      elementTop = cursor.y - diffY;
      elementLeft = Math.max(elementLeft, 0);
      elementTop = Math.max(elementTop, 0);

      if (elementLeft + elementWidth > containerWidth) {
        elementLeft = containerWidth - elementWidth;
      }

      if (elementTop + elementHeight > containerHeight) {
        elementTop = containerHeight - elementHeight;
      }
    }

    reposition(elementLeft, elementTop);
  }

  function mouseDownHandler(e) {
    initialCursor = getCursorCoords(e);
    $document.on('mousemove', moveDetectHandler);
    $document.on('touchmove', moveDetectHandler);
  }

  function mouseUpHandler() {
    $document.off('mousemove', moveDetectHandler);
    $document.off('touchmove', moveDetectHandler);
  }

  function moveDetectHandler(e) {
    const currentCursor = getCursorCoords(e);
    const c1 = initialCursor;
    const c2 = currentCursor;
    const distance = Math.hypot(c2.x - c1.x, c2.y - c1.y);

    if (distance > 5) {
      mouseUpHandler();
      startMoving(e);
    }
  }

  $element.on('mousedown', mouseDownHandler);
  $element.on('touchstart', mouseDownHandler);
  $element.on('mouseup', mouseUpHandler);
  $element.on('touchend', mouseUpHandler);
}

ohif_core.OHIF.ui.showDropdown = (items = [], options = {}) => {
  let promiseResolve;
  let promiseReject;
  const promise = new Promise((resolve, reject) => {
    promiseResolve = resolve;
    promiseReject = reject;
  }); // Prepare the method to destroy the view

  let view;

  const destroyView = () => blaze.Blaze.remove(view); // Create the data object that the dropdown will receive


  const templateData = {
    items,
    options,
    destroyView,
    promise,
    promiseResolve,
    promiseReject
  }; // Render the dialog with the given template and data

  const parentElement = options.parentElement || document.body;
  view = blaze.Blaze.renderWithData(templating.Template.dropdownForm, templateData, parentElement); // Create a handler to dismiss the dropdown on navigation

  const $body = $(document.body);

  const navigationHandler = () => {
    promiseReject();
    $body.off('ohif.navigated', navigationHandler);
  }; // Dismiss the dropdown if navigation occurs


  $body.on('ohif.navigated', navigationHandler); // Return the promise to allow callbacks stacking from outside

  return promise;
};

const Notifications = {
  currentId: 0,
  views: new Map()
}; // Remove the view object from DOM and from views Map

const removeView = (id, view) => {
  Notifications.views.delete(id);
  blaze.Blaze.remove(view);
}; // Dismiss a single notification note by its id


Notifications.dismiss = id => {
  const view = Notifications.views.get(id);

  if (!view || view.isDestroyed) {
    return Notifications.views.delete(id);
  }

  const node = view.firstNode();
  const $note = node && jquery(node);

  if ($note.length) {
    $note.addClass('out').one('transitionend', () => removeView(id, view));
  } else {
    removeView(id, view);
  }
}; // Dismiss all notification notes


Notifications.clear = () => Array.from(Notifications.views.keys()).forEach(Notifications.dismiss); // Display a notification note


Notifications.show = ({
  template,
  data,
  text,
  style,
  timeout = 5000,
  promise
}) => {
  // Check if the given template exists
  const templateObject = templating.Template[template];

  if (template && !templateObject) {
    throw new meteor.Meteor.Error('TEMPLATE_NOT_FOUND', `Template ${template} not found.`);
  } // Check if there is a notification area container


  const $area = jquery('#notificationArea');

  if (!$area.length) {
    throw new meteor.Meteor.Error('NOTIFICATION_AREA_NOT_FOUND', `Notification area not found.`);
  }

  let notificationPromise;
  let templateData = {
    template,
    data,
    text,
    style,
    timeout,
    id: Notifications.currentId++
  };

  if (promise instanceof Promise) {
    // Use the given promise to control the notification
    notificationPromise = templateData.promise = promise;
  } else {
    // Create a new promise to control the modal and store its resolve and reject callbacks
    let promiseResolve;
    let promiseReject;
    notificationPromise = new Promise((resolve, reject) => {
      promiseResolve = resolve;
      promiseReject = reject;
    }); // Render the notification passing the promise object and callbacks

    underscore.extend({}, templateData, {
      promise: notificationPromise,
      promiseResolve,
      promiseReject
    });
  }

  const view = blaze.Blaze.renderWithData(templating.Template.notificationNote, templateData, $area[0]);

  const dismissNotification = () => Notifications.dismiss(templateData.id); // Add the current view to the list of views to allow clearing all notifications


  Notifications.views.set(templateData.id, view); // Destroy the created notification view when the promise is either resolved or rejected

  notificationPromise.then(dismissNotification).catch(dismissNotification); // Destroy the created notification view if the given timeout time has passed

  if (timeout > 0) {
    meteor.Meteor.setTimeout(() => {
      if (templateData.promiseResolve) {
        templateData.promiseResolve();
      } else {
        dismissNotification();
      }
    }, timeout);
  } // Return the promise to allow callbacks stacking from outside


  return notificationPromise;
};

Notifications.info = o => Notifications.show(Object.assign({}, o, {
  style: 'info'
}));

Notifications.success = o => Notifications.show(Object.assign({}, o, {
  style: 'success'
}));

Notifications.warning = o => Notifications.show(Object.assign({}, o, {
  style: 'warning'
}));

Notifications.danger = o => Notifications.show(Object.assign({}, o, {
  style: 'danger'
}));

ohif_core.OHIF.ui.notifications = Notifications;

ohif_core.OHIF.ui.showPopover = (templateName, popoverData, options = {}) => {
  // Check if the given template exists
  const template = templating.Template[templateName];

  if (!template) {
    throw {
      name: 'TEMPLATE_NOT_FOUND',
      message: `Template ${templateName} not found.`
    };
  }

  let promise;
  let templateData;

  if (popoverData && popoverData.promise instanceof Promise) {
    // Use the given promise to control the modal
    promise = popoverData.promise;
    templateData = popoverData;
  } else {
    // Create a new promise to control the modal and store its resolve and reject callbacks
    let promiseResolve;
    let promiseReject;
    promise = new Promise((resolve, reject) => {
      promiseResolve = resolve;
      promiseReject = reject;
    }); // Render the dialog with the given template passing the promise object and callbacks

    templateData = Object.assign({}, popoverData, {
      promise,
      promiseResolve,
      promiseReject
    });
  }

  const {
    element,
    event
  } = options;
  const $element = $(element || event.currentTarget);
  const defaults = {
    content: '',
    html: true,
    trigger: 'manual',
    placement: 'auto',
    delay: {
      show: 300,
      hide: 300
    }
  };
  const popoverOptions = Object.assign({}, defaults, options);
  popoverOptions.content = blaze.Blaze.toHTMLWithData(template, popoverData);

  if (popoverOptions.hideOnClick) {
    $element.click(function () {
      $(this).popover('hide');
    });
  }

  $element.popover(popoverOptions);

  if (popoverOptions.trigger !== 'hover') {
    $element.one('shown.bs.popover', function (event) {
      const popoverId = $element.attr('aria-describedby');
      const popover = document.getElementById(popoverId);
      const $popover = $(popover);
      const $popoverContent = $popover.find('.popover-content');

      const dismissPopover = () => $element.popover('hide');

      $popoverContent.html('');
      const view = blaze.Blaze.renderWithData(template, templateData, $popoverContent[0]);
      $element.one('hidden.bs.popover', () => {
        blaze.Blaze.remove(view);
        $element.popover('destroy');
      });
      promise.then(dismissPopover).catch(dismissPopover);
    });
  }

  if (popoverOptions.trigger === 'manual') {
    $element.popover('show');
  }

  return promise;
};

$.fn.resizable = function (options) {
  underscore.each(this, element => {
    const resizableInstance = $(element).data('resizableInstance');

    if (options === 'destroy' && resizableInstance) {
      $(element).removeData('resizableInstance');
      resizableInstance.destroy();
    } else {
      if (resizableInstance) {
        resizableInstance.options(options);
      } else {
        $(element).data('resizableInstance', new Resizable(element, options));
      }
    }
  });

  return this;
};
/**
 * This class makes an element resizable.
 */


class Resizable {
  constructor(element, options = {}) {
    this.element = element;
    this.$element = $(element);
    this.options(options);
  }

  options(options = {}) {
    const {
      boundSize,
      minWidth,
      minHeight
    } = options;
    this.minWidth = minWidth || this.$element.width() || 16;
    this.minHeight = minHeight || this.$element.height() || 16;
    this.boundSize = boundSize || 8;
    this.destroy();
    this.init();
  }

  init() {
    this.defineEventHandlers();

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        this.createBound(x, y);
      }
    }

    this.$element.addClass('resizable');
  }

  destroy() {
    // Remove the instance added classes
    this.$element.removeClass('resizable resizing'); // Get the bound borders

    const $bound = this.$element.find('resize-bound'); // Remove the bound borders

    $bound.remove(); // Detach the event handlers

    this.detachEventHandlers($bound);
  }

  defineEventHandlers() {
    this.initResizeHandler = event => {
      const $window = $(window);
      this.width = this.initialWidth = this.$element.width();
      this.height = this.initialHeight = this.$element.height();
      this.startWidth = this.width;
      this.startHeight = this.height;
      this.posX = parseInt(this.$element.css('left'));
      this.posY = parseInt(this.$element.css('top'));
      this.startPosX = this.posX;
      this.startPosY = this.posY;
      this.startX = event.clientX;
      this.startY = event.clientY;
      this.$element.addClass('resizing');
      $window.on('mousemove', event.data, this.resizeHandler);
      $window.on('mouseup', event.data, this.endResizeHandler);
    };

    this.resizeHandler = event => {
      const {
        xDirection,
        yDirection
      } = event.data;
      let x, y;
      x = event.clientX < 0 ? 0 : event.clientX;
      x = x > window.innerWidth ? window.innerWidth : x;
      y = event.clientY < 0 ? 0 : event.clientY;
      y = y > window.innerHeight ? window.innerHeight : y;
      const xDistance = (x - this.startX) * xDirection;
      const yDistance = (y - this.startY) * yDirection;
      const width = xDistance + this.startWidth;
      const height = yDistance + this.startHeight;
      this.width = width < this.minWidth ? this.minWidth : width;
      this.height = height < this.minHeight ? this.minHeight : height;
      this.$element.width(this.width);
      this.$element.height(this.height);

      if (xDirection < 0) {
        this.posX = this.startPosX - xDistance;

        if (width < this.minWidth) {
          this.posX = this.startPosX + (this.startWidth - this.minWidth);
        }

        this.$element.css('left', `${this.posX}px`);
      }

      if (yDirection < 0) {
        this.posY = this.startPosY - yDistance;

        if (height < this.minHeight) {
          this.posY = this.startPosY + (this.startHeight - this.minHeight);
        }

        this.$element.css('top', `${this.posY}px`);
      }
    };

    this.endResizeHandler = event => {
      const $window = $(window);
      $window.off('mousemove', this.resizeHandler);
      $window.off('mouseup', this.endResizeHandler);
      this.$element.removeClass('resizing'); // Let the listeners know that this element was resized

      this.$element.trigger('resize');
    };
  }

  attachEventHandlers($bound, xDirection, yDirection) {
    const eventData = {
      xDirection,
      yDirection
    };
    $bound.on('mousedown', eventData, this.initResizeHandler);
  }

  detachEventHandlers($bound) {
    const $window = $(window);
    $bound.off('mousedown', this.initResizeHandler);
    $window.off('mousemove', this.resizeHandler);
    $window.off('mouseup', this.endResizeHandler);
  }

  createBound(xDirection, yDirection) {
    if (xDirection === 0 && xDirection === yDirection) {
      return;
    }

    const $bound = $('<div class="resize-bound"></div>');

    $bound[0].onselectstart = () => false;

    $bound.css('font-size', `${this.boundSize}px`);
    const mapX = ['left', 'center', 'right'];
    const mapY = ['top', 'middle', 'bottom'];
    $bound.addClass('bound-' + mapX[xDirection + 1]);
    $bound.addClass('bound-' + mapY[yDirection + 1]);
    $bound.appendTo(this.$element);
    this.attachEventHandlers($bound, xDirection, yDirection);
  }

}

ohif_core.OHIF.ui.Resizable = Resizable;

const FUNCTION = 'function';
const STRING$1 = 'string';
const UNDEFINED = 'undefined';
const WILDCARD = '*'; // "*" is a special name which means "all children".

const SEPARATOR = '.';
/**
 * Main Namespace Component Class
 */

class Node {
  constructor() {
    this.value = 0;
    this.children = {};
    this.handlers = {};
  }

  getPathComponents(path) {
    return typeof path === STRING$1 ? path.split(SEPARATOR) : null;
  }

  getNodeUpToIndex(path, index) {
    let node = this;

    for (let i = 0; i < index; ++i) {
      let item = path[i];

      if (node.children.hasOwnProperty(item)) {
        node = node.children[item];
      } else {
        node = null;
        break;
      }
    }

    return node;
  }

  append(name, value) {
    const children = this.children;
    let node = null;

    if (children.hasOwnProperty(name)) {
      node = children[name];
    } else if (typeof name === STRING$1 && name !== WILDCARD) {
      node = new Node();
      children[name] = node;
    }

    if (node !== null) {
      node.value += value > 0 ? parseInt(value) : 0;
    }

    return node;
  }

  probe(recursively) {
    let value = this.value; // Calculate entire tree value recursively?

    if (recursively === true) {
      const children = this.children;

      for (let item in children) {
        if (children.hasOwnProperty(item)) {
          value += children[item].probe(recursively);
        }
      }
    }

    return value;
  }

  clear(recursively) {
    this.value = 0; // Clear entire tree recursively?

    if (recursively === true) {
      const children = this.children;

      for (let item in children) {
        if (children.hasOwnProperty(item)) {
          children[item].clear(recursively);
        }
      }
    }
  }

  appendPath(path, value) {
    path = this.getPathComponents(path);

    if (path !== null) {
      const last = path.length - 1;
      let node = this;

      for (let i = 0; i < last; ++i) {
        node = node.append(path[i], 0);

        if (node === null) {
          return false;
        }
      }

      return node.append(path[last], value) !== null;
    }

    return false;
  }

  clearPath(path, recursively) {
    path = this.getPathComponents(path);

    if (path !== null) {
      const last = path.length - 1;
      let node = this.getNodeUpToIndex(path, last);

      if (node !== null) {
        let item = path[last];

        if (item !== WILDCARD) {
          if (node.children.hasOwnProperty(item)) {
            node.children[item].clear(recursively);
            return true;
          }
        } else {
          const children = node.children;

          for (item in children) {
            if (children.hasOwnProperty(item)) {
              children[item].clear(recursively);
            }
          }

          return true;
        }
      }
    }

    return false;
  }

  probePath(path, recursively) {
    path = this.getPathComponents(path);

    if (path !== null) {
      const last = path.length - 1;
      let node = this.getNodeUpToIndex(path, last);

      if (node !== null) {
        let item = path[last];

        if (item !== WILDCARD) {
          if (node.children.hasOwnProperty(item)) {
            return node.children[item].probe(recursively);
          }
        } else {
          const children = node.children;
          let value = 0;

          for (item in children) {
            if (children.hasOwnProperty(item)) {
              value += children[item].probe(recursively);
            }
          }

          return value;
        }
      }
    }

    return 0;
  }

  attachHandler(type, handler) {
    let result = false;

    if (typeof type === STRING$1 && typeof handler === FUNCTION) {
      const handlers = this.handlers;
      const list = handlers.hasOwnProperty(type) ? handlers[type] : handlers[type] = [];
      const length = list.length;
      let notFound = true;

      for (let i = 0; i < length; ++i) {
        if (handler === list[i]) {
          notFound = false;
          break;
        }
      }

      if (notFound) {
        list[length] = handler;
        result = true;
      }
    }

    return result;
  }

  removeHandler(type, handler) {
    let result = false;

    if (typeof type === STRING$1 && typeof handler === FUNCTION) {
      const handlers = this.handlers;

      if (handlers.hasOwnProperty(type)) {
        const list = handlers[type];
        const length = list.length;

        for (let i = 0; i < length; ++i) {
          if (handler === list[i]) {
            list.splice(i, 1);
            result = true;
            break;
          }
        }
      }
    }

    return result;
  }

  trigger(type, nonRecursively) {
    if (typeof type === STRING$1) {
      const handlers = this.handlers;

      if (handlers.hasOwnProperty(type)) {
        const list = handlers[type];
        const length = list.length;

        for (let i = 0; i < length; ++i) {
          list[i].call(null);
        }
      }

      if (nonRecursively !== true) {
        const children = this.children;

        for (let item in children) {
          if (children.hasOwnProperty(item)) {
            children[item].trigger(type);
          }
        }
      }
    }
  }

  attachHandlerForPath(path, type, handler) {
    path = this.getPathComponents(path);

    if (path !== null) {
      let node = this.getNodeUpToIndex(path, path.length);

      if (node !== null) {
        return node.attachHandler(type, handler);
      }
    }

    return false;
  }

  removeHandlerForPath(path, type, handler) {
    path = this.getPathComponents(path);

    if (path !== null) {
      let node = this.getNodeUpToIndex(path, path.length);

      if (node !== null) {
        return node.removeHandler(type, handler);
      }
    }

    return false;
  }

  triggerHandlersForPath(path, type, nonRecursively) {
    path = this.getPathComponents(path);

    if (path !== null) {
      let node = this.getNodeUpToIndex(path, path.length);

      if (node !== null) {
        node.trigger(type, nonRecursively);
      }
    }
  }

}
/**
 * Root Namespace Node and API
 */


const rootNode = new Node();
const unsavedChanges = {
  rootNode: rootNode,
  observer: new tracker.Tracker.Dependency(),
  hooks: new Map(),

  /**
   * Register a reactive dependency on every change any path suffers
   */
  depend: function () {
    return this.observer.depend();
  },

  /**
   * Signal an unsaved change for a given namespace.
   * @param {String} path A string (e.g., "viewer.studyViewer.measurements.targets") that identifies the namespace of the signaled changes.
   * @return {Boolean} Returns false if the signal could not be saved or the supplied namespace is invalid. Otherwise, true is returned.
   */
  set: function (path) {
    const result = rootNode.appendPath(path, 1);
    this.observer.changed();
    return result;
  },

  /**
   * Clear all signaled unsaved changes for a given namespace. If the supplied namespace is a wildcard, all signals below that namespace
   * are cleared.
   * @param {String} path A string that identifies the namespace of the signaled changes (e.g., "viewer.studyViewer.measurements.targets"
   *  for clearing the "targets" item of the "viewer.studyViewer.measurements" namespace or "viewer.studyViewer.*" to specify all signaled
   *  changes for the "viewer.studyViewer" namespace).
   * @param {Boolean} recursively Clear node and all its children recursively. If not specified defaults to true.
   * @return {Boolean} Returns false if the signal could not be removed or the supplied namespace is invalid. Otherwise, true is returned.
   */
  clear: function (path, recursively) {
    const result = rootNode.clearPath(path, typeof recursively === UNDEFINED ? true : recursively);
    this.observer.changed();
    return result;
  },

  /**
   * Count the amount of signaled unsaved changes for a given namespace. If the supplied namespace is a wildcard, all signals below that
   * namespace will also be accounted.
   * @param {String} path A string that identifies the namespace of the signaled changes (e.g., "viewer.studyViewer.measurements.targets"
   *  for counting the amount of signals for the "targets" item of the "viewer.studyViewer.measurements" namespace or "viewer.studyViewer.*"
   *  to count all signaled changes for the "viewer.studyViewer" namespace).
   * @param {Boolean} recursively Probe node and all its children recursively. If not specified defaults to true.
   * @return {Number} Returns the amount of signaled changes for a given namespace. If the supplied namespace is a wildcard, the sum of all
   *  changes for that namespace are returned.
   */
  probe: function (path, recursively) {
    return rootNode.probePath(path, typeof recursively === UNDEFINED ? true : recursively);
  },

  /**
   * Attach an event handler to the specified namespace.
   * @param {String} name A string that identifies the namespace to which the event handler will be attached (e.g.,
   *  "viewer.studyViewer.measurements" to attach an event handler for that namespace).
   * @param {String} type A string that identifies the event type to which the event handler will be attached.
   * @param {Function} handler The handler that will be executed when the specifed event is triggered.
   * @return {Boolean} Returns true on success and false on failure.
   */
  attachHandler: function (path, type, handler) {
    return rootNode.appendPath(path, 0) && rootNode.attachHandlerForPath(path, type, handler);
  },

  /**
   * Detach an event handler from the specified namespace.
   * @param {String} name A string that identifies the namespace from which the event handler will be detached (e.g.,
   *  "viewer.studyViewer.measurements" to remove an event handler from that namespace).
   * @param {String} type A string that identifies the event type to which the event handler was attached.
   * @param {Function} handler The handler that will be removed from execution list.
   * @return {Boolean} Returns true on success and false on failure.
   */
  removeHandler: function (path, type, handler) {
    return rootNode.removeHandlerForPath(path, type, handler);
  },

  /**
   * Trigger all event handlers for the specified namespace and type.
   * @param {String} name A string that identifies the namespace from which the event handler will be detached (e.g.,
   *  "viewer.studyViewer.measurements" to remove an event handler from that namespace).
   * @param {String} type A string that identifies the event type which will be triggered.
   * @param {Boolean} nonRecursively If set to true, prevents triggering event handlers from descending tree.
   * @return {Void} No value is returned.
   */
  trigger: function (path, type, nonRecursively) {
    rootNode.triggerHandlersForPath(path, type, nonRecursively);
  },

  /**
   * UI utility that presents a confirmation dialog to the user if any unsaved changes where signaled for the given namespace.
   * @param {String} path A string that identifies the namespace of the signaled changes (e.g., "viewer.studyViewer.measurements.targets"
   *  for considering only the signals for the "targets" item of the "viewer.studyViewer.measurements" namespace or "viewer.studyViewer.*"
   *  to consider all signaled changes for the "viewer.studyViewer" namespace).
   * @param {Function} callback A callback function (e.g, function(shouldProceed, hasChanges) { ... }) that will be executed after assessment.
   *  Upon execution, the callback will receive two boolean arguments (shouldProceed and hasChanges) indicating if the action can be performed
   *  or not and if changes that need to be cleared exist.
   * @param {Object} options (Optional) An object with UI presentation options.
   * @param {String} options.title The string that will be used as a title for confirmation dialog.
   * @param {String} options.message The string that will be used as a message for confirmation dialog.
   * @return {void} No value is returned.
   */
  checkBeforeAction: function (path, callback, options) {
    let probe, hasChanges, shouldProceed;

    if (typeof callback !== 'function') {
      // nothing to do if no callback function is supplied...
      return;
    }

    probe = this.probe(path);

    if (probe > 0) {
      // Unsaved changes exist...
      hasChanges = true;

      let dialogOptions = underscore.extend({
        title: 'You have unsaved changes!',
        message: "Your changes will be lost if you don't save them before leaving the current page... Are you sure you want to proceed?"
      }, options);

      ohif_core.OHIF.ui.showDialog('dialogConfirm', dialogOptions).then(function () {
        // Unsaved changes exist but user confirms action...
        shouldProceed = true;
        callback.call(null, shouldProceed, hasChanges);
      }, function () {
        // Unsaved changes exist and user does NOT confirm action...
        shouldProceed = false;
        callback.call(null, shouldProceed, hasChanges);
      });
    } else {
      // No unsaved changes, action can be performed...
      hasChanges = false;
      shouldProceed = true;
      callback.call(null, shouldProceed, hasChanges);
    }
  },

  /**
   * UI utility that presents a "proactive" dialog (with three options: stay, abandon-changes, save-changes) to the user if any unsaved changes where signaled for the given namespace.
   * @param {String} path A string that identifies the namespace of the signaled changes (e.g., "viewer.studyViewer.measurements.targets"
   *  for considering only the signals for the "targets" item of the "viewer.studyViewer.measurements" namespace or "viewer.studyViewer.*"
   *  to consider all signaled changes for the "viewer.studyViewer" namespace).
   * @param {Function} callback A callback function (e.g, function(hasChanges, userChoice) { ... }) that will be executed after assessment.
   *  Upon execution, the callback will receive two arguments: one boolean (hasChanges) indicating that unsaved changes exist and one string with the ID of the
   *  option picked by the user on the dialog ('abort-action', 'abandon-changes' and 'save-changes'). If no unsaved changes exist, the second argument is null.
   * @param {Object} options (Optional) An object with UI presentation options.
   * @param {Object} options.position An object with optimal position (e.g., { x: ..., y: ... }) for the dialog.
   * @return {void} No value is returned.
   */
  presentProactiveDialog: function (path, callback, options) {
    let probe, hasChanges;

    if (typeof callback !== 'function') {
      // nothing to do if no callback function is supplied...
      return;
    }

    probe = this.probe(path, true);

    if (probe > 0) {
      // Unsaved changes exist...
      hasChanges = true;
      ohif_core.OHIF.ui.unsavedChangesDialog(function (choice) {
        callback.call(null, hasChanges, choice);
      }, options);
    } else {
      // No unsaved changes, action can be performed...
      hasChanges = false;
      callback.call(null, hasChanges, null);
    }
  },

  addHook(saveCallback, options = {}) {
    underscore.defaults(options, {
      path: '*',
      message: 'There are unsaved changes'
    });

    this.hooks.set(saveCallback, options);
  },

  removeHook(saveCallback) {
    this.hooks.delete(saveCallback);
  },

  confirmNavigation(navigateCallback, event) {
    let dialogPresented = false;
    Array.from(this.hooks.keys()).every(saveCallback => {
      const options = this.hooks.get(saveCallback);
      const probe = this.probe(options.path, true);
      if (!probe) return true;
      const dialogOptions = Object.assign({
        class: 'themed'
      }, options);

      if (event) {
        dialogOptions.position = {
          x: event.clientX + 15,
          y: event.clientY + 15
        };
      }

      ohif_core.OHIF.ui.unsavedChanges.presentProactiveDialog(options.path, (hasChanges, userChoice) => {
        if (!hasChanges) return;

        const clear = () => this.clear(options.path, true);

        switch (userChoice) {
          case 'abort-action':
            return;

          case 'save-changes':
            const result = saveCallback();

            if (result instanceof Promise) {
              return result.then(() => {
                clear();
                this.confirmNavigation(navigateCallback, event);
              });
            }

            clear();
            return this.confirmNavigation(navigateCallback, event);

          case 'abandon-changes':
            clear();
            break;
        }

        navigateCallback();
      }, dialogOptions);
      dialogPresented = true;
      return false;
    });

    if (!dialogPresented) {
      navigateCallback();
    }
  }

};
ohif_core.OHIF.ui.unsavedChanges = unsavedChanges;

ohif_core.OHIF.ui.handleError = error => {
  let {
    title,
    message
  } = error;

  if (!title) {
    if (error instanceof meteor.Meteor.Error) {
      title = error.error;
    } else if (error instanceof Error) {
      title = error.name;
    }
  }

  if (!message) {
    if (error instanceof meteor.Meteor.Error) {
      message = error.reason;
    } else if (error instanceof Error) {
      message = error.message;
    }
  }

  const data = Object.assign({
    title,
    message,
    class: 'themed',
    hideConfirm: true,
    cancelLabel: 'Dismiss',
    cancelClass: 'btn-secondary'
  }, error || {});
  ohif_core.OHIF.log.error(error); // TODO: Find a better way to handle errors instead of displaying a dialog for all of them.
  // OHIF.ui.showDialog('dialogForm', data);
};

/*
 * https://github.com/swederik/dragula/blob/ccc15d75186f5168e7abadbe3077cf12dab09f8b/styleProperty.js
 */

(function () {

  const browserProps = {};

  function eachVendor(prop, fn) {
    const prefixes = ['Webkit', 'Moz', 'ms', 'O'];
    fn(prop);

    for (let i = 0; i < prefixes.length; i++) {
      fn(prefixes[i] + prop.charAt(0).toUpperCase() + prop.slice(1));
    }
  }

  function check$$1(property, testValue) {
    const sandbox = document.createElement('iframe');
    const element = document.createElement('p');
    document.body.appendChild(sandbox);
    sandbox.contentDocument.body.appendChild(element);
    const support = set(element, property, testValue); // We have to do this because remove() is not supported by IE11 and below

    sandbox.parentElement.removeChild(sandbox);
    return support;
  }

  function checkComputed(el, prop) {
    const computed = window.getComputedStyle(el).getPropertyValue(prop);
    return computed !== void 0 && computed.length > 0 && computed !== 'none';
  }

  function set(el, prop, value) {
    let match = false;

    if (browserProps[prop] === void 0) {
      eachVendor(prop, function (vendorProp) {
        if (el.style[vendorProp] !== void 0 && match === false) {
          el.style[vendorProp] = value;

          if (checkComputed(el, vendorProp)) {
            match = true;
            browserProps[prop] = vendorProp;
          }
        }
      });
    } else {
      el.style[browserProps[prop]] = value;
      return true;
    }

    return match;
  }

  const styleProperty = {
    check: check$$1,
    set
  };
  ohif_core.OHIF.ui.styleProperty = styleProperty;
})();

const {
  styleProperty
} = ohif_core.OHIF.ui;

/*
 * Defines the base OHIF header object
 */

const dropdown = new OHIF.ui.Dropdown();
const header = {
  dropdown
};

/*
 Extend the available options on schema definitions:

  * valuesLabels: Used in conjunction with allowedValues to define the text
    label for each value (used on forms)

  * textOptional: Used to allow empty strings

 */

/*SimpleSchema.extendOptions({
    valuesLabels: Match.Optional([String]),
    textOptional: Match.Optional(Boolean)
});

// Add default required validation for empty strings which can be bypassed
// using textOptional=true definition
SimpleSchema.addValidator(function() {
    if (
        this.definition.optional !== true &&
        this.definition.textOptional !== true &&
        this.value === ''
    ) {
        return 'required';
    }
});*/
// Including [label] for some messages

/*SimpleSchema.messages({
    maxCount: '[label] can not have more than [maxCount] values',
    minCount: '[label] must have at least [minCount] values',
    notAllowed: '[label] has an invalid value: "[value]"'
});*/

class ObjectPath {
  /**
   * Set an object property based on "path" (namespace) supplied creating
   * ... intermediary objects if they do not exist.
   * @param object {Object} An object where the properties specified on path should be set.
   * @param path {String} A string representing the property to be set, e.g. "user.study.series.timepoint".
   * @param value {Any} The value of the property that will be set.
   * @return {Boolean} Returns "true" on success, "false" if any intermediate component of the supplied path
   * ... is not a valid Object, in which case the property cannot be set. No excpetions are thrown.
   */
  static set(object, path, value) {
    let components = ObjectPath.getPathComponents(path),
        length = components !== null ? components.length : 0,
        result = false;

    if (length > 0 && ObjectPath.isValidObject(object)) {
      let i = 0,
          last = length - 1,
          currentObject = object;

      while (i < last) {
        let field = components[i];

        if (field in currentObject) {
          if (!ObjectPath.isValidObject(currentObject[field])) {
            break;
          }
        } else {
          currentObject[field] = {};
        }

        currentObject = currentObject[field];
        i++;
      }

      if (i === last) {
        currentObject[components[last]] = value;
        result = true;
      }
    }

    return result;
  }
  /**
   * Get an object property based on "path" (namespace) supplied traversing the object
   * ... tree as necessary.
   * @param object {Object} An object where the properties specified might exist.
   * @param path {String} A string representing the property to be searched for, e.g. "user.study.series.timepoint".
   * @return {Any} The value of the property if found. By default, returns the special type "undefined".
   */


  static get(object, path) {
    let found,
        // undefined by default
    components = ObjectPath.getPathComponents(path),
        length = components !== null ? components.length : 0;

    if (length > 0 && ObjectPath.isValidObject(object)) {
      let i = 0,
          last = length - 1,
          currentObject = object;

      while (i < last) {
        let field = components[i];
        const isValid = ObjectPath.isValidObject(currentObject[field]);

        if (field in currentObject && isValid) {
          currentObject = currentObject[field];
          i++;
        } else {
          break;
        }
      }

      if (i === last && components[last] in currentObject) {
        found = currentObject[components[last]];
      }
    }

    return found;
  }
  /**
   * Check if the supplied argument is a real JavaScript Object instance.
   * @param object {Any} The subject to be tested.
   * @return {Boolean} Returns "true" if the object is a real Object instance and "false" otherwise.
   */


  static isValidObject(object) {
    return typeof object === 'object' && object !== null && object instanceof Object;
  }

  static getPathComponents(path) {
    return typeof path === 'string' ? path.split('.') : null;
  }

}

/**
 * Create a random GUID
 *
 * @return {string}
 */
function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

// Return an absolute URL with the page domain using sub path of ROOT_URL
// to let multiple domains directed to the same server work
function absoluteUrl(path) {
  let absolutePath = '/';
  const absoluteUrl = Meteor.absoluteUrl();
  const absoluteUrlParts = absoluteUrl.split('/');

  if (absoluteUrlParts.length > 4) {
    const rootUrlPrefixIndex = absoluteUrl.indexOf(absoluteUrlParts[3]);
    absolutePath += absoluteUrl.substring(rootUrlPrefixIndex) + path;
  } else {
    absolutePath += path;
  }

  return absolutePath.replace(/\/\/+/g, '/');
}

const utils = {
  guid,
  ObjectPath,
  absoluteUrl
};

/**
 * Constants
 */
const STRING$2 = 'string';
const NUMBER$1 = 'number';
const FUNCTION$1 = 'function';
const OBJECT = 'object';
/**
 * Class Definition
 */

class Metadata {
  /**
   * Constructor and Instance Methods
   */
  constructor(data, uid) {
    // Define the main "_data" private property as an immutable property.
    // IMPORTANT: This property can only be set during instance construction.
    Object.defineProperty(this, '_data', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: data
    }); // Define the main "_uid" private property as an immutable property.
    // IMPORTANT: This property can only be set during instance construction.

    Object.defineProperty(this, '_uid', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: uid
    }); // Define "_custom" properties as an immutable property.
    // IMPORTANT: This property can only be set during instance construction.

    Object.defineProperty(this, '_custom', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Object.create(null)
    });
  }

  getData() {
    return this._data;
  }

  getDataProperty(propertyName) {
    let propertyValue;
    const _data = this._data;

    if (_data instanceof Object || typeof _data === OBJECT && _data !== null) {
      propertyValue = _data[propertyName];
    }

    return propertyValue;
  }
  /**
   * Get unique object ID
   */


  getObjectID() {
    return this._uid;
  }
  /**
   * Set custom attribute value
   * @param {String} attribute Custom attribute name
   * @param {Any} value     Custom attribute value
   */


  setCustomAttribute(attribute, value) {
    this._custom[attribute] = value;
  }
  /**
   * Get custom attribute value
   * @param  {String} attribute Custom attribute name
   * @return {Any}              Custom attribute value
   */


  getCustomAttribute(attribute) {
    return this._custom[attribute];
  }
  /**
   * Check if a custom attribute exists
   * @param  {String} attribute Custom attribute name
   * @return {Boolean}          True if custom attribute exists or false if not
   */


  customAttributeExists(attribute) {
    return attribute in this._custom;
  }
  /**
   * Set custom attributes in batch mode.
   * @param {Object} attributeMap An object whose own properties will be used as custom attributes.
   */


  setCustomAttributes(attributeMap) {
    const _hasOwn = Object.prototype.hasOwnProperty;
    const _custom = this._custom;

    for (let attribute in attributeMap) {
      if (_hasOwn.call(attributeMap, attribute)) {
        _custom[attribute] = attributeMap[attribute];
      }
    }
  }
  /**
   * Static Methods
   */


  static isValidUID(uid) {
    return typeof uid === STRING$2 && uid.length > 0;
  }

  static isValidIndex(index) {
    return typeof index === NUMBER$1 && index >= 0 && (index | 0) === index;
  }

  static isValidCallback(callback) {
    return typeof callback === FUNCTION$1;
  }

}

// @TODO: improve this object

/**
 * Objects to be used to throw errors, specially
 * in Trackers functions (afterFlush, Flush).
 */
class OHIFError extends Error {
  constructor(message) {
    super();
    this.message = message;
    this.stack = new Error().stack;
    this.name = this.constructor.name;
  }

}

/**
 * ATTENTION! This class should never depend on StudyMetadata or SeriesMetadata classes as this could
 * possibly cause circular dependency issues.
 */

const UNDEFINED$1 = 'undefined';
const STRING$3 = 'string';
const STUDY_INSTANCE_UID = 'x0020000d';
const SERIES_INSTANCE_UID = 'x0020000e';
class InstanceMetadata extends Metadata {
  constructor(data, uid) {
    super(data, uid); // Initialize Private Properties

    Object.defineProperties(this, {
      _sopInstanceUID: {
        configurable: true,
        // configurable so that it can be redefined in sub-classes...
        enumerable: false,
        writable: true,
        value: null
      },
      _imageId: {
        configurable: true,
        // configurable so that it can be redefined in sub-classes...
        enumerable: false,
        writable: true,
        value: null
      }
    }); // Initialize Public Properties

    this._definePublicProperties();
  }
  /**
   * Private Methods
   */

  /**
   * Define Public Properties
   * This method should only be called during initialization (inside the class constructor)
   */


  _definePublicProperties() {
    /**
     * Property: this.sopInstanceUID
     * Same as this.getSOPInstanceUID()
     * It's specially useful in contexts where a method call is not suitable like in search criteria. For example:
     * sopInstanceCollection.findBy({
     *   sopInstanceUID: '1.2.3.4.5.6.77777.8888888.99999999999.0'
     * });
     */
    Object.defineProperty(this, 'sopInstanceUID', {
      configurable: false,
      enumerable: false,
      get: function () {
        return this.getSOPInstanceUID();
      }
    });
  }
  /**
   * Public Methods
   */

  /**
   * Returns the StudyInstanceUID of the current instance. This method is basically a shorthand the full "getTagValue" method call.
   */


  getStudyInstanceUID() {
    return this.getTagValue(STUDY_INSTANCE_UID, null);
  }
  /**
   * Returns the SeriesInstanceUID of the current instance. This method is basically a shorthand the full "getTagValue" method call.
   */


  getSeriesInstanceUID() {
    return this.getTagValue(SERIES_INSTANCE_UID, null);
  }
  /**
   * Returns the SOPInstanceUID of the current instance.
   */


  getSOPInstanceUID() {
    return this._sopInstanceUID;
  } // @TODO: Improve this... (E.g.: blob data)


  getStringValue(tagOrProperty, index, defaultValue) {
    let value = this.getTagValue(tagOrProperty, defaultValue);

    if (typeof value !== STRING$3 && typeof value !== UNDEFINED$1) {
      value = value.toString();
    }

    return InstanceMetadata.getIndexedValue(value, index, defaultValue);
  } // @TODO: Improve this... (E.g.: blob data)


  getFloatValue(tagOrProperty, index, defaultValue) {
    let value = this.getTagValue(tagOrProperty, defaultValue);
    value = InstanceMetadata.getIndexedValue(value, index, defaultValue);

    if (value instanceof Array) {
      value.forEach((val, idx) => {
        value[idx] = parseFloat(val);
      });
      return value;
    }

    return typeof value === STRING$3 ? parseFloat(value) : value;
  } // @TODO: Improve this... (E.g.: blob data)


  getIntValue(tagOrProperty, index, defaultValue) {
    let value = this.getTagValue(tagOrProperty, defaultValue);
    value = InstanceMetadata.getIndexedValue(value, index, defaultValue);

    if (value instanceof Array) {
      value.forEach((val, idx) => {
        value[idx] = parseFloat(val);
      });
      return value;
    }

    return typeof value === STRING$3 ? parseInt(value) : value;
  }
  /**
   * @deprecated Please use getTagValue instead.
   */


  getRawValue(tagOrProperty, defaultValue) {
    return this.getTagValue(tagOrProperty, defaultValue);
  }
  /**
   * This function should be overriden by specialized classes in order to allow client libraries or viewers to take advantage of the Study Metadata API.
   */


  getTagValue(tagOrProperty, defaultValue) {
    /**
     * Please override this method on a specialized class.
     */
    throw new OHIFError('InstanceMetadata::getTagValue is not overriden. Please, override it in a specialized class. See OHIFInstanceMetadata for example');
  }
  /**
   * Compares the current instance with another one.
   * @param {InstanceMetadata} instance An instance of the InstanceMetadata class.
   * @returns {boolean} Returns true if both instances refer to the same instance.
   */


  equals(instance) {
    const self = this;
    return instance === self || instance instanceof InstanceMetadata && instance.getSOPInstanceUID() === self.getSOPInstanceUID();
  }
  /**
   * Check if the tagOrProperty exists
   * @param  {String} tagOrProperty tag or property be checked
   * @return {Boolean}   True if the tag or property exists or false if doesn't
   */


  tagExists(tagOrProperty) {
    /**
     * Please override this method
     */
    throw new OHIFError('InstanceMetadata::tagExists is not overriden. Please, override it in a specialized class. See OHIFInstanceMetadata for example');
  }
  /**
   * Get custom image id of a sop instance
   * @return {Any}          sop instance image id
   */


  getImageId(frame) {
    /**
     * Please override this method
     */
    throw new OHIFError('InstanceMetadata::getImageId is not overriden. Please, override it in a specialized class. See OHIFInstanceMetadata for example');
  }
  /**
   * Static Methods
   */

  /**
   * Get an value based that can be index based. This function is called by all getters. See above functions.
   *     - If value is a String and has indexes:
   *         - If undefined index: returns an array of the split values.
   *         - If defined index:
   *             - If invalid: returns defaultValue
   *             - If valid: returns the indexed value
   *      - If value is not a String, returns default value.
   */


  static getIndexedValue(value, index, defaultValue) {
    let result = defaultValue;

    if (typeof value === STRING$3) {
      const hasIndexValues = value.indexOf('\\') !== -1;
      result = value;

      if (hasIndexValues) {
        const splitValues = value.split('\\');

        if (Metadata.isValidIndex(index)) {
          const indexedValue = splitValues[index];
          result = typeof indexedValue !== STRING$3 ? defaultValue : indexedValue;
        } else {
          result = splitValues;
        }
      }
    }

    return result;
  }

}

class SeriesMetadata extends Metadata {
  constructor(data, uid) {
    super(data, uid); // Initialize Private Properties

    Object.defineProperties(this, {
      _seriesInstanceUID: {
        configurable: true,
        // configurable so that it can be redefined in sub-classes...
        enumerable: false,
        writable: true,
        value: null
      },
      _instances: {
        configurable: false,
        enumerable: false,
        writable: false,
        value: []
      },
      _firstInstance: {
        configurable: false,
        enumerable: false,
        writable: true,
        value: null
      }
    }); // Initialize Public Properties

    this._definePublicProperties();
  }
  /**
   * Private Methods
   */

  /**
   * Define Public Properties
   * This method should only be called during initialization (inside the class constructor)
   */


  _definePublicProperties() {
    /**
     * Property: this.seriesInstanceUID
     * Same as this.getSeriesInstanceUID()
     * It's specially useful in contexts where a method call is not suitable like in search criteria. For example:
     * seriesCollection.findBy({
     *   seriesInstanceUID: '1.2.3.4.5.6.77777.8888888.99999999999.0'
     * });
     */
    Object.defineProperty(this, 'seriesInstanceUID', {
      configurable: false,
      enumerable: false,
      get: function () {
        return this.getSeriesInstanceUID();
      }
    });
  }
  /**
   * Public Methods
   */

  /**
   * Returns the SeriesInstanceUID of the current series.
   */


  getSeriesInstanceUID() {
    return this._seriesInstanceUID;
  }
  /**
   * Append an instance to the current series.
   * @param {InstanceMetadata} instance The instance to be added to the current series.
   * @returns {boolean} Returns true on success, false otherwise.
   */


  addInstance(instance) {
    let result = false;

    if (instance instanceof InstanceMetadata && this.getInstanceByUID(instance.getSOPInstanceUID()) === void 0) {
      this._instances.push(instance);

      result = true;
    }

    return result;
  }
  /**
   * Get the first instance of the current series retaining a consistent result across multiple calls.
   * @return {InstanceMetadata} An instance of the InstanceMetadata class or null if it does not exist.
   */


  getFirstInstance() {
    let instance = this._firstInstance;

    if (!(instance instanceof InstanceMetadata)) {
      instance = null;
      const found = this.getInstanceByIndex(0);

      if (found instanceof InstanceMetadata) {
        this._firstInstance = found;
        instance = found;
      }
    }

    return instance;
  }
  /**
   * Find an instance by index.
   * @param {number} index An integer representing a list index.
   * @returns {InstanceMetadata} Returns a InstanceMetadata instance when found or undefined otherwise.
   */


  getInstanceByIndex(index) {
    let found; // undefined by default...

    if (Metadata.isValidIndex(index)) {
      found = this._instances[index];
    }

    return found;
  }
  /**
   * Find an instance by SOPInstanceUID.
   * @param {string} uid An UID string.
   * @returns {InstanceMetadata} Returns a InstanceMetadata instance when found or undefined otherwise.
   */


  getInstanceByUID(uid) {
    let found; // undefined by default...

    if (Metadata.isValidUID(uid)) {
      found = this._instances.find(instance => {
        return instance.getSOPInstanceUID() === uid;
      });
    }

    return found;
  }
  /**
   * Retrieve the number of instances within the current series.
   * @returns {number} The number of instances in the current series.
   */


  getInstanceCount() {
    return this._instances.length;
  }
  /**
   * Invokes the supplied callback for each instance in the current series passing
   * two arguments: instance (an InstanceMetadata instance) and index (the integer
   * index of the instance within the current series)
   * @param {function} callback The callback function which will be invoked for each instance in the series.
   * @returns {undefined} Nothing is returned.
   */


  forEachInstance(callback) {
    if (Metadata.isValidCallback(callback)) {
      this._instances.forEach((instance, index) => {
        callback.call(null, instance, index);
      });
    }
  }
  /**
   * Find the index of an instance inside the series.
   * @param {InstanceMetadata} instance An instance of the SeriesMetadata class.
   * @returns {number} The index of the instance inside the series or -1 if not found.
   */


  indexOfInstance(instance) {
    return this._instances.indexOf(instance);
  }
  /**
   * Search the associated instances using the supplied callback as criteria. The callback is passed
   * two arguments: instance (a InstanceMetadata instance) and index (the integer
   * index of the instance within its series)
   * @param {function} callback The callback function which will be invoked for each instance.
   * @returns {InstanceMetadata|undefined} If an instance is found based on callback criteria it
   *                                     returns a InstanceMetadata. "undefined" is returned otherwise
   */


  findInstance(callback) {
    if (Metadata.isValidCallback(callback)) {
      return this._instances.find((instance, index) => {
        return callback.call(null, instance, index);
      });
    }
  }
  /**
   * Compares the current series with another one.
   * @param {SeriesMetadata} series An instance of the SeriesMetadata class.
   * @returns {boolean} Returns true if both instances refer to the same series.
   */


  equals(series) {
    const self = this;
    return series === self || series instanceof SeriesMetadata && series.getSeriesInstanceUID() === self.getSeriesInstanceUID();
  }

}

const OBJECT$1 = 'object';
/**
 * This class defines an ImageSet object which will be used across the viewer. This object represents
 * a list of images that are associated by any arbitrary criteria being thus content agnostic. Besides the
 * main attributes (images and uid) it allows additional attributes to be appended to it (currently
 * indiscriminately, but this should be changed).
 */

class ImageSet {
  constructor(images) {
    if (Array.isArray(images) !== true) {
      throw new OHIFError('ImageSet expects an array of images');
    } // @property "images"


    Object.defineProperty(this, 'images', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: images
    }); // @property "uid"

    Object.defineProperty(this, 'uid', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: ohif_core.OHIF.utils.guid() // Unique ID of the instance

    });
  }

  getUID() {
    return this.uid;
  }

  setAttribute(attribute, value) {
    this[attribute] = value;
  }

  getAttribute(attribute) {
    return this[attribute];
  }

  setAttributes(attributes) {
    if (typeof attributes === OBJECT$1 && attributes !== null) {
      const imageSet = this,
            hasOwn = Object.prototype.hasOwnProperty;

      for (let attribute in attributes) {
        if (hasOwn.call(attributes, attribute)) {
          imageSet[attribute] = attributes[attribute];
        }
      }
    }
  }

  getImage(index) {
    return this.images[index];
  }

  sortBy(sortingCallback) {
    return this.images.sort(sortingCallback);
  }

}

class StudyMetadata extends Metadata {
  constructor(data, uid) {
    super(data, uid); // Initialize Private Properties

    Object.defineProperties(this, {
      _studyInstanceUID: {
        configurable: true,
        // configurable so that it can be redefined in sub-classes...
        enumerable: false,
        writable: true,
        value: null
      },
      _series: {
        configurable: false,
        enumerable: false,
        writable: false,
        value: []
      },
      _displaySets: {
        configurable: false,
        enumerable: false,
        writable: false,
        value: []
      },
      _firstSeries: {
        configurable: false,
        enumerable: false,
        writable: true,
        value: null
      },
      _firstInstance: {
        configurable: false,
        enumerable: false,
        writable: true,
        value: null
      }
    }); // Initialize Public Properties

    this._definePublicProperties();
  }
  /**
   * Private Methods
   */

  /**
   * Define Public Properties
   * This method should only be called during initialization (inside the class constructor)
   */


  _definePublicProperties() {
    /**
     * Property: this.studyInstanceUID
     * Same as this.getStudyInstanceUID()
     * It's specially useful in contexts where a method call is not suitable like in search criteria. For example:
     * studyCollection.findBy({
     *   studyInstanceUID: '1.2.3.4.5.6.77777.8888888.99999999999.0'
     * });
     */
    Object.defineProperty(this, 'studyInstanceUID', {
      configurable: false,
      enumerable: false,
      get: function () {
        return this.getStudyInstanceUID();
      }
    });
  }
  /**
   * Public Methods
   */

  /**
   * Getter for displaySets
   * @return {Array} Array of display set object
   */


  getDisplaySets() {
    return this._displaySets.slice();
  }
  /**
   * Set display sets
   * @param {Array} displaySets Array of display sets (ImageSet[])
   */


  setDisplaySets(displaySets) {
    displaySets.forEach(displaySet => this.addDisplaySet(displaySet));
  }
  /**
   * Add a single display set to the list
   * @param {Object} displaySet Display set object
   * @returns {boolean} True on success, false on failure.
   */


  addDisplaySet(displaySet) {
    if (displaySet instanceof ImageSet) {
      this._displaySets.push(displaySet);

      return true;
    }

    return false;
  }
  /**
   * Invokes the supplied callback for each display set in the current study passing
   * two arguments: display set (a ImageSet instance) and index (the integer
   * index of the display set within the current study)
   * @param {function} callback The callback function which will be invoked for each display set instance.
   * @returns {undefined} Nothing is returned.
   */


  forEachDisplaySet(callback) {
    if (Metadata.isValidCallback(callback)) {
      this._displaySets.forEach((displaySet, index) => {
        callback.call(null, displaySet, index);
      });
    }
  }
  /**
   * Search the associated display sets using the supplied callback as criteria. The callback is passed
   * two arguments: display set (a ImageSet instance) and index (the integer
   * index of the display set within the current study)
   * @param {function} callback The callback function which will be invoked for each display set instance.
   * @returns {undefined} Nothing is returned.
   */


  findDisplaySet(callback) {
    if (Metadata.isValidCallback(callback)) {
      return this._displaySets.find((displaySet, index) => {
        return callback.call(null, displaySet, index);
      });
    }
  }
  /**
   * Retrieve the number of display sets within the current study.
   * @returns {number} The number of display sets in the current study.
   */


  getDisplaySetCount() {
    return this._displaySets.length;
  }
  /**
   * Returns the StudyInstanceUID of the current study.
   */


  getStudyInstanceUID() {
    return this._studyInstanceUID;
  }
  /**
   * Getter for series
   * @return {Array} Array of SeriesMetadata object
   */


  getSeries() {
    return this._series.slice();
  }
  /**
   * Append a series to the current study.
   * @param {SeriesMetadata} series The series to be added to the current study.
   * @returns {boolean} Returns true on success, false otherwise.
   */


  addSeries(series) {
    let result = false;

    if (series instanceof SeriesMetadata && this.getSeriesByUID(series.getSeriesInstanceUID()) === void 0) {
      this._series.push(series);

      result = true;
    }

    return result;
  }
  /**
   * Find a series by index.
   * @param {number} index An integer representing a list index.
   * @returns {SeriesMetadata} Returns a SeriesMetadata instance when found or undefined otherwise.
   */


  getSeriesByIndex(index) {
    let found; // undefined by default...

    if (Metadata.isValidIndex(index)) {
      found = this._series[index];
    }

    return found;
  }
  /**
   * Find a series by SeriesInstanceUID.
   * @param {string} uid An UID string.
   * @returns {SeriesMetadata} Returns a SeriesMetadata instance when found or undefined otherwise.
   */


  getSeriesByUID(uid) {
    let found; // undefined by default...

    if (Metadata.isValidUID(uid)) {
      found = this._series.find(series => {
        return series.getSeriesInstanceUID() === uid;
      });
    }

    return found;
  }
  /**
   * Retrieve the number of series within the current study.
   * @returns {number} The number of series in the current study.
   */


  getSeriesCount() {
    return this._series.length;
  }
  /**
   * Retrieve the number of instances within the current study.
   * @returns {number} The number of instances in the current study.
   */


  getInstanceCount() {
    return this._series.reduce((sum, series) => {
      return sum + series.getInstanceCount();
    }, 0);
  }
  /**
   * Invokes the supplied callback for each series in the current study passing
   * two arguments: series (a SeriesMetadata instance) and index (the integer
   * index of the series within the current study)
   * @param {function} callback The callback function which will be invoked for each series instance.
   * @returns {undefined} Nothing is returned.
   */


  forEachSeries(callback) {
    if (Metadata.isValidCallback(callback)) {
      this._series.forEach((series, index) => {
        callback.call(null, series, index);
      });
    }
  }
  /**
   * Find the index of a series inside the study.
   * @param {SeriesMetadata} series An instance of the SeriesMetadata class.
   * @returns {number} The index of the series inside the study or -1 if not found.
   */


  indexOfSeries(series) {
    return this._series.indexOf(series);
  }
  /**
   * It sorts the series based on display sets order. Each series must be an instance
   * of SeriesMetadata and each display sets must be an instance of ImageSet.
   * Useful example of usage:
   *     Study data provided by backend does not sort series at all and client-side
   *     needs series sorted by the same criteria used for sorting display sets.
   */


  sortSeriesByDisplaySets() {
    // Object for mapping display sets' index by seriesInstanceUid
    const displaySetsMapping = {}; // Loop through each display set to create the mapping

    this.forEachDisplaySet((displaySet, index) => {
      if (!(displaySet instanceof ImageSet)) {
        throw new OHIFError(`StudyMetadata::sortSeriesByDisplaySets display set at index ${index} is not an instance of ImageSet`);
      } // In case of multiframe studies, just get the first index occurence


      if (displaySetsMapping[displaySet.seriesInstanceUid] === void 0) {
        displaySetsMapping[displaySet.seriesInstanceUid] = index;
      }
    }); // Clone of actual series

    const actualSeries = this.getSeries();
    actualSeries.forEach((series, index) => {
      if (!(series instanceof SeriesMetadata)) {
        throw new OHIFError(`StudyMetadata::sortSeriesByDisplaySets series at index ${index} is not an instance of SeriesMetadata`);
      } // Get the new series index


      const seriesIndex = displaySetsMapping[series.getSeriesInstanceUID()]; // Update the series object with the new series position

      this._series[seriesIndex] = series;
    });
  }
  /**
   * Compares the current study instance with another one.
   * @param {StudyMetadata} study An instance of the StudyMetadata class.
   * @returns {boolean} Returns true if both instances refer to the same study.
   */


  equals(study) {
    const self = this;
    return study === self || study instanceof StudyMetadata && study.getStudyInstanceUID() === self.getStudyInstanceUID();
  }
  /**
   * Get the first series of the current study retaining a consistent result across multiple calls.
   * @return {SeriesMetadata} An instance of the SeriesMetadata class or null if it does not exist.
   */


  getFirstSeries() {
    let series = this._firstSeries;

    if (!(series instanceof SeriesMetadata)) {
      series = null;
      const found = this.getSeriesByIndex(0);

      if (found instanceof SeriesMetadata) {
        this._firstSeries = found;
        series = found;
      }
    }

    return series;
  }
  /**
   * Get the first instance of the current study retaining a consistent result across multiple calls.
   * @return {InstanceMetadata} An instance of the InstanceMetadata class or null if it does not exist.
   */


  getFirstInstance() {
    let instance = this._firstInstance;

    if (!(instance instanceof InstanceMetadata)) {
      instance = null;
      const firstSeries = this.getFirstSeries();

      if (firstSeries instanceof SeriesMetadata) {
        const found = firstSeries.getFirstInstance();

        if (found instanceof InstanceMetadata) {
          this._firstInstance = found;
          instance = found;
        }
      }
    }

    return instance;
  }
  /**
  * Search the associated series to find an specific instance using the supplied callback as criteria.
  * The callback is passed two arguments: instance (a InstanceMetadata instance) and index (the integer
  * index of the instance within the current series)
  * @param {function} callback The callback function which will be invoked for each instance instance.
  * @returns {Object} Result object containing series (SeriesMetadata) and instance (InstanceMetadata)
  *                   objects or an empty object if not found.
  */


  findSeriesAndInstanceByInstance(callback) {
    let result;

    if (Metadata.isValidCallback(callback)) {
      let instance;

      const series = this._series.find(series => {
        instance = series.findInstance(callback);
        return instance instanceof InstanceMetadata;
      }); // No series found


      if (series instanceof SeriesMetadata) {
        result = {
          series,
          instance
        };
      }
    }

    return result || {};
  }
  /**
   * Find series by instance using the supplied callback as criteria. The callback is passed
   * two arguments: instance (a InstanceMetadata instance) and index (the integer index of
   * the instance within its series)
   * @param {function} callback The callback function which will be invoked for each instance.
   * @returns {SeriesMetadata|undefined} If a series is found based on callback criteria it
   *                                     returns a SeriesMetadata. "undefined" is returned otherwise
   */


  findSeriesByInstance(callback) {
    const result = this.findSeriesAndInstanceByInstance(callback);
    return result.series;
  }
  /**
   * Find an instance using the supplied callback as criteria. The callback is passed
   * two arguments: instance (a InstanceMetadata instance) and index (the integer index of
   * the instance within its series)
   * @param {function} callback The callback function which will be invoked for each instance.
   * @returns {InstanceMetadata|undefined} If an instance is found based on callback criteria it
   *                                     returns a InstanceMetadata. "undefined" is returned otherwise
   */


  findInstance(callback) {
    const result = this.findSeriesAndInstanceByInstance(callback);
    return result.instance;
  }

}

class OHIFInstanceMetadata extends InstanceMetadata {
  /**
   * @param {Object} Instance object.
   */
  constructor(data, series, study, uid) {
    super(data, uid);
    this.init(series, study);
  }

  init(series, study) {
    const instance = this.getData(); // Initialize Private Properties

    Object.defineProperties(this, {
      _sopInstanceUID: {
        configurable: false,
        enumerable: false,
        writable: false,
        value: instance.sopInstanceUid
      },
      _study: {
        configurable: false,
        enumerable: false,
        writable: false,
        value: study
      },
      _series: {
        configurable: false,
        enumerable: false,
        writable: false,
        value: series
      },
      _instance: {
        configurable: false,
        enumerable: false,
        writable: false,
        value: instance
      },
      _cache: {
        configurable: false,
        enumerable: false,
        writable: false,
        value: Object.create(null)
      }
    });
  } // Override


  getTagValue(tagOrProperty, defaultValue, bypassCache) {
    // check if this property has been cached...
    if (tagOrProperty in this._cache && bypassCache !== true) {
      return this._cache[tagOrProperty];
    }

    const propertyName = OHIFInstanceMetadata.getPropertyName(tagOrProperty); // Search property value in the whole study metadata chain...

    let rawValue;

    if (propertyName in this._instance) {
      rawValue = this._instance[propertyName];
    } else if (propertyName in this._series) {
      rawValue = this._series[propertyName];
    } else if (propertyName in this._study) {
      rawValue = this._study[propertyName];
    }

    if (rawValue !== void 0) {
      // if rawValue value is not undefined, cache result...
      this._cache[tagOrProperty] = rawValue;
      return rawValue;
    }

    return defaultValue;
  } // Override


  tagExists(tagOrProperty) {
    const propertyName = OHIFInstanceMetadata.getPropertyName(tagOrProperty);
    return propertyName in this._instance || propertyName in this._series || propertyName in this._study;
  } // Override


  getImageId(frame, thumbnail) {
    // If _imageID is not cached, create it
    if (this._imageId === null) {
      this._imageId = ohif_core.OHIF.viewerbase.getImageId(this.getData(), frame, thumbnail);
    }

    return this._imageId;
  }
  /**
   * Static methods
   */
  // @TODO: The current mapping of standard DICOM property names to local property names is not optimal.
  // The inconsistency in property naming makes this function increasingly complex.
  // A possible solution to improve this would be adapt retriveMetadata names to use DICOM standard names as in dicomTagDescriptions.js


  static getPropertyName(tagOrProperty) {
    let propertyName;
    const tagInfo = DICOMTagDescriptions.find(tagOrProperty);

    if (tagInfo !== void 0) {
      // This function tries to translate standard DICOM property names into local naming convention.
      propertyName = tagInfo.keyword.replace(/^SOP/, 'sop').replace(/UID$/, 'Uid').replace(/ID$/, 'Id');
      propertyName = propertyName.charAt(0).toLowerCase() + propertyName.substr(1);
    }

    return propertyName;
  }

}

class OHIFSeriesMetadata extends SeriesMetadata {
  /**
   * @param {Object} Series object.
   */
  constructor(data, study, uid) {
    super(data, uid);
    this.init(study);
  }

  init(study) {
    const series = this.getData(); // define "_seriesInstanceUID" protected property...

    Object.defineProperty(this, '_seriesInstanceUID', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: series.seriesInstanceUid
    }); // populate internal list of instances...

    series.instances.forEach(instance => {
      this.addInstance(new OHIFInstanceMetadata(instance, series, study));
    });
  }

}

class OHIFStudyMetadata extends StudyMetadata {
  /**
   * @param {Object} Study object.
   */
  constructor(data, uid) {
    super(data, uid);
    this.init();
  }

  init() {
    const study = this.getData(); // define "_studyInstanceUID" protected property

    Object.defineProperty(this, '_studyInstanceUID', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: study.studyInstanceUid
    }); // populate internal list of series

    study.seriesList.forEach(series => {
      this.addSeries(new OHIFSeriesMetadata(series, study));
    });
  }

}

class WadoRsMetaDataBuilder {
  constructor() {
    this.tags = {};
  }

  addTag(tag, value, multi) {
    this.tags[tag] = {
      tag,
      value,
      multi
    };
    return this;
  }

  toJSON() {
    const json = {};
    const keys = Object.keys(this.tags);
    keys.forEach(key => {
      if (!this.tags.hasOwnProperty(key)) {
        return;
      }

      const tag = this.tags[key];
      const multi = !!tag.multi;
      let value = tag.value;

      if (value == null || value.length === 1 && value[0] == null) {
        return;
      }

      if (typeof value === 'string' && multi) {
        value = value.split('\\');
      }

      if (!underscore.isArray(value)) {
        value = [value];
      }

      json[key] = {
        Value: value
      };
    });
    return json;
  }

}

const metadata = {
  Metadata,
  WadoRsMetaDataBuilder,
  StudyMetadata,
  SeriesMetadata,
  InstanceMetadata,
  OHIFStudyMetadata,
  OHIFSeriesMetadata,
  OHIFInstanceMetadata
};

// Check the servers on meteor startup
const servers = meteor.Meteor.settings.public.servers;
Object.keys(servers).forEach(serverType => {
  const endpoints = servers[serverType];
  endpoints.forEach(endpoint => {
    const server = Object.assign({}, endpoint);
    server.type = serverType; // TODO: figure out where else to put this function

    window.store.dispatch({
      type: 'ADD_SERVER',
      server
    });
  });
});

/**
 * A small set of utilities to help parsing DICOM element values.
 * In the future the functionality provided by this library might
 * be incorporated into dicomParser library.
 */

const parsingUtils = {
  /**
   * Check if supplied argument is a valid instance of the dicomParser.DataSet class.
   * @param data {Object} An instance of the dicomParser.DataSet class.
   * @returns {Boolean} Returns true if data is a valid instance of the dicomParser.DataSet class.
   */
  isValidDataSet: function (data) {
    return data instanceof ohif_cornerstone.dicomParser.DataSet;
  },

  /**
   * Parses an element tag according to the 'AT' VR definition.
   * @param data {Object} An instance of the dicomParser.DataSet class.
   * @param tag {String} A DICOM tag with in the format xGGGGEEEE.
   * @returns {String} A string representation of a data element tag or null if the field is not present or data is not long enough.
   */
  attributeTag: function (data, tag) {
    if (this.isValidDataSet(data) && tag in data.elements) {
      let element = data.elements[tag];

      if (element && element.length === 4) {
        let parser = data.byteArrayParser.readUint16,
            bytes = data.byteArray,
            offset = element.dataOffset;
        return 'x' + ('00000000' + (parser(bytes, offset) * 256 * 256 + parser(bytes, offset + 2)).toString(16)).substr(-8);
      }
    }

    return null;
  },

  /**
   * Parses the string representation of a multi-valued element into an array of strings. If the parser
   * parameter is passed and is a function, it will be applied to each element of the resulting array.
   * @param data {Object} An instance of the dicomParser.DataSet class.
   * @param tag {String} A DICOM tag with in the format xGGGGEEEE.
   * @param parser {Function} An optional parser function that can be applied to each element of the array.
   * @returns {Array} An array of floating point numbers or null if the field is not present or data is not long enough.
   */
  multiValue: function (data, tag, parser) {
    if (this.isValidDataSet(data) && tag in data.elements) {
      let element = data.elements[tag];

      if (element && element.length > 0) {
        let string = ohif_cornerstone.dicomParser.readFixedString(data.byteArray, element.dataOffset, element.length);

        if (typeof string === 'string' && string.length > 0) {
          if (typeof parser !== 'function') {
            parser = null;
          }

          return string.split('\\').map(function (value) {
            value = value.trim();
            return parser !== null ? parser(value) : value;
          });
        }
      }
    }

    return null;
  },

  /**
   * Parses a string to an array of floats for a multi-valued element.
   * @param data {Object} An instance of the dicomParser.DataSet class.
   * @param tag {String} A DICOM tag with in the format xGGGGEEEE.
   * @returns {Array} An array of floating point numbers or null if the field is not present or data is not long enough.
   */
  floatArray: function (data, tag) {
    return this.multiValue(data, tag, parseFloat);
  }
};

const FUNCTION$2 = 'function';

class MetadataProvider {
  constructor() {
    // Define the main "metadataLookup" private property as an immutable property.
    Object.defineProperty(this, 'metadataLookup', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: new Map()
    }); // Local reference to provider function bound to current instance.

    Object.defineProperty(this, '_provider', {
      configurable: false,
      enumerable: false,
      writable: true,
      value: null
    });
  }
  /**
   * Cornerstone Metadata provider to store image meta data
   * Data from instances, series, and studies are associated with
   * imageIds to facilitate usage of this information by Cornerstone's Tools
   *
   * e.g. the imagePlane metadata object contains instance information about
   * row/column pixel spacing, patient position, and patient orientation. It
   * is used in CornerstoneTools to position reference lines and orientation markers.
   *
   * @param {String} imageId The Cornerstone ImageId
   * @param {Object} data An object containing instance, series, and study metadata
   */


  addMetadata(imageId, data) {
    const instanceMetadata = data.instance;
    const seriesMetadata = data.series;
    const studyMetadata = data.study;
    const numImages = data.numImages;
    const metadata = {};
    metadata.frameNumber = data.frameNumber;
    metadata.study = {
      accessionNumber: studyMetadata.accessionNumber,
      patientId: studyMetadata.patientId,
      studyInstanceUid: studyMetadata.studyInstanceUid,
      studyDate: studyMetadata.studyDate,
      studyTime: studyMetadata.studyTime,
      studyDescription: studyMetadata.studyDescription,
      institutionName: studyMetadata.institutionName,
      patientHistory: studyMetadata.patientHistory
    };
    metadata.series = {
      seriesDescription: seriesMetadata.seriesDescription,
      seriesNumber: seriesMetadata.seriesNumber,
      seriesDate: seriesMetadata.seriesDate,
      seriesTime: seriesMetadata.seriesTime,
      modality: seriesMetadata.modality,
      seriesInstanceUid: seriesMetadata.seriesInstanceUid,
      numImages: numImages
    };
    metadata.instance = instanceMetadata;
    metadata.patient = {
      name: studyMetadata.patientName,
      id: studyMetadata.patientId,
      birthDate: studyMetadata.patientBirthDate,
      sex: studyMetadata.patientSex,
      age: studyMetadata.patientAge
    }; // If there is sufficient information, populate
    // the imagePlane object for easier use in the Viewer

    metadata.imagePlane = this.getImagePlane(instanceMetadata); // Add the metadata to the imageId lookup object

    this.metadataLookup.set(imageId, metadata);
  }
  /**
   * Return the metadata for the given imageId
   * @param {String} imageId The Cornerstone ImageId
   * @returns image metadata
   */


  getMetadata(imageId) {
    return this.metadataLookup.get(imageId);
  }
  /**
   * Adds a set of metadata to the Cornerstone metadata provider given a specific
   * imageId, type, and dataset
   *
   * @param imageId
   * @param type (e.g. series, instance, tagDisplay)
   * @param data
   */


  addSpecificMetadata(imageId, type, data) {
    const metadata = {};
    metadata[type] = data;
    const oldMetadata = this.metadataLookup.get(imageId);
    this.metadataLookup.set(imageId, Object.assign(oldMetadata, metadata));
  }

  getFromImage(image, type, tag, attrName, defaultValue) {
    let value;

    if (image.data) {
      value = this.getFromDataSet(image.data, type, tag);
    } else {
      value = image.instance[attrName];
    }

    return value === null ? defaultValue : value;
  }

  getFromDataSet(dataSet, type, tag) {
    if (!dataSet) {
      return;
    }

    const fn = dataSet[type];

    if (!fn) {
      return;
    }

    return fn.call(dataSet, tag);
  }

  getFrameIncrementPointer(image) {
    const dataSet = image.data;
    let frameInstancePointer = '';

    if (parsingUtils.isValidDataSet(dataSet)) {
      const frameInstancePointerNames = {
        x00181063: 'frameTime',
        x00181065: 'frameTimeVector'
      }; // (0028,0009) = Frame Increment Pointer

      const frameInstancePointerTag = parsingUtils.attributeTag(dataSet, 'x00280009');
      frameInstancePointer = frameInstancePointerNames[frameInstancePointerTag];
    } else {
      frameInstancePointer = image.instance.frameIncrementPointer;
    }

    return frameInstancePointer || '';
  }

  getFrameTimeVector(image) {
    const dataSet = image.data;

    if (parsingUtils.isValidDataSet(dataSet)) {
      // Frame Increment Pointer points to Frame Time Vector (0018,1065) field
      return parsingUtils.floatArray(dataSet, 'x00181065');
    }

    return image.instance.frameTimeVector;
  }

  getFrameTime(image) {
    const dataSet = image.data;

    if (parsingUtils.isValidDataSet(dataSet)) {
      // Frame Increment Pointer points to Frame Time (0018,1063) field or is not defined (for addtional flexibility).
      // Yet another value is possible for this field (5200,9230 for Multi-frame Functional Groups)
      // but that case is currently not supported.
      return dataSet.floatString('x00181063', -1);
    }

    return image.instance.frameTime;
  }
  /**
   * Updates the related metadata for missing fields given a specified image
   *
   * @param image
   */


  updateMetadata(image) {
    const imageMetadata = this.metadataLookup.get(image.imageId);

    if (!imageMetadata) {
      return;
    }

    imageMetadata.patient.age = imageMetadata.patient.age || this.getFromDataSet(image.data, 'string', 'x00101010');
    imageMetadata.instance.rows = imageMetadata.instance.rows || image.rows;
    imageMetadata.instance.columns = imageMetadata.instance.columns || image.columns;
    imageMetadata.instance.sopClassUid = imageMetadata.instance.sopClassUid || this.getFromDataSet(image.data, 'string', 'x00080016');
    imageMetadata.instance.sopInstanceUid = imageMetadata.instance.sopInstanceUid || this.getFromDataSet(image.data, 'string', 'x00080018');
    imageMetadata.instance.pixelSpacing = imageMetadata.instance.pixelSpacing || this.getFromDataSet(image.data, 'string', 'x00280030');
    imageMetadata.instance.frameOfReferenceUID = imageMetadata.instance.frameOfReferenceUID || this.getFromDataSet(image.data, 'string', 'x00200052');
    imageMetadata.instance.imageOrientationPatient = imageMetadata.instance.imageOrientationPatient || this.getFromDataSet(image.data, 'string', 'x00200037');
    imageMetadata.instance.imagePositionPatient = imageMetadata.instance.imagePositionPatient || this.getFromDataSet(image.data, 'string', 'x00200032');
    imageMetadata.instance.sliceThickness = imageMetadata.instance.sliceThickness || this.getFromDataSet(image.data, 'string', 'x00180050');
    imageMetadata.instance.sliceLocation = imageMetadata.instance.sliceLocation || this.getFromDataSet(image.data, 'string', 'x00201041');
    imageMetadata.instance.tablePosition = imageMetadata.instance.tablePosition || this.getFromDataSet(image.data, 'string', 'x00189327');
    imageMetadata.instance.spacingBetweenSlices = imageMetadata.instance.spacingBetweenSlices || this.getFromDataSet(image.data, 'string', 'x00180088');
    imageMetadata.instance.lossyImageCompression = imageMetadata.instance.lossyImageCompression || this.getFromDataSet(image.data, 'string', 'x00282110');
    imageMetadata.instance.lossyImageCompressionRatio = imageMetadata.instance.lossyImageCompressionRatio || this.getFromDataSet(image.data, 'string', 'x00282112');
    imageMetadata.instance.frameIncrementPointer = imageMetadata.instance.frameIncrementPointer || this.getFromDataSet(image.data, 'string', 'x00280009');
    imageMetadata.instance.frameTime = imageMetadata.instance.frameTime || this.getFromDataSet(image.data, 'string', 'x00181063');
    imageMetadata.instance.frameTimeVector = imageMetadata.instance.frameTimeVector || this.getFromDataSet(image.data, 'string', 'x00181065');

    if ((image.data || image.instance) && !imageMetadata.instance.multiframeMetadata) {
      imageMetadata.instance.multiframeMetadata = this.getMultiframeModuleMetadata(image);
    }

    imageMetadata.imagePlane = imageMetadata.imagePlane || this.getImagePlane(imageMetadata.instance);
  }
  /**
   * Constructs and returns the imagePlane given the metadata instance
   *
   * @param metadataInstance The metadata instance (InstanceMetadata class) containing information to construct imagePlane
   * @returns imagePlane The constructed imagePlane to be used in viewer easily
   */


  getImagePlane(instance) {
    if (!instance.rows || !instance.columns || !instance.pixelSpacing || !instance.frameOfReferenceUID || !instance.imageOrientationPatient || !instance.imagePositionPatient) {
      return;
    }

    const imageOrientation = instance.imageOrientationPatient.split('\\');
    const imagePosition = instance.imagePositionPatient.split('\\');
    let columnPixelSpacing = 1.0;
    let rowPixelSpacing = 1.0;

    if (instance.pixelSpacing) {
      const split = instance.pixelSpacing.split('\\');
      rowPixelSpacing = parseFloat(split[0]);
      columnPixelSpacing = parseFloat(split[1]);
    }

    return {
      frameOfReferenceUID: instance.frameOfReferenceUID,
      rows: instance.rows,
      columns: instance.columns,
      rowCosines: new cornerstoneMath.Vector3(parseFloat(imageOrientation[0]), parseFloat(imageOrientation[1]), parseFloat(imageOrientation[2])),
      columnCosines: new cornerstoneMath.Vector3(parseFloat(imageOrientation[3]), parseFloat(imageOrientation[4]), parseFloat(imageOrientation[5])),
      imagePositionPatient: new cornerstoneMath.Vector3(parseFloat(imagePosition[0]), parseFloat(imagePosition[1]), parseFloat(imagePosition[2])),
      rowPixelSpacing,
      columnPixelSpacing
    };
  }
  /**
   * This function extracts miltiframe information from a dicomParser.DataSet object.
   *
   * @param dataSet {Object} An instance of dicomParser.DataSet object where multiframe information can be found.
   * @return {Object} An object containing multiframe image metadata (frameIncrementPointer, frameTime, frameTimeVector, etc).
   */


  getMultiframeModuleMetadata(image) {
    const imageInfo = {
      isMultiframeImage: false,
      frameIncrementPointer: null,
      numberOfFrames: 0,
      frameTime: 0,
      frameTimeVector: null,
      averageFrameRate: 0 // backwards compatibility only... it might be useless in the future

    };
    let frameTime;
    const numberOfFrames = this.getFromImage(image, 'intString', 'x00280008', 'numberOfFrames', -1);

    if (numberOfFrames > 0) {
      // set multi-frame image indicator
      imageInfo.isMultiframeImage = true;
      imageInfo.numberOfFrames = numberOfFrames; // (0028,0009) = Frame Increment Pointer

      const frameIncrementPointer = this.getFrameIncrementPointer(image);

      if (frameIncrementPointer === 'frameTimeVector') {
        // Frame Increment Pointer points to Frame Time Vector (0018,1065) field
        const frameTimeVector = this.getFrameTimeVector(image);

        if (frameTimeVector instanceof Array && frameTimeVector.length > 0) {
          imageInfo.frameIncrementPointer = frameIncrementPointer;
          imageInfo.frameTimeVector = frameTimeVector;
          frameTime = frameTimeVector.reduce((a, b) => a + b) / frameTimeVector.length;
          imageInfo.averageFrameRate = 1000 / frameTime;
        }
      } else if (frameIncrementPointer === 'frameTime' || frameIncrementPointer === '') {
        frameTime = this.getFrameTime(image);

        if (frameTime > 0) {
          imageInfo.frameIncrementPointer = frameIncrementPointer;
          imageInfo.frameTime = frameTime;
          imageInfo.averageFrameRate = 1000 / frameTime;
        }
      }
    }

    return imageInfo;
  }
  /**
   * Get a bound reference to the provider function.
   */


  getProvider() {
    let provider = this._provider;

    if (typeof this._provider !== FUNCTION$2) {
      provider = this.provider.bind(this);
      this._provider = provider;
    }

    return provider;
  }
  /**
   * Looks up metadata for Cornerstone Tools given a specified type and imageId
   * A type may be, e.g. 'study', or 'patient', or 'imagePlane'. These types
   * are keys in the stored metadata objects.
   *
   * @param type
   * @param imageId
   * @returns {Object} Relevant metadata of the specified type
   */


  provider(type, imageId) {
    // TODO: Cornerstone Tools use 'imagePlaneModule', but OHIF use 'imagePlane'. It must be consistent.
    if (type === 'imagePlaneModule') {
      type = 'imagePlane';
    }

    const imageMetadata = this.metadataLookup.get(imageId);

    if (!imageMetadata) {
      return;
    }

    if (imageMetadata.hasOwnProperty(type)) {
      return imageMetadata[type];
    }
  }

}

const cornerstone$1 = {
  MetadataProvider
};

class CommandsManager {
  constructor() {
    this.contexts = {}; // Enable reactivity by storing the last executed command

    this.last = new reactiveVar.ReactiveVar('');
  }

  getContext(contextName) {
    const context = this.contexts[contextName];

    if (!context) {
      return ohif_core.OHIF.log.warn(`No context found with name "${contextName}"`);
    }

    return context;
  }

  getCurrentContext() {
    const contextName = ohif_core.OHIF.context.get();

    if (!contextName) {
      return ohif_core.OHIF.log.warn('There is no selected context');
    }

    return this.getContext(contextName);
  }

  createContext(contextName) {
    if (!contextName) return;

    if (this.contexts[contextName]) {
      return this.clear(contextName);
    }

    this.contexts[contextName] = {};
  }

  set(contextName, definitions, extend = false) {
    if (typeof definitions !== 'object') return;
    const context = this.getContext(contextName);
    if (!context) return;

    if (!extend) {
      this.clear(contextName);
    }

    Object.keys(definitions).forEach(command => context[command] = definitions[command]);
  }

  register(contextName, command, definition) {
    if (typeof definition !== 'object') return;
    const context = this.getContext(contextName);
    if (!context) return;
    context[command] = definition;
  }

  setDisabledFunction(contextName, command, func) {
    if (!command || typeof func !== 'function') return;
    const context = this.getContext(contextName);
    if (!context) return;
    const definition = context[command];

    if (!definition) {
      return ohif_core.OHIF.log.warn(`Trying to set a disabled function to a command "${command}" that was not yet defined`);
    }

    definition.disabled = func;
  }

  clear(contextName) {
    if (!contextName) return;
    this.contexts[contextName] = {};
  }

  getDefinition(command) {
    const context = this.getCurrentContext();
    if (!context) return;
    return context[command];
  }

  isDisabled(command) {
    const definition = this.getDefinition(command);
    if (!definition) return false;
    const {
      disabled
    } = definition;
    if (underscore.isFunction(disabled) && disabled()) return true;
    if (!underscore.isFunction(disabled) && disabled) return true;
    return false;
  }

  run(command) {
    const definition = this.getDefinition(command);

    if (!definition) {
      return ohif_core.OHIF.log.warn(`Command "${command}" not found in current context`);
    }

    const {
      action,
      params
    } = definition;
    if (this.isDisabled(command)) return;

    if (typeof action !== 'function') {
      return ohif_core.OHIF.log.warn(`No action was defined for command "${command}"`);
    } else {
      const result = action(params);

      if (this.last.get() === command) {
        this.last.dep.changed();
      } else {
        this.last.set(command);
      }

      return result;
    }
  }

}

class StudyPrefetcher {
  constructor(studies) {
    this.studies = studies || [];
    this.prefetchDisplaySetsTimeout = 300;
    this.lastActiveViewportElement = null;
    this.cacheFullHandlerBound = underscore.bind(this.cacheFullHandler, this);
    cornerstone.events.addEventListener('cornerstoneimagecachefull.StudyPrefetcher', this.cacheFullHandlerBound);
  }

  destroy() {
    this.stopPrefetching();
    cornerstone.events.removeEventListener('cornerstoneimagecachefull.StudyPrefetcher', this.cacheFullHandlerBound);
  }

  static getInstance() {
    if (!StudyPrefetcher.instance) {
      StudyPrefetcher.instance = new StudyPrefetcher();
    }

    return StudyPrefetcher.instance;
  }

  setStudies(studies) {
    this.stopPrefetching();
    this.studies = studies;
  }

  prefetch() {
    if (!this.studies || !this.studies.length) {
      return;
    }

    this.stopPrefetching();
    this.prefetchActiveViewport();
    this.prefetchDisplaySets();
  }

  stopPrefetching() {
    this.disableViewportPrefetch();
    cornerstoneTools.requestPoolManager.clearRequestStack('prefetch');
  }

  prefetchActiveViewport() {
    const activeViewportElement = ohif_core.OHIF.viewerbase.viewportUtils.getActiveViewportElement();
    this.enablePrefetchOnElement(activeViewportElement);
    this.attachActiveViewportListeners(activeViewportElement);
  }

  disableViewportPrefetch() {
    jquery('.imageViewerViewport').each(function () {
      if (!jquery(this).find('canvas').length) {
        return;
      }

      cornerstoneTools.stackPrefetch.disable(this);
    });
  }

  hasStack(element) {
    const stack = cornerstoneTools.getToolState(element, 'stack');
    return stack && stack.data.length && stack.data[0].imageIds.length > 1;
  }
  /**
   * This function enables stack prefetching for a specified element (viewport)
   * It first disables any prefetching currently occurring on any other viewports.
   *
   * @param element {node} DOM Node representing the viewport element
   */


  enablePrefetchOnElement(element) {
    if (!jquery(element).find('canvas').length) {
      return;
    } // Make sure there is a stack to fetch


    if (this.hasStack(element)) {
      // Check if this is a clip or not
      const activeViewportIndex = window.store.getState().viewports.activeViewport;
      const displaySetInstanceUid = ohif_core.OHIF.viewer.data.loadedSeriesData[activeViewportIndex].displaySetInstanceUid;
      const {
        StackManager
      } = ohif_core.OHIF.viewerbase;
      const stack = StackManager.findStack(displaySetInstanceUid);

      if (!stack) {
        throw new OHIFError(`Requested stack ${displaySetInstanceUid} was not created`);
      }

      cornerstoneTools.stackPrefetch.enable(element);
    }
  }

  attachActiveViewportListeners(activeViewportElement) {
    function newImageHandler() {
      // It needs to be called asynchronously because cornerstone does it at the same way.
      // All instance urls to be prefetched will be removed again if we add them before
      // Cornerstone callback (see stackPrefetch.onImageUpdated).
      StudyPrefetcher.prefetchDisplaySetsAsync();
    }

    if (this.lastActiveViewportElement) {
      this.lastActiveViewportElement.removeEventListener('cornerstonenewimage.StudyPrefetcher', newImageHandler);
    }

    activeViewportElement.removeEventListener('cornerstonenewimage.StudyPrefetcher', newImageHandler); // Cornerstone will not attach an event listener if the element doesn't have a stack

    if (this.hasStack(activeViewportElement)) {
      activeViewportElement.addEventListener('cornerstonenewimage.StudyPrefetcher', newImageHandler);
    }

    this.lastActiveViewportElement = activeViewportElement;
  }

  prefetchDisplaySetsAsync(timeout) {
    timeout = timeout || this.prefetchDisplaySetsTimeout;
    clearTimeout(this.prefetchDisplaySetsHandler);
    this.prefetchDisplaySetsHandler = setTimeout(() => {
      this.prefetchDisplaySets();
    }, timeout);
  }

  prefetchDisplaySets() {
    let config;

    if (meteor.Meteor.settings && meteor.Meteor.settings.public && meteor.Meteor.settings.prefetch) {
      config = meteor.Meteor.settings.public.prefetch;
    } else {
      config = {
        order: 'closest',
        displaySetCount: 1
      };
    }

    const displaySetsToPrefetch = this.getDisplaySetsToPrefetch(config);
    const imageIds = this.getImageIdsFromDisplaySets(displaySetsToPrefetch);
    this.prefetchImageIds(imageIds);
  }

  prefetchImageIds(imageIds) {
    const nonCachedImageIds = this.filterCachedImageIds(imageIds);
    const requestPoolManager = cornerstoneTools.requestPoolManager;
    const requestType = 'prefetch';
    const preventCache = false;

    const noop = () => {};

    nonCachedImageIds.forEach(imageId => {
      requestPoolManager.addRequest({}, imageId, requestType, preventCache, noop, noop);
    });
    requestPoolManager.startGrabbing();
  }

  getActiveViewportImage() {
    const element = ohif_core.OHIF.viewerbase.viewportUtils.getActiveViewportElement();

    if (!element) {
      return;
    }

    const enabledElement = cornerstone.getEnabledElement(element);
    const image = enabledElement.image;
    return image;
  }

  getStudy(image) {
    const studyMetadata = cornerstone.metaData.get('study', image.imageId);
    return ohif_core.OHIF.viewer.Studies.find(study => study.studyInstanceUid === studyMetadata.studyInstanceUid);
  }

  getSeries(study, image) {
    const seriesMetadata = cornerstone.metaData.get('series', image.imageId);
    const studyMetadata = ohif_core.OHIF.viewerbase.getStudyMetadata(study);
    return studyMetadata.getSeriesByUID(seriesMetadata.seriesInstanceUid);
  }

  getInstance(series, image) {
    const instanceMetadata = cornerstone.metaData.get('instance', image.imageId);
    return series.getInstanceByUID(instanceMetadata.sopInstanceUid);
  }

  getActiveDisplaySet(displaySets, instance) {
    return underscore.find(displaySets, displaySet => {
      return underscore.some(displaySet.images, displaySetImage => {
        return displaySetImage.sopInstanceUid === instance.sopInstanceUid;
      });
    });
  }

  getDisplaySetsToPrefetch(config) {
    const image = this.getActiveViewportImage();

    if (!image || !config || !config.displaySetCount) {
      return [];
    }

    const study = this.getStudy(image);
    const series = this.getSeries(study, image);
    const instance = this.getInstance(series, image);
    const displaySets = study.displaySets;
    const activeDisplaySet = this.getActiveDisplaySet(displaySets, instance);
    const prefetchMethodMap = {
      topdown: 'getFirstDisplaySets',
      downward: 'getNextDisplaySets',
      closest: 'getClosestDisplaySets'
    };
    const prefetchOrder = config.order;
    const methodName = prefetchMethodMap[prefetchOrder];
    const getDisplaySets = this[methodName];

    if (!getDisplaySets) {
      if (prefetchOrder) {
        ohif_core.OHIF.log.warn(`Invalid prefetch order configuration (${prefetchOrder})`);
      }

      return [];
    }

    return getDisplaySets.call(this, displaySets, activeDisplaySet, config.displaySetCount);
  }

  getFirstDisplaySets(displaySets, activeDisplaySet, displaySetCount) {
    const length = displaySets.length;
    const selectedDisplaySets = [];

    for (let i = 0; i < length && displaySetCount; i++) {
      const displaySet = displaySets[i];

      if (displaySet !== activeDisplaySet) {
        selectedDisplaySets.push(displaySet);
        displaySetCount--;
      }
    }

    return selectedDisplaySets;
  }

  getNextDisplaySets(displaySets, activeDisplaySet, displaySetCount) {
    const activeDisplaySetIndex = displaySets.indexOf(activeDisplaySet);
    const begin = activeDisplaySetIndex + 1;
    const end = Math.min(begin + displaySetCount, displaySets.length);
    return displaySets.slice(begin, end);
  }

  getClosestDisplaySets(displaySets, activeDisplaySet, displaySetCount) {
    const activeDisplaySetIndex = displaySets.indexOf(activeDisplaySet);
    const length = displaySets.length;
    const selectedDisplaySets = [];
    let left = activeDisplaySetIndex - 1;
    let right = activeDisplaySetIndex + 1;

    while ((left >= 0 || right < length) && displaySetCount) {
      if (left >= 0) {
        selectedDisplaySets.push(displaySets[left]);
        displaySetCount--;
        left--;
      }

      if (right < length && displaySetCount) {
        selectedDisplaySets.push(displaySets[right]);
        displaySetCount--;
        right++;
      }
    }

    return selectedDisplaySets;
  }

  getImageIdsFromDisplaySets(displaySets) {
    let imageIds = [];
    displaySets.forEach(displaySet => {
      imageIds = imageIds.concat(this.getImageIdsFromDisplaySet(displaySet));
    });
    return imageIds;
  }

  getImageIdsFromDisplaySet(displaySet) {
    /*displaySet.images.forEach(image => {
        const numFrames = image.numFrames;
        if (numFrames > 1) {
            for (let i = 0; i < numFrames; i++) {
                let imageId = getImageId(image, i);
                imageIds.push(imageId);
            }
        } else {
            let imageId = getImageId(image);
            imageIds.push(imageId);
        }
    });*/

    return []; //imageIds;
  }

  filterCachedImageIds(imageIds) {
    return underscore.filter(imageIds, imageId => {
      return !this.isImageCached(imageId);
    });
  }

  isImageCached(imageId) {
    const image = cornerstone.imageCache.imageCache[imageId];
    return image && image.sizeInBytes;
  }

  cacheFullHandler() {
    ohif_core.OHIF.log.warn('Cache full');
    this.stopPrefetching();
  }

}

// Manage resizing viewports triggered by window resize

class ResizeViewportManager {
  constructor() {
    this._resizeHandler = null;
  } // Reposition Study Series Quick Switch based whether side bars are opened or not


  repositionStudySeriesQuickSwitch() {
    ohif_core.OHIF.log.info('ResizeViewportManager repositionStudySeriesQuickSwitch'); // Stop here if viewer is not displayed

    const isViewer = session.Session.get('ViewerOpened');
    if (!isViewer) return; // Stop here if there is no one or only one viewport

    const nViewports = ohif_core.OHIF.viewer.layoutManager.viewportData.length;
    if (!nViewports || nViewports <= 1) return;
    const $viewer = jquery('#viewer');
    const leftSidebar = $viewer.find('.sidebar-left.sidebar-open');
    const rightSidebar = $viewer.find('.sidebar-right.sidebar-open');
    const $leftQuickSwitch = jquery('.quickSwitchWrapper.left');
    const $rightQuickSwitch = jquery('.quickSwitchWrapper.right');
    const hasLeftSidebar = leftSidebar.length > 0;
    const hasRightSidebar = rightSidebar.length > 0;
    $rightQuickSwitch.removeClass('left-sidebar-only');
    $leftQuickSwitch.removeClass('right-sidebar-only');
    let leftOffset = 0;

    if (hasLeftSidebar) {
      leftOffset = leftSidebar.width() / jquery(window).width() * 100;

      if (!hasRightSidebar) {
        $rightQuickSwitch.addClass('left-sidebar-only');
      }
    }

    if (hasRightSidebar && !hasLeftSidebar) {
      $leftQuickSwitch.addClass('right-sidebar-only');
    }

    const leftPosition = jquery('#imageViewerViewports').width() / nViewports / jquery(window).width() * 100 + leftOffset;
    const rightPosition = 100 - leftPosition;
    $leftQuickSwitch.css('right', rightPosition + '%');
    $rightQuickSwitch.css('left', leftPosition + '%');
  } // Relocate dialogs positions


  relocateDialogs() {
    ohif_core.OHIF.log.info('ResizeViewportManager relocateDialogs');
    const $bottomRightDialogs = jquery('#annotationDialog, #textMarkerOptionsDialog');
    $bottomRightDialogs.css({
      top: '',
      // This removes the CSS property completely
      left: '',
      bottom: 0,
      right: 0
    });
    const centerDialogs = jquery('.draggableDialog').not($bottomRightDialogs);
    centerDialogs.css({
      top: 0,
      left: 0,
      bottom: 0,
      right: 0
    });
  } // Resize viewport scrollbars


  resizeScrollbars(element) {
    ohif_core.OHIF.log.info('ResizeViewportManager resizeScrollbars');
    const $currentOverlay = jquery(element).siblings('.imageViewerViewportOverlay');
    $currentOverlay.find('.scrollbar').trigger('rescale');
  } // Resize a single viewport element


  resizeViewportElement(element, fitToWindow = true) {
    let enabledElement;

    try {
      enabledElement = cornerstone.getEnabledElement(element);
    } catch (error) {
      return;
    }

    cornerstone.resize(element, fitToWindow);
    /*if (enabledElement.fitToWindow === false) {
        const imageId = enabledElement.image.imageId;
        const instance = cornerstone.metaData.get('instance', imageId);
        const instanceClassViewport = getInstanceClassDefaultViewport(instance, enabledElement, imageId);
        cornerstone.setViewport(element, instanceClassViewport);
    }*/
  } // Resize each viewport element


  resizeViewportElements() {
    this.relocateDialogs();
    setTimeout(() => {
      this.repositionStudySeriesQuickSwitch();
      const elements = jquery('.imageViewerViewport').not('.empty');
      elements.each((index, element) => {
        this.resizeViewportElement(element);
        this.resizeScrollbars(element);
      });
    }, 1);
  } // Function to override resizeViewportElements function


  setResizeViewportElement(resizeViewportElements) {
    this.resizeViewportElements = resizeViewportElements;
  } // Avoid doing DOM manipulation during the resize handler
  // because it is fired very often.
  // Resizing is therefore performed 100 ms after the resize event stops.


  handleResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      ohif_core.OHIF.log.info('ResizeViewportManager resizeViewportElements');
      this.resizeViewportElements();
    }, 100);
  }
  /**
   * Returns a unique event handler function associated with a given instance using lazy assignment.
   * @return {function} Returns a unique copy of the event handler of this class.
   */


  getResizeHandler() {
    let resizeHandler = this._resizeHandler;

    if (resizeHandler === null) {
      resizeHandler = this.handleResize.bind(this);
      this._resizeHandler = resizeHandler;
    }

    return resizeHandler;
  }

}

class BaseLoadingListener {
  constructor(stack, options) {
    options = options || {};
    this.id = BaseLoadingListener.getNewId();
    this.stack = stack;
    this.startListening();
    this.statsItemsLimit = options.statsItemsLimit || 2;
    this.stats = {
      items: [],
      total: 0,
      elapsedTime: 0,
      speed: 0
    }; // Register the start point to make it possible to calculate
    // bytes/s or frames/s when the first byte or frame is received

    this._addStatsData(0); // Update the progress before starting the download
    // to make it possible to update the UI


    this._updateProgress();
  }

  _addStatsData(value) {
    const date = new Date();
    const stats = this.stats;
    const items = stats.items;
    const newItem = {
      value,
      date
    };
    items.push(newItem);
    stats.total += newItem.value; // Remove items until it gets below the limit

    while (items.length > this.statsItemsLimit) {
      const item = items.shift();
      stats.total -= item.value;
    } // Update the elapsedTime (seconds) based on first and last
    // elements and recalculate the speed (bytes/s or frames/s)


    if (items.length > 1) {
      const oldestItem = items[0];
      stats.elapsedTime = (newItem.date.getTime() - oldestItem.date.getTime()) / 1000;
      stats.speed = (stats.total - oldestItem.value) / stats.elapsedTime;
    }
  }

  _getProgressSessionId() {
    const displaySetInstanceUid = this.stack.displaySetInstanceUid;
    return 'StackProgress:' + displaySetInstanceUid;
  }

  _clearSession() {
    const progressSessionId = this._getProgressSessionId();

    session.Session.set(progressSessionId, undefined);
    delete session.Session.keys.progressSessionId;
  }

  startListening() {
    throw new Error('`startListening` must be implemented by child clases');
  }

  stopListening() {
    throw new Error('`stopListening` must be implemented by child clases');
  }

  destroy() {
    this.stopListening();

    this._clearSession();
  }

  static getNewId() {
    const timeSlice = new Date().getTime().toString().slice(-8);
    const randomNumber = parseInt(Math.random() * 1000000000);
    return timeSlice.toString() + randomNumber.toString();
  }

}

class DICOMFileLoadingListener extends BaseLoadingListener {
  constructor(stack) {
    super(stack);
    this._dataSetUrl = this._getDataSetUrl(stack);
    this._lastLoaded = 0; // Check how many instances has already been download (cached)

    this._checkCachedData();
  }

  _checkCachedData() {
    const dataSet = ohif_cornerstone.cornerstoneWADOImageLoader.wadouri.dataSetCacheManager.get(this._dataSetUrl);

    if (dataSet) {
      const dataSetLength = dataSet.byteArray.length;

      this._updateProgress({
        percentComplete: 100,
        loaded: dataSetLength,
        total: dataSetLength
      });
    }
  }

  _getImageLoadProgressEventName() {
    return 'cornerstoneimageloadprogress.' + this.id;
  }

  startListening() {
    const imageLoadProgressEventName = this._getImageLoadProgressEventName();

    const imageLoadProgressEventHandle = this._imageLoadProgressEventHandle.bind(this);

    this.stopListening();
    ohif_cornerstone.cornerstone.events.addEventListener(imageLoadProgressEventName, imageLoadProgressEventHandle);
  }

  stopListening() {
    const imageLoadProgressEventName = this._getImageLoadProgressEventName();

    ohif_cornerstone.cornerstone.events.removeEventListener(imageLoadProgressEventName);
  }

  _imageLoadProgressEventHandle(e) {
    const eventData = e.detail;

    const dataSetUrl = this._convertImageIdToDataSetUrl(eventData.imageId);

    const bytesDiff = eventData.loaded - this._lastLoaded;

    if (!this._dataSetUrl === dataSetUrl) {
      return;
    } // Add the bytes downloaded to the stats


    this._addStatsData(bytesDiff); // Update the download progress


    this._updateProgress(eventData); // Cache the last eventData.loaded value


    this._lastLoaded = eventData.loaded;
  }

  _updateProgress(eventData) {
    const progressSessionId = this._getProgressSessionId();

    eventData = eventData || {};
    session.Session.set(progressSessionId, {
      multiFrame: false,
      percentComplete: eventData.percentComplete,
      bytesLoaded: eventData.loaded,
      bytesTotal: eventData.total,
      bytesPerSecond: this.stats.speed
    });
  }

  _convertImageIdToDataSetUrl(imageId) {
    // Remove the prefix ("dicomweb:" or "wadouri:"")
    imageId = imageId.replace(/^(dicomweb:|wadouri:)/i, ''); // Remove "frame=999&" from the imageId

    imageId = imageId.replace(/frame=\d+&?/i, ''); // Remove the last "&" like in "http://...?foo=1&bar=2&"

    imageId = imageId.replace(/&$/, '');
    return imageId;
  }

  _getDataSetUrl(stack) {
    const imageId = stack.imageIds[0];
    return this._convertImageIdToDataSetUrl(imageId);
  }

}

class StackLoadingListener extends BaseLoadingListener {
  constructor(stack) {
    super(stack, {
      statsItemsLimit: 20
    });
    this.imageDataMap = this._convertImageIdsArrayToMap(stack.imageIds);
    this.framesStatus = this._createArray(stack.imageIds.length, false);
    this.loadedCount = 0; // Check how many instances has already been download (cached)

    this._checkCachedData();
  }

  _convertImageIdsArrayToMap(imageIds) {
    const imageIdsMap = new Map();

    for (let i = 0; i < imageIds.length; i++) {
      imageIdsMap.set(imageIds[i], {
        index: i,
        loaded: false
      });
    }

    return imageIdsMap;
  }

  _createArray(length, defaultValue) {
    // `new Array(length)` is an anti-pattern in javascript because its
    // funny API. Otherwise I would go for `new Array(length).fill(false)`
    const array = [];

    for (let i = 0; i < length; i++) {
      array[i] = defaultValue;
    }

    return array;
  }

  _checkCachedData() {// const imageIds = this.stack.imageIds;
    // TODO: No way to check status of Promise.

    /*for(let i = 0; i < imageIds.length; i++) {
        const imageId = imageIds[i];
         const imagePromise = cornerstone.imageCache.getImageLoadObject(imageId).promise;
         if (imagePromise && (imagePromise.state() === 'resolved')) {
            this._updateFrameStatus(imageId, true);
        }
    }*/
  }

  _getImageLoadedEventName() {
    return 'cornerstoneimageloaded.' + this.id;
  }

  _getImageCachePromiseRemoveEventName() {
    return 'cornerstoneimagecachepromiseremoved.' + this.id;
  }

  startListening() {
    const imageLoadedEventName = this._getImageLoadedEventName();

    const imageCachePromiseRemovedEventName = this._getImageCachePromiseRemoveEventName();

    const imageLoadedEventHandle = this._imageLoadedEventHandle.bind(this);

    const imageCachePromiseRemovedEventHandle = this._imageCachePromiseRemovedEventHandle.bind(this);

    this.stopListening();
    ohif_cornerstone.cornerstone.events.addEventListener(imageLoadedEventName, imageLoadedEventHandle);
    ohif_cornerstone.cornerstone.events.addEventListener(imageCachePromiseRemovedEventName, imageCachePromiseRemovedEventHandle);
  }

  stopListening() {
    const imageLoadedEventName = this._getImageLoadedEventName();

    const imageCachePromiseRemovedEventName = this._getImageCachePromiseRemoveEventName();

    ohif_cornerstone.cornerstone.events.removeEventListener(imageLoadedEventName);
    ohif_cornerstone.cornerstone.events.removeEventListener(imageCachePromiseRemovedEventName);
  }

  _updateFrameStatus(imageId, loaded) {
    const imageData = this.imageDataMap.get(imageId);

    if (!imageData || imageData.loaded === loaded) {
      return;
    } // Add one more frame to the stats


    if (loaded) {
      this._addStatsData(1);
    }

    imageData.loaded = loaded;
    this.framesStatus[imageData.index] = loaded;
    this.loadedCount += loaded ? 1 : -1;

    this._updateProgress();
  }

  _imageLoadedEventHandle(e) {
    this._updateFrameStatus(e.detail.image.imageId, true);
  }

  _imageCachePromiseRemovedEventHandle(e) {
    this._updateFrameStatus(e.detail.imageId, false);
  }

  _updateProgress() {
    const totalFramesCount = this.stack.imageIds.length;
    const loadedFramesCount = this.loadedCount;
    const loadingFramesCount = totalFramesCount - loadedFramesCount;
    const percentComplete = Math.round(loadedFramesCount / totalFramesCount * 100);

    const progressSessionId = this._getProgressSessionId();

    session.Session.set(progressSessionId, {
      multiFrame: true,
      totalFramesCount,
      loadedFramesCount,
      loadingFramesCount,
      percentComplete,
      framesPerSecond: this.stats.speed,
      framesStatus: this.framesStatus
    });
  }

  _logProgress() {
    const totalFramesCount = this.stack.imageIds.length;
    const displaySetInstanceUid = this.stack.displaySetInstanceUid;
    let progressBar = '[';

    for (let i = 0; i < totalFramesCount; i++) {
      const ch = this.framesStatus[i] ? '|' : '.';
      progressBar += `${ch}`;
    }

    progressBar += ']';
    ohif_core.OHIF.log.info(`${displaySetInstanceUid}: ${progressBar}`);
  }

}

/**
 * Constants
 */

const PROPERTY_SEPARATOR = '.';
const ORDER_ASC = 'asc';
const ORDER_DESC = 'desc';
const MIN_COUNT = 0x00000000;
const MAX_COUNT = 0x7FFFFFFF;
/**
 * Class Definition
 */

class TypeSafeCollection {
  constructor() {
    this._operationCount = new reactiveVar.ReactiveVar(MIN_COUNT);
    this._elementList = [];
    this._handlers = Object.create(null);
  }
  /**
   * Private Methods
   */


  _invalidate() {
    let count = this._operationCount.get();

    this._operationCount.set(count < MAX_COUNT ? count + 1 : MIN_COUNT);
  }

  _elements(silent) {
    silent === true || this._operationCount.get();
    return this._elementList;
  }

  _elementWithPayload(payload, silent) {
    return this._elements(silent).find(item => item.payload === payload);
  }

  _elementWithId(id, silent) {
    return this._elements(silent).find(item => item.id === id);
  }

  _trigger(event, data) {
    let handlers = this._handlers;

    if (event in handlers) {
      handlers = handlers[event];

      if (!(handlers instanceof Array)) {
        return;
      }

      for (let i = 0, limit = handlers.length; i < limit; ++i) {
        let handler = handlers[i];

        if (_isFunction(handler)) {
          handler.call(null, data);
        }
      }
    }
  }
  /**
   * Public Methods
   */


  onInsert(callback) {
    if (_isFunction(callback)) {
      let handlers = this._handlers.insert;

      if (!(handlers instanceof Array)) {
        handlers = [];
        this._handlers.insert = handlers;
      }

      handlers.push(callback);
    }
  }
  /**
   * Update the payload associated with the given ID to be the new supplied payload.
   * @param {string} id The ID of the entry that will be updated.
   * @param {any} payload The element that will replace the previous payload.
   * @returns {boolean} Returns true if the given ID is present in the collection, false otherwise.
   */


  updateById(id, payload) {
    let result = false,
        found = this._elementWithPayload(payload, true);

    if (found) {
      // nothing to do since the element is already in the collection...
      if (found.id === id) {
        // set result to true since the ids match...
        result = true;

        this._invalidate();
      }
    } else {
      found = this._elementWithId(id, true);

      if (found) {
        found.payload = payload;
        result = true;

        this._invalidate();
      }
    }

    return result;
  }
  /**
   * Signal that the given element has been changed by notifying reactive data-source observers.
   * This method is basically a means to invalidate the inernal reactive data-source.
   * @param {any} payload The element that has been altered.
   * @returns {boolean} Returns true if the element is present in the collection, false otherwise.
   */


  update(payload) {
    let result = false,
        found = this._elementWithPayload(payload, true);

    if (found) {
      // nothing to do since the element is already in the collection...
      result = true;

      this._invalidate();
    }

    return result;
  }
  /**
   * Insert an element in the collection. On success, the element ID (a unique string) is returned. On failure, returns null.
   * A failure scenario only happens when the given payload is already present in the collection. Note that NO exceptions are thrown!
   * @param {any} payload The element to be stored.
   * @returns {string} The ID of the inserted element or null if the element already exists...
   */


  insert(payload) {
    let id = null,
        found = this._elementWithPayload(payload, true);

    if (!found) {
      id = ohif_core.OHIF.utils.guid();

      this._elements(true).push({
        id,
        payload
      });

      this._invalidate();

      this._trigger('insert', {
        id,
        data: payload
      });
    }

    return id;
  }
  /**
   * Remove all elements from the collection.
   * @returns {void} No meaningful value is returned.
   */


  removeAll() {
    let all = this._elements(true),
        length = all.length;

    for (let i = length - 1; i >= 0; i--) {
      let item = all[i];
      delete item.id;
      delete item.payload;
      all[i] = null;
    }

    all.splice(0, length);

    this._invalidate();
  }
  /**
   * Remove elements from the collection that match the criteria given in the property map.
   * @param {Object} propertyMap A property map that will be macthed against all collection elements.
   * @returns {Array} A list with all removed elements.
   */


  remove(propertyMap) {
    let found = this.findAllEntriesBy(propertyMap),
        foundCount = found.length,
        removed = [];

    if (foundCount > 0) {
      const all = this._elements(true);

      for (let i = foundCount - 1; i >= 0; i--) {
        let item = found[i];
        all.splice(item[2], 1);
        removed.push(item[0]);
      }

      this._invalidate();
    }

    return removed;
  }
  /**
   * Provides the ID of the given element inside the collection.
   * @param {any} payload The element being searched for.
   * @returns {string} The ID of the given element or undefined if the element is not present.
   */


  getElementId(payload) {
    let found = this._elementWithPayload(payload);

    return found && found.id;
  }
  /**
   * Provides the position of the given element in the internal list returning -1 if the element is not present.
   * @param {any} payload The element being searched for.
   * @returns {number} The position of the given element in the internal list. If the element is not present -1 is returned.
   */


  findById(id) {
    let found = this._elementWithId(id);

    return found && found.payload;
  }
  /**
   * Provides the position of the given element in the internal list returning -1 if the element is not present.
   * @param {any} payload The element being searched for.
   * @returns {number} The position of the given element in the internal list. If the element is not present -1 is returned.
   */


  indexOfElement(payload) {
    return this._elements().indexOf(this._elementWithPayload(payload, true));
  }
  /**
   * Provides the position of the element associated with the given ID in the internal list returning -1 if the element is not present.
   * @param {string} id The index of the element.
   * @returns {number} The position of the element associated with the given ID in the internal list. If the element is not present -1 is returned.
   */


  indexOfId(id) {
    return this._elements().indexOf(this._elementWithId(id, true));
  }
  /**
   * Provides a list-like approach to the collection returning an element by index.
   * @param {number} index The index of the element.
   * @returns {any} If out of bounds, undefined is returned. Otherwise the element in the given position is returned.
   */


  getElementByIndex(index) {
    let found = this._elements()[index >= 0 ? index : -1];

    return found && found.payload;
  }
  /**
   * Find an element by a criteria defined by the given callback function.
   * Attention!!! The reactive source will not be notified if no valid callback is supplied...
   * @param {function} callback A callback function which will define the search criteria. The callback
   * function will be passed the collection element, its ID and its index in this very order. The callback
   * shall return true when its criterea has been fulfilled.
   * @returns {any} The matched element or undefined if not match was found.
   */


  find(callback) {
    let found;

    if (_isFunction(callback)) {
      found = this._elements().find((item, index) => {
        return callback.call(this, item.payload, item.id, index);
      });
    }

    return found && found.payload;
  }
  /**
   * Find the first element that strictly matches the specified property map.
   * @param {Object} propertyMap A property map that will be macthed against all collection elements.
   * @param {Object} options A set of options. Currently only "options.sort" option is supported.
   * @param {Object.SortingSpecifier} options.sort An optional sorting specifier. If a sorting specifier is supplied
   * but is not valid, an exception will be thrown.
   * @returns {Any} The matched element or undefined if not match was found.
   */


  findBy(propertyMap, options) {
    let found;

    if (_isObject(options)) {
      // if the "options" argument is provided and is a valid object,
      // it must be applied to the dataset before search...
      const all = this.all(options);

      if (all.length > 0) {
        if (_isObject(propertyMap)) {
          found = all.find(item => _compareToPropertyMapStrict(propertyMap, item));
        } else {
          found = all[0]; // simply extract the first element...
        }
      }
    } else if (_isObject(propertyMap)) {
      found = this._elements().find(item => _compareToPropertyMapStrict(propertyMap, item.payload));

      if (found) {
        found = found.payload;
      }
    }

    return found;
  }
  /**
   * Find all elements that strictly match the specified property map.
   * Attention!!! The reactive source will not be notified if no valid property map is supplied...
   * @param {Object} propertyMap A property map that will be macthed against all collection elements.
   * @returns {Array} An array of entries of all elements that match the given criteria. Each set in
   * in the array has the following format: [ elementData, elementId, elementIndex ].
   */


  findAllEntriesBy(propertyMap) {
    const found = [];

    if (_isObject(propertyMap)) {
      this._elements().forEach((item, index) => {
        if (_compareToPropertyMapStrict(propertyMap, item.payload)) {
          // Match! Add it to the found list...
          found.push([item.payload, item.id, index]);
        }
      });
    }

    return found;
  }
  /**
   * Find all elements that match a specified property map.
   * Attention!!! The reactive source will not be notified if no valid property map is supplied...
   * @param {Object} propertyMap A property map that will be macthed against all collection elements.
   * @param {Object} options A set of options. Currently only "options.sort" option is supported.
   * @param {Object.SortingSpecifier} options.sort An optional sorting specifier. If a sorting specifier is supplied
   * but is not valid, an exception will be thrown.
   * @returns {Array} An array with all elements that match the given criteria and sorted in the specified sorting order.
   */


  findAllBy(propertyMap, options) {
    const found = this.findAllEntriesBy(propertyMap).map(item => item[0]); // Only payload is relevant...

    if (_isObject(options)) {
      if ('sort' in options) {
        _sortListBy(found, options.sort);
      }
    }

    return found;
  }
  /**
   * Executes the supplied callback function for each element of the collection.
   * Attention!!! The reactive source will not be notified if no valid property map is supplied...
   * @param {function} callback The callback function to be executed. The callback is passed the element,
   * its ID and its index in this very order.
   * @returns {void} Nothing is returned.
   */


  forEach(callback) {
    if (_isFunction(callback)) {
      this._elements().forEach((item, index) => {
        callback.call(this, item.payload, item.id, index);
      });
    }
  }
  /**
   * Count the number of elements currently in the collection.
   * @returns {number} The current number of elements in the collection.
   */


  count() {
    return this._elements().length;
  }
  /**
   * Returns a list with all elements of the collection optionally sorted by a sorting specifier criteria.
   * @param {Object} options A set of options. Currently only "options.sort" option is supported.
   * @param {Object.SortingSpecifier} options.sort An optional sorting specifier. If a sorting specifier is supplied
   * but is not valid, an exception will be thrown.
   * @returns {Array} An array with all elements stored in the collection.
   */


  all(options) {
    let list = this._elements().map(item => item.payload);

    if (_isObject(options)) {
      if ('sort' in options) {
        _sortListBy(list, options.sort);
      }
    }

    return list;
  }

}
/**
 * Utility Functions
 */

/**
 * Test if supplied argument is a valid object for current class purposes.
 * Atention! The underscore version of this function should not be used for performance reasons.
 */

function _isObject(subject) {
  return subject instanceof Object || typeof subject === 'object' && subject !== null;
}
/**
 * Test if supplied argument is a valid string for current class purposes.
 * Atention! The underscore version of this function should not be used for performance reasons.
 */


function _isString(subject) {
  return typeof subject === 'string';
}
/**
 * Test if supplied argument is a valid function for current class purposes.
 * Atention! The underscore version of this function should not be used for performance reasons.
 */


function _isFunction(subject) {
  return typeof subject === 'function';
}
/**
 * Shortcut for Object's prototype "hasOwnProperty" method.
 */


const _hasOwnProperty = Object.prototype.hasOwnProperty;
/**
 * Retrieve an object's property value by name. Composite property names (e.g., 'address.country.name') are accepted.
 * @param {Object} targetObject The object we want read the property from...
 * @param {String} propertyName The property to be read (e.g., 'address.street.name' or 'address.street.number'
 * to read object.address.street.name or object.address.street.number, respectively);
 * @returns {Any} Returns whatever the property holds or undefined if the property cannot be read or reached.
 */

function _getPropertyValue(targetObject, propertyName) {
  let propertyValue; // undefined (the default return value)

  if (_isObject(targetObject) && _isString(propertyName)) {
    const fragments = propertyName.split(PROPERTY_SEPARATOR);
    const fragmentCount = fragments.length;

    if (fragmentCount > 0) {
      const firstFragment = fragments[0];
      const remainingFragments = fragmentCount > 1 ? fragments.slice(1).join(PROPERTY_SEPARATOR) : null;
      propertyValue = targetObject[firstFragment];

      if (remainingFragments !== null) {
        propertyValue = _getPropertyValue(propertyValue, remainingFragments);
      }
    }
  }

  return propertyValue;
}
/**
 * Compare a property map with a target object using strict comparison.
 * @param {Object} propertyMap The property map whose properties will be used for comparison. Composite
 * property names (e.g., 'address.country.name') will be tested against the "resolved" properties from the target object.
 * @param {Object} targetObject The target object whose properties will be tested.
 * @returns {boolean} Returns true if the properties match, false otherwise.
 */


function _compareToPropertyMapStrict(propertyMap, targetObject) {
  let result = false; // "for in" loops do not thown exceptions for invalid data types...

  for (let propertyName in propertyMap) {
    if (_hasOwnProperty.call(propertyMap, propertyName)) {
      if (propertyMap[propertyName] !== _getPropertyValue(targetObject, propertyName)) {
        result = false;
        break;
      } else if (result !== true) {
        result = true;
      }
    }
  }

  return result;
}
/**
 * Checks if a sorting specifier is valid.
 * A valid sorting specifier consists of an array of arrays being each subarray a pair
 * in the format ["property name", "sorting order"].
 * The following exemple can be used to sort studies by "date"" and use "time" to break ties in descending order.
 * [ [ 'study.date', 'desc' ], [ 'study.time', 'desc' ] ]
 * @param {Array} specifiers The sorting specifier to be tested.
 * @returns {boolean} Returns true if the specifiers are valid, false otherwise.
 */


function _isValidSortingSpecifier(specifiers) {
  let result = true;

  if (specifiers instanceof Array && specifiers.length > 0) {
    for (let i = specifiers.length - 1; i >= 0; i--) {
      const item = specifiers[i];

      if (item instanceof Array) {
        const property = item[0];
        const order = item[1];

        if (_isString(property) && (order === ORDER_ASC || order === ORDER_DESC)) {
          continue;
        }
      }

      result = false;
      break;
    }
  }

  return result;
}
/**
 * Sorts an array based on sorting specifier options.
 * @param {Array} list The that needs to be sorted.
 * @param {Array} specifiers An array of specifiers. Please read isValidSortingSpecifier method definition for further details.
 * @returns {void} No value is returned. The array is sorted in place.
 */


function _sortListBy(list, specifiers) {
  if (list instanceof Array && _isValidSortingSpecifier(specifiers)) {
    const specifierCount = specifiers.length;
    list.sort(function _sortListByCallback(a, b) {
      // callback name for stack traces...
      let index = 0;

      while (index < specifierCount) {
        const specifier = specifiers[index];
        const property = specifier[0];
        const order = specifier[1] === ORDER_DESC ? -1 : 1;

        const aValue = _getPropertyValue(a, property);

        const bValue = _getPropertyValue(b, property); // @TODO: should we check for the types being compared, like:
        // ~~ if (typeof aValue !== typeof bValue) continue;
        // Not sure because dates, for example, can be correctly compared to numbers...


        if (aValue < bValue) {
          return order * -1;
        }

        if (aValue > bValue) {
          return order * 1;
        }

        if (++index >= specifierCount) {
          return 0;
        }
      }
    });
  } else {
    throw new Error('Invalid Arguments');
  }
}

/**
 * Abstract class to fetch study metadata.
 */

class StudyMetadataSource {
  /**
   * Get study metadata for a study with given study InstanceUID.
   * @param {String} studyInstanceUID Study InstanceUID.
   */
  getByInstanceUID(studyInstanceUID) {
    /**
     * Please override this method on a specialized class.
     */
    throw new OHIFError('StudyMetadataSource::getByInstanceUID is not overriden. Please, override it in a specialized class. See OHIFStudyMetadataSource for example');
  }
  /**
   * Load study info and study metadata for a given study into the viewer.
   * @param {StudySummary|StudyMetadata} study of StudySummary or StudyMetadata object.
   */


  loadStudy(study) {
    /**
     * Please override this method on a specialized class.
     */
    throw new OHIFError('StudyMetadataSource::loadStudy is not overriden. Please, override it in a specialized class. See OHIFStudyMetadataSource for example');
  }

}

const classes = {
  MetadataProvider,
  CommandsManager,
  HotkeysContext,
  HotkeysManager,
  ImageSet,
  StudyPrefetcher,
  ResizeViewportManager,
  StudyLoadingListener,
  StackLoadingListener,
  DICOMFileLoadingListener,
  StudyMetadata,
  SeriesMetadata,
  InstanceMetadata,
  //StudySummary,
  TypeSafeCollection,
  OHIFError,
  //StackImagePositionOffsetSynchronizer,
  StudyMetadataSource
};

function symbolObservablePonyfill(root) {
	var result;
	var Symbol = root.Symbol;

	if (typeof Symbol === 'function') {
		if (Symbol.observable) {
			result = Symbol.observable;
		} else {
			result = Symbol('observable');
			Symbol.observable = result;
		}
	} else {
		result = '@@observable';
	}

	return result;
}

/* global window */

var root;

if (typeof self !== 'undefined') {
  root = self;
} else if (typeof window !== 'undefined') {
  root = window;
} else if (typeof global !== 'undefined') {
  root = global;
} else if (typeof module !== 'undefined') {
  root = module;
} else {
  root = Function('return this')();
}

var result = symbolObservablePonyfill(root);

/**
 * These are private action types reserved by Redux.
 * For any unknown actions, you must return the current state.
 * If the current state is undefined, you must return the initial state.
 * Do not reference these action types directly in your code.
 */
var randomString = function randomString() {
  return Math.random().toString(36).substring(7).split('').join('.');
};

var ActionTypes = {
  INIT: "@@redux/INIT" + randomString(),
  REPLACE: "@@redux/REPLACE" + randomString(),
  PROBE_UNKNOWN_ACTION: function PROBE_UNKNOWN_ACTION() {
    return "@@redux/PROBE_UNKNOWN_ACTION" + randomString();
  }
};

/**
 * @param {any} obj The object to inspect.
 * @returns {boolean} True if the argument appears to be a plain object.
 */
function isPlainObject(obj) {
  if (typeof obj !== 'object' || obj === null) return false;
  var proto = obj;

  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }

  return Object.getPrototypeOf(obj) === proto;
}

/**
 * Prints a warning in the console if it exists.
 *
 * @param {String} message The warning message.
 * @returns {void}
 */
function warning(message) {
  /* eslint-disable no-console */
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(message);
  }
  /* eslint-enable no-console */


  try {
    // This error was thrown as a convenience so that if you enable
    // "break on all exceptions" in your console,
    // it would pause the execution at this line.
    throw new Error(message);
  } catch (e) {} // eslint-disable-line no-empty

}

function getUndefinedStateErrorMessage(key, action) {
  var actionType = action && action.type;
  var actionDescription = actionType && "action \"" + String(actionType) + "\"" || 'an action';
  return "Given " + actionDescription + ", reducer \"" + key + "\" returned undefined. " + "To ignore an action, you must explicitly return the previous state. " + "If you want this reducer to hold no value, you can return null instead of undefined.";
}

function getUnexpectedStateShapeWarningMessage(inputState, reducers, action, unexpectedKeyCache) {
  var reducerKeys = Object.keys(reducers);
  var argumentName = action && action.type === ActionTypes.INIT ? 'preloadedState argument passed to createStore' : 'previous state received by the reducer';

  if (reducerKeys.length === 0) {
    return 'Store does not have a valid reducer. Make sure the argument passed ' + 'to combineReducers is an object whose values are reducers.';
  }

  if (!isPlainObject(inputState)) {
    return "The " + argumentName + " has unexpected type of \"" + {}.toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] + "\". Expected argument to be an object with the following " + ("keys: \"" + reducerKeys.join('", "') + "\"");
  }

  var unexpectedKeys = Object.keys(inputState).filter(function (key) {
    return !reducers.hasOwnProperty(key) && !unexpectedKeyCache[key];
  });
  unexpectedKeys.forEach(function (key) {
    unexpectedKeyCache[key] = true;
  });
  if (action && action.type === ActionTypes.REPLACE) return;

  if (unexpectedKeys.length > 0) {
    return "Unexpected " + (unexpectedKeys.length > 1 ? 'keys' : 'key') + " " + ("\"" + unexpectedKeys.join('", "') + "\" found in " + argumentName + ". ") + "Expected to find one of the known reducer keys instead: " + ("\"" + reducerKeys.join('", "') + "\". Unexpected keys will be ignored.");
  }
}

function assertReducerShape(reducers) {
  Object.keys(reducers).forEach(function (key) {
    var reducer = reducers[key];
    var initialState = reducer(undefined, {
      type: ActionTypes.INIT
    });

    if (typeof initialState === 'undefined') {
      throw new Error("Reducer \"" + key + "\" returned undefined during initialization. " + "If the state passed to the reducer is undefined, you must " + "explicitly return the initial state. The initial state may " + "not be undefined. If you don't want to set a value for this reducer, " + "you can use null instead of undefined.");
    }

    if (typeof reducer(undefined, {
      type: ActionTypes.PROBE_UNKNOWN_ACTION()
    }) === 'undefined') {
      throw new Error("Reducer \"" + key + "\" returned undefined when probed with a random type. " + ("Don't try to handle " + ActionTypes.INIT + " or other actions in \"redux/*\" ") + "namespace. They are considered private. Instead, you must return the " + "current state for any unknown actions, unless it is undefined, " + "in which case you must return the initial state, regardless of the " + "action type. The initial state may not be undefined, but can be null.");
    }
  });
}
/**
 * Turns an object whose values are different reducer functions, into a single
 * reducer function. It will call every child reducer, and gather their results
 * into a single state object, whose keys correspond to the keys of the passed
 * reducer functions.
 *
 * @param {Object} reducers An object whose values correspond to different
 * reducer functions that need to be combined into one. One handy way to obtain
 * it is to use ES6 `import * as reducers` syntax. The reducers may never return
 * undefined for any action. Instead, they should return their initial state
 * if the state passed to them was undefined, and the current state for any
 * unrecognized action.
 *
 * @returns {Function} A reducer function that invokes every reducer inside the
 * passed object, and builds a state object with the same shape.
 */


function combineReducers(reducers) {
  var reducerKeys = Object.keys(reducers);
  var finalReducers = {};

  for (var i = 0; i < reducerKeys.length; i++) {
    var key = reducerKeys[i];

    if (process.env.NODE_ENV !== 'production') {
      if (typeof reducers[key] === 'undefined') {
        warning("No reducer provided for key \"" + key + "\"");
      }
    }

    if (typeof reducers[key] === 'function') {
      finalReducers[key] = reducers[key];
    }
  }

  var finalReducerKeys = Object.keys(finalReducers);
  var unexpectedKeyCache;

  if (process.env.NODE_ENV !== 'production') {
    unexpectedKeyCache = {};
  }

  var shapeAssertionError;

  try {
    assertReducerShape(finalReducers);
  } catch (e) {
    shapeAssertionError = e;
  }

  return function combination(state, action) {
    if (state === void 0) {
      state = {};
    }

    if (shapeAssertionError) {
      throw shapeAssertionError;
    }

    if (process.env.NODE_ENV !== 'production') {
      var warningMessage = getUnexpectedStateShapeWarningMessage(state, finalReducers, action, unexpectedKeyCache);

      if (warningMessage) {
        warning(warningMessage);
      }
    }

    var hasChanged = false;
    var nextState = {};

    for (var _i = 0; _i < finalReducerKeys.length; _i++) {
      var _key = finalReducerKeys[_i];
      var reducer = finalReducers[_key];
      var previousStateForKey = state[_key];
      var nextStateForKey = reducer(previousStateForKey, action);

      if (typeof nextStateForKey === 'undefined') {
        var errorMessage = getUndefinedStateErrorMessage(_key, action);
        throw new Error(errorMessage);
      }

      nextState[_key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }

    return hasChanged ? nextState : state;
  };
}

/*
 * This is a dummy function to check if the function name has been altered by minification.
 * If the function has been minified and NODE_ENV !== 'production', warn the user.
 */

function isCrushed() {}

if (process.env.NODE_ENV !== 'production' && typeof isCrushed.name === 'string' && isCrushed.name !== 'isCrushed') {
  warning('You are currently using minified code outside of NODE_ENV === "production". ' + 'This means that you are running a slower development build of Redux. ' + 'You can use loose-envify (https://github.com/zertosh/loose-envify) for browserify ' + 'or setting mode to production in webpack (https://webpack.js.org/concepts/mode/) ' + 'to ensure you have the correct code for your production build.');
}

const defaultButtons = [{
  command: 'Pan',
  type: 'tool',
  text: 'Pan',
  svgUrl: '/icons.svg#icon-tools-pan',
  active: false
}, {
  command: 'Zoom',
  type: 'tool',
  text: 'Zoom',
  svgUrl: '/icons.svg#icon-tools-zoom',
  active: false
}, {
  command: 'Bidirectional',
  type: 'tool',
  text: 'Bidirectional',
  svgUrl: '/icons.svg#icon-tools-measure-target',
  active: false
}, {
  command: 'StackScroll',
  type: 'tool',
  text: 'Stack Scroll',
  svgUrl: '/icons.svg#icon-tools-stack-scroll',
  active: false
}, {
  command: 'reset',
  type: 'command',
  text: 'Reset',
  svgUrl: '/icons.svg#icon-tools-reset',
  active: false
}, {
  command: 'Wwwc',
  type: 'tool',
  text: 'Manual',
  svgUrl: '/icons.svg#icon-tools-levels',
  active: true
}, {
  command: 'setWLPresetSoftTissue',
  type: 'command',
  text: 'Soft Tissue',
  svgUrl: '/icons.svg#icon-wl-soft-tissue',
  active: false
}, {
  command: 'setWLPresetLung',
  type: 'command',
  text: 'Lung',
  svgUrl: '/icons.svg#icon-wl-lung',
  active: false
}, {
  command: 'setWLPresetLiver',
  type: 'command',
  text: 'Liver',
  svgUrl: '/icons.svg#icon-wl-liver',
  active: false
}, {
  command: 'setWLPresetBrain',
  type: 'command',
  text: 'Brain',
  svgUrl: '/icons.svg#icon-wl-brain',
  active: false
}];

const tools = (state = {
  buttons: defaultButtons
}, action) => {
  switch (action.type) {
    case 'SET_TOOL_ACTIVE':
      const item = state.buttons.find(button => button.command === action.tool);
      let buttons = [];

      if (item.type === 'tool') {
        buttons = state.buttons.map(button => {
          if (button.command === action.tool) {
            button.active = true;
          } else if (button.type === 'tool') {
            button.active = false;
          }

          return button;
        });
      }

      return {
        buttons
      };

    default:
      return state;
  }
};

const defaultState = {
  activeViewportIndex: 0
};

const viewports = (state = defaultState, action) => {
  switch (action.type) {
    case 'SET_VIEWPORT_ACTIVE':
      return Object.assign({}, state, {
        activeViewportIndex: action.viewportIndex
      });

    default:
      return state;
  }
};

const combinedReducer = combineReducers({
  tools,
  viewports
});

const redux = {
  combinedReducer
};

const studies = {
  services: {
    QIDO,
    WADO
  }
};
const OHIF$1 = {
  utils,
  studies,
  redux,
  classes,
  metadata,
  hotkeys,
  header,
  cornerstone: cornerstone$1 //commands

};

exports.utils = utils;
exports.studies = studies;
exports.redux = redux;
exports.classes = classes;
exports.metadata = metadata;
exports.hotkeys = hotkeys;
exports.header = header;
exports.cornerstone = cornerstone$1;
exports.default = OHIF$1;
//# sourceMappingURL=index.js.map