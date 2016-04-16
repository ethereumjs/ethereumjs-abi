const utils = require('ethereumjs-util')
const BN = require('bn.js')
const utf8 = require('utf8')

var ABI = function () {
}

// Convert from short to canonical names
// FIXME: optimise or make this nicer?
function elementaryName (name) {
  if (name.startsWith('int[')) {
    return 'int256' + name.slice(4)
  } else if (name === 'int') {
    return 'int256'
  } else if (name.startsWith('uint[')) {
    return 'uint256' + name.slice(4)
  } else if (name === 'uint') {
    return 'uint256'
  } else if (name.startsWith('real[')) {
    return 'real128x128' + name.slice(4)
  } else if (name === 'real') {
    return 'real128x128'
  } else if (name.startsWith('ureal[')) {
    return 'ureal128x128' + name.slice(4)
  } else if (name === 'ureal') {
    return 'ureal128x128'
  }
  return name
}

ABI.eventID = function (name, types) {
  // FIXME: use node.js util.format?
  var sig = name + '(' + types.map(elementaryName).join(',') + ')'
  return utils.sha3(new Buffer(sig))
}

ABI.methodID = function (name, types) {
  return ABI.eventID(name, types).slice(0, 4)
}

// Parse N from type<N>
function parseTypeN (type) {
  return parseInt(/^\D+(\d+)$/.exec(type)[1], 10)
}

// Parse N,M from type<N>x<M>
// function parseTypeNxM (type) {
//   var tmp = /^\D+(\d+)x(\d+)$/.exec(type)
//   return [ parseInt(tmp[1], 10), parseInt(tmp[2], 10) ]
// }

// Parse N from type[<N>]
function parseTypeArray (type) {
  var tmp = /^\w+\[(\d*)\]$/.exec(type)[1]
  if (tmp.length === 0) {
    return 0
  } else {
    return parseInt(tmp, 10)
  }
}

function parseNumber (arg) {
  var type = typeof arg
  if (type === 'string') {
    if (utils.isHexPrefixed(arg)) {
      return new BN(utils.stripHexPrefix(arg), 16)
    } else {
      return new BN(arg, 10)
    }
  } else if (type === 'number') {
    return new BN(arg)
  } else if (arg.toArray) {
    // assume this is a BN for the moment, replace with BN.isBN soon
    return arg
  } else {
    throw new Error('Argument is not a number')
  }
}

// Encodes a single item (can be dynamic array)
// @returns: Buffer
function encodeSingle (type, arg) {
  var size, num, ret, i

  if (type === 'address') {
    return encodeSingle('uint160', parseNumber(arg))
  } else if (type === 'bool') {
    return encodeSingle('uint8', arg ? 1 : 0)
  } else if (type === 'string') {
    return encodeSingle('bytes', utf8.encode(arg))
  } else if (type.match(/\w+\[\d+\]/)) {
    // this part handles fixed-length arrays ([2])
    // NOTE: we catch here all calls to arrays, that simplifies the rest
    if (typeof arg.length === 'undefined') {
      throw new Error('Not an array?')
    }

    size = parseTypeArray(type)
    if ((size !== 0) && (arg.length > size)) {
      throw new Error('Elements exceed array size: ' + size)
    }

    type = type.slice(0, type.indexOf('['))

    ret = []
    for (i in arg) {
      ret.push(encodeSingle(type, arg[i]))
    }

    return Buffer.concat(ret)
  } else if (type.match(/\w+\[\]/)) {
    // this part handles variable length ([])
    // NOTE: we catch here all calls to arrays, that simplifies the rest
    if (typeof arg.length === 'undefined') {
      throw new Error('Not an array?')
    }

    type = type.slice(0, type.indexOf('['))

    ret = [ encodeSingle('uint256', arg.length) ]
    for (i in arg) {
      ret.push(encodeSingle(type, arg[i]))
    }

    return Buffer.concat(ret)
  } else if (type === 'bytes') {
    arg = new Buffer(arg)
    return Buffer.concat([ encodeSingle('uint256', arg.length), arg, utils.zeros(32 - (arg.length % 32)) ])
  } else if (type.startsWith('bytes')) {
    size = parseTypeN(type)
    if (size < 1 || size > 32) {
      throw new Error('Invalid bytes<N> width: ' + size)
    }

    return utils.setLengthRight(arg, 32)
  } else if (type.startsWith('uint')) {
    size = parseTypeN(type)
    if ((size % 8) || (size < 8) || (size > 256)) {
      throw new Error('Invalid uint<N> width: ' + size)
    }

    num = parseNumber(arg)
    if (num.bitLength() > size) {
      throw new Error('Supplied uint exceeds width: ' + size + ' vs ' + num.bitLength())
    }

    return num.toBuffer('be', 32)
  } else if (type.startsWith('int')) {
    size = parseTypeN(type)
    if ((size % 8) || (size < 8) || (size > 256)) {
      throw new Error('Invalid int<N> width: ' + size)
    }

    num = parseNumber(arg)
    if (num.bitLength() > size) {
      throw new Error('Supplied int exceeds width: ' + size + ' vs ' + num.bitLength())
    }

    return num.toTwos(256).toBuffer('be', 32)
  }
  // FIXME: support ureal<N>x<M> and real<N>x<M>

  throw new Error('Unsupported or invalid type: ' + type)
}

