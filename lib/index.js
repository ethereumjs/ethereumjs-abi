require('es6-shim')
const utils = require('ethereumjs-util');
const BN = require('bn.js');
const Common = require('./common.js');
const utf8 = require('utf8');

ABI = function() {
  this.common = new Common();
}

// Limited to 53 bits (http://stackoverflow.com/questions/307179/what-is-javascripts-highest-integer-value-that-a-number-can-go-to-without-losin)
function bnToInteger(bn) {
  if (bn.bitLength() > 53)
    throw new Error("BN is too big for Number: " + bn.bitLength());
  return parseInt(bn.toString(), 10);
}

// Encode as 256bit two's complement
function toTwos(num) {
  if (num.isNeg())
    num = new BN('10000000000000000000000000000000000000000000000000000000000000000', 16).isub(num.iabs());
    // FIXME: the proper way would be if we have bitwise negation: num.iinv().iaddn(1)
  return num;
}

// Decode from 256bit two's complement
function fromTwos(num) {
  if (num.testn(255)) // top bit set => negative number
    num = new BN('10000000000000000000000000000000000000000000000000000000000000000', 16).isub(num).ineg();
    // FIXME: the proper way would be if we have bitwise negation: num.iinv().iaddn(1)
  return num;
}

// Parse N from type<N>
function parseTypeN(type) {
  return parseInt(/^\D+(\d+)$/.exec(type)[1]);
}

// Parse N,M from type<N>x<M>
function parseTypeNxM(type) {
  var tmp = /^\D+(\d+)x(\d+)$/.exec(type);
  return [ parseInt(tmp[1]), parseInt(tmp[2]) ];
}

// Parse N from type[<N>]
function parseTypeArray(type) {
  var tmp = /^\w+\[(\d*)\]$/.exec(type)[1];
  if (tmp.length === 0)
    return 0;
  else
    return parseInt(tmp);
}

// Encodes a single item (can be dynamic array)
// @returns: Buffer
function encodeSingle(type, arg) {
  if (type === "address") {
    return encodeSingle("uint160", arg);
  } else if (type === "bool") {
    return encodeSingle("uint8", arg ? 1 : 0);
  } else if (type === "string") {
    return encodeSingle("bytes", utf8.encode(arg));
  } else if (type.match(/\w+\[\d*\]/)) {
    // this part handles variable length ([]) and fixed-length arrays ([2])
    // NOTE: we catch here all calls to arrays, that simplifies the rest
    if (typeof(arg.length) === 'undefined')
      throw new Error("Not an array?");
    var size = parseTypeArray(type);
    if ((size != 0) && (arg.length > size))
      throw new Error("Elements exceed array size: " + size);
    var type = type.slice(0, type.indexOf('['));
    var ret = [ encodeSingle("uint256", arg.length) ];
    for (var i in arg)
      ret.push(encodeSingle(type, arg[i]));
    return Buffer.concat(ret);
  } else if (type === "bytes") {
    arg = new Buffer(arg);
    return Buffer.concat([ encodeSingle("uint256", arg.length), arg, utils.zeros(32 - (arg.length % 32)) ]);
  } else if (type.startsWith("bytes")) {
    var size = parseTypeN(type);
    if (size < 1 || size > 32)
      throw new Error("Invalid bytes<N> width: " + size);
    return utils.rpad(arg, 32);
  } else if (type.startsWith("uint")) {
    var size = parseTypeN(type);
    if ((size % 8) || (size < 8) || (size > 256))
      throw new Error("Invalid uint<N> width: " + size);
    var num = new BN(arg);
    if (num.bitLength() > size)
      throw new Error("Supplied uint exceeds width: " + size + " vs " + num.bitLength());
    return new Buffer(num.toArray('be', 32));
  } else if (type.startsWith("int")) {
    var size = parseTypeN(type);
    if ((size % 8) || (size < 8) || (size > 256))
      throw new Error("Invalid int<N> width: " + size);
    var num = new BN(arg);
    if (num.bitLength() > size)
      throw new Error("Supplied int exceeds width: " + size + " vs " + num.bitLength());
    return new Buffer(toTwos(num).toArray('be', 32));
  }
  // FIXME: support ureal<N>x<M> and real<N>x<M>

  throw new Error("Unsupported or invalid type: " + type);
}

