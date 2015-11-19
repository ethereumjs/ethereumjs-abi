# ethereumjs-abi

Module implementing the [Ethereum ABI](https://github.com/ethereum/wiki/wiki/Ethereum-Contract-ABI) in Javascript. Can be used with RPC libraries for communication or with ethereumjs-vm to implement a fully fledged simulator.

## Usage

There are two methods of interest, ```rawEncode``` to encode a call (name plus arguments) and ```rawDecode``` to decode a response for a specific encoded query.

Example code:
```js
var ABI = require('ethereumjs-abi');
var abi = new ABI();

// returns the encoded binary (as a Buffer) data to be sent
var encoded = abi.rawEncode("balanceOf", [ "address" ], [ "0x0000000000000000000000000000000000000000" ]);

// returns the decoded array of arguments
// need to define the input argument list in order to select the proper function
var decoded = abi.rawDecode("balanceOf", [ "address" ], [ "uint256" ], data);
```

For preparing encoded blocks without the signature, use ```rawEncodeResponse```. This can be useful when interfacing with contracts as a data provider.


Planned for the future is supporting the JSON ABI definition:

```js
var ABI = require('ethereumjs-abi');
var abi = new ABI();

// need to have the ABI definition in JSON as per specification
var tokenAbi = [{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"success","type":"bool"}],"type":"function"},{"inputs":[],"type":"constructor"}];

var encoded = ABI.encode(tokenAbi, "balanceOf(uint256 address)", [ "0x0000000000000000000000000000000000000000" ]);

var decoded = ABI.decode(tokenAbi, "balanceOf(uint256 address)", data);
```


## Contributing

I am more than happy to receive improvements. Please send me a pull request or reach out on email or twitter.

There is a lot missing, grep for *FIXME* in the source code to find inspiration.

## License

    Copyright (C) 2015 Alex Beregszaszi

    Permission is hereby granted, free of charge, to any person obtaining a copy of
    this software and associated documentation files (the "Software"), to deal in
    the Software without restriction, including without limitation the rights to
    use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
    the Software, and to permit persons to whom the Software is furnished to do so,
    subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
    FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
    COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
    IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
    CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