// Decodes a single item (can be dynamic array)
// @returns: array
// FIXME: this method will need a lot of attention at checking limits and validation
function decodeSingle (type, arg) {
  var size, num, ret, i

  if (type === 'address') {
    return decodeSingle('uint160', arg)
  } else if (type === 'bool') {
    return decodeSingle('uint8', arg).toString() === new BN(1).toString()
  } else if (type === 'string') {
    return utf8.decode(decodeSingle('bytes', arg).toString())
  } else if (type.match(/\w+\[\d+\]/)) {
    // this part handles fixed-length arrays ([2])
    // NOTE: we catch here all calls to arrays, that simplifies the rest
    size = parseTypeArray(type)
    type = type.slice(0, type.indexOf('['))

    ret = []
    for (i = 0; i < size; i++) {
      ret.push(decodeSingle(type, arg.slice(i * 32)))
    }

    return ret
  } else if (type.match(/\w+\[\]/)) {
    // this part handles variable length ([])
    // NOTE: we catch here all calls to arrays, that simplifies the rest
    type = type.slice(0, type.indexOf('['))
    var count = decodeSingle('uint256', arg.slice(0, 32)).toNumber()

    ret = []
    for (i = 1; i < count + 1; i++) {
      ret.push(decodeSingle(type, arg.slice(i * 32)))
    }

    return ret
  } else if (type === 'bytes') {
    size = decodeSingle('uint256', arg.slice(0, 32)).toNumber()
    return arg.slice(32, 32 + size)
  } else if (type.startsWith('bytes')) {
    size = parseTypeN(type)
    if (size < 1 || size > 32) {
      throw new Error('Invalid bytes<N> width: ' + size)
    }

    return arg.slice(0, size)
  } else if (type.startsWith('uint')) {
    size = parseTypeN(type)
    if ((size % 8) || (size < 8) || (size > 256)) {
      throw new Error('Invalid uint<N> width: ' + size)
    }

    num = new BN(arg.slice(0, 32), 16, 'be')
    if (num.bitLength() > size) {
      throw new Error('Decoded int exceeds width: ' + size + ' vs ' + num.bitLength())
    }

    return num
  } else if (type.startsWith('int')) {
    size = parseTypeN(type)
    if ((size % 8) || (size < 8) || (size > 256)) {
      throw new Error('Invalid uint<N> width: ' + size)
    }

    num = new BN(arg.slice(0, 32), 16, 'be').fromTwos(256)
    if (num.bitLength() > size) {
      throw new Error('Decoded uint exceeds width: ' + size + ' vs ' + num.bitLength())
    }

    return num
  }
  // FIXME: support ureal<N>x<M> and real<N>x<M>

  throw new Error('Unsupported or invalid type: ' + type)
}

// Is a type dynamic?
function isDynamic (type) {
  // FIXME: handle all types? I don't think anything is missing now
  return (type === 'string') || (type === 'bytes') || type.match(/\w+\[\d*\]/)
}

// Encode a method/event with arguments
// @types an array of string type names
// @args  an array of the appropriate values
ABI.rawEncode = function (name, types, args) {
  var output = new Buffer(0)
  var data = new Buffer(0)

  function pushOutput (tmp) {
    output = Buffer.concat([ output, tmp ])
  }

  function pushData (tmp) {
    data = Buffer.concat([ data, tmp ])
  }

  if (name !== null) {
    pushOutput(ABI.methodID(name, types))
  }

  const headLength = 32 * types.length

  for (var i in types) {
    var type = elementaryName(types[i])
    var arg = args[i]
    var cur = encodeSingle(type, arg)

    // Use the head/tail method for storing dynamic data
    if (isDynamic(type)) {
      pushOutput(encodeSingle('uint256', headLength + data.length))
      pushData(cur)
    } else {
      pushOutput(cur)
    }
  }

  pushOutput(data)
  return output
}

ABI.rawEncodeResponse = function (types, args) {
  return ABI.rawEncode(null, types, args)
}

ABI.encode = function (abiDefinition, request, args) {
  throw new Error('Not implemented')
}