// Decodes a single item (can be dynamic array)
// @returns: array
// FIXME: this method will need a lot of attention at checking limits and validation
function decodeSingle(type, arg) {
  if (type === "address") {
    return decodeSingle("uint160", arg);
  } else if (type === "bool") {
    return decodeSingle("uint8", arg).toString() === new BN(1).toString();
  } else if (type === "string") {
    return utf8.decode(decodeSingle("bytes", arg).toString());
  } else if (type.match(/\w+\[\d*\]/)) {
    // this part handles variable length ([]) and fixed-length arrays ([2])
    // NOTE: we catch here all calls to arrays, that simplifies the rest
    var size = parseTypeArray(type);
    var type = type.slice(0, type.indexOf('['));
    var count = bnToInteger(decodeSingle("uint256", arg.slice(0, 32)));
    if ((size != 0) && (count > size))
      throw new Error("Elements exceed array size: " + size);
    var ret = []
    for (var i = 1; i < count+1; i++)
      ret.push(decodeSingle(type, arg.slice(i*32)));
    return ret;
  } else if (type === "bytes") {
    var length = bnToInteger(decodeSingle("uint256", arg.slice(0, 32)));
    return arg.slice(32, 32 + length);
  } else if (type.startsWith("bytes")) {
    var size = parseTypeN(type);
    if (size < 1 || size > 32)
      throw new Error("Invalid bytes<N> width: " + size);
    // FIXME: return the appropriate size as specified
    return arg.slice(0, 32);
  } else if (type.startsWith("uint")) {
    var size = parseTypeN(type);
    if ((size % 8) || (size < 8) || (size > 256))
      throw new Error("Invalid uint<N> width: " + size);
    var num = new BN(arg.slice(0, 32), 16, 'be');
    if (num.bitLength() > size)
      throw new Error("Decoded int exceeds width: " + size + " vs " + num.bitLength());
    return num;
  } else if (type.startsWith("int")) {
    var size = parseTypeN(type);
    if ((size % 8) || (size < 8) || (size > 256))
      throw new Error("Invalid uint<N> width: " + size);
    var num = fromTwos(new BN(arg.slice(0, 32), 16, 'be'));
    if (num.bitLength() > size)
      throw new Error("Decoded uint exceeds width: " + size + " vs " + num.bitLength());
    return num;
  }
  // FIXME: support ureal<N>x<M> and real<N>x<M>

  throw new Error("Unsupported or invalid type: " + type);
}

// Is a type dynamic?
function isDynamic(type) {
  // FIXME: handle all types? I don't think anything is missing now
  return (type === "string") || (type === "bytes") || type.match(/\w+\[\d*\]/);
}

// Return length of the header part (in the head/tail method)
function calculateFixedLength(types) {
  // FIXME: is that correct?
  return 32 * types.length;
}

// Encode a method/event with arguments
// @types an array of string type names
// @args  an array of the appropriate values
ABI.prototype.rawEncode = function(name, types, args) {
  var output = new Buffer(0)
  var data   = new Buffer(0)

  function pushOutput(tmp) {
    output = Buffer.concat([ output, tmp ]);
  }

  function pushData(tmp) {
    data = Buffer.concat([ data, tmp ]);
  }

  if (name !== null)
    pushOutput(this.common.methodID(name, types));

  var headLength = calculateFixedLength(types);
  var tail = []

  for (var i in types) {
    var type = this.common.elementaryName(types[i]);
    var arg  = args[i];
    var cur = encodeSingle(type, arg);

    // Use the head/tail method for storing dynamic data
    if (isDynamic(type)) {
      pushOutput(encodeSingle("uint256", headLength + data.length));
      pushData(cur);
    } else {
      pushOutput(cur);
    }
  }

  pushOutput(data);
  return output;
}

ABI.prototype.rawEncodeResponse = function(types, args) {
  return this.rawEncode(null, types, args);
}

ABI.prototype.encode = function(abiDefinition, request, args) {
  throw new Error("Not implemented");
}

ABI.prototype.rawDecode = function(name, intypes, outtypes, data) {
  var ret = []

  var data = new Buffer(data);

  // Validate if signature matches
  if (name !== null) {
    if (this.common.methodID(name, intypes).toString('hex') !== data.slice(0, 4).toString('hex'))
      throw new Error("Invalid method signature");
    data = data.slice(4);
  }

  var offset = 0;
  for (var i in outtypes) {
    var type = this.common.elementaryName(outtypes[i]);
    var cur  = data.slice(offset, offset + 32);

    if (isDynamic(type)) {
      var dataOffset = bnToInteger(decodeSingle("uint256", cur));
      // We will read at least 32 bytes
      if (dataOffset > (data.length - 32))
        throw new Error("Invalid offset: " + dataOffset);
      var tmp = decodeSingle(type, data.slice(dataOffset));
      if (typeof(tmp) === Array)
        ret = ret.concat(tmp);
      else
        ret.push(tmp);
    } else {
      ret.push(decodeSingle(type, cur));
    }
    offset += 32;
  }

  return ret;
}

ABI.prototype.decode = function(abiDefinition, request, data) {
  throw new Error("Not implemented");
}

module.exports = ABI
