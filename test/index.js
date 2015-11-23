var assert = require('assert')
var ABI = require('../index.js')
var abi = new ABI()
var BN = require('bn.js')

// Official test vectors from https://github.com/ethereum/wiki/wiki/Ethereum-Contract-ABI

describe('official test vector 1 (encoding)', function() {
  it('should equal', function() {
    var a = abi.rawEncode('baz', [ 'uint32', 'bool' ], [ 69, 1]).toString('hex')
    var b = 'cdcd77c000000000000000000000000000000000000000000000000000000000000000450000000000000000000000000000000000000000000000000000000000000001'
    assert.equal(a, b)
  })
})

describe('official test vector 2 (encoding)', function() {
  it('should equal', function() {
    var a = abi.rawEncode('bar', [ 'real128x128[2]' ], [ [ 2.125, 8.5 ] ]).toString('hex')
    var b = '3e27986000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000880000000000000000000000000000000'
    assert.equal(a, b)
  })
})


describe('official test vector 3 (encoding)', function() {
  it('should equal', function() {
    var a = abi.rawEncode('sam', [ 'bytes', 'bool', 'uint256[]' ], [ 'dave', true, [ 1, 2, 3 ] ]).toString('hex')
    var b = 'a5643bf20000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000464617665000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000003'
    assert.equal(a, b)
  })
})

describe('official test vector 4 (encoding)', function() {
  it('should equal', function() {
    var a = abi.rawEncode('f', [ 'uint', 'uint32[]', 'bytes10', 'bytes' ], [ 0x123, [ 0x456, 0x789 ], '1234567890', 'Hello, world!' ]).toString('hex')
    var b = '8be6524600000000000000000000000000000000000000000000000000000000000001230000000000000000000000000000000000000000000000000000000000000080313233343536373839300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000004560000000000000000000000000000000000000000000000000000000000000789000000000000000000000000000000000000000000000000000000000000000d48656c6c6f2c20776f726c642100000000000000000000000000000000000000'
    assert.equal(a, b)
  })
})


// Homebrew tests

describe('encoding negative int32', function() {
  it('should equal', function() {
    var a = abi.rawEncode('neg', [ 'int32' ], [ -2 ]).toString('hex')
    var b = 'ae4f88b1fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe'
    assert.equal(a, b)
  })
})

describe('encoding string >32bytes', function() {
  it('should equal', function() {
    var a = abi.rawEncode('test', [ 'string' ], [ ' hello world hello world hello world hello world  hello world hello world hello world hello world  hello world hello world hello world hello world hello world hello world hello world hello world' ]).toString('hex')
    var b = 'f9fbd554000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000c22068656c6c6f20776f726c642068656c6c6f20776f726c642068656c6c6f20776f726c642068656c6c6f20776f726c64202068656c6c6f20776f726c642068656c6c6f20776f726c642068656c6c6f20776f726c642068656c6c6f20776f726c64202068656c6c6f20776f726c642068656c6c6f20776f726c642068656c6c6f20776f726c642068656c6c6f20776f726c642068656c6c6f20776f726c642068656c6c6f20776f726c642068656c6c6f20776f726c642068656c6c6f20776f726c64000000000000000000000000000000000000000000000000000000000000'
    assert.equal(a, b)
  })
})

describe('encoding uint32 response', function() {
  it('should equal', function() {
    var a = abi.rawEncodeResponse([ 'uint32' ], [ 42 ]).toString('hex')
    var b = '000000000000000000000000000000000000000000000000000000000000002a'
    assert.equal(a, b)
  })
})

describe('encoding string response (unsupported)', function() {
  it('should equal', function() {
    var a = abi.rawEncodeResponse([ 'string' ], [ 'a response string (unsupported)' ]).toString('hex')
    var b = '0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001f6120726573706f6e736520737472696e672028756e737570706f727465642900';
    assert.equal(a, b)
  })
})


describe('encoding bytes33', function() {
  it('should fail', function() {
    assert.throws(function() {
      abi.rawEncode('fail', [ 'bytes33' ], [ '' ])
    }, Error)
  })
})

describe('encoding uint0', function() {
  it('should fail', function() {
    assert.throws(function() {
      abi.rawEncode('fail', [ 'uint0' ], [ 1 ])
    }, Error)
  })
})

describe('encoding uint257', function() {
  it('should fail', function() {
    assert.throws(function() {
      abi.rawEncode('fail', [ 'uint257' ], [ 1 ])
    }, Error)
  })
})

describe('encoding int0', function() {
  it('should fail', function() {
    assert.throws(function() {
      abi.rawEncode('fail', [ 'int0' ], [ 1 ])
    }, Error);
  })
})