ABI.rawDecode = function (name, intypes, outtypes, data) {
  var ret = []

  data = new Buffer(data)

  // Validate if signature matches
  if (name !== null) {
    if (ABI.methodID(name, intypes).toString('hex') !== data.slice(0, 4).toString('hex')) {
      throw new Error('Invalid method signature')
    }
    data = data.slice(4)
  }

  var offset = 0
  for (var i in outtypes) {
    var type = elementaryName(outtypes[i])
    var cur = data.slice(offset, offset + 32)

    if (isDynamic(type)) {
      var dataOffset = decodeSingle('uint256', cur).toNumber()
      // We will read at least 32 bytes
      if (dataOffset > (data.length - 32)) {
        throw new Error('Invalid offset: ' + dataOffset)
      }

      var tmp = decodeSingle(type, data.slice(dataOffset))
      if (typeof tmp === Array) {
        ret = ret.concat(tmp)
      } else {
        ret.push(tmp)
      }
    } else {
      ret.push(decodeSingle(type, cur))
    }
    offset += 32
  }

  return ret
}

function stringify (type, value) {
  if (type.startsWith('address') || type.startsWith('bytes')) {
    return '0x' + value.toString('hex')
  } else {
    return value.toString()
  }
}

ABI.stringify = function (types, data) {
  var ret = []

  for (var i in types) {
    var type = types[i]
    var value = data[i]

    // if it is an array type, concat the items
    if (/^[^\[]+\[.*\]$/.test(type)) {
      value = value.map(function (item) {
        return stringify(type, item)
      }).join(', ')
    } else {
      value = stringify(type, value)
    }

    ret.push(value)
  }

  return ret
}

ABI.decode = function (abiDefinition, request, data) {
  throw new Error('Not implemented')
}

ABI.solidityPack = function (types, values) {
  if (types.length !== values.length) {
    throw new Error('Number of types are not matching the values')
  }

  var size, num
  var ret = []

  for (var i = 0; i < types.length; i++) {
    var type = elementaryName(types[i])
    var value = values[i]

    if (type === 'bytes') {
      ret.push(value)
    } else if (type === 'string') {
      ret.push(new Buffer(utf8.encode(value)))
    } else if (type === 'bool') {
      ret.push(new Buffer(value ? '01' : '00', 'hex'))
    } else if (type === 'address') {
      ret.push(utils.setLengthLeft(value, 20))
    } else if (type.startsWith('bytes')) {
      size = parseTypeN(type)
      if (size < 1 || size > 32) {
        throw new Error('Invalid bytes<N> width: ' + size)
      }

      return utils.setLengthRight(value, size)
    } else if (type.startsWith('uint')) {
      size = parseTypeN(type)
      if ((size % 8) || (size < 8) || (size > 256)) {
        throw new Error('Invalid uint<N> width: ' + size)
      }

      num = parseNumber(value)
      if (num.bitLength() > size) {
        throw new Error('Supplied uint exceeds width: ' + size + ' vs ' + num.bitLength())
      }

      ret.push(num.toBuffer('be', size / 8))
    } else if (type.startsWith('int')) {
      size = parseTypeN(type)
      if ((size % 8) || (size < 8) || (size > 256)) {
        throw new Error('Invalid int<N> width: ' + size)
      }

      num = parseNumber(value)
      if (num.bitLength() > size) {
        throw new Error('Supplied int exceeds width: ' + size + ' vs ' + num.bitLength())
      }

      ret.push(num.toTwos(size).toBuffer('be', size / 8))
    } else {
      // FIXME: support all other types
      throw new Error('Unsupported or invalid type: ' + type)
    }
  }

  return Buffer.concat(ret)
}

ABI.soliditySHA3 = function (types, values) {
  return utils.sha3(ABI.solidityPack(types, values))
}

ABI.soliditySHA256 = function (types, values) {
  return utils.sha256(ABI.solidityPack(types, values))
}

ABI.solidityRIPEMD160 = function (types, values) {
  return utils.ripemd160(ABI.solidityPack(types, values), true)
}

// Serpent's users are familiar with this encoding
// - s: string
// - b: bytes
// - b<N>: bytes<N>
// - i: int256
// - a: int256[]

function isNumeric (c) {
  // FIXME: is this correct? Seems to work
  return (c >= '0') && (c <= '9')
}

ABI.fromSerpent = function (sig) {
  var ret = []
  for (var i = 0; i < sig.length; i++) {
    var type = sig[i]
    if (type === 's' || type === 'b') {
      var tmp = 'bytes'
      var j = i + 1
      while ((j < sig.length) && isNumeric(sig[j])) {
        tmp += sig[j] - '0'
        j++
      }
      i = j - 1
      ret.push(tmp)
    } else if (type === 'i') {
      ret.push('int256')
    } else if (type === 'a') {
      ret.push('int256[]')
    } else {
      throw new Error('Unsupported or invalid type: ' + type)
    }
  }
  return ret
}

ABI.toSerpent = function (types) {
  var ret = []
  for (var i = 0; i < types.length; i++) {
    var type = types[i]
    if (type === 'bytes' || type === 'string') {
      ret.push('s')
    } else if (type.startsWith('bytes')) {
      ret.push('b' + parseTypeN(type))
    } else if (type === 'int256') {
      ret.push('i')
    } else if (type === 'int256[]') {
      ret.push('a')
    } else {
      throw new Error('Unsupported or invalid type: ' + type)
    }
  }
  return ret.join('')
}

module.exports = ABI
