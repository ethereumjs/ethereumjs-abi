require('es6-shim')
var utils = require('ethereumjs-util');
const BN = utils.BN;
const Common = require('./common.js');
const utf8 = require('utf8');

// FIXME: remove this once ethereumjs-util has this feature
//        (there's a pull request in progress:
//         https://github.com/ethereum/ethereumjs-util/pull/8)
if (utils.rpad === undefined) {
  utils.rpad = function (msg, length) {
    msg = utils.toBuffer(msg)
    if (msg.length < length) {
      var buf = utils.zeros(length)
      msg.copy(buf)
      return buf
    }
    return msg.slice(-length)
  }
}

ABI = function() {
  this.common = new Common();
}

// FIXME: bn.js should make the 'negative' field public
//        see https://github.com/indutny/bn.js/issues/70
function bnIsNegative(bn) {
//  return bn.toString().startsWith('-');
//  return BN.min(bn, new BN(0)) === bn;
  return bn.abs() !== bn;
}

// FIXME: this might not be the best idea
function bnToInteger(bn) {
  if (bn.bitLength() > 64)
    throw new Error("BN is too big for Number: " + bn.bitLength());
  return parseInt(bn.toString());
}

// Parse N from type<N>
function parseTypeN(type) {
  return /^\D+(\d+)$/.exec(type)[1];
}

// Parse N,M from type<N>x<M>
function parseTypeNxM(type) {
  var tmp = /^\D+(\d+)x(\d+)$/.exec(type);
  return [ tmp[1], tmp[2] ];
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
    // FIXME: check if the items exceed the fixed-length array size
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
    // FIXME: check for proper types, N%8
    return utils.pad(new BN(arg), 32);
  } else if (type.startsWith("int")) {
    // FIXME: check for proper types, N%8
    var num = new BN(arg);
    // Option 1:
    if (bnIsNegative(num))
      num = new BN('10000000000000000000000000000000000000000000000000000000000000000', 16).isub(num.iabs());
    return utils.pad(num, 32);
    // Option 2:
    //return utils.pad(num, 32, bnIsNegative(num) ? 0xff : 0x00);
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
    // FIXME: check if the items exceed the fixed-length array size
    var type = type.slice(0, type.indexOf('['));
    var count = bnToInteger(decodeSingle("uint256", arg.slice(0, 32)));
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
    // FIXME: check for proper types, N%8
    return new BN(arg.slice(0, 32), 16);
  } else if (type.startsWith("int")) {
    // FIXME: check for proper types, N%8
    var num = new BN(arg.slice(0, 32), 16);

    if (num.testn(255)) { // top bit set => negative number
      num = new BN('10000000000000000000000000000000000000000000000000000000000000000', 16).isub(num).neg();
      // FIXME: the proper way would be if we have bitwise negation:
      //num.iinv();
      //num.iaddn(1);
    }

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

  for (var i in outtypes) {
    var type = this.common.elementaryName(outtypes[i]);

    if (isDynamic(type)) {
      var offset = bnToInteger(decodeSingle("uint256", data.slice(0, 32)));
      // We will read at least 32 bytes
      if (offset > (data.length - 32))
        throw new Error("Invalid offset: " + offset);
      var tmp = decodeSingle(type, data.slice(offset));
      if (typeof(tmp) === Array)
        ret = ret.concat(tmp);
      else
        ret.push(tmp);
    } else {
      ret.push(decodeSingle(type, data.slice(0, 32)));
      data = data.slice(32);
    }
  }

  return ret;
}

ABI.prototype.decode = function(abiDefinition, request, data) {
  throw new Error("Not implemented");
}

module.exports = ABI