describe('encoding int257', function() {
  it('should fail', function() {
    assert.throws(function() {
      abi.rawEncode('fail', [ 'int257' ], [ 1 ])
    }, Error)
  })
})

describe('encoding uint[2] with [1,2,3]', function() {
  it('should fail', function() {
    assert.throws(function() {
      abi.rawEncode('fail', [ 'uint[2]' ], [ [ 1, 2, 3 ] ])
    }, Error)
  })
})

// Homebrew decoding tests

describe('decoding uint32', function() {
  it('should equal', function() {
    var a = abi.rawDecode('neg', [ 'int32' ], [ 'uint32' ], new Buffer('ae4f88b1000000000000000000000000000000000000000000000000000000000000002a', 'hex'))
    var b = new BN(42)
    assert.equal(a.length, 1)
    assert.equal(a[0].toString(), b.toString())
  })
})

describe('decoding uint256[]', function() {
  it('should equal', function() {
    var a = abi.rawDecode('neg', [ 'int32' ], [ 'uint256[]' ], new Buffer('ae4f88b100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000003', 'hex'))
    var b = new BN(1)
    var c = new BN(2)
    var d = new BN(3)

    assert.equal(a.length, 1)
    assert.equal(a[0].length, 3)
    assert.equal(a[0][0].toString(), b.toString())
    assert.equal(a[0][1].toString(), c.toString())
    assert.equal(a[0][2].toString(), d.toString())
  })
})

describe('decoding bytes', function() {
  it('should equal', function() {
    var a = abi.rawDecode('neg', [ 'int32' ], [ 'bytes' ], new Buffer('ae4f88b10000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000b68656c6c6f20776f726c64000000000000000000000000000000000000000000', 'hex'))
    var b = new Buffer('68656c6c6f20776f726c64', 'hex')

    assert.equal(a.length, 1)
    assert.equal(a[0].toString(), b.toString())
  })
})

describe('decoding string', function() {
  it('should equal', function() {
    var a = abi.rawDecode('neg', [ 'int32' ], [ 'string' ], new Buffer('ae4f88b10000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000b68656c6c6f20776f726c64000000000000000000000000000000000000000000', 'hex'))
    var b = 'hello world'
    assert.equal(a.length, 1)
    assert.equal(a[0], b)
  })
})

describe('decoding int32', function() {
  it('should equal', function() {
    var a = abi.rawDecode('neg', [ 'int32' ], [ 'int32' ], new Buffer('ae4f88b1fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe', 'hex'))
    var b = new BN(-2);
    assert.equal(a.length, 1)
    assert.equal(a[0].toString(), b.toString());

    var a = abi.rawDecode('neg', [ 'int32' ], [ 'int64' ], new Buffer('ae4f88b1ffffffffffffffffffffffffffffffffffffffffffffffffffffb29c26f344fe', 'hex'))
    var b = new BN(-85091238591234)
    assert.equal(a.length, 1)
    assert.equal(a[0].toString(), b.toString())
  })
})

describe('decoding bool, uint32', function() {
  it('should equal', function() {
    var a = abi.rawDecode('neg', [ 'int32' ], [ 'bool', 'uint32' ], new Buffer('ae4f88b10000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002a', 'hex'))
    assert.equal(a.length, 2)
    assert.equal(a[0], true)
    assert.equal(a[1].toString(), new BN(42).toString())
  })
})

describe('decoding bool, uint256[]', function() {
  it('should equal', function() {
    var a = abi.rawDecode('neg', [ 'int32' ], [ 'bool', 'uint256[]' ], new Buffer('ae4f88b1000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002a', 'hex'))
    assert.equal(a.length, 2)
    assert.equal(a[0], true)
    assert.equal(a[1].length, 1)
    assert.equal(a[1][0].toString(), new BN(42).toString())
  })
})

describe('decoding uint256[], bool', function() {
  it('should equal', function() {
    var a = abi.rawDecode('neg', [ 'int32' ], [ 'uint256[]', 'bool' ], new Buffer('ae4f88b1000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002a', 'hex'))
    assert.equal(a.length, 2)
    assert.equal(a[1], true)
    assert.equal(a[0].length, 1)
    assert.equal(a[0][0].toString(), new BN(42).toString())
  })
})

describe('decoding uint[2] with [1,2,3]', function() {
  it('should fail', function() {
    assert.throws(function() {
      abi.rawDecode('fail', [ 'uint[3]' ], [ 'uint[2]' ], new Buffer('87dde33e00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000003', 'hex'))
    }, Error)
  })
})
